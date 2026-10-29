/**
 * Page events on `tracker.onEvent`, through `useNavigation`.
 *
 * The contract: every page in the stack gets one `enter` when it is mounted
 * and one `leave` when it is removed; `cover` / `uncover` follow which page is
 * on top. Leaves come before enters within one navigation.
 */
import { describe, expect, mock, spyOn, test } from 'bun:test';

import { useNavigation } from '../libs/composables/navigation/use-navigation';
import { usePageTracker } from '../libs/composables/use-page-tracker';
import type { NavigationGuard, TrackerEvent } from '../libs/core/types';

const STEP_DELAY = 5;
const settle = () => new Promise((r) => setTimeout(r, STEP_DELAY + 10));
const page = { render: () => null };

function createNav(beforeEach: NavigationGuard[] = []) {
  const events: TrackerEvent[] = [];
  const nav = useNavigation(
    { defaultPath: 'home', stepDelay: STEP_DELAY, guards: { beforeEach } },
    usePageTracker({ onEvent: (e) => events.push(e) })
  );
  nav.registerRoutes(
    ['home', 'a', 'b', 'c'].map((path) => ({ path, component: page }))
  );
  nav.trackCurrentPage();
  return { nav, events };
}

/** `phase name reason?` — enough to read the order at a glance. */
function brief(events: TrackerEvent[]) {
  return events.map((e) =>
    [e.phase, e.name, e.closeReason].filter(Boolean).join(' ')
  );
}

describe('page events', () => {
  test('the initial page enters once, from nothing', () => {
    const { nav, events } = createNav();
    expect(events).toEqual([
      {
        kind: 'page',
        phase: 'enter',
        name: 'home',
        path: '/home',
        from: '',
        to: '/home',
        navigationKind: 'push'
      }
    ]);
    nav.trackCurrentPage();
    expect(events).toHaveLength(1);
  });

  test('push covers the page under it; back uncovers it', async () => {
    const { nav, events } = createNav();
    events.length = 0;

    await nav.push('a');
    expect(brief(events)).toEqual(['cover home', 'enter a']);
    expect(events[1]).toMatchObject({ path: '/home/a', from: '/home', to: '/home/a', navigationKind: 'push' });

    events.length = 0;
    await settle();
    await nav.push(-1);
    expect(brief(events)).toEqual(['leave a programmatic', 'uncover home']);
    expect(events[0]).toMatchObject({ navigationKind: 'back', from: '/home/a', to: '/home' });
  });

  test('replace reports the swapped page leaving with reason replace', async () => {
    const { nav, events } = createNav();
    await nav.push('a');
    await settle();
    events.length = 0;

    await nav.replace('b');
    expect(brief(events)).toEqual(['leave a replace', 'enter b']);
    expect(events.every((e) => e.navigationKind === 'replace')).toBe(true);
  });

  test('a multi-step back reports every removed page, top first', async () => {
    const { nav, events } = createNav();
    await nav.push('a');
    await settle();
    await nav.push('b');
    await settle();
    await nav.push('c');
    await settle();
    events.length = 0;

    await nav.push('a');
    expect(brief(events)).toEqual([
      'leave c programmatic',
      'leave b programmatic',
      'uncover a'
    ]);
    expect(events.every((e) => e.from === '/home/a/b/c' && e.to === '/home/a')).toBe(true);
  });

  test('an absolute push to a new stack leaves the old pages and covers every new page but the top', async () => {
    const { nav, events } = createNav();
    await nav.push('a');
    await settle();
    events.length = 0;

    await nav.push('/b/c');
    expect(brief(events)).toEqual([
      'leave a programmatic',
      'leave home programmatic',
      'enter b',
      'cover b',
      'enter c'
    ]);
  });

  test('a page carries its route meta', async () => {
    const events: TrackerEvent[] = [];
    const nav = useNavigation(
      { defaultPath: 'home', stepDelay: STEP_DELAY },
      usePageTracker({ onEvent: (e) => events.push(e) })
    );
    nav.registerRoutes([
      { path: 'home', component: page },
      { path: 'shop', component: page, meta: { screen: 'store' } }
    ]);
    await nav.push('shop');
    expect(events.at(-1)).toMatchObject({ name: 'shop', meta: { screen: 'store' } });
    expect(events.at(-2)).not.toHaveProperty('meta');
    expect(nav.listRoutes()).toEqual([
      { path: 'home' },
      { path: 'shop', meta: { screen: 'store' } }
    ]);
  });

  test('a leave reason does not outlive a navigation a guard rejected', async () => {
    let allow = true;
    const { nav, events } = createNav([() => allow]);
    await nav.push('a');
    await settle();

    allow = false;
    await nav.withLeaveReason('gesture', () => nav.push(-1));
    expect(nav.activePage.value).toBe('a');

    allow = true;
    events.length = 0;
    await nav.push(-1);
    expect(brief(events)).toEqual(['leave a programmatic', 'uncover home']);
  });

  test('a throwing onEvent does not stop the navigation or the page hooks', async () => {
    const trackPageEnter = mock((_page: string) => {});
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    const nav = useNavigation(
      { defaultPath: 'home', stepDelay: STEP_DELAY },
      usePageTracker({
        trackPageEnter,
        onEvent: () => {
          throw new Error('tracker down');
        }
      })
    );
    nav.registerRoutes([{ path: 'home', component: page }, { path: 'a', component: page }]);
    await nav.push('a');
    expect(nav.activePath.value).toBe('/home/a');
    expect(trackPageEnter).toHaveBeenCalledWith('/home/a', 'home', '/home/a');
    warn.mockRestore();
  });
});
