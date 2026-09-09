/**
 * Devtools opt-in (AC5).
 *
 * The inspector shipped in every bundle but never initialised: a
 * `import.meta.env.DEV` guard was substituted to a constant `false` by the
 * library build, so `setupDevtoolsPlugin` returned before doing anything. Phase
 * 3 moved the decision to `config.devtools` and made the module a lazy chunk.
 *
 * These tests assert at the `@vue/devtools-api` boundary — the point the old
 * code never reached — rather than at anything internal to the library.
 */
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';

import { cleanupRouters, createPage, flush, mountRouter } from './support/router-test-utils';

const STEP_DELAY = 30;

interface PluginDescriptor {
  id: string;
  label: string;
  packageName: string;
}

/** Everything the library asked the devtools API to do, in order. */
interface ApiCalls {
  descriptors: PluginDescriptor[];
  inspectors: Record<string, unknown>[];
  timelineLayers: Record<string, unknown>[];
  timelineEvents: Record<string, unknown>[];
  /** Handlers the library registered, so a test can drive them like devtools would. */
  getInspectorTree?: (payload: Record<string, unknown>) => void;
}

let calls: ApiCalls;

function resetCalls() {
  calls = { descriptors: [], inspectors: [], timelineLayers: [], timelineEvents: [] };
}

/**
 * Stand-in for `@vue/devtools-api`.
 *
 * The real `setupDevtoolsPlugin` only runs its callback once a devtools client
 * connects, which never happens headlessly — so the callback would never fire
 * and every assertion below would be vacuous. This runs it immediately.
 */
const fakeApi = {
  addInspector: (options: Record<string, unknown>) => calls.inspectors.push(options),
  addTimelineLayer: (options: Record<string, unknown>) => calls.timelineLayers.push(options),
  addTimelineEvent: (options: Record<string, unknown>) => calls.timelineEvents.push(options),
  sendInspectorTree: () => {},
  sendInspectorState: () => {},
  on: {
    getInspectorTree: (cb: (payload: Record<string, unknown>) => void) => {
      calls.getInspectorTree = cb;
    },
    getInspectorState: () => {}
  }
};

let realModule: typeof import('@vue/devtools-api');

beforeAll(async () => {
  realModule = await import('@vue/devtools-api');
  mock.module('@vue/devtools-api', () => ({
    ...realModule,
    setupDevtoolsPlugin: (descriptor: PluginDescriptor, cb: (api: unknown) => void) => {
      calls.descriptors.push(descriptor);
      cb(fakeApi);
    }
  }));
});

// The module registry is process-wide, so leaving the stub in place would leak
// into any file that loads devtools later — the same hazard that made this
// suite order-dependent before Phase 1.
afterAll(() => {
  // Guarded: if `beforeAll` threw, `realModule` is undefined and an unguarded
  // restore would install `() => undefined` for every file that runs after.
  if (realModule) mock.module('@vue/devtools-api', () => realModule);
});

afterEach(cleanupRouters);

const routes = [
  { path: 'home', component: createPage('home') },
  { path: 'detail', component: createPage('detail') }
];

/** Mount, then let the dynamic import and its promise chain settle. */
async function mountAndSettle(devtools?: boolean) {
  resetCalls();
  const r = mountRouter({ routes, stepDelay: STEP_DELAY, devtools });
  await flush(4);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flush(2);
  return r;
}

describe('devtools opt-in', () => {
  test('stays out of the way when the flag is absent', async () => {
    await mountAndSettle();

    expect(calls.descriptors).toHaveLength(0);
    expect(calls.inspectors).toHaveLength(0);
    expect(calls.timelineLayers).toHaveLength(0);
  });

  test('stays out of the way when the flag is explicitly false', async () => {
    await mountAndSettle(false);

    expect(calls.descriptors).toHaveLength(0);
  });

  test('registers the inspector and timeline layer when enabled', async () => {
    await mountAndSettle(true);

    expect(calls.descriptors).toHaveLength(1);
    expect(calls.descriptors[0]!.id).toBe('vue-micro-router');
    expect(calls.descriptors[0]!.packageName).toBe('vue-micro-router');
    expect(calls.inspectors.map((i) => i.id)).toEqual(['micro-router-inspector']);
    expect(calls.timelineLayers.map((l) => l.id)).toEqual(['micro-router-events']);
  });
});

