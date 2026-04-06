/**
 * Segment-based page navigation with forward/back transitions and route resolution.
 *
 * Path is a slash-separated segment string: "home/menu/settings" means 3 stacked pages.
 * activePage is the last segment (top of the stack).
 *
 * routeAttrs stored separately so attrs-only changes do NOT invalidate resolveRoutes computed.
 *
 * Step-wise navigation and route registration are extracted into:
 *   - use-navigation-step-wise.ts  (stepWisePush, stepWiseBack)
 *   - use-route-registry.ts        (registerRoute, registerRoutes, asyncLoaders)
 */
import {
  computed,
  reactive,
  shallowReactive,
  type AsyncComponentLoader,
  type ComputedRef
} from 'vue';

import { STEP_DELAY } from '../core/constants';
import type { MicroRoute, PageTrackerHooks } from '../core/types';
import {
  buildPathFromSegments,
  getLastSegment,
  normalizePath,
  parsePathSegments,
  warmLoaderCache
} from '../utils/path-utils';
import { createTimerManager } from '../utils/timer-manager';
import { executeAfterHooks, executeGuardPipeline, type GuardConfig } from './use-navigation-guards';
import { createNavigationHistory, type NavigationHistory, type NavigationHistoryConfig } from './use-navigation-history';
import { createRouteRegistry } from './use-route-registry';
import { createStepWiseNavigation } from './use-navigation-step-wise';

interface NavigationConfig {
  defaultPath: string;
  stepDelay?: number;
  guards?: GuardConfig;
  history?: NavigationHistoryConfig;
}

export interface NavigationState {
  activePath: ComputedRef<string>;
  fromPath: ComputedRef<string>;
  toPath: ComputedRef<string>;
  activePage: ComputedRef<string>;
  fromPage: ComputedRef<string>;
  toPage: ComputedRef<string>;
  resolveRoutes: ComputedRef<MicroRoute[]>;
  push: (
    destination: string | number,
    props?: Record<string, unknown>
  ) => Promise<void>;
  stepWisePush: (
    targetPath: string,
    props?: Record<string, unknown>
  ) => Promise<void>;
  stepWiseBack: (steps: number) => Promise<void>;
  registerRoute: (route: MicroRoute) => void;
  registerRoutes: (routes: MicroRoute[]) => void;
  updateRouteAttrs: (segment: string, attrs: Record<string, unknown>) => void;
  getRouteAttrs: (segment: string) => Record<string, unknown> | undefined;
  /** Navigation history (only populated when config.history.enabled) */
  history?: NavigationHistory;
  cleanup: () => void;
}

