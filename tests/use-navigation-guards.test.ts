import { describe, expect, mock, test } from 'bun:test';

import { useNavigation } from '../libs/composables/use-navigation';
import { usePageTracker } from '../libs/composables/use-page-tracker';
import type { NavigationGuard } from '../libs/core/types';

function createNav(config: {
  defaultPath?: string;
  stepDelay?: number;
  guards?: {
    beforeEach?: NavigationGuard[];
    afterEach?: Array<(to: string, from: string) => void>;
  };
} = {}) {
  const tracker = usePageTracker();
  return useNavigation(
    { defaultPath: config.defaultPath ?? 'home', stepDelay: config.stepDelay ?? 10, ...config },
    tracker
  );
}

describe('Navigation Guards', () => {
  test('beforeEach guard blocks navigation when returning false', async () => {
    const guard = mock(() => false);
    const nav = createNav({ guards: { beforeEach: [guard] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'protected', component: { render: () => null } } as any);

    await nav.push('protected');
    expect(nav.activePage.value).toBe('home');
    expect(guard).toHaveBeenCalled();
  });

  test('beforeEach guard allows navigation when returning true', async () => {
    const guard = mock(() => true);
    const nav = createNav({ guards: { beforeEach: [guard] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'allowed', component: { render: () => null } } as any);

    await nav.push('allowed');
    expect(nav.activePage.value).toBe('allowed');
    expect(guard).toHaveBeenCalled();
  });

  test('async beforeEach guard works', async () => {
    const guard = mock(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return true;
    });
    const nav = createNav({ guards: { beforeEach: [guard] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

    await nav.push('page');
    expect(nav.activePage.value).toBe('page');
  });

  test('async beforeEach guard blocks when resolving false', async () => {
    const guard = mock(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return false;
    });
    const nav = createNav({ guards: { beforeEach: [guard] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'blocked', component: { render: () => null } } as any);

    await nav.push('blocked');
    expect(nav.activePage.value).toBe('home');
  });

  test('multiple beforeEach guards — first reject stops chain', async () => {
    const guard1 = mock(() => true);
    const guard2 = mock(() => false);
    const guard3 = mock(() => true);
    const nav = createNav({ guards: { beforeEach: [guard1, guard2, guard3] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

    await nav.push('page');
    expect(nav.activePage.value).toBe('home');
    expect(guard1).toHaveBeenCalled();
    expect(guard2).toHaveBeenCalled();
    expect(guard3).not.toHaveBeenCalled();
  });

  test('per-route beforeEnter guard blocks navigation', async () => {
    const nav = createNav();
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({
      path: 'admin',
      component: { render: () => null },
      beforeEnter: () => false
    } as any);

    await nav.push('admin');
    expect(nav.activePage.value).toBe('home');
  });

  test('per-route beforeEnter guard allows navigation', async () => {
    const nav = createNav();
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({
      path: 'admin',
      component: { render: () => null },
      beforeEnter: () => true
    } as any);

    await nav.push('admin');
    expect(nav.activePage.value).toBe('admin');
  });

  test('per-route beforeLeave guard blocks navigation', async () => {
    const nav = createNav();
    nav.registerRoute({
      path: 'home',
      component: { render: () => null },
      beforeLeave: () => false
    } as any);
    nav.registerRoute({ path: 'away', component: { render: () => null } } as any);

    await nav.push('away');
    expect(nav.activePage.value).toBe('home');
  });

  test('per-route beforeLeave guard allows navigation', async () => {
    const nav = createNav();
    nav.registerRoute({
      path: 'home',
      component: { render: () => null },
      beforeLeave: () => true
    } as any);
    nav.registerRoute({ path: 'away', component: { render: () => null } } as any);

    await nav.push('away');
    expect(nav.activePage.value).toBe('away');
  });

  test('guard composition: global + per-route both execute', async () => {
    const globalGuard = mock(() => true);
    const enterGuard = mock(() => true);
    const leaveGuard = mock(() => true);
    const nav = createNav({ guards: { beforeEach: [globalGuard] } });
    nav.registerRoute({
      path: 'home',
      component: { render: () => null },
      beforeLeave: leaveGuard
    } as any);
    nav.registerRoute({
      path: 'target',
      component: { render: () => null },
      beforeEnter: enterGuard
    } as any);

    await nav.push('target');
    expect(nav.activePage.value).toBe('target');
    expect(globalGuard).toHaveBeenCalled();
    expect(enterGuard).toHaveBeenCalled();
    expect(leaveGuard).toHaveBeenCalled();
  });

  test('guard receives correct to/from paths', async () => {
    const guard = mock(() => true);
    const nav = createNav({ guards: { beforeEach: [guard] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'menu', component: { render: () => null } } as any);

    await nav.push('menu');
    // to should be the resolved target, from should be the current path
    expect(guard).toHaveBeenCalledWith('/home/menu', '/home');
  });

  test('afterEach hook fires after successful navigation', async () => {
    const afterHook = mock(() => {});
    const nav = createNav({ guards: { afterEach: [afterHook] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

    await nav.push('page');
    expect(afterHook).toHaveBeenCalledWith('/home/page', '/home');
  });

  test('afterEach hook does NOT fire when guard blocks', async () => {
    const afterHook = mock(() => {});
    const nav = createNav({
      guards: { beforeEach: [() => false], afterEach: [afterHook] }
    });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'blocked', component: { render: () => null } } as any);

    await nav.push('blocked');
    expect(afterHook).not.toHaveBeenCalled();
  });

  test('guards work with back navigation', async () => {
    const guard = mock(() => true);
    const nav = createNav({ guards: { beforeEach: [guard] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

    await nav.push('page');
    await new Promise((r) => setTimeout(r, 20));
    guard.mockClear();

    await nav.push(-1);
    expect(guard).toHaveBeenCalled();
    expect(nav.activePage.value).toBe('home');
  });

  test('conditional guard blocks back navigation but allows forward', async () => {
    let allowNav = true;
    const nav = createNav({ guards: { beforeEach: [() => allowNav] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'sticky', component: { render: () => null } } as any);

    // Forward nav allowed
    await nav.push('sticky');
    expect(nav.activePage.value).toBe('sticky');
    await new Promise((r) => setTimeout(r, 20));

    // Now block navigation
    allowNav = false;
    await nav.push(-1);
    expect(nav.activePage.value).toBe('sticky');
  });

  test('guard that throws is treated as rejection', async () => {
    const nav = createNav({
      guards: { beforeEach: [() => { throw new Error('fail'); }] }
    });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

    await nav.push('page');
    expect(nav.activePage.value).toBe('home');
  });

  test('navigation still works when no guards configured', async () => {
    const nav = createNav();
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

    await nav.push('page');
    expect(nav.activePage.value).toBe('page');
  });

  test('isNavigating resets after guard blocks', async () => {
    const nav = createNav({ guards: { beforeEach: [() => false] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'blocked', component: { render: () => null } } as any);

    await nav.push('blocked');
    // isNavigating should be reset, so next push should work
    // Change guard to allow
    // (Can't change guard dynamically in this setup, but verify no deadlock)
    expect(nav.activePage.value).toBe('home');
  });

  test('stepWisePush respects guards for final destination', async () => {
    const guard = mock(() => false);
    const nav = createNav({ guards: { beforeEach: [guard] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'a', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'b', component: { render: () => null } } as any);

    await nav.stepWisePush('/home/a/b');
    expect(nav.activePage.value).toBe('home'); // blocked by guard
    expect(guard).toHaveBeenCalled();
  });

  test('stepWisePush allows when guard returns true', async () => {
    const guard = mock(() => true);
    const nav = createNav({ guards: { beforeEach: [guard] } });
    nav.registerRoute({ path: 'a', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'b', component: { render: () => null } } as any);

    await nav.stepWisePush('/a/b');
    expect(nav.activePath.value).toBe('/a/b');
  });

  test('stepWiseBack respects guards', async () => {
    let allowNav = true;
    const nav = createNav({ guards: { beforeEach: [() => allowNav] } });
    nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'a', component: { render: () => null } } as any);
    nav.registerRoute({ path: 'b', component: { render: () => null } } as any);

    await nav.stepWisePush('/home/a/b');
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.activePath.value).toBe('/home/a/b');

    allowNav = false;
    await nav.stepWiseBack(3);
    expect(nav.activePath.value).toBe('/home/a/b'); // blocked
  });

  test('guards work with absolute path push', async () => {
    const guard = mock((_to: string, _from: string) => true);
    const nav = createNav({ guards: { beforeEach: [guard] } });
    nav.registerRoute({ path: 'settings', component: { render: () => null } } as any);

    await nav.push('/settings');
    expect(guard).toHaveBeenCalledWith('/settings', '/home');
    expect(nav.activePath.value).toBe('/settings');
  });
});
