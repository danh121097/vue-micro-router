<script setup lang="ts">
import { computed } from 'vue';

import { useGlobalMicroRouter } from '../composables/use-micro-router';
import { registerFeaturePlugins } from '../plugins/feature-plugin-manager';
import type { FeaturePlugin, MicroRouterConfig } from '../core/types';
import MicroControlWrapper from './MicroControlWrapper.vue';
import MicroDialog from './MicroDialog.vue';
import RoutePage from './RoutePage.vue';

interface Props {
  /** Required config — must provide defaultPath and defaultControlName */
  config: MicroRouterConfig;
  plugins?: FeaturePlugin[];
}

const props = defineProps<Props>();

const store = useGlobalMicroRouter(props.config);

// Register plugins synchronously so controls exist before onMounted toggles main_gui
if (props.plugins?.length) registerFeaturePlugins(props.plugins, store);

const {
  resolveRoutes,
  resolveDialogs,
  resolveControls,
  fromPath,
  toPath,
  closeDialog
} = store;

const hasSharedSegments = computed(() => {
  const fromSegments = fromPath.value.split('/').filter(Boolean);
  const toSegments = toPath.value.split('/').filter(Boolean);
  return fromSegments.some((s) => toSegments.includes(s));
});
const showGUI = computed(() => resolveControls.value.length > 0);
</script>

<template>
  <TransitionGroup name="page-slide" :css="hasSharedSegments">
    <RoutePage
      v-for="(route, i) in resolveRoutes"
      :key="route.key || route.path"
      :route-path="route.path"
      :class="{
        deactive: resolveRoutes.length > 1 && i !== resolveRoutes.length - 1
      }"
      :style="{
        transition: hasSharedSegments
          ? 'transform .5s cubic-bezier(0.65, 0, 0.35, 1)'
          : 'none',
        zIndex: i
      }"
    >
      <component
        :is="route.component"
        :key="route.componentKey"
        v-bind="store.getRouteAttrs(route.path)"
      />
    </RoutePage>
  </TransitionGroup>

  <!-- Content slot layer -->
  <div class="micro-router-content-layer">
    <slot />
  </div>

  <!-- GUI controls layer -->
  <div class="micro-router-gui-layer" :class="{ 'gui-visible': showGUI }">
    <TransitionGroup name="control-fade">
      <MicroControlWrapper
        v-for="control in resolveControls"
        :key="control.name + '-' + (control.componentKey || 0)"
        :control="control"
      />
    </TransitionGroup>
  </div>

  <!-- Dialog layer -->
  <MicroDialog
    v-for="(dialog, index) in resolveDialogs"
    :key="'dialog-' + dialog.path"
    :dialog="dialog"
    :stack-index="index"
    @close="closeDialog"
  />
</template>
