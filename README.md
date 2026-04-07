# vue-micro-router

**Mobile-app-style navigation for Vue 3 — no URL paths, just screens.**

Build apps that feel like native mobile — pages slide in/out with smooth transitions, dialogs stack as modals, and persistent HUD controls float above everything. No `/users/:id` URL routing. Just `push('profile')` and watch it animate.

### Why not vue-router?

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

### How it works

Pages stack as path segments — `push('menu')` slides a new page on top. `push(-1)` slides it back. No browser URL changes. Just screens animating like a native app.

```
push('menu')      →  [home] ← [menu slides in]
push('settings')  →  [home] [menu] ← [settings slides in]
push(-1)          →  [home] [menu slides out →]
```

Dialogs and controls layer on top — independently managed with their own lifecycle, stacking, and transitions.

## Install

```bash
bun add vue-micro-router
# or
npm install vue-micro-router
```

## Quick Start

```vue
<!-- app-plugin.ts — declare once, typed everywhere -->
<script lang="ts">
import { defineFeaturePlugin } from 'vue-micro-router';
import HomePage from './pages/HomePage.vue';
import MenuPage from './pages/MenuPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import ConfirmDialog from './dialogs/ConfirmDialog.vue';
import MainGUI from './controls/MainGUI.vue';

export const appPlugin = defineFeaturePlugin({
  name: 'app',
  routes: [
    { path: 'home', component: HomePage },
    { path: 'menu', component: MenuPage, transition: 'fade', transitionDuration: 300 },
    { path: 'settings', component: SettingsPage, preload: 'adjacent',
      beforeLeave: () => confirm('Leave settings?') },
  ],
  dialogs: [
    { path: 'confirm', component: ConfirmDialog, activated: false },
  ],
  controls: [
    { name: 'main_gui', component: MainGUI, activated: false },
  ],
} as const);

// Register plugin type globally — no generics needed in useMicroRouter()
declare module 'vue-micro-router' {
  interface Register {
    plugin: typeof appPlugin;
  }
}
</script>
```

```vue
<!-- App.vue — fully typed without generics -->
<script setup>
import { MicroRouterView } from 'vue-micro-router';
import 'vue-micro-router/styles';
import { appPlugin } from './app-plugin';

const config = {
  defaultPath: 'home',
  defaultControlName: 'main_gui',
  history: { enabled: true, maxEntries: 50 },
  gesture: { enabled: true },
  guards: {
    beforeEach: [(to, from) => {
      console.log(`Navigating: ${from} → ${to}`);
      return true;
    }],
  },
};
</script>

<template>
  <MicroRouterView :config :plugins="[appPlugin]" />
</template>
```

## Core Concepts

### Segment-Based Paths

Pages stack as path segments. `"home/menu/settings"` renders 3 pages simultaneously — each page slides in on top of the previous one.

```ts
const { push } = useMicroRouter();

// Push a new page on top
await push('menu');           // home → home/menu

// Push with absolute path
await push('/home/settings'); // → home/settings

// Go back one step
await push(-1);               // home/settings → home

// Go back with props (forces remount)
await push(-1, { reset: true });
```

### Navigation with Props

Pass data to pages via `push()` and read it with `useMicroState()`:

```ts
// Parent — push with props
await push('profile', { userId: 42 });
```

```vue
<!-- ProfilePage.vue -->
<script setup>
import { useMicroState } from 'vue-micro-router';

// Read props passed via push() — auto-syncs mutations back to store
const { userId } = useMicroState<{ userId: number }>();

// With defaults for optional props
const { tab } = useMicroState({ tab: 'overview' });
</script>
```

### Route Guards

Prevent or control navigation with sync/async guards:

```ts
// Global guards — run on every navigation
const config = {
  guards: {
    beforeEach: [
      async (to, from) => {
        if (to.includes('admin') && !isAuthenticated()) return false;
        return true;
      }
    ],
    afterEach: [(to, from) => analytics.track('navigate', { to, from })],
  }
};

// Per-route guards — on specific routes
defineFeaturePlugin({
  routes: [
    {
      path: 'admin',
      component: AdminPage,
      beforeEnter: async (to, from) => {
        const user = await fetchUser();
        return user.isAdmin;
      },
    },
    {
      path: 'editor',
      component: EditorPage,
      beforeLeave: (to, from) => {
        if (hasUnsavedChanges()) return confirm('Discard changes?');
        return true;
      },
    },
  ],
});
```

Guard execution order: `global beforeEach → target beforeEnter → source beforeLeave → global afterEach`

Guards have a 5s timeout — if a guard doesn't resolve, navigation is cancelled.

### Per-Route Transitions

Each route can have its own transition style and duration:

