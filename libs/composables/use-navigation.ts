/**
 * Segment-based page navigation with forward/back, step-wise transitions, and route registration.
 *
 * Path is a slash-separated segment string: "home/menu/settings" means 3 stacked pages.
 * activePage is the last segment (top of the stack).
 *
 * routeAttrs stored separately so attrs-only changes do NOT invalidate resolveRoutes computed.
 */
import {
  computed,
  defineAsyncComponent,
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
  isAsyncLoader,
  normalizePath,
  parsePathSegments,
  safeMarkRaw,
  warmLoaderCache
} from '../utils/path-utils';
import { createTimerManager, delay } from '../utils/timer-manager';

interface NavigationConfig {
  defaultPath: string;
  stepDelay?: number;
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
  cleanup: () => void;
}

export function useNavigation(
  config: NavigationConfig,
  tracker?: Required<PageTrackerHooks>
): NavigationState {
  const defaultPath = config.defaultPath;
  const stepDelay = config.stepDelay ?? STEP_DELAY;
  const asyncLoaders = new Map<string, AsyncComponentLoader>();
  const timers = createTimerManager();

  let isNavigating = false;

  const state = reactive({
    activePath: defaultPath,
    fromPath: defaultPath,
    toPath: defaultPath,
    /** Route definitions keyed by segment name */
    routes: shallowReactive(new Map<string, MicroRoute>()),
    /** Attrs stored separately — changes here do NOT invalidate resolveRoutes computed */
    routeAttrs: shallowReactive(new Map<string, Record<string, unknown>>()),
    /** Version stamp per segment — incremented on re-navigation to same segment (forces transition) */
    routeKeys: shallowReactive(new Map<string, number>()),
    /** Component key per segment — incremented to force Vue full remount (resets local state) */
    componentKeys: shallowReactive(new Map<string, number>())
  });

  const resolveRoutes = computed<MicroRoute[]>(() => {
    return parsePathSegments(state.activePath)
      .map((segment): MicroRoute | undefined => {
        const route = state.routes.get(segment);
        if (!route) return undefined;
        const version = state.routeKeys.get(segment) || 0;
        const componentKey = state.componentKeys.get(segment) || 0;
        return { ...route, key: `${route.path}-${version}`, componentKey };
      })
      .filter((r): r is MicroRoute => r !== undefined);
  });

  const safeTimeout = timers.schedule;

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
        .map((segment) => asyncLoaders.get(segment))
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

  /** Public push — guarded against spam clicks */
  async function push(
    destination: string | number,
    props?: Record<string, unknown>
  ) {
    if (isNavigating) return;
    isNavigating = true;
    try {
      await pushCore(destination, props);
      safeTimeout(() => {
        isNavigating = false;
      }, stepDelay);
    } catch (e) {
      isNavigating = false;
      throw e;
    }
  }

  async function stepWisePush(
    targetPath: string,
    props?: Record<string, unknown>
  ) {
    if (!targetPath || isNavigating) return;

    const normalized = normalizePath(targetPath);
    if (state.activePath === normalized) return;

    isNavigating = true;
    try {
      const currentSegments = parsePathSegments(state.activePath);
      const targetSegments = parsePathSegments(normalized);

      if (targetPath.startsWith('/')) {
        for (let i = 0; i < targetSegments.length; i++) {
          const intermediate = buildPathFromSegments(
            targetSegments.slice(0, i + 1)
          );
          if (state.activePath === intermediate) continue;
          const isLast = i === targetSegments.length - 1;
          await pushCore(intermediate, isLast ? props : undefined);
          if (!isLast) await delay(stepDelay);
        }
      } else {
        const toAdd = targetSegments.filter(
          (s) => !currentSegments.includes(s)
        );
        if (toAdd.length === 0) {
          await pushCore(targetPath, props);
          return;
        }
        for (let i = 0; i < toAdd.length; i++) {
          const isLast = i === toAdd.length - 1;
          await pushCore(toAdd[i]!, isLast ? props : undefined);
          if (!isLast) await delay(stepDelay);
        }
      }
      safeTimeout(() => {
        isNavigating = false;
      }, stepDelay);
    } catch (e) {
      isNavigating = false;
      throw e;
    }
  }

  async function stepWiseBack(steps: number) {
    if (steps < 1 || isNavigating) return;
    const stepsBack = Math.abs(steps) - 1;
    const currentSegments = parsePathSegments(state.activePath);
    if (stepsBack >= currentSegments.length) return;

    isNavigating = true;
    try {
      for (let i = 0; i < stepsBack; i++) {
        await pushCore(-1);
        if (i < stepsBack - 1) await delay(stepDelay);
      }
      safeTimeout(() => {
        isNavigating = false;
      }, stepDelay);
    } catch (e) {
      isNavigating = false;
      throw e;
    }
  }

  // ── Registration ──────────────────────────────────────────────────────────

  function registerRoute(route: MicroRoute) {
    if (state.routes.has(route.path)) {
      console.warn(`[vue-micro-router] Route "${route.path}" already registered. Overwriting.`);
    }

    let { component } = route;

    if (isAsyncLoader(component)) {
      asyncLoaders.set(route.path, component);
      component = defineAsyncComponent(component);
    }

    state.routes.set(route.path, {
      ...route,
      component: safeMarkRaw(component)
    });
  }

  function registerRoutes(routes: MicroRoute[]) {
    routes.forEach(registerRoute);
  }

  return {
    activePath: computed(() => state.activePath),
    fromPath: computed(() => state.fromPath),
    toPath: computed(() => state.toPath),
    activePage: computed(() => getLastSegment(state.activePath)),
    fromPage: computed(() => getLastSegment(state.fromPath)),
    toPage: computed(() => getLastSegment(state.toPath)),
    resolveRoutes,
    push,
    stepWisePush,
    stepWiseBack,
    registerRoute,
    registerRoutes,
    updateRouteAttrs,
    getRouteAttrs,
    cleanup: timers.cleanup
  };
}
