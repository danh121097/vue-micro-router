# vue-micro-router System Architecture

**Version:** 1.0.0 (Phase 1-3 Complete)  
**Last Updated:** 2026-04-06

---

## Architecture Overview

vue-micro-router is a **segment-based routing system** with three first-class concepts managed by a unified store:

1. **Navigation** — page stacking via segment paths ("home/menu/settings")
2. **Dialogs** — independent modal stack with persistent option
3. **Controls** — persistent GUI overlays surviving page changes

State: provide/inject via composables. Attrs bridge: two-way reactive sync. Transitions: per-route customizable with View Transition API support.

---

## Core Concepts

### Segment-Based Routing

Paths are slash-separated strings representing a stack of pages:

```
"home"              → [Home]
"home/menu"         → [Home, Menu]
"home/menu/settings" → [Home, Menu, Settings]
```

Push replaces entire stack. Back pops segments. Step-wise navigation adds one per step.

### Three First-Class Concepts

| Concept | Stack | Lifecycle | Persist on Page Change |
|---------|-------|-----------|------------------------|
| **Pages** | Segment-based | Push/pop/stepWise | Part of history |
| **Dialogs** | Own stack | Open/close | Only if persistent |
| **Controls** | Singleton per name | Toggle on/off | Always |

```typescript
// Pages: replace entire stack
router.push("home/menu");
router.stepWisePush("home/menu/settings");
router.back(2);

// Dialogs: independent stack
router.openDialog("/pause", { mode: "settings" });
router.closeDialog("/pause");
router.closeAllDialogs();

// Controls: persistent overlays
router.toggleControl("inventory", true);
router.toggleControl("inventory", false);
```

### Reactive Attrs Bridge (useMicroState)

Components read/write state via injected attrs, auto-synced to store:

```typescript
// Store manages central state
router.updateRouteAttrs("menu", { selectedIndex: 0 });

// Component reads via useMicroState
const { selectedIndex } = useMicroState<{ selectedIndex: number }>();
console.log(selectedIndex.value); // 0

// Component mutates
selectedIndex.value = 2;

// Auto-synced back to store via watcher (flush: 'post')
```

---

## Navigation Pipeline

### Guard Execution Order

```
1. beforeEach guards (config-level)
   ↓
2. beforeLeave guards (from-route-specific)
   ↓
3. beforeEnter guards (to-route-specific)
   ↓
4. Route resolution & component load
   ↓
5. afterEach hooks (config-level)
```

Each guard: `(to: string, from: string) => boolean | Promise<boolean>`
- Returns `false` to cancel navigation
- Supports both sync and async
- All guards run before component mounts

### Navigation State

```typescript
// Reactive references
activePath: Ref<string>      // Current path "home/menu"
fromPath: Ref<string>        // Previous path (for transitions)
toPath: Ref<string>          // Destination during transition
pageStack: Ref<MicroRoute[]> // Resolved route objects

// Computed selectors
activePage: computed          // Last segment of activePath
fromPage: computed            // Last segment of fromPath
toPage: computed              // Last segment of toPath
resolveRoutes: computed       // pageStack as MicroRoute[]
```

### History Integration

Navigation history recorded on successful push:

```typescript
// Each history entry
interface SerializedState {
  path: string;               // "home/menu"
  attrs: Record<string, any>; // { selectedIndex: 0 }
  timestamp?: number;         // Optional
}

// History API
getHistory(): SerializedState[]  // Full stack
goBack(steps?: number)          // Jump back in history
clearHistory(): void            // Reset stack
serialize(): SerializedState    // Current state
restore(data): void             // Hydrate state
```

### Route Preloading

Three strategies:

```typescript
interface MicroRoute {
  preload?: 'eager' | 'adjacent' | false; // default: false
}

// eager: load all on store init
// adjacent: after each push, preload next-level routes
// false/manual: app calls router.preloadRoute('settings')
```

### View Transition API

For shared element morphing:

