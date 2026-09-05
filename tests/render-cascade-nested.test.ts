/**
 * Render-cascade coverage for the surfaces `micro-router-view.test.ts` leaves
 * untested: a nested router, control attrs, and dialog attrs.
 *
 * F2 claimed an attrs write on one page re-renders the whole view. The route
 * baseline measured 0, but only for route attrs on a single router — these are
 * the three places the claim could still have been true.
 *
 * Every number here is measured current behaviour, not a target.
 */
/* eslint-disable vue/one-component-per-file -- probe components are test fixtures, not app components */
import { afterEach, describe, expect, test } from 'bun:test';
import { defineComponent, h, markRaw, type Component } from 'vue';

import MicroControlWrapper from '../libs/components/MicroControlWrapper.vue';
import MicroDialog from '../libs/components/MicroDialog.vue';
import MicroRouterView from '../libs/components/MicroRouterView.vue';
import RoutePage from '../libs/components/RoutePage.vue';
import { useMicroRouter } from '../libs/composables/use-micro-router';
import type { FeaturePlugin, MicroRouterConfig, MicroRouterStore } from '../libs/core/types';
import {
  cleanupRouters,
  createPage,
  createUpdateCounter,
  flush,
  mountRouter
} from './support/router-test-utils';

const STEP_DELAY = 30;

const homeAndDetail = [
  { path: 'home', component: createPage('home') },
  { path: 'detail', component: createPage('detail') }
];

/** Store of the innermost router, captured by whichever inner page renders. */
let innerStore: MicroRouterStore | null = null;

/** Inner page that also hands its own (nested) store back to the test. */
function createInnerPage(label: string): Component {
  return markRaw(
    defineComponent({
      name: `Inner${label}`,
      setup() {
        innerStore = useMicroRouter() as MicroRouterStore;
        return () => h('div', { class: `page page--inner-${label}` }, label);
      }
    })
  );
}

/**
 * An outer page that hosts a nested `MicroRouterView`.
 *
 * `config` and `plugins` are built once per host and closed over, so a
 * re-render of the host passes identical prop references — otherwise the nested
 * view would re-render because of the fixture, not because of the library.
 */
