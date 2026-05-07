<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref } from 'vue';

import {
  MICRO_ATTRS_READ_KEY,
  MICRO_ATTRS_WRITE_KEY,
  MICRO_ROUTE_PATH_KEY
} from '../core/constants';
import { useMicroRouter } from '../composables/use-micro-router';
import { focusInputWhenReady } from '../utils/dialog-focus';

interface Props {
  routePath?: string;
}

const props = defineProps<Props>();
const pageRef = ref<HTMLElement | null>(null);
let cancelPendingFocus: (() => void) | null = null;

if (props.routePath) {
  const path = props.routePath;
  provide(MICRO_ROUTE_PATH_KEY, path);

  const { updateRouteAttrs, getRouteAttrs } = useMicroRouter();
  provide(MICRO_ATTRS_READ_KEY, () => getRouteAttrs(path));
  provide(MICRO_ATTRS_WRITE_KEY, (attrs: Record<string, unknown>) => {
    updateRouteAttrs(path, attrs);
  });
}

onMounted(() => {
  cancelPendingFocus = focusInputWhenReady(
    () => pageRef.value,
    true,
    false
  );
});

onBeforeUnmount(() => {
  cancelPendingFocus?.();
});
</script>

<template>
  <div ref="pageRef" class="route-page">
    <div class="route-page__body">
      <slot />
    </div>
  </div>
</template>
