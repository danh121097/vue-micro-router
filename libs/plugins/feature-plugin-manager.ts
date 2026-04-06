import type {
  FeaturePlugin,
  FeaturePluginConfig,
  MicroRouterStore
} from '../core/types';

/**
 * Define a feature plugin — a bundle of routes, dialogs, and controls.
 *
 * @example
 * ```ts
 * export const inventoryPlugin = defineFeaturePlugin({
 *   name: 'inventory',
 *   routes: [{ path: 'inventory', component: () => import('./InventoryPage.vue') }],
 *   dialogs: [{ path: 'item-detail', component: ItemDetail, activated: false }],
 *   controls: [{ name: 'inventory_gui', component: InventoryHUD, activated: false }],
 * });
 * ```
 */
/**
 * Generic overload preserves literal path/name types when `as const` is used.
 * Without `as const`, falls back to loose FeaturePlugin type (backward compatible).
 */
export function defineFeaturePlugin<const T extends FeaturePluginConfig>(config: T): T;
export function defineFeaturePlugin(config: FeaturePluginConfig): FeaturePlugin;
export function defineFeaturePlugin(config: FeaturePluginConfig): FeaturePlugin {
  return { ...config };
}

/**
 * Register all plugins' routes/dialogs/controls with the router store.
 * Call synchronously before onMounted (typically in MicroRouterView setup).
 */
export function registerFeaturePlugins(
  plugins: FeaturePlugin[],
  store: MicroRouterStore
) {
  for (const plugin of plugins) {
    if (plugin.routes?.length) store.registerRoutes(plugin.routes);
    if (plugin.dialogs?.length) store.registerDialogs(plugin.dialogs);
    if (plugin.controls?.length) store.registerControls(plugin.controls);
  }
}
