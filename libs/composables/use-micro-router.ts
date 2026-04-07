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

import { MICRO_ROUTER_KEY, MICRO_ROUTER_ROOT_KEY } from '../core/constants';
import type { MicroRouterConfig, MicroRouterStore } from '../core/types';
import { useAudioManager } from './use-audio-manager';
import type {
  RouteMap,
  TypedPush,
  ExtractRoutePaths,
  ExtractDialogPaths,
  ExtractControlNames,
  PluginTypedPush,
  PluginTypedStepWisePush,
  PluginTypedStepWiseBack,
  PluginTypedOpenDialog,
  PluginTypedCloseDialog,
  PluginTypedToggleControl,
  ResolvedMicroRouterStore,
  RegisteredRouteAttrs,
  RegisteredDialogAttrs,
  RegisteredControlAttrs
} from '../core/type-helpers';
import { getLastSegment } from '../utils/path-utils';
import { useControlManager } from './control/use-control-manager';
import {
  setupDevtoolsPlugin,
  emitDevtoolsEvent,
  refreshDevtoolsInspector
} from '../devtools/devtools-plugin';
import { serializeState, restoreState } from './use-state-serializer';
import { useDialogManager } from './dialog/use-dialog-manager';
import { useNavigation } from './navigation/use-navigation';
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

  // Audio (opt-in — only initialized when volumeRef is provided)
  const audio = config.volumeRef
    ? useAudioManager({
        volumeRef: config.volumeRef,
        defaultBgm: config.defaultBgm,
        urlResolver: config.audioUrlResolver,
      })
    : null;

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
    ...(navigation.history
      ? {
          canGoBack: navigation.history.canGoBack,
          canGoForward: navigation.history.canGoForward,
          historyBack: navigation.history.back,
          historyForward: navigation.history.forward,
          historyGo: navigation.history.go
        }
      : {}),

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
    restore: (state) => restoreState(store, state),

    // Audio (conditional — only if volumeRef provided in config)
    ...(audio
      ? {
          playSound: audio.playSound,
          stopSound: audio.stopSound,
          updateBackgroundMusic: audio.updateBackgroundMusic
        }
      : {})
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
    // Devtools: emit navigation event (dev-only — zero cost in production)
    if ((import.meta as any).env?.DEV) {
      emitDevtoolsEvent('navigate', { from: oldPage, to: page });
      refreshDevtoolsInspector();
    }
  });

  // Cross-concern: navigation → audio (BGM switches on path change)
  if (audio) {
    let audioStarted = false;

    watch(navigation.activePath, (path) => {
      void audio.updateBackgroundMusic(path, navigation.routes);
    });

    // Browser autoplay policy blocks audio before user gesture.
    // Start BGM on first user interaction, then remove listener.
    const startAudioOnInteraction = () => {
      if (audioStarted) return;
      audioStarted = true;
      void audio.updateBackgroundMusic(
        navigation.activePath.value,
        navigation.routes,
      );
      document.removeEventListener('click', startAudioOnInteraction);
      document.removeEventListener('touchstart', startAudioOnInteraction);
    };
    document.addEventListener('click', startAudioOnInteraction, { once: true });
    document.addEventListener('touchstart', startAudioOnInteraction, { once: true });
  }

  // Lifecycle
  onMounted(async () => {
    await nextTick();
    controls.toggleControl(config.defaultControlName, true);
    tracker.trackPageEnter(
      navigation.activePath.value,
      undefined,
      navigation.activePath.value
    );
    if (audio) addEventListener('visibilitychange', audio.handleVisibilityChange);
    // Initialize devtools (no-ops in production or when @vue/devtools-api not installed)
    setupDevtoolsPlugin(store);
  });

  onBeforeUnmount(() => {
    tracker.cleanupAllSessions();
    navigation.cleanup();
    dialogs.cleanup();
    controls.cleanup();
    if (audio) {
      removeEventListener('visibilitychange', audio.handleVisibilityChange);
      audio.cleanup();
    }
  });

  provide(MICRO_ROUTER_KEY, store);
  // Also provide as root — first MicroRouterView in the tree is the root
  const existingRoot = inject(MICRO_ROUTER_ROOT_KEY, null);
  if (!existingRoot) {
    provide(MICRO_ROUTER_ROOT_KEY, store);
  }
  return store;
}

/** Typed store from manual RouteMap — push() validates route names + props */
export type TypedMicroRouterStore<T extends RouteMap> = Omit<
  MicroRouterStore,
  'push'
> & {
  push: TypedPush<T>;
};

/**
 * Typed store from plugin(s) — push/openDialog/closeDialog/toggleControl all validate names.
 * Accepts single plugin or union of plugins: `typeof pluginA | typeof pluginB`
 */
export type PluginTypedMicroRouterStore<T> = Omit<
  MicroRouterStore,
  'push' | 'stepWisePush' | 'stepWiseBack' | 'openDialog' | 'closeDialog' | 'toggleControl'
> & {
  push: PluginTypedPush<ExtractRoutePaths<T>, RegisteredRouteAttrs>;
  stepWisePush: PluginTypedStepWisePush<ExtractRoutePaths<T>, RegisteredRouteAttrs>;
  stepWiseBack: PluginTypedStepWiseBack;
  openDialog: PluginTypedOpenDialog<ExtractDialogPaths<T>, RegisteredDialogAttrs>;
  closeDialog: PluginTypedCloseDialog<ExtractDialogPaths<T>>;
  toggleControl: PluginTypedToggleControl<ExtractControlNames<T>, RegisteredControlAttrs>;
};

export interface UseMicroRouterOptions {
  /** If true, injects the root (outermost) router instead of the nearest parent */
  root?: boolean;
}

/**
 * Inject the MicroRouter store from a parent MicroRouterView.
 *
 * @example Auto-typed via Register (recommended — declare once, typed everywhere)
 * ```ts
 * // env.d.ts — declare once
 * declare module 'vue-micro-router' {
 *   interface Register { plugin: typeof appPlugin }
 * }
 *
 * // Any component — no generic needed
 * const { push } = useMicroRouter();
 * push('shop');              // ✅ type-safe
 * push('unknown');           // ❌ compile error
 * ```
 *
 * @example Explicit generic (override or without Register)
 * ```ts
 * const store = useMicroRouter<typeof plugin>();
 * ```
 *
 * @example Manual RouteMap (for typed props)
 * ```ts
 * interface AppRoutes { home: undefined; profile: { userId: number } }
 * const store = useMicroRouter<AppRoutes>();
 * store.push('profile', { userId: 42 }); // OK
 * ```
 */
export function useMicroRouter(
  options?: UseMicroRouterOptions
): ResolvedMicroRouterStore;
export function useMicroRouter<T extends RouteMap>(
  options?: UseMicroRouterOptions
): TypedMicroRouterStore<T>;
export function useMicroRouter<T extends { name: string }>(
  options?: UseMicroRouterOptions
): PluginTypedMicroRouterStore<T>;
export function useMicroRouter(
  options?: UseMicroRouterOptions
): any {
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
  return store;
}
