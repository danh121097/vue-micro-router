/**
 * Generic attrs bridge for route pages, dialogs, and controls.
 *
 * Reads attrs injected by the parent wrapper via MICRO_ATTRS_READ_KEY,
 * merges with caller-supplied defaults, and syncs mutations back
 * via MICRO_ATTRS_WRITE_KEY so the store always holds the latest state.
 *
 * flush: 'post' batches the write-back watcher after the render cycle ends.
 */
import { inject, reactive, toRef, watch, type Ref } from 'vue';

import { MICRO_ATTRS_READ_KEY, MICRO_ATTRS_WRITE_KEY } from '../core/constants';

/**
 * Like ToRefs but all keys are required (ref always exists).
 * Optional fields → Ref<T | undefined> (value may be undefined, ref itself never is).
 * Required fields → Ref<T> (value always present).
 *
 * This means: `meta.value?.title` ✅ (not `meta?.value?.title`)
 */
type StateRefs<T extends object> = {
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

  // Proxy creates refs lazily — handles optional keys not in defaults/attrs.
  // toRef(state, key) returns a valid Ref even if key doesn't exist yet.
  const refCache = new Map<string, Ref>();
  const getRef = (key: string) => {
    if (!refCache.has(key)) {
      refCache.set(key, toRef(state as Record<string, unknown>, key));
    }
    return refCache.get(key)!;
  };

  return new Proxy({}, {
    get: (_, key) => typeof key === 'string' ? getRef(key) : undefined,
    has: () => true,
    ownKeys: () => Reflect.ownKeys(state),
    getOwnPropertyDescriptor: (_, key) => ({
      configurable: true,
      enumerable: true,
      value: typeof key === 'string' ? getRef(key) : undefined,
    }),
  }) as StateRefs<T>;
}