export function useNavigation(
  config: NavigationConfig,
  tracker?: Required<PageTrackerHooks>
): NavigationState {
  const defaultPath = config.defaultPath;
  const stepDelay = config.stepDelay ?? STEP_DELAY;
  const guardConfig = config.guards ?? {};
  const historyConfig = config.history ?? {};
  const timers = createTimerManager();
  const registry = createRouteRegistry();

  let isNavigating = false;

  const state = reactive({
    activePath: defaultPath,
    fromPath: defaultPath,
    toPath: defaultPath,
    /** Attrs stored separately — changes here do NOT invalidate resolveRoutes computed */
    routeAttrs: shallowReactive(new Map<string, Record<string, unknown>>()),
    /** Version stamp per segment — incremented on re-navigation to same segment (forces transition) */
    routeKeys: shallowReactive(new Map<string, number>()),
    /** Component key per segment — incremented to force Vue full remount (resets local state) */
    componentKeys: shallowReactive(new Map<string, number>())
  });

  /**
   * Cache for resolved route objects — avoids creating new object references
   * when only attrs change (attrs are stored separately and not in resolveRoutes).
   * Only replaces cached entry when key or componentKey actually changes.
   */
  const resolvedCache = new Map<string, MicroRoute>();

  const resolveRoutes = computed<MicroRoute[]>(() => {
    const activeSegments = parsePathSegments(state.activePath);
    const result: MicroRoute[] = [];

    for (const segment of activeSegments) {
      const route = registry.routes.get(segment);
      if (!route) continue;
      const version = state.routeKeys.get(segment) || 0;
      const componentKey = state.componentKeys.get(segment) || 0;
      const key = `${route.path}-${version}`;

      const cached = resolvedCache.get(segment);
      if (cached && cached.key === key && cached.componentKey === componentKey) {
        result.push(cached);
      } else {
        const resolved = { ...route, key, componentKey };
        resolvedCache.set(segment, resolved);
        result.push(resolved);
      }
    }

    // Clean stale cache entries for segments no longer in the active path
    for (const cachedSegment of resolvedCache.keys()) {
      if (!activeSegments.includes(cachedSegment)) {
        resolvedCache.delete(cachedSegment);
      }
    }

    return result;
  });

  // ── Internal navigation ───────────────────────────────────────────────────

  function navigateBack(steps: number, props?: Record<string, unknown>) {
    const segments = parsePathSegments(state.activePath);
    const safeSteps = Math.min(steps, segments.length - 1);
    if (safeSteps <= 0) return;
    const targetSegments = segments.slice(0, -safeSteps);
    const targetPath = buildPathFromSegments(targetSegments);

    // Clear attrs on removed segments
    segments.slice(-safeSteps).forEach((segment) => {
      state.routeAttrs.delete(segment);
    });

    // Apply props to target segment (the page we're going back to)
    const newTopSegment = targetSegments.at(-1);
    if (newTopSegment) {
      if (props) {
        const existing = state.routeAttrs.get(newTopSegment);
        state.routeAttrs.set(newTopSegment, { ...existing, ...props });
      }
      // Only force remount when props are passed
      if (props) {
        state.componentKeys.set(
          newTopSegment,
          (state.componentKeys.get(newTopSegment) || 0) + 1
        );
      }
    }

    const prevPath = state.activePath;
    tracker?.trackPageLeave?.(prevPath, prevPath, targetPath);
    state.fromPath = prevPath;
    state.toPath = targetPath;
    state.activePath = targetPath;
    tracker?.trackPageEnter?.(targetPath, prevPath, targetPath);
  }

  async function navigateToPath(path: string, props?: Record<string, unknown>) {
    const normalized = normalizePath(path);

    // Warm module cache for async loaders before transitioning
    const targetSegments = parsePathSegments(normalized);
    await Promise.all(
      targetSegments
        .map((segment) => registry.asyncLoaders.get(segment))
        .filter((loader): loader is AsyncComponentLoader => !!loader)
        .map((loader) => warmLoaderCache(loader))
    );

    const prevPath = state.activePath;
    if (prevPath !== normalized) {
      tracker?.trackPageLeave?.(prevPath, prevPath, normalized);
    }
    state.fromPath = prevPath;
    state.toPath = normalized;
    state.activePath = normalized;
    if (props) updateRouteProps(normalized, props);
    tracker?.trackPageEnter?.(normalized, prevPath, normalized);
  }

  function updateRouteProps(path: string, props: Record<string, unknown>) {
    const lastSegment = parsePathSegments(path).at(-1);
    if (!lastSegment) return;
    const existing = state.routeAttrs.get(lastSegment);
    state.routeAttrs.set(lastSegment, { ...existing, ...props });
  }

  function updateRouteAttrs(segment: string, attrs: Record<string, unknown>) {
    const existing = state.routeAttrs.get(segment);
    state.routeAttrs.set(segment, { ...existing, ...attrs });
  }

  function getRouteAttrs(segment: string): Record<string, unknown> | undefined {
    return state.routeAttrs.get(segment);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Core push logic — no guard, used internally by stepWise* */
  async function pushCore(
    destination: string | number,
    props?: Record<string, unknown>
  ) {
    if (!destination && destination !== 0) return;

    // Back navigation
    if (typeof destination === 'number' && destination < 0) {
      navigateBack(Math.abs(destination), props);
      return;
    }

    const dest = destination.toString();

    // Absolute path
    if (dest.startsWith('/')) {
      const segments = parsePathSegments(dest);
      const lastSegment = segments.at(-1);
      const currentSegments = parsePathSegments(state.activePath);
      if (lastSegment && currentSegments.includes(lastSegment)) {
        state.routeKeys.set(
          lastSegment,
          (state.routeKeys.get(lastSegment) || 0) + 1
        );
      }
      await navigateToPath(dest, props);
      return;
    }

    // Relative — check if segment exists in current path (pop to it)
    const currentSegments = parsePathSegments(state.activePath);
    const existingIndex = currentSegments.indexOf(dest);
    if (existingIndex !== -1) {
      state.routeKeys.set(dest, (state.routeKeys.get(dest) || 0) + 1);
      const targetPath = buildPathFromSegments(
        currentSegments.slice(0, existingIndex + 1)
      );
      await navigateToPath(targetPath, props);
      return;
    }

    // Relative — append
    const newPath = buildPathFromSegments([...currentSegments, dest]);
    await navigateToPath(newPath, props);
  }

  /**
   * Resolve the target path that a destination would produce, WITHOUT mutating state.
   * Used to evaluate guards before committing navigation.
   */
  function resolveDestinationPath(destination: string | number): string {
    if (typeof destination === 'number' && destination < 0) {
      const segments = parsePathSegments(state.activePath);
      const safeSteps = Math.min(Math.abs(destination), segments.length - 1);
      return safeSteps <= 0
        ? state.activePath
        : buildPathFromSegments(segments.slice(0, -safeSteps));
    }
    const dest = destination.toString();
    if (dest.startsWith('/')) return normalizePath(dest);
    const currentSegments = parsePathSegments(state.activePath);
    const existingIndex = currentSegments.indexOf(dest);
    if (existingIndex !== -1) {
      return buildPathFromSegments(currentSegments.slice(0, existingIndex + 1));
    }
    return buildPathFromSegments([...currentSegments, dest]);
  }

  const guardContext = { getRoute: (segment: string) => registry.routes.get(segment) };

  /** Public push — runs navigation guards, then executes pushCore */
  async function push(
    destination: string | number,
    props?: Record<string, unknown>
  ) {
    if (isNavigating) return;
    isNavigating = true;
    try {
      // Run guard pipeline before any state mutation
      const hasGlobalGuards = (guardConfig.beforeEach?.length ?? 0) > 0;
      // Per-route guards are checked inside executeGuardPipeline — only enter pipeline if there's reason to
      const hasPerRouteGuards = registry.routes.size > 0;
      if ((hasGlobalGuards || hasPerRouteGuards) && destination) {
        const targetPath = resolveDestinationPath(destination);
        const fromPath = normalizePath(state.activePath);
        const allowed = await executeGuardPipeline(targetPath, fromPath, guardConfig, guardContext);
        if (!allowed) {
          isNavigating = false;
          return;
        }
      }

      const fromPath = normalizePath(state.activePath);
      await pushCore(destination, props);
      const toPath = normalizePath(state.activePath);

      // Record history entry after successful navigation
      navHistory?.record(toPath, props);

      // Fire afterEach hooks (non-blocking)
      executeAfterHooks(toPath, fromPath, guardConfig.afterEach);

      timers.schedule(() => {
        isNavigating = false;
      }, stepDelay);
    } catch (e) {
      isNavigating = false;
      throw e;
    }
  }

  // ── Step-wise navigation (delegated) ──────────────────────────────────────

  // ── History tracking (opt-in) ──────────────────────────────────────────────

  const navHistory = historyConfig.enabled
    ? createNavigationHistory(historyConfig, async (path) => {
        // History navigation runs guards (auth state may have changed since recording)
        const fromPath = normalizePath(state.activePath);
        const hasGlobalGuards = (guardConfig.beforeEach?.length ?? 0) > 0;
        if (hasGlobalGuards || registry.routes.size > 0) {
          const allowed = await executeGuardPipeline(path, fromPath, guardConfig, guardContext);
          if (!allowed) return;
        }
        await pushCore(path);
      })
    : undefined;

  // Record initial path if history is enabled
  if (navHistory) navHistory.record(normalizePath(defaultPath));

  // ── Step-wise navigation (delegated) ──────────────────────────────────────

  const stepWise = createStepWiseNavigation({
    getActivePath: () => state.activePath,
    pushCore,
    runGuards: (to, from) => executeGuardPipeline(to, from, guardConfig, guardContext),
    scheduleUnlock: () => timers.schedule(() => { isNavigating = false; }, stepDelay),
    lock: () => { isNavigating = true; },
    unlock: () => { isNavigating = false; },
    isLocked: () => isNavigating,
    stepDelay
  });

  return {
    activePath: computed(() => state.activePath),
    fromPath: computed(() => state.fromPath),
    toPath: computed(() => state.toPath),
    activePage: computed(() => getLastSegment(state.activePath)),
    fromPage: computed(() => getLastSegment(state.fromPath)),
    toPage: computed(() => getLastSegment(state.toPath)),
    resolveRoutes,
    push,
    stepWisePush: stepWise.stepWisePush,
    stepWiseBack: stepWise.stepWiseBack,
    registerRoute: registry.registerRoute,
    registerRoutes: registry.registerRoutes,
    updateRouteAttrs,
    getRouteAttrs,
    history: navHistory,
    cleanup: timers.cleanup
  };
}