```typescript
interface MicroRoute {
  viewTransition?: boolean; // default: false
}

// Before push(), if available and route.viewTransition === true:
if (document.startViewTransition) {
  const transition = document.startViewTransition(() => doNavigate());
  await transition.finished;
}

// Browser support: Chrome 111+, Edge 111+, Safari partial
```

---

## Dialog Management

### Dialog Stack

Independent from page stack. FIFO queue with immediate open/close.

```typescript
// State
dialogStack: Ref<MicroDialog[]> // Active dialogs
dialogCatalog: Map<string, MicroDialog> // Catalog
dialogAttrs: Map<string, Record> // Per-dialog props

// API
openDialog(path, props?)    // Push to stack
closeDialog(path)           // Mark closing, schedule removal
closeAllDialogs()           // Clear entire stack
registerDialog(dialog)      // Add to catalog
updateDialogAttrs(path, attrs) // Merge props
```

### Lifecycle

```
openDialog()
  ↓
MicroDialog renders <dialog open>
  ↓
Dialog component injects attrs via useMicroState()
  ↓
closeDialog() called
  ↓
Dialog transitions out (CSS)
  ↓
Removed from DOM after transitionDuration
```

### Per-Dialog Attrs

```typescript
// Update without re-opening
router.updateDialogAttrs("/item-detail", { itemId: 42 });

// Component reads
const { itemId } = useMicroState<{ itemId: number }>();
itemId.value = 43; // Auto-synced back
```

---

## Control Management

### Control State

Persistent GUI overlays (inventory, HUD, menus) surviving page changes.

```typescript
// Only one control active at a time (or none)
activeControl: computed      // boolean
currentControl: computed     // string | null
resolveControls: computed    // MicroControl[]

// API
toggleControl(name, active, attrs?)  // Enable/disable
registerControl(control)             // Add to catalog
updateControlAttrs(name, attrs)      // Merge props
getControlAttrs(name)                // Read current attrs
```

### Lifecycle

```
toggleControl("inventory", true)
  ↓
MicroControlWrapper renders if activated
  ↓
Control component injects attrs via useMicroState()
  ↓
toggleControl("inventory", false)
  ↓
MicroControlWrapper removes from DOM
```

---

## State Serialization

### Format

```typescript
interface SerializedState {
  path: string;               // "home/menu/settings"
  attrs: Record<string, any>; // { page state }
  timestamp?: number;         // Optional order tracking
}
```

### Use Cases

1. **History:** Each navigation recorded
2. **Persistence:** Save/restore to localStorage
3. **Time-travel:** Debug goBack(n)
4. **Deep linking:** Serialize for URL/QR code

### Implementation

- Handles complex objects, arrays, nested structures
- JSON-safe (no circular refs, Functions stripped)
- Roundtrip: serialize → store → deserialize
- All composables support state restore on mount

---

## Gesture Navigation

### Swipe-Back Detection

Pointer tracking from left edge:

```typescript
interface GestureConfig {
  enabled?: boolean;          // default: false
  edgeWidth?: number;         // px from left (default: 20)
  threshold?: number;         // 0-1, % to trigger (default: 0.3)
  velocityThreshold?: number; // px/ms (default: 0.5)
}

// Listener setup
useGestureNavigation().setupListeners(element, config);

// Features:
// - Pointer tracking (mouse + touch)
// - Partial page translation during swipe
// - Previous page peek from left
// - Threshold + velocity detection
// - Works with guards, respects isNavigating
// - GPU-accelerated via transform
// - Disabled during programmatic nav
```

### Event Loop

```
pointerdown on left edge
  ↓
Track pointer movement right
  ↓
Translate current page proportionally
  ↓
If threshold + velocity exceeded:
  Execute guards, navigation.back()
Else:
  Animate back to original position
```

---

## Nested Routers

### Scoped Provide/Inject

Create independent routers within pages (tabs, split-screen):

```typescript
// Root router
<MicroRouterView>
  <!-- Full app navigation -->
  <RoutePage>
    <!-- Nested router: own state, isolated from root -->
    <MicroRouterView nested>
      <RoutePage>...</RoutePage>
    </MicroRouterView>
  </RoutePage>
</MicroRouterView>

// Access root from nested scope
const rootRouter = useMicroRouter({ root: true });
```

