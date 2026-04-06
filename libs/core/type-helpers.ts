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

/** Typed push that validates route segment names inferred from plugins */
export interface PluginTypedPush<Routes extends string> {
  (destination: Routes, props?: Record<string, unknown>): Promise<void>;
  (destination: number): Promise<void>;
  (destination: `/${string}`, props?: Record<string, unknown>): Promise<void>;
}

/** Typed openDialog that validates dialog paths inferred from plugins */
export interface PluginTypedOpenDialog<Dialogs extends string> {
  (path: Dialogs, props?: Record<string, unknown>): { path: string; attrs?: Record<string, unknown> };
}

/** Typed closeDialog that validates dialog paths */
export interface PluginTypedCloseDialog<Dialogs extends string> {
  (path: Dialogs): void;
}

/** Typed toggleControl that validates control names inferred from plugins */
export interface PluginTypedToggleControl<Controls extends string> {
  (name: Controls, active: boolean, attrs?: Record<string, unknown>): void;
}

/**
 * Detect whether T is a FeaturePluginConfig (infer approach) or a RouteMap (manual approach).
 * - FeaturePluginConfig has `name` + optional `routes`/`dialogs`/`controls`
 * - RouteMap is Record<string, ...>
 */
export type IsPluginConfig<T> = T extends { name: string } ? true : false;

// ── Module Augmentation — Register pattern ──────────────────────────────────
//
// Declare your plugin type ONCE, then useMicroRouter() auto-infers everywhere.
//
// ```ts
// // env.d.ts or app-plugin.ts — declare once
// declare module 'vue-micro-router' {
//   interface Register {
//     plugin: typeof appPlugin;
//   }
// }
//
// // Any component — no generic needed
// const { push } = useMicroRouter();
// push('home');      // ✅ type-safe
// push('unknown');   // ❌ compile error
// ```

/**
 * Module augmentation interface. Users extend this to register their plugin type.
 * Accepts `plugin` (single or union of plugins) or `routeMap` (manual RouteMap).
 */
 
export interface Register {}

/** Resolved plugin type from Register — `never` if not augmented */
export type RegisteredPlugin =
  Register extends { plugin: infer T } ? T : never;

/** Resolved route map from Register — `never` if not augmented */
export type RegisteredRouteMap =
  Register extends { routeMap: infer T extends RouteMap } ? T : never;

/** True if user has augmented Register with a plugin */
export type HasRegisteredPlugin = [RegisteredPlugin] extends [never] ? false : true;

/** True if user has augmented Register with a route map */
export type HasRegisteredRouteMap = [RegisteredRouteMap] extends [never] ? false : true;

/**
 * Auto-resolved store type based on Register augmentation.
 * Priority: plugin > routeMap > untyped MicroRouterStore
 *
 * Defined inline (no circular import back to use-micro-router.ts).
 */
export type ResolvedMicroRouterStore =
  HasRegisteredPlugin extends true
    ? Omit<
        import('./types').MicroRouterStore,
        'push' | 'openDialog' | 'closeDialog' | 'toggleControl'
      > & {
        push: PluginTypedPush<ExtractRoutePaths<RegisteredPlugin>>;
        openDialog: PluginTypedOpenDialog<ExtractDialogPaths<RegisteredPlugin>>;
        closeDialog: PluginTypedCloseDialog<ExtractDialogPaths<RegisteredPlugin>>;
        toggleControl: PluginTypedToggleControl<ExtractControlNames<RegisteredPlugin>>;
      }
    : HasRegisteredRouteMap extends true
      ? Omit<import('./types').MicroRouterStore, 'push'> & {
          push: TypedPush<RegisteredRouteMap>;
        }
      : import('./types').MicroRouterStore;
