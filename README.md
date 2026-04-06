# vue-micro-router

**Mobile-app-style navigation for Vue 3 — no URL paths, just screens.**

Build apps that feel like native mobile — pages slide in/out with smooth transitions, dialogs stack as modals, and persistent HUD controls float above everything. No `/users/:id` URL routing. Just `push('profile')` and watch it animate.

### Why not vue-router?

| | vue-router | vue-micro-router |
|---|---|---|
| Navigation model | URL-based (`/path/:param`) | Segment stack (`home → home/menu → home/menu/settings`) |
| Page transitions | Manual (TransitionGroup) | Built-in slide/fade animations |
| Multiple visible pages | No (one route = one view) | Yes — stacked pages all render simultaneously |
| Modal dialogs | DIY | First-class with stacking, backdrop, focus trap |
| GUI overlays / HUD | DIY | First-class controls with auto-show/hide |
| State passing | Query params / route params | Reactive `useMicroState()` bridge |
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
<!-- App.vue -->
<script setup>
import { MicroRouterView, defineFeaturePlugin } from 'vue-micro-router';
import 'vue-micro-router/styles';

import HomePage from './pages/HomePage.vue';
import MenuPage from './pages/MenuPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import ConfirmDialog from './dialogs/ConfirmDialog.vue';
import MainGUI from './controls/MainGUI.vue';

const plugin = defineFeaturePlugin({
  name: 'app',
  routes: [
    { path: 'home', component: HomePage },
    { path: 'menu', component: MenuPage },
    { path: 'settings', component: SettingsPage },
  ],
  dialogs: [
    { path: 'confirm', component: ConfirmDialog, activated: false },
  ],
  controls: [
    { name: 'main_gui', component: MainGUI, activated: false },
  ],
});
</script>

<template>
  <MicroRouterView
    :config="{ defaultPath: 'home', defaultControlName: 'main_gui' }"
    :plugins="[plugin]"
  />
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

```vue
<!-- ConfirmDialog.vue -->
<script setup>
import { useMicroState } from 'vue-micro-router';

const { title, onConfirm } = useMicroState<{
  title: string;
  onConfirm: () => void;
}>();

// onClose is auto-injected via dialog.attrs (optional — set via nextTick)
const props = withDefaults(defineProps<{ onClose?: () => void }>(), {
  onClose: () => {},
});
</script>

<template>
  <div class="dialog-content">
    <h2>{{ title }}</h2>
    <button @click="onConfirm(); props.onClose()">Yes</button>
    <button @click="props.onClose()">Cancel</button>
  </div>
</template>
```

Dialog options:

```ts
registerDialog({
  path: 'settings-modal',
  component: SettingsModal,
  activated: false,
  position: 'right',          // 'standard' | 'top' | 'right' | 'bottom' | 'left'
  transition: 'slide',        // 'fade' | 'slide' | 'scale'
  transitionDuration: 400,    // ms (default: slide=500, fade/scale=300)
  fullscreen: false,
  persistent: true,           // prevent close on backdrop click / Escape
  seamless: true,             // transparent background, no shadow (default)
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

```vue
<!-- InventoryHUD.vue -->
<script setup>
import { useMicroState } from 'vue-micro-router';
const { filter } = useMicroState({ filter: 'all' });
</script>
```

### Lifecycle Hooks

iOS-style `viewWillAppear` / `viewWillDisappear` — available for routes, dialogs, and controls:

```vue
<!-- Inside a route page component -->
<script setup>
import { useRouteLifecycle } from 'vue-micro-router';

useRouteLifecycle({
  onRouteEnter: () => console.log('Page is now the active (top) page'),
  onRouteLeave: () => console.log('Page is no longer the active page'),
});
</script>
```

```vue
<!-- Inside a dialog component -->
<script setup>
import { useDialogLifecycle } from 'vue-micro-router';

useDialogLifecycle({
  onDialogEnter: () => console.log('Dialog is now the topmost dialog'),
  onDialogLeave: () => console.log('Dialog is no longer the topmost dialog'),
});
</script>
```

```vue
<!-- Inside a control component -->
<script setup>
import { useControlLifecycle } from 'vue-micro-router';