function createNestedHost(inheritAttrs = true): Component {
  const config: MicroRouterConfig = {
    defaultPath: 'inner-a',
    defaultControlName: 'inner_gui',
    stepDelay: STEP_DELAY
  };
  const plugins: FeaturePlugin[] = [
    {
      name: 'inner',
      routes: [
        { path: 'inner-a', component: createInnerPage('a') },
        { path: 'inner-b', component: createInnerPage('b') }
      ],
      dialogs: [],
      controls: []
    }
  ];

  return markRaw(
    defineComponent({
      name: 'NestedHost',
      inheritAttrs,
      setup: () => () => h(MicroRouterView, { config, plugins, nested: true })
    })
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Both routers run an onMounted → nextTick → toggleControl pass; let it finish. */
async function settle() {
  await flush(4);
  await wait(STEP_DELAY * 3);
  await flush(4);
}

function mountNested(
  counter: ReturnType<typeof createUpdateCounter>,
  inheritAttrs = true
) {
  const host = createNestedHost(inheritAttrs);
  const outer = mountRouter({
    routes: [
      { path: 'host', component: host },
      { path: 'other', component: createPage('other') }
    ],
    defaultPath: 'host',
    mixins: [counter.mixin],
    stepDelay: STEP_DELAY
  });
  return outer;
}

afterEach(() => {
  innerStore = null;
  cleanupRouters();
});

/**
 * `createUpdateCounter` keys on `type.__name ?? type.name`. If a library SFC
 * ever stopped exposing the name assumed here, every `toBe(0)` assertion in the
 * cascade baselines would keep passing while measuring nothing at all.
 */
describe('render-count instrumentation', () => {
  test('every library SFC exposes the name the update counter keys on', () => {
    const named = (c: unknown) => (c as { __name?: string; name?: string }).__name
      ?? (c as { name?: string }).name;

    expect(named(MicroRouterView)).toBe('MicroRouterView');
    expect(named(RoutePage)).toBe('RoutePage');
    expect(named(MicroDialog)).toBe('MicroDialog');
    expect(named(MicroControlWrapper)).toBe('MicroControlWrapper');
  });
});

describe('render cascade — nested router', () => {
  test('an inner attrs write does not reach the outer router', async () => {
    const counter = createUpdateCounter();
    mountNested(counter);
    await settle();
    expect(innerStore).not.toBeNull();
    counter.reset();

    innerStore!.updateRouteAttrs('inner-a', { visits: 1 });
    await flush();

    // Each MicroRouterView owns its own store, so the inner Map is not even
    // reachable from the outer view's render effect.
    expect(counter.get('MicroRouterView')).toBe(0);
    expect(counter.get('TransitionGroup')).toBe(0);
    expect(counter.get('NestedHost')).toBe(0);
    // Counts aggregate by name across both routers; NestedHost staying at 0 is
    // what shows this single RoutePage render is not the outer one.
    expect(counter.get('RoutePage')).toBe(1);
    expect(counter.get('Innera')).toBe(1);
  });

  test('an outer attrs write falls through onto the nested router', async () => {
    const counter = createUpdateCounter();
    const outer = mountNested(counter);
    await settle();
    counter.reset();

    outer.store.updateRouteAttrs('host', { visits: 1 });
    await flush(4);

    // The host page declares no props, so the route attrs the view binds to it
    // become fallthrough attrs and are cloned onto its root vnode — the nested
    // MicroRouterView. Its props therefore change and the entire inner router
    // re-renders, which is the F2-shaped cost the route baseline never saw.
    // (Vue also logs an extraneous-attrs warning: the inner view is multi-root.)
    expect(counter.get('NestedHost')).toBe(1);
    // Only the outer router holds a mounted page here whose attrs just changed,
    // and only the inner view can re-render on a prop change — see the paired
    // inheritAttrs test below, where this same MicroRouterView count drops to 0.
    expect(counter.get('MicroRouterView')).toBe(1);
    expect(counter.get('RoutePage')).toBe(1);

    expect(outer.store.getRouteAttrs('host')).toEqual({ visits: 1 });
  });

  test('inheritAttrs: false on the host stops the fallthrough re-render', async () => {
    const counter = createUpdateCounter();
    const outer = mountNested(counter, false);
    await settle();
    counter.reset();

    outer.store.updateRouteAttrs('host', { visits: 1 });
    await flush(4);

    // Same write, same tree, one flag different — this pins the cause on
    // attribute fallthrough rather than on anything the store does.
    expect(counter.get('NestedHost')).toBe(1);
    expect(counter.get('MicroRouterView')).toBe(0);
  });

});

describe('render cascade — control and dialog attrs', () => {
  test('a control attrs write reaches the store but never the control props', async () => {
    const counter = createUpdateCounter();
    const r = mountRouter({
      routes: homeAndDetail,
      controls: [{ name: 'main_gui', component: createPage('hud'), activated: false }],
      mixins: [counter.mixin],
      stepDelay: STEP_DELAY
    });
    await settle();
    expect(r.wrapper.find('.page--hud').exists()).toBe(true); // it really is mounted
    counter.reset();

    r.store.updateControlAttrs('main_gui', { badge: 1 });
    await flush();

    // MicroControlWrapper binds `v-bind="control.attrs"`, not getControlAttrs(),
    // so the controlAttrs Map it writes is reachable only through the injected
    // reader (useMicroState). Nothing re-renders — including the view, which is
    // the F2 claim this test was written to check.
    expect(counter.get('MicroRouterView')).toBe(0);
    expect(counter.get('MicroControlWrapper')).toBe(0);
    expect(counter.get('Pagehud')).toBe(0);
    expect(r.store.getControlAttrs('main_gui')).toEqual({ badge: 1 });
  });

  test('a dialog attrs write reaches the store but never the dialog props', async () => {
    const counter = createUpdateCounter();
    const r = mountRouter({
      routes: homeAndDetail,
      dialogs: [{ path: 'confirm', component: createPage('confirm'), activated: false }],
      mixins: [counter.mixin],
      stepDelay: STEP_DELAY
    });
    await flush();
    r.store.openDialog('confirm');
    await flush(6);
    expect(document.querySelector('.page--confirm')).not.toBeNull();
    counter.reset();

    r.store.updateDialogAttrs('confirm', { message: 'hi' });
    await flush();

    // Same asymmetry as controls: MicroDialog binds `v-bind="dialog.attrs"`,
    // while updateDialogAttrs writes the separate dialogAttrs Map.
    expect(counter.get('MicroRouterView')).toBe(0);
    expect(counter.get('MicroDialog')).toBe(0);
    expect(counter.get('Pageconfirm')).toBe(0);
    expect(r.store.getDialogAttrs('confirm')).toEqual({ message: 'hi' });
  });
});
