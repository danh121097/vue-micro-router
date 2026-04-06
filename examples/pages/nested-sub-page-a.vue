<script setup lang="ts">
/**
 * Nested sub-page A — first page in the nested router stack.
 * Demonstrates independent navigation within a nested MicroRouterView.
 */
import { useMicroRouter } from '../../libs/index';

const { push } = useMicroRouter();
</script>

<template>
  <div class="sub-page sub-a">
    <h2>Sub-page A</h2>
    <p>Nested router — independent page stack.</p>
    <button @click="push('sub-b')">Go to Sub-page B →</button>
  </div>
</template>