```ts
defineFeaturePlugin({
  routes: [
    { path: 'home', component: HomePage },                           // default: slide 500ms
    { path: 'settings', component: SettingsPage, transition: 'fade', transitionDuration: 300 },
    { path: 'modal-page', component: ModalPage, transition: 'none' }, // instant, no animation
  ],
});
```

Supported: `'slide'` (default), `'fade'`, `'none'`

### Navigation History

Opt-in browser-like history with back/forward:

```ts
const config = {
  history: { enabled: true, maxEntries: 50 },
};

// In any component:
const router = useMicroRouter();
router.canGoBack?.value;    // reactive boolean
router.canGoForward?.value; // reactive boolean
await router.historyBack?.();
await router.historyForward?.();
await router.historyGo?.(-2); // go back 2 entries
```

History truncates forward entries on new push (browser behavior).

### Type-Safe Routes

#### Register Pattern (Recommended)

Use `Register` module augmentation to declare your plugin type once. Then `useMicroRouter()` auto-infers everywhere — no generics needed.

```ts
// app-plugin.ts — declare once with `as const`
export const appPlugin = defineFeaturePlugin({
  name: 'my-app',
  routes: [
    { path: 'home', component: HomePage },
    { path: 'profile', component: ProfilePage },
  ],
  dialogs: [{ path: 'confirm', component: ConfirmDialog, activated: false }],
  controls: [{ name: 'main_hud', component: MainHUD, activated: false }],
} as const);

// Declare module once — this is the ONLY place you write the type
declare module 'vue-micro-router' {
  interface Register {
    plugin: typeof appPlugin;
  }
}
```

Then everywhere:

```ts
// Any component — fully typed, zero generics
const { push, openDialog, toggleControl } = useMicroRouter();
push('profile');                    // ✅ OK
push('typo');                       // ❌ TS Error
openDialog('confirm');              // ✅ OK
toggleControl('main_hud', true);    // ✅ OK
```

**Benefits:** Type-safe push/openDialog/closeDialog/toggleControl. No duplication. One declaration fixes all usages.

#### Manual Route Map (Alternative)

For simple cases or when you only need typed props (not route names):

```ts
interface AppRoutes {
  home: undefined;
  profile: { userId: number };
}

const router = useMicroRouter<AppRoutes>();
router.push('profile', { userId: 42 }); // ✅ OK
router.push('profile');                  // ❌ TS Error: missing props
router.push('unknown');                  // ❌ TS Error: unknown route
```

**Untyped:** `useMicroRouter()` without Register returns `MicroRouterStore` with untyped methods.

#### Typed Props (Per-Route/Dialog/Control Attrs)

Opt-in per-component — export `interface Attrs` to get typed `push()` / `openDialog()` / `toggleControl()` props.

**Step 1:** In your component, export `interface Attrs`:

```vue
<!-- ProfilePage.vue -->
<script setup lang="ts">
import { useMicroState } from 'vue-micro-router';

export interface Attrs {
  userId: number;
  username: string;
  meta?: { title: string };  // optional fields OK
}

// Required fields need defaults (prevents undefined on remount)
const { userId, username, meta } = useMicroState<Attrs>({
  userId: 0,
  username: 'Guest',
});
// userId.value → number (never undefined)
// meta.value?.title → string | undefined (ref exists, value may be undefined)
</script>
```

```vue
<!-- ConfirmDialog.vue -->
<script setup lang="ts">
export interface Attrs {
  title?: string;
  message?: string;
  onConfirm?: () => void;
}
const { title, message, onConfirm } = useMicroState<Attrs>({
  title: 'Confirm',
  message: 'Are you sure?',
});
</script>
```

**Step 2:** Run code generation:

```bash
npx vue-micro-router-gen          # auto-detects src/ or app/, outputs src/vue-micro-router.d.ts
npx vue-micro-router-gen -d src   # explicit scan directory
npx vue-micro-router-gen -o types/router.d.ts  # custom output path
```

The script:
- Scans **all `.ts` files** for `defineFeaturePlugin()` calls (any folder structure)
- Resolves `@/`, `~/`, `#/` path aliases automatically
- Finds `.vue` components with `export interface Attrs`
- Generates `vue-micro-router.d.ts` with Register + AttrsMap augmentations

**Step 3:** Include in tsconfig and enjoy typed everywhere:

```jsonc
// tsconfig.json — add the generated file
{ "include": ["src/**/*.ts", "src/**/*.vue", "src/vue-micro-router.d.ts"] }
```

```ts
push('profile', { userId: 42, username: 'Danh' });  // ✅ typed, autocomplete
push('profile');                                      // ❌ TS error: missing required props
push('profile', { meta: { title: 'Hi' } });          // ✅ optional fields can be skipped
push('home');                                         // ✅ OK (no Attrs → untyped)
openDialog('confirm', { title: 'Sure?' });            // ✅ typed
```

