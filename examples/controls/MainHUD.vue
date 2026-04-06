<script setup lang="ts">
/**
 * Main HUD control — persistent overlay with navigation, history, and state controls.
 */
import { useMicroRouter } from '../../libs/index';

const {
  activePage,
  push,
  openDialog,
  canGoBack,
  canGoForward,
  historyBack,
  historyForward,
  serialize,
} = useMicroRouter();

function saveState() {
  if (!serialize) return;
  localStorage.setItem('vmr-snapshot', JSON.stringify(serialize()));
  console.log('[HUD] State saved');
}
</script>

<template>
  <div class="main-hud">
    <div class="hud-bar">
      <span class="hud-title">vue-micro-router</span>

      <!-- History back/forward -->
      <div class="hud-history">
        <button class="hud-btn icon-btn" :class="{ disabled: !canGoBack }" :disabled="!canGoBack"
          title="History back" @click="historyBack && historyBack()">←</button>
        <button class="hud-btn icon-btn" :class="{ disabled: !canGoForward }" :disabled="!canGoForward"
          title="History forward" @click="historyForward && historyForward()">→</button>
      </div>

      <span class="hud-page">{{ activePage }}</span>

      <div class="hud-actions">
        <button class="hud-btn" :class="{ active: activePage === 'home' }" @click="push('home')">Home</button>
        <button class="hud-btn" :class="{ active: activePage === 'settings' }" @click="push('settings')">Settings</button>
        <button class="hud-btn" :class="{ active: activePage === 'nested' }" @click="push('nested')">Nested</button>
        <button class="hud-btn" @click="openDialog('confirm', { title: 'Quick confirm', message: 'From HUD!' })">Dialog</button>
        <button class="hud-btn btn-save" title="Save router state" @click="saveState">💾</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-hud { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; pointer-events: auto; }
.hud-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.45rem 1rem; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(8px); border-bottom: 1px solid #1e293b; }
.hud-title { font-weight: 700; color: #38bdf8; font-size: 0.8rem; white-space: nowrap; }
.hud-history { display: flex; gap: 0.25rem; }
.hud-page { color: #94a3b8; font-size: 0.75rem; white-space: nowrap; }
.hud-actions { margin-left: auto; display: flex; gap: 0.4rem; align-items: center; }
.hud-btn { padding: 0.3rem 0.65rem; border: 1px solid #334155; border-radius: 0.375rem; background: transparent; color: #94a3b8; cursor: pointer; font-size: 0.72rem; transition: all 0.2s; line-height: 1; }
.hud-btn:hover:not(.disabled) { background: #1e293b; color: #e2e8f0; }
.hud-btn.active { background: #1e293b; color: #38bdf8; border-color: #38bdf8; }
.hud-btn.disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn { padding: 0.3rem 0.5rem; font-size: 0.8rem; }
.btn-save { border-color: #3b82f6; color: #93c5fd; }
.btn-save:hover { background: #1e3a5f; }
</style>
