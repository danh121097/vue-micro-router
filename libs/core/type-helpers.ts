/**
 * Type-level helpers for opt-in type safety across routes, dialogs, and controls.
 *
 * Two usage patterns:
 *
 * 1. Infer from plugin (recommended — zero duplication):
 *    ```ts
 *    const plugin = defineFeaturePlugin({ ... } as const);
 *    const store = useMicroRouter<typeof plugin>();
 *    ```
 *
 * 2. Manual route map (when you need typed props):
 *    ```ts
 *    interface AppRoutes { home: undefined; profile: { userId: number } }
 *    const store = useMicroRouter<AppRoutes>();
 *    ```
 */
// ── Route Map (manual approach) ──────────────────────────────────────────────

/** Route map: keys are route segment names, values are props type or undefined */
export type RouteMap = Record<string, Record<string, unknown> | undefined>;

/** Extract route names that require props */
export type RoutesWithProps<T extends RouteMap> = {
  [K in keyof T]: T[K] extends undefined ? never : K;
}[keyof T];

/** Extract route names that don't require props */
export type RoutesWithoutProps<T extends RouteMap> = {
  [K in keyof T]: T[K] extends undefined ? K : never;
}[keyof T];

/** Typed push overloads for manual RouteMap */
export interface TypedPush<T extends RouteMap> {
  (destination: RoutesWithoutProps<T>): Promise<void>;
  <K extends RoutesWithProps<T>>(destination: K, props: T[K]): Promise<void>;
  (destination: number): Promise<void>;
  (destination: `/${string}`, props?: Record<string, unknown>): Promise<void>;
}

// ── Plugin Type Extraction (infer approach) ──────────────────────────────────

/** Extract route path literals from a plugin config type */
export type ExtractRoutePaths<T> =
  T extends { routes: readonly (infer R)[] }
    ? R extends { path: infer P } ? P & string : never
    : never;

/** Extract dialog path literals from a plugin config type */
export type ExtractDialogPaths<T> =
  T extends { dialogs: readonly (infer D)[] }
    ? D extends { path: infer P } ? P & string : never
    : never;

/** Extract control name literals from a plugin config type */
export type ExtractControlNames<T> =
  T extends { controls: readonly (infer C)[] }
    ? C extends { name: infer N } ? N & string : never
    : never;

/**
 * Per-call generic: TypeScript infers K from the destination string literal,
 * then resolves props type specifically for that route.
 * K extends keyof AttrsMap → AttrsMap[K]
 * K not in AttrsMap → Record<string, unknown>
 */

/**
 * Conditional rest args pattern:
 * - Route in AttrsMap → [props: AttrsMap[K]] (required)
 * - Route not in AttrsMap → [props?: Record<string, unknown>] (optional)
 */
export interface PluginTypedPush<Routes extends string, AttrsMap = {}> {
  <K extends Routes>(
    destination: K,
    ...args: K extends keyof AttrsMap ? [props: AttrsMap[K]] : [props?: Record<string, unknown>]
  ): Promise<void>;
  (destination: number, props?: Record<string, unknown>): Promise<void>;
  (destination: `/${string}`, props?: Record<string, unknown>): Promise<void>;
}

export interface PluginTypedStepWisePush<Routes extends string, AttrsMap = {}> {
  <K extends Routes>(
    targetPath: K,
    ...args: K extends keyof AttrsMap ? [props: AttrsMap[K]] : [props?: Record<string, unknown>]
  ): Promise<void>;
  (targetPath: `/${string}`, props?: Record<string, unknown>): Promise<void>;
}

export interface PluginTypedStepWiseBack {
  (steps: number): Promise<void>;
}

export interface PluginTypedOpenDialog<Dialogs extends string, AttrsMap = {}> {
  <K extends Dialogs>(
    path: K,
    ...args: K extends keyof AttrsMap ? [props: AttrsMap[K]] : [props?: Record<string, unknown>]
  ): { path: string; attrs?: Record<string, unknown> };
}

export interface PluginTypedCloseDialog<Dialogs extends string> {
  (path: Dialogs): void;
}