**Rules:**
- Required fields in `Attrs` → must pass in `push()` / `openDialog()`
- Optional fields (`?`) → can skip entirely, including the whole props arg
- Routes without `export interface Attrs` → `push()` accepts any `Record<string, unknown>`
- Re-run `npx vue-micro-router-gen` after adding/changing `Attrs` interfaces

### State Serialization

Save and restore full router state for session persistence:

```ts
const router = useMicroRouter();

// Save state (e.g., on page hide)
const snapshot = router.serialize!();
localStorage.setItem('router-state', JSON.stringify(snapshot));

// Restore state (e.g., on page load)
const saved = localStorage.getItem('router-state');
if (saved) await router.restore!(JSON.parse(saved));
```

Serializes: navigation path + attrs, dialog stack + attrs, control state + attrs.

### Route Preloading

Preload async route components before they're needed:

```ts
defineFeaturePlugin({
  routes: [
    { path: 'home', component: () => import('./Home.vue') },
    { path: 'shop', component: () => import('./Shop.vue'), preload: 'eager' },     // loads on mount
    { path: 'cart', component: () => import('./Cart.vue'), preload: 'adjacent' },   // loads after each nav
  ],
});

// Manual preload
await router.preloadRoute('cart');
```

### Gesture Navigation (Swipe Back)

iOS-style swipe-back from the left edge:

```ts
const config = {
  gesture: {
    enabled: true,
    edgeWidth: 20,       // px from left edge (default: 20)
    threshold: 0.3,      // 30% screen width to trigger (default: 0.3)
    velocityThreshold: 0.5, // px/ms fast swipe (default: 0.5)
  },
};
```

### Nested Routers

Independent router instances within the same component tree:

```vue
<template>
  <!-- Root router -->
  <MicroRouterView :config="rootConfig" :plugins="[mainPlugin]">
    <!-- Inside a page component: -->
    <MicroRouterView nested :config="tabConfig" :plugins="[tabPlugin]" />
  </MicroRouterView>
</template>
```

```ts
// Access root router from within nested router
const rootRouter = useMicroRouter({ root: true });
const localRouter = useMicroRouter(); // nearest parent
```

### Step-Wise Navigation

Animate through intermediate pages one-by-one:

```ts
const { stepWisePush, stepWiseBack } = useMicroRouter();

// Walk through: home → home/onboarding → home/onboarding/step1
await stepWisePush('/home/onboarding/step1');

// Step back through each page with animation
await stepWiseBack(3);
```

### Dialogs

Open modal dialogs with props and handle close:

```ts
const { openDialog, closeDialog, closeAllDialogs } = useMicroRouter();

// Open with props
openDialog('confirm', {
  title: 'Delete item?',
  onConfirm: () => handleDelete(),
});

// Close specific dialog
closeDialog('confirm');

// Close all open dialogs
closeAllDialogs();
```

Dialog options:

```ts
registerDialog({
  path: 'settings-modal',
  component: SettingsModal,
  activated: false,
  position: 'right',          // 'standard' | 'top' | 'right' | 'bottom' | 'left'
  transition: 'slide',        // 'fade' | 'slide' | 'scale'
  transitionDuration: 400,
  fullscreen: false,
  persistent: true,           // prevent close on backdrop click / Escape
  seamless: true,             // transparent background, no shadow
});
```

### GUI Controls

Persistent overlay controls (HUDs, toolbars) that auto-manage visibility:

```ts
const { toggleControl } = useMicroRouter();

// Show inventory HUD (auto-hides default main_gui)
toggleControl('inventory', true, { filter: 'weapons' });

// Hide inventory (auto-restores main_gui)
toggleControl('inventory', false);
```

### Lifecycle Hooks

iOS-style `viewWillAppear` / `viewWillDisappear` — available for routes, dialogs, and controls:

```vue
<script setup>
import { useRouteLifecycle } from 'vue-micro-router';

useRouteLifecycle({
  onRouteEnter: () => console.log('Page is now the active (top) page'),
  onRouteLeave: () => console.log('Page is no longer the active page'),
});
</script>
```

Also: `useDialogLifecycle({ onDialogEnter, onDialogLeave })` and `useControlLifecycle({ onControlEnter, onControlLeave })`.

### Feature Plugins

Bundle routes, dialogs, and controls into feature modules:

```ts
import { defineFeaturePlugin } from 'vue-micro-router';

export const shopPlugin = defineFeaturePlugin({
  name: 'shop',
  routes: [
    { path: 'shop', component: () => import('./ShopPage.vue'), preload: 'eager' },
    { path: 'cart', component: () => import('./CartPage.vue'), preload: 'adjacent' },
  ],
  dialogs: [
    { path: 'buy-confirm', component: () => import('./BuyConfirm.vue'), activated: false },
  ],
  controls: [
    { name: 'shop_hud', component: () => import('./ShopHUD.vue'), activated: false },
  ],
});
```

