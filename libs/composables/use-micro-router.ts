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

import { MICRO_ROUTER_KEY } from '../core/constants';
import type { MicroRouterConfig, MicroRouterStore } from '../core/types';
import { getLastSegment } from '../utils/path-utils';
import { useControlManager } from './use-control-manager';
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
      guards: config.guards
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
    updateControlAttrs: controls.updateControlAttrs
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
  });

  onBeforeUnmount(() => {
    tracker.cleanupAllSessions();
    navigation.cleanup();
    dialogs.cleanup();
    controls.cleanup();
  });

  provide(MICRO_ROUTER_KEY, store);
  return store;
}

/**
 * Inject the MicroRouter store from a parent MicroRouterView.
 * Must be called within the MicroRouterView component tree.
 */
export function useMicroRouter(): MicroRouterStore {
  const store = inject(MICRO_ROUTER_KEY);
  if (!store) {
    throw new Error(
      '[vue-micro-router] useMicroRouter() must be called inside <MicroRouterView>. ' +
        'Did you forget to wrap your app with <MicroRouterView>?'
    );
  }
  return store;
}
