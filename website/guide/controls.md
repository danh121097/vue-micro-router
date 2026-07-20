# GUI Controls & Lifecycle

Persistent overlay controls (HUDs, toolbars), lifecycle hooks, feature plugins, analytics tracking, and devtools.

## GUI Controls

Persistent overlay controls that auto-manage visibility:

```ts
const { toggleControl } = useMicroRouter();

// Show inventory HUD (auto-hides default main_gui)
toggleControl('inventory', true, { filter: 'weapons' });

// Hide inventory (auto-restores main_gui)
toggleControl('inventory', false);
```

## Lifecycle Hooks

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

## Feature Plugins

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

## Analytics / Page Tracking

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

## Vue Devtools

Automatic in development — shows a "Micro Router" inspector tab with:
- Current path and page stack
- Open dialogs with attrs
- Active controls
- Navigation timeline events

Requires `@vue/devtools-api` (optional peer dependency). Zero cost in production builds.
