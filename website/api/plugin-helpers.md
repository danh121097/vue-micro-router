# Plugin Helpers

| Function | Description |
|----------|-------------|
| `defineFeaturePlugin(config)` | Create a feature plugin bundle. |
| `registerFeaturePlugins(plugins, store)` | Register all plugins with the store. |

## `defineFeaturePlugin(config)`

Bundles routes, dialogs, and controls into a single feature module. Use `as const` to enable the [Register pattern](/guide/core-concepts#register-pattern-recommended) for full type inference.

```ts
export const appPlugin = defineFeaturePlugin({
  name: 'app',
  routes: [
    { path: 'home', component: HomePage },
    { path: 'menu', component: MenuPage, transition: 'fade' },
  ],
  dialogs: [{ path: 'confirm', component: ConfirmDialog, activated: false }],
  controls: [{ name: 'main_gui', component: MainGUI, activated: false }],
} as const);
```

## `registerFeaturePlugins(plugins, store)`

Registers all plugins with an existing store. Normally handled for you by `<MicroRouterView :plugins>`, but available for manual/low-level setups.

```ts
const store = useGlobalMicroRouter(config);
registerFeaturePlugins([appPlugin, shopPlugin], store);
```
