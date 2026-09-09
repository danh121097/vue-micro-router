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
/* eslint-disable vue/one-component-per-file -- probe components are test fixtures, not app components */
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

/**
 * Page holding nested state. `useMicroState` watches a `reactive()` source, so
 * the watcher is deep without a `deep` flag — this fixture is what pins that.
 */
let nestedState: { profile: { value: { name: string } } } | null = null;
const NestedStatePage = markRaw(
  defineComponent({
    name: 'NestedStatePage',
    setup() {
      const state = useMicroState({ profile: { name: 'a' } });
      nestedState = state as unknown as { profile: { value: { name: string } } };
      return () => h('div', { class: 'nested-state' }, state.profile.value.name);
    }
  })
);

/** Page whose props come straight from the store's route attrs. */
const BadgePage = markRaw(
  defineComponent({
    name: 'BadgePage',
    props: { badge: { type: Number, default: 0 } },
    setup: (props) => () => h('div', { class: 'badge' }, String(props.badge))
  })
);

const homeAndDetail = [
  { path: 'home', component: createPage('home') },
  { path: 'detail', component: createPage('detail') }
];

afterEach(() => {
  pageState = null;
  nestedState = null;
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

    // The outgoing page stays mounted for the length of its leave transition —
    // that is what a leave transition is. This used to read as 1 here only
    // because the page stack was a fragment, so `findAll` never saw the leaving
    // element; the stack is a real element now and the count is honest.
    const leaving = r.wrapper.findAll('.route-page');
    expect(leaving).toHaveLength(2);
    expect(leaving[1]!.classes()).toContain('page-slide-leave-active');

    await new Promise((resolve) => setTimeout(resolve, 600));
    await flush();
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
describe('MicroRouterView — render cascade', () => {
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

  test('one useMicroState mutation costs the page a single render', async () => {
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

    // Once, for its own reactive change. The write-back used to echo straight
    // back down as props — `persistRouteAttrs` persists without notifying, so the
    // owning RoutePage no longer re-renders and the page is not handed data it
    // just produced (baseline was 2 page renders and 1 RoutePage render).
    expect(counter.get('StatefulPage')).toBe(1);
    expect(counter.get('RoutePage')).toBe(0);
    expect(counter.get('MicroRouterView')).toBe(0);
    expect(counter.get('TransitionGroup')).toBe(0);
    expect(counter.get('Pagedetail')).toBe(0);

    // The write-back reached the store, and the page shows the new value.
    expect(r.store.getRouteAttrs('home')).toEqual({ count: 5 });
    expect(document.querySelector('.stateful')?.textContent).toBe('5');
  });

  test('a page mutation survives a remount even though it never notified', async () => {
    const r = mountRouter({
      routes: [
        { path: 'home', component: StatefulPage },
        { path: 'detail', component: createPage('detail') }
      ],
      stepDelay: STEP_DELAY
    });
    await flush();
    await r.store.push('detail');
    await new Promise((resolve) => setTimeout(resolve, STEP_DELAY * 3));
    await flush();

    pageState!.count.value = 7;
    await flush(3);

    // `push(-1, props)` bumps the target's componentKey, so `home` is torn down
    // and set up again. Persist-without-notify must still mean persist: the
    // fresh instance reads its state back out of the store.
    pageState = null;
    await r.store.push(-1, {});
    await new Promise((resolve) => setTimeout(resolve, STEP_DELAY * 3));
    await flush(3);

    expect(pageState).not.toBeNull();
    expect(pageState!.count.value).toBe(7);
    expect(document.querySelector('.stateful')?.textContent).toBe('7');
  });

  test('a nested mutation still syncs back without an explicit deep flag', async () => {
    const r = mountRouter({
      routes: [{ path: 'home', component: NestedStatePage }],
      stepDelay: STEP_DELAY
    });
    await flush();

    nestedState!.profile.value.name = 'b';
    await flush(3);

    // A shallow watch source here would drop this write silently and lose it on
    // remount — see D3. Watching the `reactive()` object keeps it deep.
    //
    // The write-back spreads the page's `reactive()` state, so a nested value
    // reaches the store as the page's own live object rather than a copy. That
    // is pre-existing shape, not something this phase introduced — it is why
    // this assertion compares content and not identity.
    expect(r.store.getRouteAttrs('home')).toEqual({ profile: { name: 'b' } });
  });

  test('repeated mutations do not re-clone the stored attrs object (AC3)', async () => {
    const r = mountRouter({
      routes: [{ path: 'home', component: StatefulPage }],
      stepDelay: STEP_DELAY
    });
    await flush();

    pageState!.count.value = 1;
    await flush(3);
    const stored = r.store.getRouteAttrs('home');

    pageState!.count.value = 2;
    await flush(3);

    // `persistRouteAttrs` merges in place, so the only clone left on this path
    // is the one `useMicroState` makes of its own state — a second clone in the
    // store would show up here as a new identity.
    expect(r.store.getRouteAttrs('home')).toBe(stored);
    expect(stored).toEqual({ count: 2 });
  });

  test('a page write-back does not wipe attrs the page never held', async () => {
    const r = mountRouter({
      routes: [{ path: 'home', component: StatefulPage }],
      stepDelay: STEP_DELAY
    });
    await flush();

    // Set after the page read its attrs, so the key exists in the store but not
    // in the page's own state.
    r.store.updateRouteAttrs('home', { serverTag: 'x' });
    await flush(3);

    pageState!.count.value = 3;
    await flush(3);

    // `persistRouteAttrs` merges. Replacing would silently drop everything the page
    // did not happen to be carrying.
    expect(r.store.getRouteAttrs('home')).toEqual({ serverTag: 'x', count: 3 });
  });

  test('the notifying attrs path still re-renders a mounted page', async () => {
    const r = mountRouter({
      routes: [
        { path: 'home', component: createPage('home') },
        { path: 'detail', component: BadgePage }
      ],
      stepDelay: STEP_DELAY
    });
    await flush();

    // Props handed to a page as it is pushed.
    await r.store.push('detail', { badge: 1 });
    await new Promise((resolve) => setTimeout(resolve, STEP_DELAY * 3));
    await flush();
    expect(document.querySelector('.badge')?.textContent).toBe('1');

    // And `updateRouteAttrs` on the page while it is mounted. Only the
    // `useMicroState` write-back moved to `persistRouteAttrs`; this path must still
    // notify, or `push(path, props)` and state restore stop reaching the page.
    r.store.updateRouteAttrs('detail', { badge: 2 });
    await flush(3);
    expect(document.querySelector('.badge')?.textContent).toBe('2');
    expect(r.store.getRouteAttrs('detail')).toEqual({ badge: 2 });
  });

  test('per-page inline styles carry the stack order and the route transition', async () => {
    const r = mountRouter({
      routes: [
        { path: 'home', component: createPage('home') },
        { path: 'detail', component: createPage('detail'), transitionDuration: 250 }
      ],
      stepDelay: STEP_DELAY
    });
    await flush();
    await r.store.push('detail');
    await flush();

    // The styles moved out of the `v-for` literal into a memoised computed;
    // these are the three parts that had to survive the move.
    const styles = r.wrapper.findAll('.route-page').map((p) => p.attributes('style') ?? '');
    expect(styles).toHaveLength(2);
    expect(styles[0]).toContain('z-index: 10');
    expect(styles[1]).toContain('z-index: 11');
    // Duration comes from the topmost route, and applies to every page in the stack.
    for (const style of styles) {
      expect(style).toContain('transform 250ms');
      expect(style).toContain('opacity 250ms');
    }
  });

  test('a navigation re-renders the page stack three times', async () => {
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
