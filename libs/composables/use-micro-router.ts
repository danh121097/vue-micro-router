/**
 * Composes all micro-router managers into a single store and wires cross-concern watchers.
 *
 * Two exported functions:
 *   - useGlobalMicroRouter → creates + provides the store; call ONCE in the root MicroRouterView
 *   - useMicroRouter       → injects the store; call anywhere inside the MicroRouterView tree
 *
 * Cross-concern watchers:
 *   - navigation.activePage → controls gui tracking
 *   - navigation.activePath → audio (when audio sub-path is used)
 */
import {
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  watch
} from 'vue';

import { MICRO_ROUTER_KEY, MICRO_ROUTER_ROOT_KEY, createRouterKey } from '../core/constants';
import type { MicroRouterConfig, MicroRouterStore } from '../core/types';
import type { RouteMap, TypedPush } from '../core/type-helpers';
import { getLastSegment } from '../utils/path-utils';
import { useControlManager } from './use-control-manager';
import { setupDevtoolsPlugin, emitDevtoolsEvent, refreshDevtoolsInspector } from '../devtools/devtools-plugin';
import { serializeState, restoreState } from './use-state-serializer';
import { useDialogManager } from './use-dialog-manager';
import { useNavigation } from './use-navigation';
import { usePageTracker } from './use-page-tracker';

/**
 * Create and provide the MicroRouter store.
 * Call once in the root MicroRouterView component.
 */
export function useGlobalMicroRouter(
  config: MicroRouterConfig
): MicroRouterStore {
  const tracker = usePageTracker(config.tracker);
  const navigation = useNavigation(
    {
      defaultPath: config.defaultPath,
      stepDelay: config.stepDelay,
      guards: config.guards,
      history: config.history
    },
    tracker
  );
  const dialogs = useDialogManager(tracker);
  const controls = useControlManager(
    {
      defaultControlName: config.defaultControlName,
      onboardingControlName: config.onboardingControlName
    },
    tracker
  );

  const store: MicroRouterStore = {
    // Navigation
    activePath: navigation.activePath,
    fromPath: navigation.fromPath,
    toPath: navigation.toPath,
    activePage: navigation.activePage,
    fromPage: navigation.fromPage,
    toPage: navigation.toPage,
    resolveRoutes: navigation.resolveRoutes,
    push: navigation.push,
    stepWisePush: navigation.stepWisePush,
    stepWiseBack: navigation.stepWiseBack,
    registerRoute: navigation.registerRoute,
    registerRoutes: navigation.registerRoutes,
    updateRouteAttrs: navigation.updateRouteAttrs,
    getRouteAttrs: navigation.getRouteAttrs,
    preloadRoute: navigation.preloadRoute,

    // History (conditional — only if enabled)
    ...(navigation.history ? {
      canGoBack: navigation.history.canGoBack,
      canGoForward: navigation.history.canGoForward,
      historyBack: navigation.history.back,
      historyForward: navigation.history.forward,
      historyGo: navigation.history.go,
    } : {}),

    // Dialogs
    activeDialog: dialogs.activeDialog,
    fromDialog: dialogs.fromDialog,
    toDialog: dialogs.toDialog,
    resolveDialogs: dialogs.resolveDialogs,
    openDialog: dialogs.openDialog,
    closeDialog: dialogs.closeDialog,
    closeAllDialogs: dialogs.closeAllDialogs,
    registerDialog: dialogs.registerDialog,
    registerDialogs: dialogs.registerDialogs,
    getDialogAttrs: dialogs.getDialogAttrs,
    updateDialogAttrs: dialogs.updateDialogAttrs,

    // Controls
    resolveControls: controls.resolveControls,
    activeControl: controls.activeControl,
    currentControl: controls.currentControl,
    toggleControl: controls.toggleControl,
    registerControl: controls.registerControl,
    registerControls: controls.registerControls,
    getControlAttrs: controls.getControlAttrs,
    updateControlAttrs: controls.updateControlAttrs,

    // Serialization
    serialize: () => serializeState(store),
    restore: (state) => restoreState(store, state)
  };

  // Cross-concern: navigation → controls (gui leave/enter on page change)
  const defaultPage = getLastSegment(config.defaultPath);

  watch(navigation.activePage, (page, oldPage) => {
    if (!oldPage) return;
    const active = controls.currentControl.value;
    if (oldPage === defaultPage && page !== defaultPage) {
      tracker.trackGuiLeave(active);
    }
    if (page === defaultPage && oldPage !== defaultPage) {
      tracker.trackGuiEnter(active);
    }
    // Devtools: emit navigation event and refresh inspector
    emitDevtoolsEvent('navigate', { from: oldPage, to: page });
    refreshDevtoolsInspector();
  });

  // Lifecycle
  onMounted(async () => {
    await nextTick();
    controls.toggleControl(config.defaultControlName, true);
    tracker.trackPageEnter(
      navigation.activePath.value,
      undefined,
      navigation.activePath.value
    );
    // Initialize devtools (no-ops in production or when @vue/devtools-api not installed)
    setupDevtoolsPlugin(store);
  });

  onBeforeUnmount(() => {
    tracker.cleanupAllSessions();
    navigation.cleanup();
    dialogs.cleanup();
    controls.cleanup();
  });

  provide(MICRO_ROUTER_KEY, store);
  // Also provide as root — first MicroRouterView in the tree is the root
  const existingRoot = inject(MICRO_ROUTER_ROOT_KEY, null);
  if (!existingRoot) {
    provide(MICRO_ROUTER_ROOT_KEY, store);
  }
  return store;
}

/** Typed store — replaces push() with type-safe overloads when a RouteMap generic is provided */
export type TypedMicroRouterStore<T extends RouteMap> = Omit<MicroRouterStore, 'push'> & {
  push: TypedPush<T>;
};

/**
 * Inject the MicroRouter store from a parent MicroRouterView.
 * Must be called within the MicroRouterView component tree.
 *
 * @example Untyped (default)
 * ```ts
 * const router = useMicroRouter();
 * router.push('page', { any: 'props' });
 * ```
 *
 * @example Typed (opt-in)
 * ```ts
 * interface AppRoutes { home: undefined; profile: { userId: number } }
 * const router = useMicroRouter<AppRoutes>();
 * router.push('profile', { userId: 42 }); // OK
 * router.push('typo');                     // TS error
 * ```
 */
export interface UseMicroRouterOptions {
  /** If true, injects the root (outermost) router instead of the nearest parent */
  root?: boolean;
}

export function useMicroRouter(options?: UseMicroRouterOptions): MicroRouterStore;
export function useMicroRouter<T extends RouteMap>(options?: UseMicroRouterOptions): TypedMicroRouterStore<T>;
export function useMicroRouter(options?: UseMicroRouterOptions): MicroRouterStore {
  const key = options?.root ? MICRO_ROUTER_ROOT_KEY : MICRO_ROUTER_KEY;
  const store = inject(key);
  if (!store) {
    throw new Error(
      options?.root
        ? '[vue-micro-router] useMicroRouter({ root: true }) failed — no root <MicroRouterView> found.'
        : '[vue-micro-router] useMicroRouter() must be called inside <MicroRouterView>. ' +
          'Did you forget to wrap your app with <MicroRouterView>?'
    );
  }
  return store as any;
}
