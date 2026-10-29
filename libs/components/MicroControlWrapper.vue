<script setup lang="ts">
import { onUpdated, provide, type VNode } from 'vue';

import {
  MICRO_ATTRS_READ_KEY,
  MICRO_ATTRS_WRITE_KEY,
  MICRO_CONTROL_NAME_KEY
} from '../core/constants';
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

/**
 * Put `data-micro-control` on the control's root element, and again after each
 * of its renders (a root behind `v-if` appears later). Set on the element
 * rather than passed as a fallthrough attribute: a fragment or teleport root
 * cannot inherit one, and Vue warns on every render when it is passed.
 */
function tagOwner(vnode: VNode) {
  const instance = vnode.component;
  if (!instance) return;
  const tag = () => {
    // `nodeType` 1 is an element; no `Node` global, which some test runners lack
    const el = instance.subTree.el as Element | null;
    if (el?.nodeType === 1) el.setAttribute('data-micro-control', props.control.name);
  };
  tag();
  onUpdated(tag, instance);
}
</script>

<template>
  <component
    :is="control.component"
    :key="control.componentKey || 0"
    v-bind="control.attrs"
    @vue:mounted="tagOwner"
  />
</template>
