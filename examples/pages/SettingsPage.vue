<script setup lang="ts">
/**
 * Settings page — demonstrates back navigation and step-wise navigation.
 */
import {
  useMicroRouter,
  useRouteLifecycle,
  useMicroState
} from '../../libs/index';

const { push, stepWisePush } = useMicroRouter();

// useMicroState with defaults — read whatever was passed via push(), fill missing
const { theme } = useMicroState({ theme: 'dark' });

useRouteLifecycle({
  onRouteEnter: () => console.log('[SettingsPage] entered'),
  onRouteLeave: () => console.log('[SettingsPage] left')
});
</script>

<template>
  <div class="page settings-page">
    <h1>Settings</h1>
    <p>
      Current theme: <strong>{{ theme }}</strong>
    </p>

    <div class="actions">
      <button @click="push(-1)">← Back</button>
      <button @click="theme = theme === 'dark' ? 'light' : 'dark'">
        Toggle Theme
      </button>
      <button @click="stepWisePush('profile')">Step-wise → Profile</button>
    </div>

    <div class="info">
      <h3>State Bridge</h3>
      <p>
        <code>useMicroState({ theme: 'dark' })</code> reads props from the
        store.
      </p>
      <p>
        Mutations auto-sync back — toggle theme above and navigate away, the
        value persists.
      </p>
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
  gap: 1.5rem;
  padding: 2rem;
  background: #1a1a2e;
}
h1 {
  font-size: 2rem;
}
.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}
button {
  padding: 0.75rem 1.5rem;
  border: 1px solid #475569;
  border-radius: 0.5rem;
  background: #1e293b;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}
button:hover {
  background: #334155;
}
.info {
  margin-top: 1rem;
  padding: 1.5rem;
  background: #16213e;
  border-radius: 0.75rem;
  max-width: 500px;
}
.info h3 {
  margin-bottom: 0.5rem;
}
.info p {
  font-size: 0.85rem;
  margin: 0.25rem 0;
}
code {
  color: #38bdf8;
  font-size: 0.8rem;
}
</style>
