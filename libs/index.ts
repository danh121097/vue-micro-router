/**
 * vue-micro-router — Segment-based micro router for Vue 3.
 *
 * Three entry points:
 *   - `vue-micro-router`        → core composables, components, types
 *   - `vue-micro-router/audio`  → optional audio manager (requires howler)
 *   - `vue-micro-router/styles` → CSS transitions and dialog styles
 *
 * @example
 * ```vue
 * <script setup>
 * import { MicroRouterView } from 'vue-micro-router';
 * import 'vue-micro-router/styles';
 * </script>
 * <template>
 *   <MicroRouterView :config="{ defaultPath: 'home' }" />
 * </template>
 * ```
 */

// ── Types ──
export type {
  DialogInstance,
  DialogPosition,
  DialogProps,
  FeaturePlugin,
  FeaturePluginConfig,
  MicroControl,
  MicroDialog,
  MicroRoute,
  MicroRouterConfig,
  MicroRouterStore,
  NavigationAfterHook,
  NavigationGuard,
  PageTrackerHooks,
  SerializedState,
  TransitionType
} from './core/types';

export type {
  RouteMap,
  RoutesWithProps,
  RoutesWithoutProps,
  TypedPush,
  ExtractRoutePaths,
  ExtractDialogPaths,
  ExtractControlNames,
  PluginTypedPush,
  PluginTypedOpenDialog,
  PluginTypedCloseDialog,
  PluginTypedToggleControl,
  Register,
  RouteAttrsMap,
  DialogAttrsMap,
  ControlAttrsMap,
  RegisteredPlugin,
  RegisteredRouteAttrs,
  RegisteredDialogAttrs,
  RegisteredControlAttrs,
  ResolvedMicroRouterStore
} from './core/type-helpers';

// ── Constants ──
export {
  createRouterKey,
  MICRO_ATTRS_READ_KEY,
  MICRO_ATTRS_WRITE_KEY,
  MICRO_CONTROL_NAME_KEY,
  MICRO_DIALOG_PATH_KEY,
  MICRO_ROUTE_PATH_KEY,
  MICRO_ROUTER_KEY,
  MICRO_ROUTER_ROOT_KEY,
  STEP_DELAY
} from './core/constants';

// ── Composables ──
export {
  useGlobalMicroRouter,
  useMicroRouter
} from './composables/use-micro-router';
export type { TypedMicroRouterStore, PluginTypedMicroRouterStore } from './composables/use-micro-router';
export { useMicroState } from './composables/use-micro-state';
export { useRouteLifecycle } from './composables/navigation/use-route-lifecycle';
export type { RouteLifecycleHooks } from './composables/navigation/use-route-lifecycle';
export { useDialogLifecycle } from './composables/dialog/use-dialog-lifecycle';
export type { DialogLifecycleHooks } from './composables/dialog/use-dialog-lifecycle';
export { useControlLifecycle } from './composables/control/use-control-lifecycle';
export type { ControlLifecycleHooks } from './composables/control/use-control-lifecycle';
export { usePageTracker } from './composables/use-page-tracker';
export { useNavigation } from './composables/navigation/use-navigation';
export type { NavigationState } from './composables/navigation/use-navigation';
export { useGestureNavigation } from './composables/navigation/use-gesture-navigation';
export type { GestureConfig } from './composables/navigation/use-gesture-navigation';
export { useDialogManager } from './composables/dialog/use-dialog-manager';
export type { DialogManagerState } from './composables/dialog/use-dialog-manager';
export { useControlManager } from './composables/control/use-control-manager';
export type { ControlManagerState } from './composables/control/use-control-manager';

// ── Components ──
export { default as MicroRouterView } from './components/MicroRouterView.vue';
export { default as RoutePage } from './components/RoutePage.vue';
export { default as MicroDialogComponent } from './components/MicroDialog.vue';
export { default as MicroControlWrapper } from './components/MicroControlWrapper.vue';

// ── Plugins ──
export {
  defineFeaturePlugin,
  registerFeaturePlugins
} from './plugins/feature-plugin-manager';

// ── Utils ──
export {
  buildPathFromSegments,
  getLastSegment,
  isAsyncLoader,
  normalizePath,
  parsePathSegments,
  safeMarkRaw
} from './utils/path-utils';
