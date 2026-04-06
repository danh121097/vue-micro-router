<script setup lang="ts">
import { provide } from 'vue';

import { MICRO_ATTRS_READ_KEY, MICRO_ATTRS_WRITE_KEY, MICRO_CONTROL_NAME_KEY } from '../core/constants';
import { useMicroRouter } from '../composables/use-micro-router';
import type { MicroControl } from '../core/types';

interface Props {
  control: MicroControl;
}

const props = defineProps<Props>();

const { getControlAttrs, updateControlAttrs } = useMicroRouter();

provide(MICRO_CONTROL_NAME_KEY, props.control.name);
provide(MICRO_ATTRS_READ_KEY, () => getControlAttrs(props.control.name));
provide(MICRO_ATTRS_WRITE_KEY, (attrs: Record<string, unknown>) => {
  updateControlAttrs(props.control.name, attrs);
});
</script>

<template>
  <component
    :is="control.component"
    :key="control.componentKey || 0"
    v-bind="control.attrs"
  />
</template>
