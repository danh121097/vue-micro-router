<script setup lang="ts">
/**
 * Profile page — demonstrates reading props passed via push().
 */
import { useMicroRouter, useMicroState, useRouteLifecycle } from '../../libs/index';

const { push } = useMicroRouter();

// Read props passed via push('profile', { userId: 42, username: 'Danh' })
const { userId, username } = useMicroState({ userId: 0, username: 'Guest' });

useRouteLifecycle({
  onRouteEnter: () => console.log(`[ProfilePage] entered — userId=${userId.value}`),
  onRouteLeave: () => console.log('[ProfilePage] left'),
});
</script>

<template>
  <div class="page profile-page">
    <h1>Profile</h1>

    <div class="profile-card">
      <div class="avatar">{{ username.charAt(0).toUpperCase() }}</div>
      <div class="details">
        <p class="name">{{ username }}</p>
        <p class="id">User #{{ userId }}</p>
      </div>
    </div>

    <div class="actions">
      <button @click="push(-1)">← Back</button>
      <button @click="push(-2)">← Back to Home</button>
    </div>

    <div class="info">
      <h3>Props via push()</h3>
      <p>This page received <code>{ userId: {{ userId }}, username: '{{ username }}' }</code></p>
      <p>Read with <code>useMicroState({ userId: 0, username: 'Guest' })</code></p>
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
  background: #0a192f;
}
h1 { font-size: 2rem; }
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
.name { font-size: 1.2rem; font-weight: 600; }
.id { color: #94a3b8; font-size: 0.85rem; }
.actions { display: flex; gap: 0.75rem; }
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
button:hover { background: #334155; }
.info { margin-top: 1rem; padding: 1.5rem; background: #112240; border-radius: 0.75rem; max-width: 500px; }
.info h3 { margin-bottom: 0.5rem; }
.info p { font-size: 0.85rem; margin: 0.25rem 0; }
code { color: #38bdf8; font-size: 0.8rem; }
</style>
