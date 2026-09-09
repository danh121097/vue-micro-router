/**
 * Swipe-back gesture (F4).
 *
 * The gesture had no test file at all before this one — `docs/` listed one that
 * did not exist. It is measured here on the real mounted tree rather than by
 * calling the composable directly, because the handlers are bound to the
 * `TransitionGroup` element and the pages they move are the ones Vue rendered.
 *
 * Viewport width is 1024 in this environment, so the 30% threshold sits at
 * 307.2px and the 0.5 px/ms velocity threshold is what a short fast flick has
 * to clear.
 */
/* eslint-disable vue/one-component-per-file -- nested-router hosts are test fixtures, not app components */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, markRaw } from 'vue';

import MicroRouterView from '../libs/components/MicroRouterView.vue';
import { cleanupRouters, createPage, flush, mountRouter } from './support/router-test-utils';

const STEP_DELAY = 10;
const VIEWPORT = 1024;

const routes = [
  { path: 'home', component: createPage('home') },
  { path: 'detail', component: createPage('detail') }
];

afterEach(cleanupRouters);

/** Mount with the gesture on, then push so there is a page to go back from. */
async function mountWithTwoPages(gesture: Record<string, unknown> = {}) {
  const r = mountRouter({
    routes,
    stepDelay: STEP_DELAY,
    gesture: { enabled: true, ...gesture }
  });
  await flush(3);
  await r.store.push('detail');
  await flush(4);
  return r;
}

/** The page-stack element the gesture binds to. */
function container(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.micro-router__pages');
  if (!el) throw new Error('page stack element is missing');
  return el;
}

/** The consumer's app root — the gesture must NOT be bound here. */
function appRoot(): HTMLElement {
  return document.body.firstElementChild as HTMLElement;
}

function pointer(type: string, x: number, y = 100): PointerEvent {
  return new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    bubbles: true,
    cancelable: true
  });
}

function pages(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.route-page'));
}

/** One animation frame, so rAF-batched style writes land. */
function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('swipe-back gesture', () => {
  test('two pages are stacked inside the page-stack element', async () => {
    const r = await mountWithTwoPages();
    expect(pages()).toHaveLength(2);
    expect(r.store.activePage.value).toBe('detail');
    for (const page of pages()) {
      expect(page.parentElement).toBe(container());
    }
  });

  test('the listeners are on the page stack, not on the app root', async () => {
    await mountWithTwoPages();
    const stack = container();
    const root = appRoot();
    expect(stack).not.toBe(root);

    // Every event here is non-bubbling, so only a listener on the element it is
    // dispatched at can respond. Bubbling events would pass whether the gesture
    // were bound to the stack, the app root, or the document.
    const at = (el: HTMLElement, x: number) =>
      el.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: x, clientY: 100, pointerId: 1, bubbles: false })
      );

    at(root, 5);
    root.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 400, clientY: 100, pointerId: 1, bubbles: false })
    );
    await frame();
    // Binding to the app root would arm the gesture from sibling layers — the
    // GUI layer is fixed at the left edge with `pointer-events: auto`.
    expect(pages()[1]!.style.transform).toBe('');

    at(stack, 5);
    stack.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 400, clientY: 100, pointerId: 1, bubbles: false })
    );
    await frame();
    expect(pages()[1]!.style.transform).toBe('translateX(395px)');
  });

  test('a drag past the threshold navigates back', async () => {
    const r = await mountWithTwoPages();
    const el = container();

    el.dispatchEvent(pointer('pointerdown', 5));
    el.dispatchEvent(pointer('pointermove', 400));
    await frame();
    el.dispatchEvent(pointer('pointerup', 400));

    // The handler animates for 200ms before handing off to goBack.
    await new Promise((resolve) => setTimeout(resolve, 260));
    await flush(4);

    expect(r.store.activePage.value).toBe('home');
  });

  test('a short fast flick navigates back below the distance threshold', async () => {
    const r = await mountWithTwoPages();
    const el = container();

    // 120px is well under 30% of 1024; the velocity is what carries it.
    el.dispatchEvent(pointer('pointerdown', 5));
    el.dispatchEvent(pointer('pointermove', 125));
    await frame();
    el.dispatchEvent(pointer('pointerup', 125));

    await new Promise((resolve) => setTimeout(resolve, 260));
    await flush(4);

    expect(r.store.activePage.value).toBe('home');
  });

  test('a slow short drag snaps back without navigating', async () => {
    const r = await mountWithTwoPages();
    const el = container();

    el.dispatchEvent(pointer('pointerdown', 5));
    el.dispatchEvent(pointer('pointermove', 60));
    await frame();
    // Slow enough that velocity stays under 0.5 px/ms.
    await new Promise((resolve) => setTimeout(resolve, 200));
    el.dispatchEvent(pointer('pointerup', 60));

    await new Promise((resolve) => setTimeout(resolve, 260));
    await flush(4);

    expect(r.store.activePage.value).toBe('detail');
  });

  test('a vertical drag cancels the gesture', async () => {
    const r = await mountWithTwoPages();
    const el = container();

    el.dispatchEvent(pointer('pointerdown', 5, 100));
    // deltaY > deltaX * 1.5 — a scroll, not a swipe.
    el.dispatchEvent(pointer('pointermove', 40, 300));
    await frame();
    el.dispatchEvent(pointer('pointerup', 400));

    await new Promise((resolve) => setTimeout(resolve, 260));
    await flush(4);

    expect(r.store.activePage.value).toBe('detail');
  });

  test('a drag starting outside the edge is ignored', async () => {
    const r = await mountWithTwoPages();
    const el = container();

    // Default edgeWidth is 20.
    el.dispatchEvent(pointer('pointerdown', 200));
    el.dispatchEvent(pointer('pointermove', 700));
    await frame();
    el.dispatchEvent(pointer('pointerup', 700));

    await new Promise((resolve) => setTimeout(resolve, 260));
    await flush(4);

    expect(r.store.activePage.value).toBe('detail');
    expect(pages()[1]!.style.transform).toBe('');
  });

  test('the gesture stays off when not enabled', async () => {
    const r = mountRouter({ routes, stepDelay: STEP_DELAY });
    await flush(3);
    await r.store.push('detail');
    await flush(4);

    const el = container();
    el.dispatchEvent(pointer('pointerdown', 5));
    el.dispatchEvent(pointer('pointermove', 700));
    await frame();
    el.dispatchEvent(pointer('pointerup', 700));

    await new Promise((resolve) => setTimeout(resolve, 260));
    await flush(4);

    expect(r.store.activePage.value).toBe('detail');
  });
});

