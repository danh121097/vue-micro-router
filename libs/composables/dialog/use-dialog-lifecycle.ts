/**
 * Lifecycle hooks for dialog components — fire when a dialog opens/closes.
 *
 * Must be called inside a component rendered by MicroDialog. Reads MICRO_DIALOG_PATH_KEY
 * and watches activeDialog to detect enter/leave transitions.
 *
 * @example
 * ```ts
 * useDialogLifecycle({
 *   onDialogEnter: () => console.log('Dialog opened'),
 *   onDialogLeave: () => console.log('Dialog closed'),
 * });
 * ```
 */
import { inject, onMounted, watch } from 'vue';

import { MICRO_DIALOG_PATH_KEY } from '../../core/constants';
import { useMicroRouter } from '../use-micro-router';

export interface DialogLifecycleHooks {
  /** Called when this dialog becomes the active (topmost) dialog */
  onDialogEnter?: () => void;
  /** Called when this dialog is no longer the active dialog (another opened on top, or this one closed) */
  onDialogLeave?: () => void;
}

export function useDialogLifecycle(hooks: DialogLifecycleHooks) {
  const dialogPath = inject(MICRO_DIALOG_PATH_KEY);
  if (!dialogPath) {
    console.warn(
      '[vue-micro-router] useDialogLifecycle() must be called inside a dialog component rendered by <MicroDialog>.',
    );
    return;
  }

  const { activeDialog } = useMicroRouter();

  let wasActive = activeDialog.value === dialogPath;

  if (wasActive) onMounted(() => hooks.onDialogEnter?.());

  watch(activeDialog, (newDialog) => {
    const isActive = newDialog === dialogPath;

    if (isActive && !wasActive) hooks.onDialogEnter?.();
    else if (!isActive && wasActive) hooks.onDialogLeave?.();

    wasActive = isActive;
  });
}
