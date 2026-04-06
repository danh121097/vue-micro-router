/**
 * Generic attrs bridge for route pages, dialogs, and controls.
 *
 * Reads attrs injected by the parent wrapper via MICRO_ATTRS_READ_KEY,
 * merges with caller-supplied defaults, and syncs mutations back
 * via MICRO_ATTRS_WRITE_KEY so the store always holds the latest state.
 *
 * flush: 'post' batches the write-back watcher after the render cycle ends.
 */
import { inject, reactive, toRefs, watch, type ToRefs } from 'vue';

import { MICRO_ATTRS_READ_KEY, MICRO_ATTRS_WRITE_KEY } from '../core/constants';

/**
 * Reactive state bridge for routes, dialogs, and controls.
 * Auto-reads attrs from parent wrapper (RoutePage/MicroDialog/MicroControlWrapper).
 * Mutations auto-sync back to the store — state survives remount.
 *
 * @example
 * ```ts
 * // Type-only — reads whatever was passed via push()/openDialog()/toggleControl()
 * const { userId } = useMicroState<{ userId: number }>();
 *
 * // With defaults — fills missing values
 * const { count } = useMicroState({ count: 0 });
 * ```
 */
export function useMicroState<T extends object>(): ToRefs<T>;
export function useMicroState<T extends object>(defaults: T): ToRefs<T>;
export function useMicroState<T extends object>(defaults?: T): ToRefs<T> {
  const readAttrs = inject(MICRO_ATTRS_READ_KEY);
  const writeAttrs = inject(MICRO_ATTRS_WRITE_KEY);

  if (!readAttrs && !defaults) {
    console.warn(
      '[vue-micro-router] useMicroState() called without provider and no defaults. ' +
        'Ensure component is inside <RoutePage>, <MicroDialog>, or <MicroControlWrapper>.'
    );
  }

  const attrs = readAttrs?.() ?? {};

  // Merge: attrs > defaults
  const initial: Record<string, unknown> = defaults ? { ...defaults } : {};
  for (const key of Object.keys(attrs)) {
    initial[key] = attrs[key];
  }
  const state = reactive(initial) as T;

  // Auto-sync changes back (flush: 'post' batches updates after render)
  if (writeAttrs) {
    watch(
      () => ({ ...state }),
      (newState) => writeAttrs(newState as Record<string, unknown>),
      { deep: true, flush: 'post' }
    );
  }

  return toRefs(state) as ToRefs<T>;
}