describe('gesture layout reads (AC6)', () => {
  let reads: number;
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    reads = 0;
    original = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      get() {
        reads += 1;
        return VIEWPORT;
      }
    });
  });

  afterEach(() => {
    if (original) Object.defineProperty(window, 'innerWidth', original);
    else delete (window as unknown as Record<string, unknown>).innerWidth;
  });

  test('a drag reads the viewport width once, not once per move', async () => {
    await mountWithTwoPages();
    const el = container();

    reads = 0;
    el.dispatchEvent(pointer('pointerdown', 5));
    // Once per gesture, in pointerdown — the width cannot change mid-drag.
    expect(reads).toBe(1);
    reads = 0;

    for (let x = 20; x <= 300; x += 10) {
      el.dispatchEvent(pointer('pointermove', x));
    }
    await frame();

    // 29 moves. Reading the viewport inside the move handler interleaves a
    // layout read between two transform writes on every one of them.
    expect(reads).toBe(0);
  });
});

describe('gesture transform writes', () => {
  test('moves within one frame produce a single coalesced write', async () => {
    await mountWithTwoPages();
    const el = container();
    const current = pages()[1]!;

    el.dispatchEvent(pointer('pointerdown', 5));

    let writes = 0;
    const style = current.style;
    const proto = Object.getPrototypeOf(style);
    const desc = Object.getOwnPropertyDescriptor(proto, 'transform');
    Object.defineProperty(style, 'transform', {
      configurable: true,
      get: () => desc?.get?.call(style) ?? '',
      set(v: string) {
        writes += 1;
        desc?.set?.call(style, v);
      }
    });

    try {
      for (let x = 20; x <= 200; x += 10) {
        el.dispatchEvent(pointer('pointermove', x));
      }
      expect(writes).toBe(0); // nothing written synchronously

      await frame();
      expect(writes).toBe(1); // 19 moves coalesced into one frame
      expect(current.style.transform).toBe('translateX(195px)');
    } finally {
      delete (style as unknown as Record<string, unknown>).transform;
    }
  });
});

/**
 * The gesture container is resolved per router, so an outer router must not
 * reach into a nested one. Before the `tag`/`:scope` fix the outer router's
 * `getPages()` returned the inner router's page as `current` and its own host
 * page as `previous` — `current` a DOM descendant of `previous`.
 */
