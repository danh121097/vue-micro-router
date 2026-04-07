<script setup lang="ts">
/**
 * Root app — showcases all vue-micro-router features including type-safe plugin inference.
 */
import { ref } from 'vue';
import { MicroRouterView } from '../libs/index';
import type { MicroRouterConfig, NavigationGuard } from '../libs/index';
import '../libs/styles/index.css';

import { isAuthenticated } from './auth-state';
import { appPlugin } from './app-plugin';

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

const bgmVolume = ref(80);
const config: MicroRouterConfig = {
  defaultPath: 'home',
  defaultControlName: 'main_hud',
  history: { enabled: true, maxEntries: 50 },
  gesture: { enabled: true, edgeWidth: 30, threshold: 0.3 },
  guards: {
    beforeEach: [authGuard],
    afterEach: [analyticsHook]
  },
  volumeRef: bgmVolume,
  defaultBgm: '/audios/default.mp3'
};
</script>

<template>
  <MicroRouterView :config="config" :plugins="[appPlugin]" />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: system-ui, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}
</style>
