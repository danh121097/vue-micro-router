/**
 * App plugin definition — exported so its type can be used with useMicroRouter<typeof appPlugin>().
 *
 * Using `as const` on the config preserves literal path/name types,
 * enabling type-safe push/openDialog/toggleControl across all components.
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

/** Plugin type — use with useMicroRouter<AppPlugin>() for type-safe store */
export type AppPlugin = typeof appPlugin;
