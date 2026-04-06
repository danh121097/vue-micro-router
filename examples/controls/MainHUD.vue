<script setup lang="ts">
/**
 * Main HUD control — persistent overlay with navigation buttons.
 * Demonstrates GUI controls and toggleControl.
 */
import { useMicroRouter } from '../../libs/index';

const { activePage, push, toggleControl, openDialog } = useMicroRouter();
</script>

<template>
  <div class="main-hud">
    <div class="hud-bar">
      <span class="hud-title">vue-micro-router</span>
      <span class="hud-page">📍 {{ activePage }}</span>
      <div class="hud-actions">
        <button
          @click="push('home')"
          :class="{ active: activePage === 'home' }"
        >
          Home
        </button>
        <button
          @click="push('settings')"
          :class="{ active: activePage === 'settings' }"
        >
          Settings
        </button>
        <button
          @click="
            openDialog('confirm', {
              title: 'Quick confirm',
              message: 'From HUD!'
            })
          "
        >
          Dialog
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: auto;
}
.hud-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #1e293b;
}
.hud-title {
  font-weight: 700;
  color: #38bdf8;
  font-size: 0.85rem;
}
.hud-page {
  color: #94a3b8;
  font-size: 0.8rem;
}
.hud-actions {
  margin-left: auto;
  display: flex;
  gap: 0.5rem;
}
.hud-actions button {
  padding: 0.35rem 0.75rem;
  border: 1px solid #334155;
  border-radius: 0.375rem;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}
.hud-actions button:hover {
  background: #1e293b;
  color: #e2e8f0;
}
.hud-actions button.active {
  background: #1e293b;
  color: #38bdf8;
  border-color: #38bdf8;
}
</style>