describe('nested routers', () => {
  test('each router only sees its own pages', async () => {
    const inner = markRaw(
      defineComponent({
        name: 'InnerHost',
        setup: () => () =>
          h(MicroRouterView, {
            config: { defaultPath: 'inner-a', defaultControlName: 'main_gui' },
            plugins: [
              {
                name: 'inner',
                routes: [
                  { path: 'inner-a', component: createPage('inner-a') },
                  { path: 'inner-b', component: createPage('inner-b') }
                ],
                dialogs: [],
                controls: []
              }
            ],
            nested: true
          })
      })
    );

    const r = mountRouter({
      routes: [
        { path: 'home', component: createPage('home') },
        { path: 'host', component: inner }
      ],
      stepDelay: STEP_DELAY,
      gesture: { enabled: true }
    });
    await flush(3);
    await r.store.push('host');
    await flush(6);

    const stacks = Array.from(
      document.querySelectorAll<HTMLElement>('.micro-router__pages')
    );
    expect(stacks).toHaveLength(2);

    const [outer, innerStack] = stacks;
    const own = (el: HTMLElement) =>
      Array.from(el.querySelectorAll<HTMLElement>(':scope > .route-page'));

    expect(own(outer!)).toHaveLength(2);
    expect(own(innerStack!)).toHaveLength(1);

    // The outer stack contains the inner one, so an unscoped query would mix
    // them: the outer router would treat the inner page as its current page.
    expect(outer!.querySelectorAll('.route-page').length).toBeGreaterThan(
      own(outer!).length
    );
    expect(own(outer!).some((p) => own(innerStack!).includes(p))).toBe(false);
  });

  test('a swipe on the outer router moves the outer page, not the inner one', async () => {
    const inner = markRaw(
      defineComponent({
        name: 'InnerHost',
        setup: () => () =>
          h(MicroRouterView, {
            config: { defaultPath: 'inner-a', defaultControlName: 'main_gui' },
            plugins: [
              {
                name: 'inner',
                routes: [{ path: 'inner-a', component: createPage('inner-a') }],
                dialogs: [],
                controls: []
              }
            ],
            nested: true
          })
      })
    );

    const r = mountRouter({
      routes: [
        { path: 'home', component: createPage('home') },
        { path: 'host', component: inner }
      ],
      stepDelay: STEP_DELAY,
      gesture: { enabled: true }
    });
    await flush(3);
    await r.store.push('host');
    await flush(6);

    const outer = document.querySelectorAll<HTMLElement>('.micro-router__pages')[0]!;
    const outerPages = Array.from(
      outer.querySelectorAll<HTMLElement>(':scope > .route-page')
    );
    const innerPage = document
      .querySelectorAll<HTMLElement>('.micro-router__pages')[1]!
      .querySelector<HTMLElement>(':scope > .route-page')!;

    outer.dispatchEvent(pointer('pointerdown', 5));
    outer.dispatchEvent(pointer('pointermove', 300));
    await frame();

    // An unscoped `.route-page` query returns document order across the whole
    // subtree, so the outer router would grab the *inner* router's page as its
    // current page and drag that instead.
    expect(outerPages[1]!.style.transform).toBe('translateX(295px)');
    expect(innerPage.style.transform).toBe('');
  });
});

/**
 * Each release schedules a timer that clears the inline styles once the
 * animation ends. A second gesture started inside that window used to have its
 * page wiped by the previous gesture's timer — a fast repeat swipe simply did
 * nothing.
 */
describe('overlapping gestures', () => {
  test('a new gesture survives the previous one settling', async () => {
    await mountWithTwoPages();
    const el = container();
    const current = pages()[1]!;

    // Gesture A: short and slow, so it snaps back and schedules a 200ms settle.
    el.dispatchEvent(pointer('pointerdown', 5));
    el.dispatchEvent(pointer('pointermove', 40));
    await frame();
    el.dispatchEvent(pointer('pointerup', 40));

    // Gesture B starts well inside A's settle window.
    await new Promise((resolve) => setTimeout(resolve, 40));
    el.dispatchEvent(pointer('pointerdown', 5));
    el.dispatchEvent(pointer('pointermove', 150));
    await frame();
    expect(current.style.transform).toBe('translateX(145px)');

    // Past when A's timer would have fired.
    await new Promise((resolve) => setTimeout(resolve, 220));
    el.dispatchEvent(pointer('pointermove', 250));
    await frame();

    expect(current.style.transform).toBe('translateX(245px)');
  });
});
