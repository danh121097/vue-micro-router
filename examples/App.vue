<script setup lang="ts">
/**
 * App.vue — Full feature showcase for vue-micro-router Phase 1-3.
 *
 * Demonstrates:
 *   Phase 1: Route guards (global beforeEach), per-route transitions, audio adapter config
 *   Phase 2: History enabled, typesafe routes, state serialization, preloading
 *   Phase 3: Gesture navigation, nested routers, devtools (auto in dev), viewTransition
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

// ── Simulated auth state (Phase 1: guard demo) ─────────────────────────────
export const isAuthenticated = ref(false);

const appPlugin = defineFeaturePlugin({
  name: 'showcase-app',
  routes: [
    // Phase 2: default route (no preload)
    {
      path: 'home',
      component: HomePage,
      // Phase 1: 'slide' is default — explicit for clarity
      transition: 'slide',
      transitionDuration: 400,
    },
    {
      path: 'settings',
      component: SettingsPage,
      // Phase 1: per-route transition — fade instead of slide
      transition: 'fade',
      transitionDuration: 300,
      // Phase 1: beforeLeave guard defined on the page itself (see SettingsPage.vue)
    },
    {
      path: 'profile',
      component: ProfilePage,
      // Phase 2: preload adjacent routes after each nav
      preload: 'adjacent',
      // Phase 3: opt-in View Transition API (shared element morphing, Chrome 111+)
      viewTransition: true,
      // Phase 1: per-route beforeEnter guard
      beforeEnter: (_to, _from) => {
        console.log('[ProfileGuard] Allowing entry to profile');
        return true;
      },
    },
    {
      path: 'admin',
      component: AdminPage,
      // Phase 1: 'none' = instant navigation, no animation
      transition: 'none',
    },
    {
      path: 'nested',
      component: NestedDemoPage,
      transition: 'slide',
      // Phase 2: eager preload — load component immediately on mount
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

/**
 * Phase 1: Global beforeEach guard — blocks admin page unless authenticated.
 * Guards return false to cancel navigation.
 */
const authGuard: NavigationGuard = (to, _from) => {
  if (to.endsWith('admin') && !isAuthenticated.value) {
    console.warn('[AuthGuard] Blocked navigation to admin — not authenticated');
    return false;
  }
  return true;
};

const analyticsHook = (to: string, from: string) => {
  console.log(`[Analytics] ${from} → ${to}`);
};
</script>

<template>
  <!--
    Full config showcasing ALL Phase 1-3 features:
    - guards.beforeEach       → Phase 1: global navigation guard
    - guards.afterEach        → Phase 1: post-navigation hook (analytics)
    - history.enabled         → Phase 2: back/forward history tracking
    - gesture.enabled         → Phase 3: swipe-back gesture navigation
    - Per-route transition/preload/viewTransition set in plugin above
    - Devtools: auto-enabled in dev mode (no config needed)
  -->
  <MicroRouterView
    :config="{
      defaultPath: 'home',
      defaultControlName: 'main_hud',
      history: { enabled: true, maxEntries: 50 },
      gesture: { enabled: true, edgeWidth: 30, threshold: 80 },
      guards: {
        beforeEach: [authGuard],
        afterEach: [analyticsHook],
      },
    }"
    :plugins="[appPlugin]"
  />
</template>

<style>
/* Reset for example app */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
</style>
