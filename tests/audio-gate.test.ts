/**
 * `audioGate`: navigation music waits for the app's go-ahead.
 *
 * Drives a real `MicroRouterView` with the default `HowlerAdapter`, with
 * `howler` replaced by a fake whose constructor records each sound created.
 * "No sound" means no `Howl` was constructed: that is the call that makes
 * Howler create its AudioContext, which a browser refuses before the page's
 * first user gesture.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { computed, ref } from 'vue';

import type { MicroRouterConfig } from '../libs/core/types';
import { cleanupRouters, createPage, mountRouter } from './support/router-test-utils';

const STEP_DELAY = 5;
const DEFAULT_BGM = '/default.mp3';

/** Source of every fake `Howl` constructed, in order. */
const created: string[] = [];

class FakeHowl {
  private on = false;
  constructor(options: { src: string[] }) {
    created.push(options.src[0]!);
  }
  play() { this.on = true; return 1; }
  stop() { this.on = false; return this; }
  pause() { this.on = false; return this; }
  fade() { return this; }
  off() { return this; }
  once() { return this; }
  unload() { this.on = false; }
  playing() { return this.on; }
  state() { return 'loaded'; }
}

let realHowler: typeof import('howler') | undefined;

beforeAll(async () => {
  // A copy: `mock.module` rewrites the live namespace object in place.
  realHowler = { ...(await import('howler')) };
  mock.module('howler', () => ({ ...realHowler, Howl: FakeHowl }));
});

// The module registry is process-wide: put the real module back for later files.
afterAll(() => {
  if (realHowler) mock.module('howler', () => realHowler!);
});

beforeEach(() => {
  created.length = 0;
});

afterEach(cleanupRouters);

const routes = [
  { path: 'home', component: createPage('home') },
  { path: 'a', component: createPage('a'), bgm: '/a.mp3' },
  { path: 'b', component: createPage('b'), bgm: '/b.mp3' }
];

/** Let the adapter's `howler` preload and the navigation unlock timer finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, STEP_DELAY * 3));

async function mountWithAudio(audio: Omit<NonNullable<Parameters<typeof mountRouter>[0]>['audio'], 'volumeRef'>) {
  const { store } = mountRouter({
    routes,
    stepDelay: STEP_DELAY,
    audio: { volumeRef: ref(100), defaultBgm: DEFAULT_BGM, ...audio }
  });
  await settle();
  return store;
}

async function go(store: Awaited<ReturnType<typeof mountWithAudio>>, path: string) {
  await store.push(path);
  await settle();
}

/**
 * The app's shape: one "unlocked" flag, read by the gate, and by `bgmStartRef`
 * through a computed. Both watchers then fire in the same gesture, in an
 * order Vue does not promise.
 */
function sharedGate() {
  const unlocked = ref(false);
  const config: Pick<MicroRouterConfig, 'audioGate' | 'bgmStartRef'> = {
    audioGate: () => unlocked.value,
    bgmStartRef: computed(() => unlocked.value)
  };
  return { unlocked, config };
}

describe('audioGate closed', () => {
  test('a navigation creates no sound', async () => {
    const { config } = sharedGate();
    const store = await mountWithAudio(config);

    await go(store, 'a');
    await go(store, 'b');

    expect(created).toEqual([]);
  });

  test('opening the gate plays the latest track asked for, once', async () => {
    const { unlocked, config } = sharedGate();
    const store = await mountWithAudio(config);
    await go(store, 'a');
    await go(store, 'b');

    unlocked.value = true;
    await settle();

    // Not the default BGM first, then B: only B.
    expect(created).toEqual(['/b.mp3']);
  });

  // Vue does not promise which sync watcher runs first. When the start runs
  // first, it already reads the gate open while the held track still waits.
  // A gate whose source is not reactive gives exactly that order.
  test('the bgmStartRef start plays the held track if it sees the gate open first', async () => {
    let unlocked = false;
    const start = ref(false);
    const store = await mountWithAudio({ audioGate: () => unlocked, bgmStartRef: start });
    await go(store, 'b');
    expect(created).toEqual([]);

    unlocked = true;
    start.value = true;

    expect(created).toEqual(['/b.mp3']);
  });

  test('a stop asked for before the gate opens keeps the music off', async () => {
    const { unlocked, config } = sharedGate();
    const store = await mountWithAudio(config);
    await go(store, 'a');
    store.stopSound!();

    unlocked.value = true;
    await settle();
    expect(created).toEqual([]);

    // The stop holds only until the next request: navigation music comes back.
    await go(store, 'b');
    expect(created).toEqual(['/b.mp3']);
  });

  test('a stop stays in force when bgmStartRef turns true after the gate opens', async () => {
    const gate = ref(false);
    const start = ref(false);
    const store = await mountWithAudio({ audioGate: gate, bgmStartRef: start });
    store.stopSound!();

    gate.value = true;
    start.value = true;
    await settle();

    expect(created).toEqual([]);
  });

  test('bgmStartRef turning true while closed starts the default BGM when the gate opens', async () => {
    const gate = ref(false);
    const start = ref(false);
    await mountWithAudio({ audioGate: gate, bgmStartRef: start });

    start.value = true;
    await settle();
    expect(created).toEqual([]);

    gate.value = true;
    await settle();
    expect(created).toEqual([DEFAULT_BGM]);
  });
});

describe('audioGate: pause and resume while closed', () => {
  // Ungated, a page track that was paused stays silent until resumed.
  test('a pause keeps the held track silent when the gate opens', async () => {
    const { unlocked, config } = sharedGate();
    const store = await mountWithAudio(config);
    await go(store, 'b');
    store.pauseSound!();

    unlocked.value = true;
    await settle();
    expect(created).toEqual([]);

    store.resumeSound!();
    expect(created).toEqual(['/b.mp3']);
  });

  // Ungated, resume continues the page track; it must not fall back to the default.
  test('pause then resume keeps the held page track', async () => {
    const { unlocked, config } = sharedGate();
    const store = await mountWithAudio(config);
    await go(store, 'b');
    store.pauseSound!();
    store.resumeSound!();
    expect(created).toEqual([]);

    unlocked.value = true;
    await settle();
    expect(created).toEqual(['/b.mp3']);
  });
});

// The gate may open before the adapter's eager `import('howler')` resolves.
// Ungated, a `playSound` then waits for the import; a held one must too.
test('a held track still plays when the gate opens before howler has loaded', async () => {
  const unlocked = ref(false);
  const { store } = mountRouter({
    routes,
    stepDelay: STEP_DELAY,
    audio: { volumeRef: ref(100), defaultBgm: DEFAULT_BGM, audioGate: () => unlocked.value }
  });
  void store.playSound!('/x.mp3', true);

  unlocked.value = true;
  await settle();

  expect(created).toEqual(['/x.mp3']);
});

describe('no audioGate (1.1.5 behaviour)', () => {
  test('a navigation plays its track at once', async () => {
    const store = await mountWithAudio({});

    await go(store, 'a');

    expect(created).toEqual(['/a.mp3']);
  });

  test('bgmStartRef starts the default BGM even after a stop', async () => {
    const start = ref(false);
    const store = await mountWithAudio({ bgmStartRef: start });
    store.stopSound!();

    start.value = true;

    expect(created).toEqual([DEFAULT_BGM]);
  });
});
