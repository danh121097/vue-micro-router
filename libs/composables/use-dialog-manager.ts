/**
 * Manages modal dialog open/close lifecycle including stacking, animations, and attrs.
 *
 * Dialogs stored in Map keyed by path. dialogStack tracks open order so
 * most-recently opened dialog is always on top.
 *
 * isProcessing guard prevents rapid open calls from stacking broken transitions.
 * closeDialog is exempt so closing always works.
 */
import {
  computed,
  defineAsyncComponent,
  nextTick,
  reactive,
  shallowReactive,
  type ComputedRef
} from 'vue';

import type {
  DialogInstance,
  DialogProps,
  MicroDialog,
  PageTrackerHooks
} from '../core/types';
import { isAsyncLoader, safeMarkRaw } from '../utils/path-utils';
import { createTimerManager } from '../utils/timer-manager';

export interface DialogManagerState {
  activeDialog: ComputedRef<string>;
  fromDialog: ComputedRef<string>;
  toDialog: ComputedRef<string>;
  resolveDialogs: ComputedRef<MicroDialog[]>;
  openDialog: (path: string, props?: Record<string, unknown>) => DialogInstance;
  closeDialog: (path: string) => void;
  closeAllDialogs: () => void;
  registerDialog: (dialog: MicroDialog) => void;
  registerDialogs: (dialogs: MicroDialog[]) => void;
  getDialogAttrs: (path: string) => Record<string, unknown> | undefined;
  updateDialogAttrs: (path: string, attrs: Record<string, unknown>) => void;
  cleanup: () => void;
}

export function useDialogManager(
  tracker?: Required<PageTrackerHooks>
): DialogManagerState {
  const DIALOG_STEP_DELAY = 300;
  const timers = createTimerManager();

  let isProcessing = false;

  const state = reactive({
    activeDialog: '',
    fromDialog: '',
    toDialog: '',
    /** Open order stack — last entry = topmost dialog. Used for z-index and focus management. */
    dialogStack: [] as string[],
    /** Dialog definitions. Re-set on open/close to trigger shallowReactive reactivity. */
    dialogs: shallowReactive(new Map<string, MicroDialog>()),
    /** Attrs stored separately for useMicroState access inside dialog components */
    dialogAttrs: shallowReactive(new Map<string, Record<string, unknown>>())
  });

  const resolveDialogs = computed<MicroDialog[]>(() => {
    const result: MicroDialog[] = [];
    for (const d of state.dialogs.values()) {
      if (d.activated || d.closing) result.push(d);
    }
    return result;
  });

  const safeTimeout = timers.schedule;

  function createInstance(
    path: string,
    attrs?: Record<string, unknown>
  ): DialogInstance {
    return { path, attrs };
  }

  function executeDialog({ path, open, attrs }: DialogProps): DialogInstance {
    const dialog = state.dialogs.get(path);
    if (!dialog) return createInstance(path, attrs);

    void nextTick(() => {
      if (open) {
        state.fromDialog = state.activeDialog;
        state.toDialog = path;
        if (!state.dialogStack.includes(path)) state.dialogStack.push(path);
        state.activeDialog = path;

        if (attrs) {
          state.dialogAttrs.set(path, { ...attrs });
        }

        state.dialogs.set(path, {
          ...dialog,
          activated: true,
          componentKey: (dialog.componentKey || 0) + 1,
          attrs: {
            path,
            ...attrs,
            onClose: () => {
              closeDialog(path);
              if (attrs?.onClose && typeof attrs.onClose === 'function')
                attrs.onClose();
            }
          }
        });
      } else {
        state.fromDialog = state.activeDialog;
        const index = state.dialogStack.indexOf(path);
        if (index > -1) state.dialogStack.splice(index, 1);
        state.activeDialog = state.dialogStack.at(-1) ?? '';
        state.toDialog = state.activeDialog;

        const closeDuration =
          dialog.transitionDuration ??
          (dialog.transition === 'slide' ? 500 : DIALOG_STEP_DELAY);
        state.dialogs.set(path, {
          ...dialog,
          activated: false,
          closing: true,
          attrs: undefined
        });

        safeTimeout(() => {
          const current = state.dialogs.get(path);
          if (current && !current.activated) {
            state.dialogs.set(path, { ...current, closing: false });
          }
        }, closeDuration + 200);
      }
    });

    return createInstance(path, attrs);
  }

  function openDialog(
    path: string,
    props?: Record<string, unknown>
  ): DialogInstance {
    if (isProcessing) return createInstance(path, props);
    isProcessing = true;
    try {
      const context = state.activeDialog || '';
      tracker?.trackDialogEnter?.(path, context, path);
      const result = executeDialog({ path, open: true, attrs: props });
      safeTimeout(() => {
        isProcessing = false;
      }, DIALOG_STEP_DELAY);
      return result;
    } catch (e) {
      isProcessing = false;
      throw e;
    }
  }

  function closeDialog(path: string) {
    tracker?.trackDialogLeave?.(path, path, '');
    state.dialogAttrs.delete(path);
    executeDialog({ path, open: false });
  }

  function closeAllDialogs() {
    const closingPaths: string[] = [];
    const callbacks: Array<() => void> = [];
    state.dialogs.forEach((dialog, path) => {
      if (dialog.activated) {
        tracker?.trackDialogLeave?.(path, path, '');
        const onClose = dialog.attrs?.onClose;
        if (typeof onClose === 'function')
          callbacks.push(onClose as () => void);
        state.dialogs.set(path, {
          ...dialog,
          activated: false,
          closing: true,
          attrs: undefined
        });
        closingPaths.push(path);
      }
    });
    // Execute callbacks after iteration to avoid map mutation during forEach
    callbacks.forEach((cb) => cb());
    state.dialogAttrs.clear();
    state.fromDialog = state.activeDialog;
    state.toDialog = '';
    state.activeDialog = '';
    state.dialogStack = [];

    safeTimeout(() => {
      closingPaths.forEach((path) => {
        const current = state.dialogs.get(path);
        if (current && !current.activated) {
          state.dialogs.set(path, { ...current, closing: false });
        }
      });
    }, DIALOG_STEP_DELAY + 200);
  }

  function registerDialog(dialog: MicroDialog) {
    if (state.dialogs.has(dialog.path)) {
      console.warn(`[vue-micro-router] Dialog "${dialog.path}" already registered. Overwriting.`);
    }
    let { component } = dialog;
    if (isAsyncLoader(component)) component = defineAsyncComponent(component);
    state.dialogs.set(dialog.path, {
      persistent: true,
      ...dialog,
      component: safeMarkRaw(component)
    });
  }

  function registerDialogs(dialogs: MicroDialog[]) {
    dialogs.forEach(registerDialog);
  }

  function getDialogAttrs(path: string): Record<string, unknown> | undefined {
    return state.dialogAttrs.get(path);
  }

  function updateDialogAttrs(path: string, attrs: Record<string, unknown>) {
    const existing = state.dialogAttrs.get(path);
    state.dialogAttrs.set(path, { ...existing, ...attrs });
  }

  return {
    activeDialog: computed(() => state.activeDialog),
    fromDialog: computed(() => state.fromDialog),
    toDialog: computed(() => state.toDialog),
    resolveDialogs,
    openDialog,
    closeDialog,
    closeAllDialogs,
    registerDialog,
    registerDialogs,
    getDialogAttrs,
    updateDialogAttrs,
    cleanup: timers.cleanup
  };
}
