<script setup lang="ts">
/**
 * NestedDemoPage — demonstrates:
 *   Phase 3: <MicroRouterView nested> with its own independent page stack
 *   Phase 3: Nested router navigation is isolated from the parent router
 *   Core: useMicroRouter({ root: true }) to reach parent from inside nested
 */
import { defineFeaturePlugin, MicroRouterView, useMicroRouter } from '../../libs/index';

import SubPageA from './nested-sub-page-a.vue';
import SubPageB from './nested-sub-page-b.vue';

// Parent router — exits the nested page entirely
const { push } = useMicroRouter({ root: true });

const nestedPlugin = defineFeaturePlugin({
  name: 'nested-demo',
  routes: [
    { path: 'sub-a', component: SubPageA, transition: 'slide' },
    { path: 'sub-b', component: SubPageB, transition: 'fade' },
  ],
});
</script>

<template>
  <div class="page nested-page">
    <div class="outer-header">
      <span class="badge">Phase 3: Nested Router</span>
      <button class="btn-back" @click="push(-1)">← Exit Nested</button>
    </div>

    <h1>Nested Router Demo</h1>
    <p class="subtitle">
      The box below is an independent <code>&lt;MicroRouterView nested&gt;</code>
      with its own page stack. Navigation inside doesn't affect the parent.
    </p>

    <!-- Phase 3: nested MicroRouterView — isolated from parent router -->
    <div class="nested-container">
      <MicroRouterView
        nested
        :config="{
          defaultPath: 'sub-a',
          defaultControlName: '',
        }"
        :plugins="[nestedPlugin]"
      />
    </div>

    <div class="info">
      <h3>How Nested Routers Work</h3>
      <pre class="code-block">&lt;!-- Parent page template --&gt;
&lt;MicroRouterView
  nested
  :config="{ defaultPath: 'sub-a', defaultControlName: '' }"
  :plugins="[nestedPlugin]"
/&gt;

// Inside nested sub-page:
const nested = useMicroRouter();           // nearest router
const root   = useMicroRouter({ root: true }); // outermost router</pre>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 2rem;
  padding-top: 4rem;
  min-height: 100%;
  background: #0f1729;
  position: relative;
}
.outer-header {
  position: absolute;
  top: 3.5rem;
  left: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 0.375rem;
  font-size: 0.72rem;
  border: 1px solid #6366f1;
  color: #a5b4fc;
}
.btn-back {
  padding: 0.4rem 0.9rem;
  border: 1px solid #475569;
  border-radius: 0.375rem;
  background: #1e293b;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.2s;
}
.btn-back:hover { background: #334155; }
h1 { font-size: 1.75rem; }
.subtitle {
  color: #94a3b8;
  font-size: 0.85rem;
  text-align: center;
  max-width: 460px;
}
.nested-container {
  width: 100%;
  max-width: 520px;
  height: 220px;
  border: 2px solid #6366f1;
  border-radius: 0.75rem;
  overflow: hidden;
  position: relative;
  background: #0f172a;
}
.info {
  padding: 1.25rem 1.5rem;
  background: #1e293b;
  border-radius: 0.75rem;
  max-width: 520px;
  width: 100%;
}
.info h3 { margin-bottom: 0.5rem; font-size: 0.9rem; color: #94a3b8; }
code { color: #38bdf8; font-size: 0.78rem; }
.code-block {
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

<style>
/* Sub-page styles — global so they apply inside the nested router's shadow */
.sub-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  padding: 1.25rem;
}
.sub-page h2 { font-size: 1.25rem; color: #e2e8f0; }
.sub-page p  { font-size: 0.82rem; color: #94a3b8; }
.sub-a { background: #0d1b2a; }
.sub-b { background: #1a0d2e; }
.sub-actions { display: flex; gap: 0.5rem; }
.sub-page button {
  padding: 0.5rem 1rem;
  border: 1px solid #475569;
  border-radius: 0.375rem;
  background: #1e293b;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.2s;
}
.sub-page button:hover { background: #334155; }
</style>
