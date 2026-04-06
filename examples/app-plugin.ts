/**
 * App plugin definition — type registered globally via module augmentation.
 *
 * Using `as const` preserves literal path/name types.
 * Register pattern: declare once → useMicroRouter() auto-typed everywhere.
 */
import { defineFeaturePlugin } from '../libs/index';

import HomePage from './pages/HomePage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import ProfilePage from './pages/ProfilePage.vue';
import AdminPage from './pages/AdminPage.vue';
import NestedDemoPage from './pages/NestedDemoPage.vue';
import ConfirmDialog from './dialogs/ConfirmDialog.vue';
import MainHUD from './controls/MainHUD.vue';

export const appPlugin = defineFeaturePlugin({
  name: 'showcase-app',
  routes: [
    { path: 'home', component: HomePage },
    { path: 'settings', component: SettingsPage },
    {
      path: 'profile',
      component: ProfilePage,
      preload: 'adjacent' as const,
      viewTransition: true
    },
    { path: 'admin', component: AdminPage },
    { path: 'nested', component: NestedDemoPage, preload: 'eager' as const }
  ],
  dialogs: [{ path: 'confirm', component: ConfirmDialog, activated: false }],
  controls: [{ name: 'main_hud', component: MainHUD, activated: false }]
} as const);

/** Plugin type — auto-registered via `bun run gen:types` → vue-micro-router.d.ts */
export type AppPlugin = typeof appPlugin;
