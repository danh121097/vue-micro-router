import { describe, expect, test } from 'bun:test';

import { useNavigation } from '../libs/composables/navigation/use-navigation';
import { usePageTracker } from '../libs/composables/use-page-tracker';

function createNav(config: {
  defaultPath?: string;
  stepDelay?: number;
  history?: { enabled?: boolean; maxEntries?: number };
} = {}) {
  const tracker = usePageTracker();
  return useNavigation(
    { defaultPath: config.defaultPath ?? 'home', stepDelay: config.stepDelay ?? 10, ...config },
    tracker
  );
}

describe('Navigation History', () => {
  test('history is undefined when not enabled', () => {
    const nav = createNav();
    expect(nav.history).toBeUndefined();
  });

  test('history is available when enabled', () => {
    const nav = createNav({ history: { enabled: true } });
    expect(nav.history).toBeDefined();
    expect(nav.history!.canGoBack.value).toBe(false);
    expect(nav.history!.canGoForward.value).toBe(false);
  });

  test('records entries on push', async () => {
    const nav = createNav({ history: { enabled: true } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

    await nav.push('page');
    expect(nav.history!.entries.value).toHaveLength(2); // initial + push
    expect(nav.history!.canGoBack.value).toBe(true);
  });

  test('back() navigates to previous entry', async () => {
    const nav = createNav({ history: { enabled: true } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page1', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page2', component: { render: () => null } } as any);

    await nav.push('page1');
    await new Promise((r) => setTimeout(r, 20));
    await nav.push('page2');
    await new Promise((r) => setTimeout(r, 20));

    expect(nav.activePage.value).toBe('page2');
    expect(nav.history!.canGoBack.value).toBe(true);

    await nav.history!.back();
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.history!.canGoForward.value).toBe(true);
  });

  test('forward() navigates to next entry after back()', async () => {
    const nav = createNav({ history: { enabled: true } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page1', component: { render: () => null } } as any);

    await nav.push('page1');
    await new Promise((r) => setTimeout(r, 20));

    await nav.history!.back();
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.history!.canGoForward.value).toBe(true);

    await nav.history!.forward();
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.history!.canGoForward.value).toBe(false);
  });

  test('push after back() truncates forward entries', async () => {
    const nav = createNav({ history: { enabled: true } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'a', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'b', component: { render: () => null } } as any);

    await nav.push('a');
    await new Promise((r) => setTimeout(r, 20));
    await nav.push('b');
    await new Promise((r) => setTimeout(r, 20));

    // Go back then push new — should truncate forward
    await nav.history!.back();
    await new Promise((r) => setTimeout(r, 20));

    await nav.push('b'); // new push from 'a'
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.history!.canGoForward.value).toBe(false);
  });

  test('maxEntries caps history with FIFO eviction', async () => {
    const nav = createNav({ history: { enabled: true, maxEntries: 3 } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'a', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'b', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'c', component: { render: () => null } } as any);

    // initial 'home' + 3 pushes = 4 entries, maxEntries=3 so first evicted
    await nav.push('a');
    await new Promise((r) => setTimeout(r, 20));
    await nav.push('b');
    await new Promise((r) => setTimeout(r, 20));
    await nav.push('c');
    await new Promise((r) => setTimeout(r, 20));

    expect(nav.history!.entries.value.length).toBeLessThanOrEqual(3);
  });

  test('clear() resets history', async () => {
    const nav = createNav({ history: { enabled: true } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

    await nav.push('page');
    expect(nav.history!.entries.value.length).toBeGreaterThan(0);

    nav.history!.clear();
    expect(nav.history!.entries.value).toHaveLength(0);
    expect(nav.history!.canGoBack.value).toBe(false);
  });

  test('zero overhead when history disabled (default)', () => {
    const nav = createNav();
    expect(nav.history).toBeUndefined();
  });
});
