<script setup lang="ts">
/**
 * Admin page — demonstrates:
 *   - Global beforeEach guard blocks unless authenticated (see App.vue)
 *   - transition:'none' — instant navigation, no animation
 *   - Auth state toggle for testing guard behavior
 */
import { useMicroRouter } from '../../libs/index';
import { isAuthenticated } from '../auth-state';

const { push } = useMicroRouter();
</script>

<template>
  <div class="page admin-page">
    <div class="admin-header">
      <span class="badge-instant">transition: none</span>
      <span class="badge-guard">authGuard protected</span>
    </div>

    <div class="shield-icon">🔒</div>
    <h1>Admin Panel</h1>
    <p class="subtitle">You are authenticated — guard allowed entry.</p>

    <div class="auth-toggle">
      <label>
        <input v-model="isAuthenticated" type="checkbox" />
        Authenticated (controls authGuard)
      </label>
    </div>

    <div class="actions">
      <button @click="push(-1)">← Back</button>
      <button @click="push('home')">Home</button>
    </div>

    <div class="info">
      <h3>Route Guard + Instant Transition</h3>
      <p>
        Protected by a global <code>beforeEach</code> guard in App.vue.
        Uncheck "Authenticated" then navigate here from Home — guard blocks it.
      </p>
      <pre class="code-block">// App.vue — global guard
const authGuard: NavigationGuard = (to) => {
  if (to.endsWith('admin') &amp;&amp; !isAuthenticated.value) return false;
  return true;
};

// Route config
{ path: 'admin', component: AdminPage, transition: 'none' }</pre>
    </div>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; gap: 1.25rem; padding: 2rem; background: #1a0a0a; }
.admin-header { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
.badge-instant, .badge-guard { padding: 0.2rem 0.6rem; border-radius: 0.375rem; font-size: 0.72rem; border: 1px solid; }
.badge-instant { border-color: #64748b; color: #94a3b8; }
.badge-guard { border-color: #ef4444; color: #fca5a5; }
.shield-icon { font-size: 3rem; }
h1 { font-size: 2rem; }
.subtitle { color: #94a3b8; font-size: 0.9rem; }
.auth-toggle { padding: 0.75rem 1.25rem; background: #1e293b; border-radius: 0.5rem; border: 1px solid #334155; font-size: 0.85rem; }
.auth-toggle label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.auth-toggle input { accent-color: #ef4444; }
.actions { display: flex; gap: 0.75rem; }
button { padding: 0.65rem 1.25rem; border: 1px solid #475569; border-radius: 0.5rem; background: #1e293b; color: #e2e8f0; cursor: pointer; font-size: 0.85rem; transition: background 0.2s; }
button:hover { background: #334155; }
.info { padding: 1.25rem 1.5rem; background: #1e0a0a; border: 1px solid #7f1d1d; border-radius: 0.75rem; max-width: 520px; width: 100%; }
.info h3 { margin-bottom: 0.5rem; font-size: 0.9rem; color: #f87171; }
.info p { font-size: 0.82rem; margin: 0.2rem 0; color: #cbd5e1; }
code { color: #38bdf8; font-size: 0.78rem; }
.code-block { margin-top: 0.75rem; padding: 0.75rem; background: #0f172a; border-radius: 0.375rem; font-size: 0.72rem; color: #94a3b8; white-space: pre-wrap; font-family: monospace; border: 1px solid #1e293b; }
</style>
