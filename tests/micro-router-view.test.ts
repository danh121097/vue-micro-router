/**
 * Mount tests for `MicroRouterView` — the first coverage the SFCs have had.
 *
 * The render-count block is the net Phase 2 (render cascade) is measured
 * against: it records, as executable assertions, exactly which components
 * re-render when a page's attrs change and when the stack navigates.
 *
 * Counts aggregate by component name, so `RoutePage` is the total across every
 * mounted page. Each assertion says which reading it is.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { defineComponent, h, markRaw } from 'vue';

import { useMicroState } from '../libs/composables/use-micro-state';
import {
  cleanupRouters,
  createPage,
  createUpdateCounter,
  flush,
  mountRouter
} from './support/router-test-utils';

/** Short enough to keep the navigation-lock waits from dominating the suite. */
const STEP_DELAY = 30;

/**
 * Page that owns local state through the attrs bridge. Its state proxy is
 * captured on setup so a test can mutate it the way page code would.
 */
let pageState: { count: { value: number } } | null = null;
const StatefulPage = markRaw(
  defineComponent({
    name: 'StatefulPage',
    setup() {
      const state = useMicroState({ count: 0 });
      pageState = state as unknown as { count: { value: number } };
      return () => h('div', { class: 'stateful' }, String(state.count.value));
    }
  })
);

const homeAndDetail = [
  { path: 'home', component: createPage('home') },
  { path: 'detail', component: createPage('detail') }
];

afterEach(() => {
  pageState = null;
  cleanupRouters();
});

describe('MicroRouterView — rendering', () => {
  test('renders one RoutePage per active segment', async () => {
    const r = mountRouter({ routes: homeAndDetail });
    await flush();

    expect(r.wrapper.findAll('.route-page')).toHaveLength(1);
    expect(r.wrapper.find('.page--home').exists()).toBe(true);
    expect(r.store.activePath.value).toBe('home');
  });

  test('renders the content slot and the GUI layer', async () => {
    const r = mountRouter({
      routes: homeAndDetail,
      controls: [{ name: 'main_gui', component: createPage('hud'), activated: false }]
    });
    await flush();

    expect(r.wrapper.find('.micro-router-content-layer').exists()).toBe(true);
    expect(r.wrapper.find('.micro-router-gui-layer').exists()).toBe(true);
  });

  test('push adds a page, push(-1) removes it', async () => {
    const r = mountRouter({ routes: homeAndDetail, stepDelay: STEP_DELAY });
    await flush();

    await r.store.push('detail');
    await flush();
    expect(r.store.activePath.value).toBe('/home/detail');
    expect(r.wrapper.findAll('.route-page')).toHaveLength(2);
    expect(r.wrapper.find('.page--detail').exists()).toBe(true);

    // Back only lands once the navigation lock has released.
    await new Promise((resolve) => setTimeout(resolve, STEP_DELAY * 3));
    await r.store.push(-1);
    await flush();
    // Back rebuilds the path from segments, so it is normalized to "/home".
    expect(r.store.activePage.value).toBe('home');
    expect(r.wrapper.findAll('.route-page')).toHaveLength(1);
    expect(r.wrapper.find('.page--detail').exists()).toBe(false);
  });

  test('background page is marked deactivate, foreground is not', async () => {
    const r = mountRouter({ routes: homeAndDetail, stepDelay: STEP_DELAY });
    await flush();
    await r.store.push('detail');
    await flush();

    const pages = r.wrapper.findAll('.route-page');
    expect(pages[0]!.classes()).toContain('deactivate');
    expect(pages[1]!.classes()).not.toContain('deactivate');
  });

  test('nested router sizes pages to the container, not the viewport', async () => {
    const nested = mountRouter({ routes: homeAndDetail, nested: true });
    await flush();
    expect(nested.wrapper.find('.route-page').attributes('style')).toContain(
      '--mr-page-height: 100%'
    );

    const root = mountRouter({ routes: homeAndDetail });
    await flush();
    expect(root.wrapper.find('.route-page').attributes('style')).toContain(
      '--mr-page-height: 100dvh'
    );
  });
});

/**
 * Baseline for Phase 2 (F2/F3). Every number here is *measured* current
 * behaviour, not a target — a change in any of them is a render-path change and
 * must be deliberate.
 */
