<script setup lang="ts">
/**
 * Home page — demonstrates:
 *   Phase 2: History back/forward with canGoBack/canGoForward
 *   Phase 2: State serialization — save to localStorage, restore
 *   Phase 1: Route guard info display
 *   Core: push navigation, dialog, lifecycle hooks
 */
import { computed } from 'vue';
import { useMicroRouter, useRouteLifecycle } from '../../libs/index';
import type { SerializedState } from '../../libs/index';

const {
  push,
  openDialog,
  canGoBack,
  canGoForward,
  historyBack,
  historyForward,
  serialize,
  restore,
} = useMicroRouter();

// Phase 2: Serialize current state label
const serializedLabel = computed(() => {
  const saved = localStorage.getItem('vmr-snapshot');
  return saved ? 'Restore Saved State' : 'No Saved State';
});

useRouteLifecycle({
  onRouteEnter: () => console.log('[HomePage] entered'),
  onRouteLeave: () => console.log('[HomePage] left'),
});

function goToSettings() {
  push('settings');
}

function goToProfile() {
  push('profile', { userId: 42, username: 'John Doe' });
}

function goToAdmin() {
  push('admin');
}

function goToNested() {
  push('nested');
}

function showConfirm() {
  openDialog('confirm', {
    title: 'Delete all data?',
    message: 'This action cannot be undone.',
    onConfirm: () => console.log('Confirmed!'),
  });
}

// Phase 2: Save current router state to localStorage
function saveState() {
  if (!serialize) return;
  const snapshot = serialize();
  localStorage.setItem('vmr-snapshot', JSON.stringify(snapshot));
  console.log('[Serialize] State saved:', snapshot);
}

// Phase 2: Restore saved state from localStorage
async function restoreState() {
  if (!restore) return;
  const raw = localStorage.getItem('vmr-snapshot');
  if (!raw) return console.warn('[Restore] No saved state found');
  const snapshot = JSON.parse(raw) as SerializedState;
  await restore(snapshot);
  console.log('[Restore] State restored:', snapshot);
}
</script>

<template>
  <div class="page home-page">
    <h1>Home</h1>
    <p>Segment-based micro router for Vue 3</p>

    <!-- Phase 2: History navigation controls -->
    <div class="history-bar">
      <button
        :disabled="!canGoBack"
        :class="{ disabled: !canGoBack }"
        @click="historyBack && historyBack()"
      >
        ← Back
      </button>
      <span class="history-label">History</span>
      <button
        :disabled="!canGoForward"
        :class="{ disabled: !canGoForward }"
        @click="historyForward && historyForward()"
      >
        Forward →
      </button>
    </div>

    <div class="actions">
      <button @click="goToSettings">Settings (fade)</button>
      <button @click="goToProfile">Profile (viewTransition)</button>
      <button @click="goToAdmin">Admin (guarded)</button>
      <button @click="goToNested">Nested Router</button>
      <button @click="showConfirm">Open Dialog</button>
    </div>

    <!-- Phase 2: State serialization controls -->
    <div class="serialize-bar">
      <button class="btn-save" @click="saveState">Save State</button>
      <button class="btn-restore" @click="restoreState">{{ serializedLabel }}</button>
    </div>

    <div class="info">
      <h3>Phase 1-3 Features Active</h3>
      <ul>
        <li><code>push('settings')</code> — fade transition (300ms)</li>
        <li><code>push('profile', props)</code> — viewTransition + preload:adjacent</li>
        <li><code>push('admin')</code> — blocked by authGuard unless authenticated</li>
        <li><code>push('nested')</code> — nested router with independent page stack</li>
        <li><code>historyBack()</code> / <code>historyForward()</code> — Phase 2 history</li>
        <li><code>serialize()</code> / <code>restore()</code> — session persistence</li>
        <li>Swipe from left edge — Phase 3 gesture back navigation</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1.25rem;
  padding: 2rem;
}
h1 { font-size: 2.5rem; }
.history-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.history-label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}
.serialize-bar {
  display: flex;
  gap: 0.75rem;
}
button {
  padding: 0.65rem 1.25rem;
  border: 1px solid #475569;
  border-radius: 0.5rem;
  background: #1e293b;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}
button:hover:not(.disabled) { background: #334155; }
button.disabled { opacity: 0.35; cursor: not-allowed; }
.btn-save { border-color: #3b82f6; color: #93c5fd; }
.btn-save:hover { background: #1e3a5f; }
.btn-restore { border-color: #10b981; color: #6ee7b7; }
.btn-restore:hover { background: #064e3b; }
.info {
  padding: 1.25rem 1.5rem;
  background: #1e293b;
  border-radius: 0.75rem;
  max-width: 520px;
  width: 100%;
}
.info h3 { margin-bottom: 0.6rem; font-size: 0.9rem; color: #94a3b8; }
.info li { margin: 0.3rem 0; font-size: 0.8rem; }
code { color: #38bdf8; font-size: 0.78rem; }
</style>