### Scoping Rules

- Nested MICRO_ROUTER_KEY shadows parent (own state)
- Child router fully independent: own navigation, dialogs, controls
- Can register plugins to specific router instance
- Cleanup on unmount (no parent leaks)

---

## Audio Management

### AudioAdapter Pattern

Abstraction for audio implementations:

```typescript
interface AudioAdapter {
  play(src: string, loop?: boolean): Promise<void>;
  stop(): void;
  setVolume(volume: number): void;
}

// Default: HowlerAdapter (howler.js wrapper)
// Custom: implement AudioAdapter, substitute at runtime
```

### Integration

- Optional: only loaded if `vue-micro-router/audio` imported
- Watcher on `navigation.activePath` → `updateBackgroundMusic(route)`
- Route can specify `bgm?: string` for per-page music
- Audio manager accessible via store when imported

---

## Vue Devtools Plugin

### Inspector

Custom inspector tab "Micro Router" with sections:
- Routes: active page stack with attrs
- Dialogs: active modal stack with attrs
- Controls: active control with attrs
- History: full navigation history

### Timeline

Events: push, back, openDialog, closeDialog, toggleControl
Includes: timestamp, path/name, attrs delta

### Production Cost

- Zero: `__VUE_PROD_DEVTOOLS__` guard eliminates all code
- Development: <0.1ms overhead per operation
- Optional dependency: @vue/devtools-api

---

## Component Architecture

### MicroRouterView.vue

Root wrapper, creates store:

```vue
<script setup lang="ts">
const router = useGlobalMicroRouter(config);
// Provides MICRO_ROUTER_KEY
</script>

<template>
  <div class="micro-router-view">
    <slot />
  </div>
</template>
```

### RoutePage.vue

Wrapper for each active page, provides attrs injection:

```vue
<template>
  <div class="route-page">
    <component :is="route.component" :key="route.key" />
  </div>
</template>

<!-- Provides: MICRO_ATTRS_READ_KEY, MICRO_ATTRS_WRITE_KEY -->
```

### MicroDialog.vue

Headless native `<dialog>` element with lifecycle:

```vue
<template>
  <dialog :open="dialog.activated" @close="onClose">
    <component :is="dialog.component" :key="dialog.key" />
  </dialog>
</template>

<!-- Features: CSS transitions, native open/close, dismiss via closeDialog() -->
```

### MicroControlWrapper.vue

Wrapper for control component:

```vue
<template>
  <div v-if="control.activated" class="micro-control-wrapper">
    <component :is="control.component" :key="control.key" />
  </div>
</template>

<!-- Only renders when activeControl === true -->
```

---

## Injection Keys

| Key | Purpose | Provider | Injector |
|-----|---------|----------|----------|
| `MICRO_ROUTER_KEY` | Store instance | MicroRouterView | useMicroRouter() |
| `MICRO_ATTRS_READ_KEY` | Get attrs | RoutePage/MicroDialog/MicroCtrl | useMicroState() |
| `MICRO_ATTRS_WRITE_KEY` | Update attrs | RoutePage/MicroDialog/MicroCtrl | useMicroState() |
| `MICRO_ROUTE_PATH_KEY` | Current segment | RoutePage | useRouteLifecycle() |
| `MICRO_DIALOG_PATH_KEY` | Dialog path | MicroDialog | useDialogLifecycle() |
| `MICRO_CONTROL_NAME_KEY` | Control name | MicroControlWrapper | useControlLifecycle() |

---

## Data Flow Example

### Navigation Flow (home → home/menu)

1. Component calls `router.push("home/menu")`
2. Parse path: ["home", "menu"]
3. Resolve routes from catalog
4. Run beforeEach + beforeEnter guards (if any)
5. Update activePath, activePage
6. Page stack re-renders
7. RoutePage components inject attrs
8. useMicroState() creates reactive refs
9. Run afterEach hooks
10. Track with tracker.trackPageEnter()

### Dialog Flow

