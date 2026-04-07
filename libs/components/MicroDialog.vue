<script setup lang="ts">
/**
 * Headless dialog using native <dialog> element.
 * No dependency — native focus trap, backdrop, escape key handling.
 */
import { computed, nextTick, onMounted, provide, ref, watch } from 'vue';

import {
  MICRO_ATTRS_READ_KEY,
  MICRO_ATTRS_WRITE_KEY,
  MICRO_DIALOG_PATH_KEY
} from '../core/constants';
import { useMicroRouter } from '../composables/use-micro-router';
import type { MicroDialog } from '../core/types';

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

const dialogRef = ref<HTMLDialogElement | null>(null);

provide(MICRO_DIALOG_PATH_KEY, props.dialog.path);
provide(MICRO_ATTRS_READ_KEY, () => getDialogAttrs(props.dialog.path));
provide(MICRO_ATTRS_WRITE_KEY, (attrs: Record<string, unknown>) => {
  updateDialogAttrs(props.dialog.path, attrs);
});

const transition = computed(() => props.dialog.transition ?? 'scale');
const duration = computed(() => {
  if (props.dialog.transitionDuration != null)
    return props.dialog.transitionDuration;
  return transition.value === 'slide' ? 500 : 300;
});

const position = computed(() => props.dialog.position ?? 'standard');
const sameless = computed(() => props.dialog.seamless ?? true);

function handleCancel(e: Event) {
  if (props.dialog.persistent) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  emits('close', props.dialog.path);
}

function handleBackdropClick(e: MouseEvent) {
  if (props.dialog.persistent) return;
  if (e.target === dialogRef.value) {
    emits('close', props.dialog.path);
  }
}

/** Prime mobile keyboard by briefly focusing a hidden input inside the dialog */
function primeMobileKeyboard() {
  if (!props.dialog.focusInput || !dialogRef.value) return;
  const input = document.createElement('input');
  input.style.cssText = 'position:fixed;opacity:0;height:0;width:0;top:-100px;';
  dialogRef.value.appendChild(input);
  input.focus();
  setTimeout(() => input.remove(), 50);
}

// Open native dialog when activated
watch(
  () => props.dialog.activated,
  (activated) => {
    void nextTick(() => {
      if (!dialogRef.value) return;
      if (activated && !dialogRef.value.open) {
        dialogRef.value.showModal();
        primeMobileKeyboard();
      }
      // Don't call close() here — wait for closing animation to finish
    });
  },
  { immediate: true },
);

// Close native dialog after closing animation completes
// Dialog manager sets closing=true → waits transitionDuration → sets closing=false
watch(
  () => props.dialog.closing,
  (closing) => {
    if (!closing && !props.dialog.activated && dialogRef.value?.open) {
      dialogRef.value.close();
    }
  },
);

onMounted(() => {
  if (props.dialog.activated && dialogRef.value && !dialogRef.value.open) {
    dialogRef.value.showModal();
    primeMobileKeyboard();
  }
});
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      :class="[
        'micro-dialog',
        `micro-dialog--${position}`,
        dialog.fullscreen && 'micro-dialog--fullscreen',
        sameless && 'micro-dialog--seamless',
        `dialog-transition-${transition}`,
        dialog.closing && 'micro-dialog--closing'
      ]"
      :style="{
        '--dialog-duration': `${duration}ms`,
        zIndex: 100 + stackIndex,
        width: '100vw',
        height: '100dvh',
        maxWidth: '100vw',
        maxHeight: '100dvh',
        margin: '0',
        padding: '0',
        inset: '0',
      }"
      @cancel="handleCancel"
      @click="handleBackdropClick"
    >
      <div class="micro-dialog__content" @click.stop>
        <slot />
        <component
          :is="dialog.component"
          :key="dialog.componentKey"
          v-bind="dialog.attrs"
        />
      </div>
    </dialog>
  </Teleport>
</template>
