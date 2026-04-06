<script setup lang="ts">
/**
 * Nested sub-page B — second page in the nested router stack.
 * Demonstrates: nested back nav vs root router escape via { root: true }.
 */
import { useMicroRouter } from '../../libs/index';

// Nearest (nested) router — back only affects the nested stack
const { push } = useMicroRouter();

// Root (parent) router — escapes the nested context entirely
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
