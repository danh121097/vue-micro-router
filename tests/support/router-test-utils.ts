/**
 * Shared helpers for the SFC mount tests.
 *
 * Two concerns live here so `micro-router-view.test.ts` and
 * `micro-dialog.test.ts` do not repeat them:
 *   - mounting `MicroRouterView` with a feature plugin and getting its store
 *     ({@link mountRouter});
 *   - counting per-component re-renders ({@link createUpdateCounter}), which is
 *     how the render-cascade findings are measured.
 */
/* eslint-disable vue/one-component-per-file -- probe components are test fixtures, not app components */
import {
  defineComponent,
  h,
  markRaw,
  nextTick,
  type Component,
  type ComponentOptions
} from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';

import MicroRouterView from '../../libs/components/MicroRouterView.vue';
import { useMicroRouter } from '../../libs/composables/use-micro-router';
import type { GestureConfig } from '../../libs/composables/navigation/use-gesture-navigation';
import type {
  FeaturePlugin,
  MicroControl,
  MicroDialog,
  MicroRoute,
  MicroRouterStore
} from '../../libs/core/types';

/** Minimal page component that renders its own label — enough to assert on markup. */
export function createPage(label: string): Component {
  return markRaw(
    defineComponent({
      name: `Page${label}`,
      setup: () => () => h('div', { class: `page page--${label}` }, label)
    })
  );
}

export interface MountRouterOptions {
  defaultPath?: string;
  defaultControlName?: string;
  routes?: MicroRoute[];
  dialogs?: MicroDialog[];
  controls?: MicroControl[];
  /** Mount as a nested router instance. */
  nested?: boolean;
  /** Navigation lock duration; lower it to keep timing-sensitive tests short. */
  stepDelay?: number;
  /** Devtools opt-in; omit to leave the flag absent, as a normal consumer has it. */
  devtools?: boolean;
  /** Swipe-back gesture config; omit to leave the feature off. */
  gesture?: GestureConfig;
  /** Global mixins — pass `createUpdateCounter().mixin` to tally re-renders. */
  mixins?: ComponentOptions[];
}

export interface MountedRouter {
  wrapper: VueWrapper;
  /** The store the mounted view created — the same object `useMicroRouter()` injects. */
  store: MicroRouterStore;
}

/** Every wrapper mounted since the last {@link cleanupRouters}. */
const mounted: VueWrapper[] = [];

/**
 * Unmount everything `mountRouter` created and clear the document.
 *
 * Call from `afterEach`, not at the end of each test: a failing assertion
 * aborts the test body, and a view left mounted keeps its navigation-unlock
 * and dialog timers — plus the `lockBodyScroll` refcount — alive in the next
 * test.
 */
export function cleanupRouters(): void {
  while (mounted.length > 0) {
    try {
      mounted.pop()!.unmount();
    } catch {
      // Already unmounted by the test itself; nothing left to release.
    }
  }
  document.body.innerHTML = '';
}

/**
 * Mount `MicroRouterView` with one feature plugin holding the given
 * routes/dialogs/controls, and expose the store the view built.
 *
 * The store is read through a probe rendered in the default slot, which
 * injects it the same way any consumer component would — no test-only export
 * is added to the library for this.
 *
 * `Transition`/`TransitionGroup` stubbing is turned off: the render-cascade
 * baselines need to count the real `TransitionGroup`, which also applies
 * transition hooks to its children and so participates in the cascade.
 */
export function mountRouter(options: MountRouterOptions = {}): MountedRouter {
  const {
    defaultPath = 'home',
    defaultControlName = 'main_gui',
    routes = [],
    dialogs = [],
    controls = [],
    nested = false,
    stepDelay,
    devtools,
    gesture,
    mixins = []
  } = options;

  let captured: MicroRouterStore | null = null;
  const StoreProbe = defineComponent({
    name: 'StoreProbe',
    setup() {
      captured = useMicroRouter() as MicroRouterStore;
      return () => null;
    }
  });

  const plugin: FeaturePlugin = { name: 'test', routes, dialogs, controls };

  const wrapper = mount(MicroRouterView, {
    props: {
      config: {
        defaultPath,
        defaultControlName,
        ...(stepDelay ? { stepDelay } : {}),
        ...(devtools === undefined ? {} : { devtools }),
        ...(gesture === undefined ? {} : { gesture })
      },
      plugins: [plugin],
      nested
    },
    slots: { default: () => h(StoreProbe) },
    global: { mixins, stubs: { transition: false, 'transition-group': false } },
    attachTo: document.body
  });
  mounted.push(wrapper);

  if (!captured) {
    throw new Error('[router-test-utils] store was not injected into the default slot');
  }

  return { wrapper, store: captured };
}

/**
 * Drain Vue's scheduler. Each `nextTick` resolves one flush cycle, so `rounds`
 * is a count of cascading updates to settle, not an arbitrary microtask budget.
 */
export async function flush(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) await nextTick();
}

/** Per-component re-render tallies collected by {@link createUpdateCounter}. */
export interface UpdateCounter {
  /** Global mixin to pass through `global.mixins` when mounting. */
  mixin: ComponentOptions;
  /** Re-renders recorded for a component, by its registered or `<script setup>` name. */
  get: (componentName: string) => number;
  reset: () => void;
}

/**
 * Count re-renders per component across a mounted tree.
 *
 * A global mixin's `updated()` hook runs once per component whose own render
 * function actually re-ran — it stays silent when a dependency notifies but the
 * dirty check finds nothing changed, which is exactly the distinction the
 * render-cascade findings turn on. Instrumenting from the outside keeps the
 * library components untouched.
 *
 * Counts aggregate by name, so two `RoutePage` instances share one tally.
 */
export function createUpdateCounter(): UpdateCounter {
  const counts = new Map<string, number>();
  const mixin: ComponentOptions = {
    updated(this: { $: { type: { __name?: string; name?: string } } }) {
      const type = this.$.type;
      const name = type.__name ?? type.name ?? 'anonymous';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  };
  return {
    mixin,
    get: (componentName: string) => counts.get(componentName) ?? 0,
    reset: () => counts.clear()
  };
}
