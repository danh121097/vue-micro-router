# Examples

A runnable example app lives in the [`examples/`](https://github.com/danh121097/vue-micro-router/tree/master/examples) directory of the repository. It wires up pages, dialogs, and controls with the `Register` pattern.

## Run it locally

```bash
git clone https://github.com/danh121097/vue-micro-router.git
cd vue-micro-router
bun install
bun run dev:example
```

## What it demonstrates

| Area | File | Shows |
|------|------|-------|
| App shell | `examples/App.vue` | Mounting `<MicroRouterView>` with config + plugins |
| Plugin | `examples/app-plugin.ts` | `defineFeaturePlugin` with routes, dialogs, controls |
| Typed state | `examples/auth-state.ts` | Sharing reactive state alongside navigation |
| Pages | `examples/pages/` | Page components reading props via `useMicroState()` |
| Dialogs | `examples/dialogs/` | Modal dialogs with typed `Attrs` |
| Controls | `examples/controls/` | Persistent HUD overlays |

## Recipes

- **Segment navigation** — see [Navigation & Routing](/guide/core-concepts#segment-based-paths)
- **Route guards** — see [Route Guards](/guide/core-concepts#route-guards)
- **Dialogs** — see [Dialogs](/guide/dialogs)
- **HUD controls** — see [GUI Controls](/guide/controls#gui-controls)
- **Swipe-back gestures** — see [Gesture Navigation](/guide/advanced#gesture-navigation-swipe-back)
- **Session persistence** — see [State Serialization](/guide/advanced#state-serialization)