describe('MicroRouterView — render cascade baseline (pre-Phase-2)', () => {
  async function mountAtDetail(counter: ReturnType<typeof createUpdateCounter>) {
    const r = mountRouter({
      routes: homeAndDetail,
      mixins: [counter.mixin],
      stepDelay: STEP_DELAY
    });
    await flush();
    await r.store.push('detail');
    await new Promise((resolve) => setTimeout(resolve, STEP_DELAY * 3));
    await flush();
    counter.reset();
    return r;
  }

  test('baseline: background attrs change re-renders only the owning page', async () => {
    const counter = createUpdateCounter();
    const r = await mountAtDetail(counter);

    r.store.updateRouteAttrs('home', { visits: 1 });
    await flush();

    // The attrs read lives in RoutePage's slot, so the dependency is scoped per
    // page: neither the view nor the page-stack TransitionGroup re-renders.
    expect(counter.get('MicroRouterView')).toBe(0);
    expect(counter.get('TransitionGroup')).toBe(0);
    expect(counter.get('RoutePage')).toBe(1);
    expect(counter.get('Pagehome')).toBe(1);
    expect(counter.get('Pagedetail')).toBe(0);
  });

  test('baseline: foreground attrs change does not reach the background page', async () => {
    const counter = createUpdateCounter();
    const r = await mountAtDetail(counter);

    r.store.updateRouteAttrs('detail', { visits: 1 });
    await flush();

    expect(counter.get('MicroRouterView')).toBe(0);
    expect(counter.get('TransitionGroup')).toBe(0);
    expect(counter.get('RoutePage')).toBe(1);
    expect(counter.get('Pagedetail')).toBe(1);
    expect(counter.get('Pagehome')).toBe(0);
  });

  test('baseline: repeated attrs writes cost one page re-render each', async () => {
    const counter = createUpdateCounter();
    const r = mountRouter({
      routes: homeAndDetail,
      mixins: [counter.mixin],
      stepDelay: STEP_DELAY
    });
    await flush();
    counter.reset();

    for (let i = 1; i <= 3; i++) {
      r.store.updateRouteAttrs('home', { visits: i });
      await flush();
    }

    expect(counter.get('RoutePage')).toBe(3);
    expect(counter.get('MicroRouterView')).toBe(0);
    expect(counter.get('TransitionGroup')).toBe(0);
  });

  test('baseline: one useMicroState mutation costs the page two renders', async () => {
    const counter = createUpdateCounter();
    const r = mountRouter({
      routes: [
        { path: 'home', component: StatefulPage },
        { path: 'detail', component: createPage('detail') }
      ],
      mixins: [counter.mixin],
      stepDelay: STEP_DELAY
    });
    await flush();
    await r.store.push('detail');
    await new Promise((resolve) => setTimeout(resolve, STEP_DELAY * 3));
    await flush();
    counter.reset();

    // A real page-side write, not a store call — this is the path F3 describes.
    pageState!.count.value = 5;
    await flush(3);

    // Once for its own reactive change, then again when the owning RoutePage
    // re-renders and hands it a freshly built v-bind object. That second render
    // is the cost Phase 2 should target.
    expect(counter.get('StatefulPage')).toBe(2);
    expect(counter.get('RoutePage')).toBe(1);
    expect(counter.get('MicroRouterView')).toBe(0);
    expect(counter.get('TransitionGroup')).toBe(0);
    expect(counter.get('Pagedetail')).toBe(0);

    // The write-back reached the store, and the page shows the new value.
    expect(r.store.getRouteAttrs('home')).toEqual({ count: 5 });
    expect(document.querySelector('.stateful')?.textContent).toBe('5');
  });

  test('baseline: a navigation re-renders the page stack three times', async () => {
    const counter = createUpdateCounter();
    const r = mountRouter({
      routes: homeAndDetail,
      mixins: [counter.mixin],
      stepDelay: STEP_DELAY
    });
    await flush();
    counter.reset();

    await r.store.push('detail');
    await flush();

    // Two on the push itself. The per-page :class / :style literals are rebuilt
    // on each of these, because they live in the TransitionGroup's slot rather
    // than in the view's own render.
    expect(counter.get('TransitionGroup')).toBe(2);
    expect(counter.get('RoutePage')).toBe(2); // one instance, twice
    expect(counter.get('MicroRouterView')).toBe(0);
    counter.reset();

    // A third when the lock releases and `isNavigating` flips back to false.
    await new Promise((resolve) => setTimeout(resolve, STEP_DELAY * 3));
    await flush();
    expect(counter.get('TransitionGroup')).toBe(1);
    expect(counter.get('RoutePage')).toBe(2); // two instances, once each
    expect(counter.get('MicroRouterView')).toBe(0);
  });
});
