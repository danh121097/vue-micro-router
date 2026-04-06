<script setup lang="ts">
/**
 * Home page — demonstrates push navigation and opening dialogs.
 */
import { useMicroRouter, useRouteLifecycle } from '../../libs/index';

const { push, openDialog } = useMicroRouter();

useRouteLifecycle({
  onRouteEnter: () => console.log('[HomePage] entered'),
  onRouteLeave: () => console.log('[HomePage] left')
});

function goToSettings() {
  push('settings');
}

function goToProfile() {
  push('profile', { userId: 42, username: 'John Doe' });
}

function showConfirm() {
  openDialog('confirm', {
    title: 'Delete all data?',
    message: 'This action cannot be undone.',
    onConfirm: () => console.log('Confirmed!')
  });
}
</script>

<template>
  <div class="page home-page">
    <h1>Home</h1>
    <p>Segment-based micro router for Vue 3</p>

    <div class="actions">
      <button @click="goToSettings">Go to Settings</button>
      <button @click="goToProfile">Go to Profile (with props)</button>
      <button @click="showConfirm">Open Confirm Dialog</button>
    </div>

    <div class="info">
      <h3>How it works</h3>
      <ul>
        <li>
          <code>push('settings')</code> — appends segment →
          <code>/home/settings</code>
        </li>
        <li><code>push('profile', { userId: 42 })</code> — push with props</li>
        <li><code>push(-1)</code> — go back one step</li>
        <li><code>openDialog('confirm', { ... })</code> — open modal dialog</li>
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
  gap: 1.5rem;
  padding: 2rem;
}
h1 {
  font-size: 2.5rem;
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
  background: #1e293b;
  border-radius: 0.75rem;
  max-width: 500px;
}
.info h3 {
  margin-bottom: 0.75rem;
}
.info li {
  margin: 0.25rem 0;
  font-size: 0.85rem;
}
code {
  color: #38bdf8;
  font-size: 0.8rem;
}
</style>
