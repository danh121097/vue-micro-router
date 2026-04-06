/**
 * Lifecycle hooks for control components — fire when a control activates/deactivates.
 *
 * Must be called inside a component rendered by MicroControlWrapper. Reads MICRO_CONTROL_NAME_KEY
 * and watches currentControl to detect enter/leave transitions.
 *
 * @example
 * ```ts
 * useControlLifecycle({
 *   onControlEnter: () => console.log('Control activated'),
 *   onControlLeave: () => console.log('Control deactivated'),
 * });
 * ```
 */
import { inject, onMounted, watch } from 'vue';

import { MICRO_CONTROL_NAME_KEY } from '../core/constants';
import { useMicroRouter } from './use-micro-router';

export interface ControlLifecycleHooks {
  /** Called when this control becomes the active control */
  onControlEnter?: () => void;
  /** Called when this control is deactivated */
  onControlLeave?: () => void;
}

export function useControlLifecycle(hooks: ControlLifecycleHooks) {
  const controlName = inject(MICRO_CONTROL_NAME_KEY);
  if (!controlName) {
    console.warn(
      '[vue-micro-router] useControlLifecycle() must be called inside a control component rendered by <MicroControlWrapper>.',
    );
    return;
  }

  const { currentControl } = useMicroRouter();

  let wasActive = currentControl.value === controlName;

  if (wasActive) onMounted(() => hooks.onControlEnter?.());

  watch(currentControl, (newControl) => {
    const isActive = newControl === controlName;

    if (isActive && !wasActive) hooks.onControlEnter?.();
    else if (!isActive && wasActive) hooks.onControlLeave?.();

    wasActive = isActive;
  });
}
