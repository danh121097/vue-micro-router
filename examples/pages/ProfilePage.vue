<script setup lang="ts">
import {
  useMicroRouter,
  useMicroState,
  useRouteLifecycle
} from '../../libs/index';

/** Exported for auto-generated route attrs type mapping */
export interface Attrs {
  userId: number;
  username: string;
  meta?: {
    title: string;
  };
}

const router = useMicroRouter();
const { userId, username, meta } = useMicroState<Attrs>();

useRouteLifecycle({
  onRouteEnter: () =>
    console.log(
      `[ProfilePage] entered — userId=${userId.value} username=${username.value} meta.title=${meta.value?.title}`
    ),
  onRouteLeave: () => console.log('[ProfilePage] left')
});
</script>

<template>
  <div class="page profile-page">
    <h1>Profile</h1>

    <div class="badges">
      <span class="badge blue">preload: adjacent</span>
      <span class="badge purple">viewTransition: true</span>
      <span class="badge green">beforeEnter guard</span>
    </div>

    <div class="profile-card">
      <div class="avatar">{{ username.charAt(0).toUpperCase() }}</div>
      <div class="details">
        <p class="name">{{ username }}</p>
        <p class="id">User #{{ userId }}</p>
      </div>
    </div>

    <div class="actions">
      <button @click="router.push(-1)">← Back</button>
      <button @click="router.push('home')">Home</button>
    </div>

    <div class="info">
      <h3>Type-Safe via Register</h3>
      <p>Declare plugin type once — auto-typed everywhere:</p>
      <pre class="code-block">
// app-plugin.ts — declare once
export const plugin = defineFeaturePlugin({ ... } as const);
declare module 'vue-micro-router' {
  interface Register { plugin: typeof plugin }
}

// Any component — no generic needed:
const store = useMicroRouter();
store.push('profile');               // OK
store.push('typo');                  // TS Error
store.openDialog('confirm');         // OK
store.toggleControl('main_hud', true); // OK</pre
      >
    </div>

    <div class="info">
      <h3>View Transition API</h3>
      <p>
        <code>viewTransition: true</code> opts in to the browser's View
        Transition API for shared element morphing. Falls back gracefully on
        unsupported browsers.
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
  min-height: 100%;
  gap: 1.25rem;
  padding: 2rem;
  background: #0a192f;
}
h1 {
  font-size: 2rem;
}
.badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}
.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 0.375rem;
  font-size: 0.72rem;
  border: 1px solid;
}
.badge.blue {
  border-color: #3b82f6;
  color: #93c5fd;
}
.badge.purple {
  border-color: #8b5cf6;
  color: #c4b5fd;
}
.badge.green {
  border-color: #10b981;
  color: #6ee7b7;
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: #1e293b;
  border-radius: 0.75rem;
}
.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
}
.name {
  font-size: 1.2rem;
  font-weight: 600;
}
.id {
  color: #94a3b8;
  font-size: 0.85rem;
}
.actions {
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
button:hover {
  background: #334155;
}
.info {
  padding: 1.25rem 1.5rem;
  background: #112240;
  border-radius: 0.75rem;
  max-width: 520px;
  width: 100%;
}
.info h3 {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #94a3b8;
}
.info p {
  font-size: 0.82rem;
  margin: 0.2rem 0;
}
code {
  color: #38bdf8;
  font-size: 0.78rem;
}
.code-block {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #0f172a;
  border-radius: 0.375rem;
  font-size: 0.72rem;
  color: #94a3b8;
  white-space: pre-wrap;
  font-family: monospace;
  border: 1px solid #1e293b;
}
</style>
