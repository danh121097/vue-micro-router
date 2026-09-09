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
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

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

function container(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.micro-router__pages')
    ?? document.body.firstElementChild as HTMLElement;
  return el;
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
  test('two pages are stacked and the container has the listeners', async () => {
    const r = await mountWithTwoPages();
    expect(pages()).toHaveLength(2);
    expect(r.store.activePage.value).toBe('detail');
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

    el.dispatchEvent(pointer('pointerdown', 5));
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
