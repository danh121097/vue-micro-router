<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch
} from 'vue';

import {
  MICRO_ATTRS_READ_KEY,
  MICRO_ATTRS_WRITE_KEY,
  MICRO_DIALOG_PATH_KEY
} from '../core/constants';
import { useMicroRouter } from '../composables/use-micro-router';
import type { MicroDialog } from '../core/types';
import { lockBodyScroll, unlockBodyScroll } from '../utils/body-scroll-lock';
import {
  focusInputWhenReady,
  getDialogFocusableElements,
  rememberDialogFocusOrigin,
  resolveDialogFocusReturn,
} from '../utils/dialog-focus';

interface Props {
  dialog: MicroDialog;
  stackIndex: number;
}

interface Emits {
  (event: 'close', path: string): void;
}

const props = defineProps<Props>();
const emits = defineEmits<Emits>();

const { getDialogAttrs, updateDialogAttrs } = useMicroRouter();

let isOpen = false;
let focusRequestId = 0;
let cancelPendingFocus: (() => void) | null = null;

const wrapperRef = ref<HTMLDivElement | null>(null);
const previousFocus = ref<HTMLElement | null>(null);

const transition = computed(() => props.dialog.transition ?? 'scale');
const duration = computed(() => {
  if (props.dialog.transitionDuration != null)
    return props.dialog.transitionDuration;
  return transition.value === 'slide' ? 500 : 300;
});
const position = computed(() => props.dialog.position ?? 'standard');
const seamless = computed(() => props.dialog.seamless ?? false);

function getFocusable(): HTMLElement[] {
  if (!wrapperRef.value) return [];
  return getDialogFocusableElements(wrapperRef.value);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (props.dialog.persistent) return;
    e.preventDefault();
    e.stopPropagation();
    emits('close', props.dialog.path);
    return;
  }
  if (e.key !== 'Tab') return;

  const list = getFocusable();
  if (list.length === 0) {
    e.preventDefault();
    wrapperRef.value?.focus();
    return;
  }

  const first = list[0]!;
  const last = list[list.length - 1]!;
  const active = document.activeElement;
  const inside = !!wrapperRef.value?.contains(active as Node);
  // The dialog root holds focus whenever nothing inside it claimed focus on
  // open. It sits before every focusable in DOM order, so forward Tab reaches
  // them natively, but Shift+Tab would step backwards out of the dialog —
  // treat the root as the leading boundary and wrap it to the last control.
  const atRoot = active === wrapperRef.value;

  if (e.shiftKey) {
    if (!inside || atRoot || active === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (!inside || active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function handleBackdropClick(e: MouseEvent) {
  if (props.dialog.persistent) return;
  if (e.target === e.currentTarget) {
    emits('close', props.dialog.path);
  }
}

function focusInitialTarget(shouldPrimeKeyboard: boolean) {
  const requestId = ++focusRequestId;
  cancelPendingFocus?.();
  void nextTick(() => {
    cancelPendingFocus = focusInputWhenReady(
      () => wrapperRef.value,
      shouldPrimeKeyboard,
      () => props.dialog.activated && requestId === focusRequestId
    );
  });
}

function open() {
  if (isOpen) {
    focusInitialTarget(props.dialog.focusInput ?? false);
    return;
  }
  isOpen = true;
  previousFocus.value = document.activeElement as HTMLElement;
  // A dialog stacked over another records that dialog's root, which will be
  // gone before this one closes in several flows — keep the link so close()
  // can walk back to whatever opened the stack.
  if (wrapperRef.value) {
    rememberDialogFocusOrigin(wrapperRef.value, previousFocus.value);
  }
  lockBodyScroll();
  focusInitialTarget(props.dialog.focusInput ?? false);
}

function close() {
  if (!isOpen) return;
  focusRequestId++;
  cancelPendingFocus?.();
  cancelPendingFocus = null;
  isOpen = false;
  unlockBodyScroll();
  const prev = resolveDialogFocusReturn(previousFocus.value);
  previousFocus.value = null;
  // Only restore focus if nothing else has claimed it (e.g. a stacked dialog
  // that opened during this one's close animation). Otherwise we'd blur the
  // newer dialog's auto-focused element.
  const active = document.activeElement;
  const focusInside = !!wrapperRef.value?.contains(active as Node);
  const focusOnBody = !active || active === document.body;
  if (
    prev
    && typeof prev.focus === 'function'
    && document.contains(prev)
    && (focusInside || focusOnBody)
  ) {
    prev.focus();
  }
}

provide(MICRO_DIALOG_PATH_KEY, props.dialog.path);
provide(MICRO_ATTRS_READ_KEY, () => getDialogAttrs(props.dialog.path));
provide(MICRO_ATTRS_WRITE_KEY, (attrs: Record<string, unknown>) => {
  updateDialogAttrs(props.dialog.path, attrs);
});

watch(
  () => props.dialog.activated,
  (activated) => {
    if (activated) open();
  }
);

watch(
  () => props.dialog.closing,
  (closing) => {
    if (!closing && !props.dialog.activated && isOpen) close();
  }
);

onMounted(() => {
  if (props.dialog.activated) open();
});

onBeforeUnmount(() => {
  if (isOpen) close();
});
</script>

<template>
  <Teleport to="body">
    <div
      class="micro-dialog-portal"
      :class="[
        `micro-dialog--${position}`,
        dialog.fullscreen && 'micro-dialog--fullscreen',
        seamless && 'micro-dialog--seamless'
      ]"
      :style="{
        zIndex: 100 + stackIndex,
        '--dialog-duration': `${duration}ms`
      }"
      @click.self="handleBackdropClick"
      @mousedown.self.prevent
    >
      <div
        v-if="!seamless"
        class="micro-dialog-backdrop"
        :class="dialog.closing && 'micro-dialog-backdrop--closing'"
      />
      <!-- The `mousedown.self` below is defensive: `.micro-dialog` is
           `pointer-events: none`, so it is never a hit-test target and `.self`
           cannot match here in a browser. The portal handler above is the one
           that stops focus escaping; this only matters if a consumer re-enables
           pointer-events on the wrapper. -->
      <div
        ref="wrapperRef"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="micro-dialog"
        :class="[
          `dialog-transition-${transition}`,
          dialog.closing && 'micro-dialog--closing'
        ]"
        @click.self="handleBackdropClick"
        @mousedown.self.prevent
        @keydown="handleKeydown"
      >
        <div class="micro-dialog__content" @click.stop>
          <slot />
          <component
            :is="dialog.component"
            :key="dialog.componentKey"
            v-bind="dialog.attrs"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