export interface PluginTypedToggleControl<Controls extends string, AttrsMap = {}> {
  <K extends Controls>(
    name: K,
    active: boolean,
    ...args: K extends keyof AttrsMap ? [attrs: AttrsMap[K]] : [attrs?: Record<string, unknown>]
  ): void;
}

/**
 * Detect whether T is a FeaturePluginConfig (infer approach) or a RouteMap (manual approach).
 * - FeaturePluginConfig has `name` + optional `routes`/`dialogs`/`controls`
 * - RouteMap is Record<string, ...>
 */
export type IsPluginConfig<T> = T extends { name: string } ? true : false;

// ── Module Augmentation ─────────────────────────────────────────────────────
//
// 1. Register — plugin type (declare once in app-plugin.ts)
// 2. RouteAttrsMap / DialogAttrsMap / ControlAttrsMap — per-component attrs
//
// Each component declares its own attrs type. TS interface merging combines all.
//
// ```vue
// <!-- ProfilePage.vue -->
// <script lang="ts">
// declare module 'vue-micro-router' {
//   interface RouteAttrsMap {
//     profile: { userId: number; username: string };
//   }
// }
// </script>
// ```
//
// Then push('profile', { userId: 42, username: 'Danh' }) is fully typed.

/** Register plugin type — declare once in app-plugin.ts */
export interface Register {}

/**
 * Per-route attrs — augment from each route component.
 * Keys = route path strings, values = attrs type for that route.
 * TS interface merging combines declarations across all files.
 */
export interface RouteAttrsMap {}

/**
 * Per-dialog attrs — augment from each dialog component.
 * Keys = dialog path strings, values = attrs type for that dialog.
 */
export interface DialogAttrsMap {}

/**
 * Per-control attrs — augment from each control component.
 * Keys = control name strings, values = attrs type for that control.
 */
export interface ControlAttrsMap {}

/** Resolved plugin type from Register — `never` if not augmented */
export type RegisteredPlugin =
  Register extends { plugin: infer T } ? T : never;

/** Resolved route map from Register — `never` if not augmented */
export type RegisteredRouteMap =
  Register extends { routeMap: infer T extends RouteMap } ? T : never;

/** Resolved attrs maps — from augmented interfaces */
export type RegisteredRouteAttrs = RouteAttrsMap;
export type RegisteredDialogAttrs = DialogAttrsMap;
export type RegisteredControlAttrs = ControlAttrsMap;

/** True if user has augmented Register with a plugin */
export type HasRegisteredPlugin = [RegisteredPlugin] extends [never] ? false : true;

/** True if user has augmented Register with a route map */
export type HasRegisteredRouteMap = [RegisteredRouteMap] extends [never] ? false : true;

/**
 * Auto-resolved store type based on Register augmentation.
 * Priority: plugin > routeMap > untyped MicroRouterStore
 * Attrs maps (routeAttrs/dialogAttrs/controlAttrs) are passed through when declared.
 */
export type ResolvedMicroRouterStore =
  HasRegisteredPlugin extends true
    ? Omit<
        import('./types').MicroRouterStore,
        'push' | 'stepWisePush' | 'stepWiseBack' | 'openDialog' | 'closeDialog' | 'toggleControl'
      > & {
        push: PluginTypedPush<ExtractRoutePaths<RegisteredPlugin>, RegisteredRouteAttrs>;
        stepWisePush: PluginTypedStepWisePush<ExtractRoutePaths<RegisteredPlugin>, RegisteredRouteAttrs>;
        stepWiseBack: PluginTypedStepWiseBack;
        openDialog: PluginTypedOpenDialog<ExtractDialogPaths<RegisteredPlugin>, RegisteredDialogAttrs>;
        closeDialog: PluginTypedCloseDialog<ExtractDialogPaths<RegisteredPlugin>>;
        toggleControl: PluginTypedToggleControl<ExtractControlNames<RegisteredPlugin>, RegisteredControlAttrs>;
      }
    : HasRegisteredRouteMap extends true
      ? Omit<import('./types').MicroRouterStore, 'push'> & {
          push: TypedPush<RegisteredRouteMap>;
        }
      : import('./types').MicroRouterStore;
