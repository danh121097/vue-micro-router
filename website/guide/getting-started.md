# Getting Started

**Mobile-app-style navigation for Vue 3 — no URL paths, just screens.**

Build apps that feel like native mobile — pages slide in/out with smooth transitions, dialogs stack as modals, and persistent HUD controls float above everything. No `/users/:id` URL routing. Just `push('profile')` and watch it animate.

## Why not vue-router?

| | vue-router | vue-micro-router |
|---|---|---|
| Navigation model | URL-based (`/path/:param`) | Segment stack (`home → home/menu → home/menu/settings`) |
| Page transitions | Manual (TransitionGroup) | Built-in slide/fade animations + per-route customization |
| Multiple visible pages | No (one route = one view) | Yes — stacked pages all render simultaneously |
| Modal dialogs | DIY | First-class with stacking, backdrop, focus trap |
| GUI overlays / HUD | DIY | First-class controls with auto-show/hide |
| Route guards | `beforeRouteEnter` etc. | `beforeEach`, `beforeEnter`, `beforeLeave` + async |
| State passing | Query params / route params | Reactive `useMicroState()` bridge |
| Navigation history | Browser history API | Built-in `canGoBack` / `historyBack()` |
| Gesture navigation | None | Swipe-back from left edge |
| Type safety | Route params typing | Auto-typed via `Register` + `useMicroRouter()` |
| State persistence | None | `serialize()` / `restore()` |
| Nested routers | Nested `<router-view>` | Independent `<MicroRouterView nested>` |
| Lifecycle hooks | `beforeRouteEnter` etc. | `onRouteEnter`, `onDialogEnter`, `onControlEnter` |
| Use case | Websites, SPAs | Games, mobile-style apps, kiosks, wizards |

## How it works

Pages stack as path segments — `push('menu')` slides a new page on top. `push(-1)` slides it back. No browser URL changes. Just screens animating like a native app.

```
push('menu')      →  [home] ← [menu slides in]
push('settings')  →  [home] [menu] ← [settings slides in]
push(-1)          →  [home] [menu slides out →]
```

Dialogs and controls layer on top — independently managed with their own lifecycle, stacking, and transitions.

## Next steps

- [Installation](/guide/installation) — add the package and import styles
- [Basic Usage](/guide/basic-usage) — declare a plugin and mount the router
- [Navigation & Routing](/guide/core-concepts) — segment paths, props, guards, transitions
