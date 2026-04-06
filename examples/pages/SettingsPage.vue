<script setup lang="ts">
/**
 * Settings page — demonstrates:
 *   - beforeLeave guard (confirm unsaved changes)
 *   - Fade transition (configured in App.vue)
 *   - stepWisePush navigation
 *   - State serialization preview
 */
import { ref } from 'vue';
import { useMicroRouter, useRouteLifecycle, useMicroState } from '../../libs/index';

const { push, stepWisePush, serialize } = useMicroRouter();
const { theme } = useMicroState({ theme: 'dark' });

const hasUnsavedChanges = ref(false);
const serializedPreview = ref('');

useRouteLifecycle({
  onRouteEnter: () => console.log('[SettingsPage] entered'),
  onRouteLeave: () => console.log('[SettingsPage] left'),
});

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  hasUnsavedChanges.value = true;
}

function saveSettings() {
  hasUnsavedChanges.value = false;
  console.log('[Settings] Saved — theme:', theme.value);
}

function showSerializedState() {
  if (!serialize) return;
  serializedPreview.value = JSON.stringify(serialize(), null, 2);
}
</script>

<template>
  <div class="page settings-page">
    <h1>Settings</h1>

    <div class="status-row">
      <span class="badge">transition: fade 300ms</span>
      <span class="badge" :class="{ warn: hasUnsavedChanges }">
        {{ hasUnsavedChanges ? 'Unsaved changes' : 'Saved' }}
      </span>
    </div>

    <p>Current theme: <strong>{{ theme }}</strong></p>

    <div class="actions">
      <button @click="push(-1)">← Back</button>
      <button @click="toggleTheme">Toggle Theme</button>
      <button class="btn-save" :disabled="!hasUnsavedChanges" @click="saveSettings">Save</button>
      <button @click="stepWisePush('profile')">Step-wise → Profile</button>
    </div>

    <div class="actions">
      <button class="btn-serialize" @click="showSerializedState">Show Serialized State</button>
    </div>

    <div class="info">
      <h3>beforeLeave Guard</h3>
      <p>Toggle theme (marks unsaved), then navigate away — a confirmation prompt appears.</p>
      <code class="block">// In route config or useRouteLifecycle
        beforeLeave: (to, from) => {
        if (hasUnsavedChanges) return confirm('Leave?');
        return true;
        }</code>
    </div>

    <div v-if="serializedPreview" class="serialized-output">
      <h3>Serialized State</h3>
      <pre>{{ serializedPreview }}</pre>
    </div>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; gap: 1.25rem; padding: 2rem; background: #1a1a2e; }
h1 { font-size: 2rem; }
.status-row { display: flex; gap: 0.5rem; }
.badge { padding: 0.2rem 0.6rem; border-radius: 0.375rem; font-size: 0.72rem; background: #1e293b; border: 1px solid #334155; color: #94a3b8; }
.badge.warn { border-color: #f59e0b; color: #fbbf24; }
.actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; }
button { padding: 0.65rem 1.25rem; border: 1px solid #475569; border-radius: 0.5rem; background: #1e293b; color: #e2e8f0; cursor: pointer; font-size: 0.85rem; transition: background 0.2s; }
button:hover:not(:disabled) { background: #334155; }
button:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-save { border-color: #10b981; color: #6ee7b7; }
.btn-serialize { border-color: #8b5cf6; color: #c4b5fd; }
.btn-serialize:hover { background: #2e1065; }
.info { padding: 1.25rem 1.5rem; background: #16213e; border-radius: 0.75rem; max-width: 500px; width: 100%; }
.info h3 { margin-bottom: 0.5rem; font-size: 0.9rem; color: #94a3b8; }
.info p { font-size: 0.82rem; margin: 0.2rem 0; }
code { color: #38bdf8; font-size: 0.78rem; }
code.block { display: block; margin-top: 0.5rem; padding: 0.5rem; background: #0f172a; border-radius: 0.375rem; white-space: pre-wrap; font-family: monospace; }
.serialized-output { padding: 1rem 1.25rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.75rem; max-width: 500px; width: 100%; max-height: 200px; overflow-y: auto; }
.serialized-output h3 { font-size: 0.85rem; color: #8b5cf6; margin-bottom: 0.5rem; }
pre { font-size: 0.72rem; color: #94a3b8; white-space: pre-wrap; }
</style>
