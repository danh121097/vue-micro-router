<script setup lang="ts">
/**
 * Nested sub-page B — second page in the nested router stack.
 * Demonstrates: typed nested nav + root router escape.
 */
import { useMicroRouter } from '../../libs/index';
import type { nestedPlugin } from './nested-demo-plugin';

// Nested router — explicit generic for 'sub-a' | 'sub-b' autocomplete
const { push } = useMicroRouter<typeof nestedPlugin>();

// Root router — auto-typed via Register ('home' | 'settings' | ... autocomplete)
const root = useMicroRouter({ root: true });
</script>

<template>
  <div class="sub-page sub-b">
    <h2>Sub-page B</h2>
    <p>Back only affects the nested stack, not the parent.</p>
    <div class="sub-actions">
      <button @click="push(-1)">← Nested Back</button>
      <button @click="root.push('home')">Root → Home</button>
    </div>
  </div>
</template>
