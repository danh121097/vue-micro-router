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

  const { persistRouteAttrs, getRouteAttrs } = useMicroRouter();
  provide(MICRO_ATTRS_READ_KEY, () => getRouteAttrs(path));
  // Persist-without-notify: the writer is `useMicroState` handing back state the
  // page already owns, so notifying would only re-render it with its own data.
  // `updateRouteAttrs` stays the notifying path for push(path, props).
  provide(MICRO_ATTRS_WRITE_KEY, (attrs: Record<string, unknown>) => {
    persistRouteAttrs(path, attrs);
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
