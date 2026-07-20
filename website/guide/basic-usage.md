# Basic Usage

Declare your screens once in a feature plugin, then mount the router. With the `Register` pattern, everything is typed without generics.

## 1. Declare a feature plugin

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

## 2. Mount the router

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

## 3. Navigate

```ts
import { useMicroRouter } from 'vue-micro-router';

const { push, openDialog, toggleControl } = useMicroRouter();

push('menu');                        // slide the menu page in
openDialog('confirm');               // open a modal
toggleControl('main_gui', true);     // show a HUD control
```

## Next

Dive into [Navigation & Routing](/guide/core-concepts) for segment paths, props, guards, transitions, and history.