1. Component calls `router.openDialog("/settings", { mode: "game" })`
2. MicroDialog renders with `open={true}`
3. Dialog component injects attrs, renders content
4. Component calls `router.closeDialog("/settings")`
5. Dialog transitions out (CSS)
6. Removed from dialogStack after transitionDuration

### Attrs Sync Flow

1. Component uses `useMicroState<T>(defaults)`
2. Reads attrs from MICRO_ATTRS_READ_KEY
3. Merges with defaults, creates reactive refs
4. User interaction mutates refs
5. Watcher fires (flush: 'post') after render
6. writeAttrs() updates store via MICRO_ATTRS_WRITE_KEY
7. Store attrs now in sync with component state

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Segment parsing | <1ms | 10-20 segments typical |
| Guard execution | <0.5ms/guard | Supports async |
| Page transition | <16ms render | +step delay (default 600ms) |
| History push/pop | <2ms | Serialization included |
| Gesture tracking | <1ms | 60fps via RAF |
| Devtools overhead | <0.1ms | Zero in production |
| Memory per history | ~100 bytes | Plus route attrs |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing route | Logs warning, renders placeholder |
| Missing dialog | Returns empty DialogInstance |
| Missing control | toggleControl() is no-op |
| Guard throws | Navigation cancelled, error logged |
| Circular attrs ref | Serialization handles gracefully |

---

## Type Safety via Register Pattern

### Module Augmentation (Infer Approach)

The **Register** interface enables zero-duplication type-safety:

```ts
// app-plugin.ts — declare once with `as const`
export const appPlugin = defineFeaturePlugin({
  name: 'app',
  routes: [
    { path: 'home', component: HomePage },
    { path: 'profile', component: ProfilePage },
  ],
  dialogs: [{ path: 'confirm', component: ConfirmDialog, activated: false }],
  controls: [{ name: 'main_hud', component: MainHUD, activated: false }],
} as const);

// env.d.ts — declare module once
declare module 'vue-micro-router' {
  interface Register {
    plugin: typeof appPlugin;
  }
}
```

Then everywhere:

```ts
// Components — fully typed, no generics needed
const { push, openDialog, toggleControl } = useMicroRouter();
push('profile');           // ✅ TS knows valid routes
openDialog('confirm');     // ✅ TS knows valid dialogs
toggleControl('main_hud', true); // ✅ TS knows valid controls
```

**Implementation:** `ResolvedMicroRouterStore` type in `type-helpers.ts` auto-resolves:
1. Extract route paths from RegisteredPlugin
2. Create PluginTypedPush with literal path union
3. Override push/openDialog/closeDialog/toggleControl/stepWisePush methods

### Per-Route Typed Attrs

Components export `interface Attrs` → `npx vue-micro-router-gen` generates `src/vue-micro-router.d.ts` with augmentations for `RouteAttrsMap` / `DialogAttrsMap` / `ControlAttrsMap`.

**Flow:**
```
Component exports Attrs → npx vue-micro-router-gen scans plugins → generates .d.ts → TS infers per-call
```

**Type resolution per-call:**
```ts
push<K extends Routes>(destination: K,
  ...args: K extends keyof AttrsMap ? [props: AttrsMap[K]] : [props?: Record<string, unknown>]
)
```

TypeScript narrows `K` from the string literal → resolves correct attrs type per route.

**StateRefs<T>:** `useMicroState` returns `StateRefs<T>` (not `ToRefs<T>`) — all keys required as refs even for optional fields. `Ref<T | undefined>` for optional, `Ref<T>` for required. Uses Proxy to lazily create refs for keys not in defaults.

---

## Design Principles

1. **Composition over classes** — all logic in composables
2. **Explicit over implicit** — no magic, clear API
3. **First-class concepts** — pages, dialogs, controls equal
4. **Immutable inputs** — functions don't mutate parameters
5. **Reactive by default** — refs & computed, never plain objects
6. **Separation of concerns** — navigation, dialogs, controls independent
7. **Convention over config** — sensible defaults, explicit when needed
8. **Tree-shakeable** — optional sub-paths, dead code eliminated
