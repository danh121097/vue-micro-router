<script setup lang="ts">
import { provide } from 'vue';

import {
  MICRO_ATTRS_READ_KEY,
  MICRO_ATTRS_WRITE_KEY,
  MICRO_ROUTE_PATH_KEY
} from '../core/constants';
import { useMicroRouter } from '../composables/use-micro-router';

interface Props {
  routePath?: string;
}

const props = defineProps<Props>();

if (props.routePath) {
  const path = props.routePath;
  provide(MICRO_ROUTE_PATH_KEY, path);

  const { updateRouteAttrs, getRouteAttrs } = useMicroRouter();
  provide(MICRO_ATTRS_READ_KEY, () => getRouteAttrs(path));
  provide(MICRO_ATTRS_WRITE_KEY, (attrs: Record<string, unknown>) => {
    updateRouteAttrs(path, attrs);
  });
}
</script>

<template>
  <div class="route-page">
    <div class="route-page__body">
      <slot />
    </div>
  </div>
</template>
