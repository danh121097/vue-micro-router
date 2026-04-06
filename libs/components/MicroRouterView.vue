<script setup lang="ts">
import { computed, ref } from 'vue';

import { useGlobalMicroRouter } from '../composables/use-micro-router';
import { useGestureNavigation } from '../composables/use-gesture-navigation';
import { registerFeaturePlugins } from '../plugins/feature-plugin-manager';
import type { FeaturePlugin, MicroRouterConfig } from '../core/types';
import MicroControlWrapper from './MicroControlWrapper.vue';
import MicroDialog from './MicroDialog.vue';
import RoutePage from './RoutePage.vue';

interface Props {
  /** Required config — must provide defaultPath and defaultControlName */
  config: MicroRouterConfig;
  plugins?: FeaturePlugin[];
  /** Mark as a nested router — each nested instance has its own independent page/dialog/control state */
  nested?: boolean;
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

// Gesture navigation ref (must be before computed per SFC ordering convention)
const pageContainerRef = ref<HTMLElement | null>(null);

const hasSharedSegments = computed(() => {
  const fromSegments = fromPath.value.split('/').filter(Boolean);
  const toSegments = toPath.value.split('/').filter(Boolean);
  return fromSegments.some((s) => toSegments.includes(s));
});
const showGUI = computed(() => resolveControls.value.length > 0);

/**
 * Per-route transition: uses the target (topmost) route's transition config.
 * Defaults to 'slide' if not specified. 'none' disables CSS transitions entirely.
 */
const activeTransition = computed(() => {
  const topRoute = resolveRoutes.value.at(-1);
  return topRoute?.transition ?? 'slide';
});

const transitionName = computed(() => {
  if (activeTransition.value === 'none') return '';
  return activeTransition.value === 'fade' ? 'page-fade' : 'page-slide';
});

const transitionDuration = computed(() => {
  const topRoute = resolveRoutes.value.at(-1);
  if (topRoute?.transitionDuration) return topRoute.transitionDuration;
  return activeTransition.value === 'fade' ? 300 : 500;
});

const useCss = computed(() => hasSharedSegments.value && activeTransition.value !== 'none');

// Gesture navigation (swipe-back from left edge)
if (props.config.gesture?.enabled) {
  useGestureNavigation(props.config.gesture, {
    containerRef: pageContainerRef,
    goBack: () => store.push(-1),
    canGoBack: () => resolveRoutes.value.length > 1
  });
}
</script>

<template>
  <TransitionGroup ref="pageContainerRef" :name="transitionName" :css="useCss">
    <RoutePage
      v-for="(route, i) in resolveRoutes"
      :key="route.key || route.path"
      :route-path="route.path"
      :class="{
        deactive: resolveRoutes.length > 1 && i !== resolveRoutes.length - 1
      }"
      :style="{
        transition: useCss
          ? `transform ${transitionDuration}ms cubic-bezier(0.65, 0, 0.35, 1), opacity ${transitionDuration}ms ease`
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