useControlLifecycle({
  onControlEnter: () => console.log('Control is now active'),
  onControlLeave: () => console.log('Control deactivated'),
});
</script>
```

### Feature Plugins

Bundle routes, dialogs, and controls into feature modules:

```ts
// features/shop.ts
import { defineFeaturePlugin } from 'vue-micro-router';

export const shopPlugin = defineFeaturePlugin({
  name: 'shop',
  routes: [
    { path: 'shop', component: () => import('./ShopPage.vue') },
    { path: 'cart', component: () => import('./CartPage.vue') },
  ],
  dialogs: [
    { path: 'buy-confirm', component: () => import('./BuyConfirm.vue'), activated: false },
  ],
  controls: [
    { name: 'shop_hud', component: () => import('./ShopHUD.vue'), activated: false },
  ],
});
```

```vue
<!-- App.vue -->
<template>
  <MicroRouterView :plugins="[shopPlugin, inventoryPlugin]" />
</template>
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

## Optional: Audio Manager

Background music tied to route BGM fields. Requires `howler`:

```bash
bun add howler
```

```ts
import { useAudioManager } from 'vue-micro-router/audio';
import { ref } from 'vue';

const volume = ref(80); // 0-100
const audio = useAudioManager({
  volumeRef: volume,
  urlResolver: (name) => `/assets/audio/${name}.mp3`,
});

// Play a sound
await audio.playSound('click');

// Play looping BGM
await audio.playSound('battle-theme', true);

// Auto-pause on tab hidden, resume on tab visible
addEventListener('visibilitychange', audio.handleVisibilityChange);
```

Set `bgm` on routes for automatic music switching:

```ts
registerRoute({ path: 'battle', component: BattlePage, bgm: 'battle-theme' });
registerRoute({ path: 'town', component: TownPage, bgm: 'peaceful' });
// Music auto-switches when navigating between routes
```

## Styles

Import styles separately (not bundled with JS):

```ts
import 'vue-micro-router/styles';
```

Includes:
- Page slide transitions (`.page-slide-*`)
- Dialog animations (fade, scale, slide) with `::backdrop`
- Control fade transitions
- GUI layer positioning

Customize via CSS custom properties:

```css
/* Override dialog transition duration */
.micro-dialog { --dialog-duration: 400ms; }
```

## API Reference

### Composables

| Composable | Description |
|-----------|-------------|
| `useGlobalMicroRouter(config?)` | Create & provide store. Call once in root. |
| `useMicroRouter()` | Inject store from parent `<MicroRouterView>`. |
| `useMicroState<T>(defaults?)` | Reactive attrs bridge — read/write props in routes, dialogs, controls. |
| `useRouteLifecycle(hooks)` | `onRouteEnter` / `onRouteLeave` — fires when a page becomes/stops being the top page. |
| `useDialogLifecycle(hooks)` | `onDialogEnter` / `onDialogLeave` — fires when a dialog becomes/stops being the topmost dialog. |
| `useControlLifecycle(hooks)` | `onControlEnter` / `onControlLeave` — fires when a control activates/deactivates. |
| `usePageTracker(hooks?)` | Normalize tracker hooks with no-op fallbacks. |
| `useNavigation(config?, tracker?)` | Low-level page navigation (used internally). |
| `useDialogManager(tracker?)` | Low-level dialog management (used internally). |
| `useControlManager(config?, tracker?)` | Low-level control management (used internally). |

### Components

| Component | Description |
|-----------|-------------|
| `<MicroRouterView>` | Root wrapper — renders pages, dialogs, controls. |
| `<RoutePage>` | Page slot wrapper — provides attrs injection. |
| `<MicroDialogComponent>` | Headless native `<dialog>` — focus trap, backdrop, escape key. |
| `<MicroControlWrapper>` | Control slot wrapper — provides attrs injection. |

### Plugin Helpers

| Function | Description |
|----------|-------------|
| `defineFeaturePlugin(config)` | Create a feature plugin bundle. |
| `registerFeaturePlugins(plugins, store)` | Register all plugins with the store. |

## TypeScript

Full strict TypeScript support. All composables return typed interfaces.

```ts
// Extend with your own route params
const { userId } = useMicroState<{ userId: number }>();
```

## Peer Dependencies

- `vue` >= 3.4.0
- `howler` >= 2.2.0 *(optional — only for `vue-micro-router/audio`)*

## License

MIT
