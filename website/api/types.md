# Types

| Type | Description |
|------|-------------|
| `NavigationGuard` | `(to, from) => boolean \| Promise<boolean>` |
| `NavigationAfterHook` | `(to, from) => void` |
| `RouteMap` | `Record<string, Record<string, unknown> \| undefined>` |
| `TypedPush<T>` | Type-safe push overloads for a RouteMap |
| `SerializedState` | JSON-serializable router state snapshot |
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