### Analytics / Page Tracking

Hook into navigation events:

```ts
const config: MicroRouterConfig = {
  tracker: {
    trackPageEnter: (page, from, to) => analytics.track('page_view', { page }),
    trackPageLeave: (page, from, to) => analytics.track('page_leave', { page }),
    trackDialogEnter: (dialog) => analytics.track('dialog_open', { dialog }),
    trackDialogLeave: (dialog) => analytics.track('dialog_close', { dialog }),
    trackGuiEnter: (name) => analytics.track('gui_show', { name }),
    trackGuiLeave: (name) => analytics.track('gui_hide', { name }),
  },
};
```

### Vue Devtools

Automatic in development — shows a "Micro Router" inspector tab with:
- Current path and page stack
- Open dialogs with attrs
- Active controls
- Navigation timeline events

Requires `@vue/devtools-api` (optional peer dependency). Zero cost in production builds.

## Optional: Audio Manager

Background music tied to route BGM fields. Supports custom audio backends via `AudioAdapter`:

```bash
bun add howler
```

```ts
import { useAudioManager, HowlerAdapter } from 'vue-micro-router/audio';

const audio = useAudioManager({
  volumeRef: ref(80),
  urlResolver: (name) => `/assets/audio/${name}.mp3`,
  // adapter: new HowlerAdapter(), // default — or provide your own AudioAdapter
});
```

Custom adapter:

```ts
import type { AudioAdapter } from 'vue-micro-router/audio';

class WebAudioAdapter implements AudioAdapter {
  async play(src, options) { /* Web Audio API */ }
  stop() { /* ... */ }
  pause() { /* ... */ }
  resume() { /* ... */ }
  fade(from, to, duration) { /* ... */ }
  isPlaying() { return false; }
  state() { return 'unloaded'; }
  cleanup() { /* ... */ }
}

const audio = useAudioManager({ adapter: new WebAudioAdapter() });
```

## Styles

Import styles separately (not bundled with JS):

```ts
import 'vue-micro-router/styles';
```

Includes page slide/fade transitions, dialog animations, control fade transitions, and GUI layer positioning.

## Development

```bash
bun run lint        # ESLint check
bun run lint:fix    # Auto-fix lint issues
bun test            # Run all tests
bun run typecheck   # TypeScript strict check
bun run build       # Build package
bun run gen:types   # Generate vue-micro-router.d.ts (local dev)
bun run dev:example # Run example app
bun run publish:npm # Bump version + build + publish + tag + release
```

For consumers:
```bash
npx vue-micro-router-gen  # Generate type augmentations in consumer project
```

## API Reference

### Composables

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

### Components

| Component | Description |
|-----------|-------------|
| `<MicroRouterView>` | Root wrapper — renders pages, dialogs, controls. Accepts `nested` prop. |
| `<RoutePage>` | Page slot wrapper — provides attrs injection. |
| `<MicroDialogComponent>` | Headless native `<dialog>` — focus trap, backdrop, escape key. |
| `<MicroControlWrapper>` | Control slot wrapper — provides attrs injection. |

### Plugin Helpers

| Function | Description |
|----------|-------------|
| `defineFeaturePlugin(config)` | Create a feature plugin bundle. |
| `registerFeaturePlugins(plugins, store)` | Register all plugins with the store. |

### Types

| Type | Description |
|------|-------------|
| `NavigationGuard` | `(to, from) => boolean \| Promise<boolean>` |
| `NavigationAfterHook` | `(to, from) => void` |
| `RouteMap` | `Record<string, Record<string, unknown> \| undefined>` |
| `TypedPush<T>` | Type-safe push overloads for a RouteMap |
| `SerializedState` | JSON-serializable router state snapshot |
| `AudioAdapter` | Abstract audio playback interface |
| `GestureConfig` | Gesture navigation configuration |

## Performance

| Metric | Value |
|--------|-------|
| Core bundle (gzip) | 10.35 kB |
| Audio (gzip) | 1.07 kB |
| Styles (gzip) | 0.84 kB |
| Navigation latency (p50) | < 0.01 ms |
| Tests | 150 passing |
| Coverage | ~96% |

Run benchmarks: `bun run bench` (navigation timing) / `bun run bench:size` (bundle check)

## Peer Dependencies

- `vue` >= 3.4.0
- `howler` >= 2.2.0 *(optional — only for `vue-micro-router/audio`)*
- `@vue/devtools-api` >= 6.0.0 *(optional — only for devtools inspector)*

## License

MIT