describe('devtools reporting', () => {
  test('a navigation reaches the timeline', async () => {
    const r = await mountAndSettle(true);
    expect(calls.timelineEvents).toHaveLength(0);

    await r.store.push('detail');
    await flush(4);

    // This is the call the old build could never make: emitDevtoolsEvent sat
    // behind the same dead guard as the setup it depended on.
    expect(calls.timelineEvents).toHaveLength(1);
    const event = calls.timelineEvents[0]! as {
      layerId: string;
      event: { title: string; data: Record<string, unknown> };
    };
    expect(event.layerId).toBe('micro-router-events');
    expect(event.event.title).toBe('navigate');
    expect(event.event.data).toEqual({ from: 'home', to: 'detail' });
  });

  test('the inspector tree reports the live page stack', async () => {
    const r = await mountAndSettle(true);
    await r.store.push('detail');
    await flush(4);

    expect(calls.getInspectorTree).toBeDefined();
    const payload: Record<string, unknown> = { inspectorId: 'micro-router-inspector' };
    calls.getInspectorTree!(payload);

    const rootNodes = payload.rootNodes as { id: string; label: string }[];
    const routeNode = rootNodes.find((n) => n.id === 'routes')!;
    expect(routeNode.label).toBe('Routes (2 active)');
  });

  test('a foreign inspectorId is left untouched', async () => {
    await mountAndSettle(true);

    const payload: Record<string, unknown> = { inspectorId: 'someone-elses-inspector' };
    calls.getInspectorTree!(payload);

    expect(payload.rootNodes).toBeUndefined();
  });
});

describe('devtools lifecycle', () => {
  test('a router unmounted before the import resolves never registers', async () => {
    resetCalls();
    const r = mountRouter({ routes, stepDelay: STEP_DELAY, devtools: true });
    // Unmount inside the dynamic-import window, before the `.then` can run.
    r.wrapper.unmount();

    await flush(4);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flush(2);

    // Registering here would strand the unmounted store — and everything its
    // refs reach — inside the inspector closure for the life of the page.
    expect(calls.descriptors).toHaveLength(0);
    expect(calls.inspectors).toHaveLength(0);
  });

  test('unmounting stops the router reporting', async () => {
    const r = await mountAndSettle(true);
    expect(calls.inspectors).toHaveLength(1);

    const tree: Record<string, unknown> = { inspectorId: 'micro-router-inspector' };
    calls.getInspectorTree!(tree);
    expect(tree.rootNodes).toHaveLength(3);

    r.wrapper.unmount();
    await flush(2);

    const after: Record<string, unknown> = { inspectorId: 'micro-router-inspector' };
    calls.getInspectorTree!(after);
    expect(after.rootNodes).toHaveLength(0);
  });

  test('a second enabled router joins the inspector instead of re-registering', async () => {
    await mountAndSettle(true);
    mountRouter({ routes, stepDelay: STEP_DELAY, devtools: true });
    await flush(4);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flush(2);

    // One plugin, one inspector, one timeline layer — registering a second set
    // under the same ids is what made the tree describe only the last router.
    expect(calls.descriptors).toHaveLength(1);
    expect(calls.inspectors).toHaveLength(1);
    expect(calls.timelineLayers).toHaveLength(1);

    const payload: Record<string, unknown> = { inspectorId: 'micro-router-inspector' };
    calls.getInspectorTree!(payload);
    const rootNodes = payload.rootNodes as { id: string; label: string }[];
    expect(rootNodes.map((n) => n.label)).toEqual(['Router 1', 'Router 2']);
  });
});
