# Composables

| Composable | Description |
|-----------|-------------|
| `useGlobalMicroRouter(config?)` | Create & provide store. Call once in root. |
| `useMicroRouter(options?)` | Inject store. Pass `{ root: true }` for root in nested setups. |
| `useMicroRouter()` | Auto-typed via `Register` augmentation. Explicit `<T>` generic also supported. |
| `useMicroState<T>(defaults?)` | Reactive attrs bridge — read/write props in routes, dialogs, controls. |
| `useRouteLifecycle(hooks)` | `onRouteEnter` / `onRouteLeave` — fires when page becomes/stops being top. |
| `useDialogLifecycle(hooks)` | `onDialogEnter` / `onDialogLeave` — fires when dialog becomes/stops being topmost. |
| `useControlLifecycle(hooks)` | `onControlEnter` / `onControlLeave` — fires when control activates/deactivates. |
| `usePageTracker(hooks?)` | Normalize tracker hooks with no-op fallbacks. |
| `useNavigation(config?, tracker?)` | Low-level page navigation (used internally). |
| `useDialogManager(tracker?)` | Low-level dialog management (used internally). |
| `useControlManager(config?, tracker?)` | Low-level control management (used internally). |
| `useGestureNavigation(config, ctx)` | Swipe-back gesture handler (used internally by MicroRouterView). |

## Common patterns

```ts
// Root setup (once)
const store = useGlobalMicroRouter(config);

// Anywhere in the tree — auto-typed via Register
const { push, openDialog, toggleControl } = useMicroRouter();

// Read/write props bridged from push()/openDialog()
const { userId } = useMicroState<{ userId: number }>({ userId: 0 });

// Lifecycle
useRouteLifecycle({
  onRouteEnter: () => {/* page became top */},
  onRouteLeave: () => {/* page left top */},
});
```

See [Navigation & Routing](/guide/core-concepts) for typing details and [GUI Controls & Lifecycle](/guide/controls) for lifecycle hooks.
