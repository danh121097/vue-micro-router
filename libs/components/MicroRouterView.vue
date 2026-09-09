<script setup lang="ts">
import { computed, ref } from 'vue';

import { useGlobalMicroRouter } from '../composables/use-micro-router';
import { useGestureNavigation } from '../composables/navigation/use-gesture-navigation';
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
  isNavigating,
  closeDialog
} = store;

// Gesture navigation ref (must be before computed per SFC ordering convention)
const pageContainerRef = ref<HTMLElement | null>(null);

const hasSharedSegments = computed(() => {
  const fromSegments = fromPath.value.split('/').filter(Boolean);
  const toSegments = new Set(toPath.value.split('/').filter(Boolean));
  return fromSegments.some((s) => toSegments.has(s));
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

const useCss = computed(
  () => hasSharedSegments.value && activeTransition.value !== 'none'
);

/**
 * Per-page inline styles, one entry per stacked route.
 *
 * Built here rather than as a literal in the `v-for`: the page stack re-renders
 * three times per navigation (twice on the push, once when `isNavigating` flips
 * back), and as a literal the style object and its two `transition` template
 * strings were rebuilt for every page on every one of those renders. Memoised,
 * it is one build pass per change to the routes or the transition config, still
 * one object per page. Measured over one navigation on a four-page stack:
 * 11 objects and 11 transition strings inline, 4 objects and 1 string here.
 *
 * This saves the construction, not the style patch. `getTransitionRawChildren`
 * clones every keyed child (`cloneVNode(child, { key })`) and `mergeProps`
 * rebuilds `style` from an array, so the vnode carries a fresh object per
 * render either way — that copy is Vue's and predates this change.
 */
const pageStyles = computed(() => {
  const transition = useCss.value
    ? `transform ${transitionDuration.value}ms cubic-bezier(0.65, 0, 0.35, 1), opacity ${transitionDuration.value}ms ease`
    : 'none';
  const height = props.nested ? '100%' : '100dvh';
  return resolveRoutes.value.map((_, i) => ({
    transition,
    zIndex: 10 + i,
    '--mr-page-height': height
  }));
});

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
  <!-- `tag` is load-bearing: without it TransitionGroup renders a fragment,
       whose `$el` is an anchor text node. The swipe-back gesture binds its
       pointer listeners here, and a text node never receives pointer events. -->
  <TransitionGroup
    ref="pageContainerRef"
    tag="div"
    class="micro-router__pages"
    :name="transitionName"
    :css="useCss"
  >
    <RoutePage
      v-for="(route, i) in resolveRoutes"
      :key="route.key || route.path"
      :route-path="route.path"
      :class="{
        deactivate: resolveRoutes.length > 1 && i !== resolveRoutes.length - 1,
        'micro-router--navigating': isNavigating
      }"
      :style="pageStyles[i]"
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
