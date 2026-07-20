# Components

| Component | Description |
|-----------|-------------|
| `<MicroRouterView>` | Root wrapper — renders pages, dialogs, controls. Accepts `nested` prop. |
| `<RoutePage>` | Page slot wrapper — provides attrs injection. |
| `<MicroDialogComponent>` | Headless native `<dialog>` — focus trap, backdrop, escape key. |
| `<MicroControlWrapper>` | Control slot wrapper — provides attrs injection. |

## `<MicroRouterView>`

The root entry point. Renders the current page stack, any open dialogs, and active controls.

```vue
<template>
  <MicroRouterView :config :plugins="[appPlugin]" />
</template>
```

Pass `nested` to create an independent child router instance:

```vue
<MicroRouterView nested :config="tabConfig" :plugins="[tabPlugin]" />
```

See [Nested Routers](/guide/advanced#nested-routers) for details.
