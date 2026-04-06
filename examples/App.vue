<script setup lang="ts">
/**
 * Root app — showcases all vue-micro-router features:
 *   - Global navigation guards (auth check)
 *   - Per-route transitions (slide/fade/none)
 *   - Navigation history (back/forward)
 *   - Gesture navigation (swipe-back)
 *   - Route preloading (eager/adjacent)
 *   - View Transition API
 *   - Nested routers
 *   - State serialization
 *   - Devtools (auto-enabled in dev mode)
 */
import { ref } from 'vue';
import { MicroRouterView, defineFeaturePlugin } from '../libs/index';
import type { NavigationGuard } from '../libs/index';
import '../libs/styles/index.css';

import HomePage from './pages/HomePage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import ProfilePage from './pages/ProfilePage.vue';
import AdminPage from './pages/AdminPage.vue';
import NestedDemoPage from './pages/NestedDemoPage.vue';
import ConfirmDialog from './dialogs/ConfirmDialog.vue';
import MainHUD from './controls/MainHUD.vue';

/** Simulated auth state — toggle in AdminPage to test guard behavior */
export const isAuthenticated = ref(false);

const appPlugin = defineFeaturePlugin({
  name: 'showcase-app',
  routes: [
    {
      path: 'home',
      component: HomePage,
      transition: 'slide',
      transitionDuration: 400,
    },
    {
      path: 'settings',
      component: SettingsPage,
      transition: 'fade',
      transitionDuration: 300,
    },
    {
      path: 'profile',
      component: ProfilePage,
      preload: 'adjacent',
      viewTransition: true,
      beforeEnter: (_to, _from) => {
        console.log('[Guard] Allowing profile entry');
        return true;
      },
    },
    {
      path: 'admin',
      component: AdminPage,
      transition: 'none',
    },
    {
      path: 'nested',
      component: NestedDemoPage,
      transition: 'slide',
      preload: 'eager',
    },
  ],
  dialogs: [
    { path: 'confirm', component: ConfirmDialog, activated: false },
  ],
  controls: [
    { name: 'main_hud', component: MainHUD, activated: false },
  ],
});

/** Global guard — blocks admin page unless authenticated */
const authGuard: NavigationGuard = (to, _from) => {
  if (to.endsWith('admin') && !isAuthenticated.value) {
    console.warn('[Guard] Blocked: not authenticated');
    return false;
  }
  return true;
};

const analyticsHook = (to: string, from: string) => {
  console.log(`[Analytics] ${from} → ${to}`);
};
</script>

<template>
  <MicroRouterView
    :config="{
      defaultPath: 'home',
      defaultControlName: 'main_hud',
      history: { enabled: true, maxEntries: 50 },
      gesture: { enabled: true, edgeWidth: 30, threshold: 0.3 },
      guards: {
        beforeEach: [authGuard],
        afterEach: [analyticsHook],
      },
    }"
    :plugins="[appPlugin]"
  />
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
</style>
