<script setup lang="ts">
/**
 * Basic example — demonstrates pages, dialogs, controls, and lifecycle hooks.
 *
 * Structure:
 *   - 3 pages: Home, Settings, Profile
 *   - 1 dialog: Confirm
 *   - 1 control: MainHUD
 */
import { MicroRouterView, defineFeaturePlugin } from '../libs/index';
import '../libs/styles/index.css';

import HomePage from './pages/HomePage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import ProfilePage from './pages/ProfilePage.vue';
import ConfirmDialog from './dialogs/ConfirmDialog.vue';
import MainHUD from './controls/MainHUD.vue';

const appPlugin = defineFeaturePlugin({
  name: 'basic-app',
  routes: [
    { path: 'home', component: HomePage },
    { path: 'settings', component: SettingsPage },
    { path: 'profile', component: ProfilePage },
  ],
  dialogs: [
    { path: 'confirm', component: ConfirmDialog, activated: false },
  ],
  controls: [
    { name: 'main_hud', component: MainHUD, activated: false },
  ],
});
</script>

<template>
  <MicroRouterView
    :config="{
      defaultPath: 'home',
      defaultControlName: 'main_hud',
    }"
    :plugins="[appPlugin]"
  />
</template>

<style>
/* Reset for example app */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
</style>
