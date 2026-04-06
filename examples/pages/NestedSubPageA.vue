<script setup lang="ts">
/**
 * Nested sub-page A — first page in the nested router stack.
 * Demonstrates typed nested navigation via explicit generic.
 */
import { useMicroRouter } from '../../libs/index';
import type { nestedPlugin } from './nested-demo-plugin';

// Explicit generic for nested router — 'sub-a' | 'sub-b' autocomplete
const { push } = useMicroRouter<typeof nestedPlugin>();
</script>

<template>
  <div class="sub-page sub-a">
    <h2>Sub-page A</h2>
    <p>Nested router — independent page stack.</p>
    <button @click="push('sub-b')">Go to Sub-page B →</button>
  </div>
</template>
