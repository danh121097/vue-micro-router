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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let isOpen = false;

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
  return Array.from(
    wrapperRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => el.offsetParent !== null);
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

  if (e.shiftKey) {
    if (!inside || active === first) {
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

function primeMobileKeyboard(done: () => void) {
  if (!props.dialog.focusInput || !wrapperRef.value) {
    done();
    return;
  }
  const input = document.createElement('input');
  input.style.cssText = 'position:fixed;opacity:0;height:0;width:0;top:-100px;';
  wrapperRef.value.appendChild(input);
  input.focus();
  setTimeout(() => {
    input.remove();
    done();
  }, 50);
}

function open() {
  if (isOpen) return;
  isOpen = true;
  previousFocus.value = document.activeElement as HTMLElement;
  lockBodyScroll();
  void nextTick(() => {
    if (!wrapperRef.value) return;
    // Prime mobile keyboard first; only after temp input is removed do we
    // focus the real target — otherwise the temp removal blurs it.
    primeMobileKeyboard(() => {
      if (!wrapperRef.value) return;
      const list = getFocusable();
      (list[0] ?? wrapperRef.value).focus();
    });
  });
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  unlockBodyScroll();
  const prev = previousFocus.value;
  previousFocus.value = null;
  if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
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
    >
      <div
        v-if="!seamless"
        class="micro-dialog-backdrop"
        :class="dialog.closing && 'micro-dialog-backdrop--closing'"
      />
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
