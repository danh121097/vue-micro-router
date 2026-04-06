import { describe, expect, test } from 'bun:test';

import { useNavigation } from '../libs/composables/use-navigation';
import { usePageTracker } from '../libs/composables/use-page-tracker';

function createNav(config: { defaultPath?: string; stepDelay?: number } = {}) {
  const tracker = usePageTracker();
  return useNavigation(
    { defaultPath: config.defaultPath ?? 'home', stepDelay: config.stepDelay ?? 10 },
    tracker
  );
}

describe('Route Resolution Caching', () => {
  test('resolveRoutes returns same object reference when path unchanged', () => {
    const nav = createNav();
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);

    const first = nav.resolveRoutes.value[0];
    const second = nav.resolveRoutes.value[0];
    expect(first).toBe(second); // same reference
  });

  test('resolveRoutes preserves reference after attrs-only update', () => {
    const nav = createNav();
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);

    const before = nav.resolveRoutes.value[0];
    // Attrs changes don't affect resolveRoutes (stored separately)
    nav.updateRouteAttrs('home', { foo: 'bar' });
    const after = nav.resolveRoutes.value[0];
    expect(before).toBe(after); // same reference — cache hit
  });

  test('resolveRoutes returns new reference after navigation changes path', async () => {
    const nav = createNav();
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'menu', component: { render: () => null } } as any);

    const homeBefore = nav.resolveRoutes.value[0];
    await nav.push('menu');
    // After push, home is still in resolved (stacked), check identity preserved
    const homeAfter = nav.resolveRoutes.value[0];
    expect(homeBefore).toBe(homeAfter); // home route unchanged — cache hit
    expect(nav.resolveRoutes.value).toHaveLength(2);
  });

  test('cache cleans stale entries on back navigation', async () => {
    const nav = createNav();
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

    await nav.push('page');
    expect(nav.resolveRoutes.value).toHaveLength(2);

    await new Promise((r) => setTimeout(r, 20));
    await nav.push(-1);
    expect(nav.resolveRoutes.value).toHaveLength(1);
    expect(nav.resolveRoutes.value[0]?.path).toBe('home');
  });
});
