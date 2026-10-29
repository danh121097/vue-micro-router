# Types

| Type | Description |
|------|-------------|
| `NavigationGuard` | `(to, from) => boolean \| Promise<boolean>` |
| `NavigationAfterHook` | `(to, from) => void` |
| `RouteMap` | `Record<string, Record<string, unknown> \| undefined>` |
| `TypedPush<T>` | Type-safe push overloads for a RouteMap |
| `TypedReplace<T>` | Type-safe replace overloads for a RouteMap (segment names only) |
| `NavigationKind` | `'push' \| 'back' \| 'replace'` — kind of the last navigation |
| `SerializedState` | JSON-serializable router state snapshot |
| `TrackerEvent` | One page/dialog/control change delivered to `tracker.onEvent` |
| `CloseReason` | `'close_button' \| 'backdrop' \| 'escape' \| 'gesture' \| 'programmatic' \| 'replace'` |
| `MicroMeta` | `Record<string, unknown>` — free-form `meta` on a route, dialog or control |
| `MicroRouterRegistry` | `getRegistry()` result: registered routes, dialogs and controls with their `meta` |
| `AudioAdapter` | Abstract audio playback interface |
| `GestureConfig` | Gesture navigation configuration |

## Other exported types

The package also exports the shape types used across the API — import them directly from `vue-micro-router`:

```ts
import type {
  MicroRoute,
  MicroDialog,
  MicroControl,
  MicroRouterConfig,
  MicroRouterStore,
  DialogProps,
  DialogPosition,
  DialogInstance,
  FeaturePlugin,
  FeaturePluginConfig,
  TransitionType,
  PageTrackerHooks,
  Register,
} from 'vue-micro-router';
```

See [Type-Safe Routes](/guide/core-concepts#type-safe-routes) for how `Register` and per-route `Attrs` interfaces drive full type inference.
