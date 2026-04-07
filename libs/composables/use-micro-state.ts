/**
 * Generic attrs bridge for route pages, dialogs, and controls.
 *
 * Reads attrs injected by the parent wrapper via MICRO_ATTRS_READ_KEY,
 * merges with caller-supplied defaults, and syncs mutations back
 * via MICRO_ATTRS_WRITE_KEY so the store always holds the latest state.
 *
 * flush: 'post' batches the write-back watcher after the render cycle ends.
 */
import { inject, reactive, toRef, toRefs, watch, type Ref } from 'vue';

import { MICRO_ATTRS_READ_KEY, MICRO_ATTRS_WRITE_KEY } from '../core/constants';

/**
 * Like ToRefs but all keys are required (ref always exists).
 * Optional fields → Ref<T | undefined> (value may be undefined, ref itself never is).
 * Required fields → Ref<T> (value always present).
 *
 * This means: `meta.value?.title` ✅ (not `meta?.value?.title`)
 */
export type StateRefs<T extends object> = {
  [K in keyof T]-?: Ref<T[K]>;
};

/**
 * Reactive state bridge for routes, dialogs, and controls.
 * Auto-reads attrs from parent wrapper (RoutePage/MicroDialog/MicroControlWrapper).
 * Mutations auto-sync back to the store — state survives remount.
 *
 * Returns a reactive object — no `.value` needed, works like Vue's `reactive()`.
 * Reactive in template: `{{ state.userId }}` auto-updates.
 * Writable: `state.userId = 42` triggers sync back to store.
 *
 * @example
 * ```ts
 * const state = useMicroState<{ userId: number; username: string }>();
 * state.userId   // number — no .value
 * state.userId = 42  // reactive, syncs back
 *
 * // With defaults
 * const state = useMicroState({ count: 0 });
 * state.count++  // reactive
 * ```
 */
export function useMicroState<T extends object>(): StateRefs<T>;
export function useMicroState<T extends object>(defaults: T): StateRefs<T>;
export function useMicroState<T extends object>(defaults?: T): StateRefs<T> {
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
  // Watch state directly — spread in callback only, not in source (avoids defeating Vue dirty-check)
  if (writeAttrs) {
    watch(
      state,
      (newState) => writeAttrs({ ...newState } as Record<string, unknown>),
      { deep: true, flush: 'post' }
    );
  }

  // toRefs for existing keys + toRef for any key accessed via destructure.
  // toRefs only creates refs for keys present on the reactive object.
  // We supplement with toRef for optional keys not in initial/attrs.
  const refs = toRefs(state) as Record<string, Ref>;

  // Return a Proxy that falls back to toRef for missing keys (optional fields).
  // Unlike a full Proxy, this delegates all standard operations to the refs object
  // so Vue template internals (Symbol checks, __v_isRef, etc.) work normally.
  return new Proxy(refs, {
    get(target, key, receiver) {
      if (typeof key === 'string' && !(key in target)) {
        target[key] = toRef(state as Record<string, unknown>, key);
      }
      return Reflect.get(target, key, receiver);
    },
  }) as StateRefs<T>;
}
