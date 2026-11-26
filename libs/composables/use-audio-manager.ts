/**
 * Manages background music playback tied to route BGM fields.
 *
 * Accepts an optional AudioAdapter — defaults to HowlerAdapter (lazy-loaded).
 * BGM is driven by the bgm field on registered MicroRoute objects.
 * Volume fade 0 → target over 200ms on every new sound prevents audible pop/click.
 *
 * With a `gate`, no sound is created while it reads false: the latest play asked
 * for waits and runs the moment the gate opens.
 */
import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';

import type { AudioAdapter } from '../audio/audio-adapter-types';
import { HowlerAdapter } from '../audio/howler-adapter';
import type { MicroRoute } from '../core/types';
import { getLastSegment } from '../utils/path-utils';

export interface AudioManagerConfig {
  /** Volume ref (0-100). Defaults to 100. */
  volumeRef?: Ref<number>;
  /** Default BGM track name — played on mount and used as fallback. Defaults to 'default'. */
  defaultBgm?: string;
  /** Custom audio adapter. Defaults to HowlerAdapter (requires howler peer dep). */
  adapter?: AudioAdapter;
  /**
   * Set to true to start `defaultBgm`, unless a sound already plays. Watched
   * with flush:'sync' to keep the gesture context: without a `gate`, set it in a
   * user gesture handler. With a `gate`, the start waits for it.
   */
  bgmStartRef?: Ref<boolean>;
  /**
   * Whether a sound may start now, e.g. "the page has had a user gesture".
   * Omit to play at once.
   *
   * While it reads false, nothing is created. The latest request waits: a play,
   * a `resumeSound`, `updateBackgroundMusic` or the `bgmStartRef` start. It runs
   * when the gate turns true, by the path it would have taken ungated: a
   * `playSound` waits for the adapter to load, a sync start stays in the
   * gesture. A `pauseSound` keeps the waiting track silent when the gate opens,
   * until `resumeSound` plays it. A `stopSound` drops the waiting request. With a gate, the `bgmStartRef` start never overrides a stop, nor
   * any other request: only a later play brings music back.
   *
   * Must be reactive (a ref, or a getter reading one) for a held track to
   * start by itself; a non-reactive gate is only read on the next request.
   */
  gate?: MaybeRefOrGetter<boolean>;
}

export interface AudioManagerState {
  playSound: (soundSrc: string, loop?: boolean) => Promise<void>;
  /** Synchronous play — no async gaps, safe in user gesture context for autoplay policy */
  playSoundSync: (soundSrc: string, loop?: boolean) => void;
  stopSound: () => void;
  /** Pause BGM without destroying the Howl instance — resumeSound() to continue */
  pauseSound: () => void;
  /** Resume paused BGM — safe to call from non-gesture context (no new Howl created) */
  resumeSound: () => void;
  updateBackgroundMusic: (
    route: string,
    routes?: Map<string, MicroRoute>
  ) => Promise<void>;
  handleVisibilityChange: () => void;
  /** Whether audio has successfully started playing at least once */
  isStarted: () => boolean;
  cleanup: () => void;
}

export function useAudioManager(
  config?: AudioManagerConfig
): AudioManagerState {
  let isVisibilityChange = false;
  const defaultBgm = config?.defaultBgm ?? '';
  /** Start empty so first updateBackgroundMusic always triggers playSound */
  let previousSoundSrc = '';
  const gate = config?.gate;
  const isGateOpen = () => gate === undefined || toValue(gate);
  /**
   * The latest play asked for while the gate was closed — run when it opens,
   * through the path it came by (`sync`), unless a pause holds it (`paused`).
   */
  let held: { src: string; loop: boolean; sync: boolean; paused: boolean } | null = null;
  /** A stop came after the last play (gate only) — the default BGM start stays off */
  let keptOff = false;

  const adapter: AudioAdapter = config?.adapter ?? new HowlerAdapter();
  const soundSrc = ref<string>('');
  const volume = computed(() => (config?.volumeRef?.value || 0) / 100);

  /** True when the request is held for the gate; otherwise it supersedes any held one. */
  function holdWhileClosed(src: string, loop: boolean, sync: boolean) {
    keptOff = false;
    if (isGateOpen()) {
      held = null;
      return false;
    }
    held = { src, loop, sync, paused: false };
    return true;
  }

  /**
   * An async request goes back through `playSound`, which waits for the
   * adapter to load, as it would have ungated; a sync one stays in the gesture.
   */
  function releaseHeld() {
    const request = held;
    if (!request || request.paused) return;
    held = null;
    if (request.sync) playSoundSync(request.src, request.loop);
    else void playSound(request.src, request.loop);
  }

  async function playSound(src: string, loop = false) {
    if (holdWhileClosed(src, loop, false)) return;
    try {
      const resolvedSrc = src === 'default' ? defaultBgm : src;
      if (!resolvedSrc) return;
      if (adapter.isPlaying() && soundSrc.value === resolvedSrc) return;

      previousSoundSrc = soundSrc.value;
      soundSrc.value = resolvedSrc;

      await adapter.play(resolvedSrc, { loop: src === 'default' ? true : loop, volume: volume.value });
    } catch (error) {
      console.error('Sound playback failed:', error);
      adapter.destroy();
    }
  }

  /** Synchronous play — no async gaps, safe in user gesture context for autoplay */
  function playSoundSync(src: string, loop = false) {
    if (holdWhileClosed(src, loop, true)) return;
    try {
      const resolvedSrc = src === 'default' ? defaultBgm : src;
      if (!resolvedSrc) return;
      if (adapter.isPlaying() && soundSrc.value === resolvedSrc) return;
      previousSoundSrc = soundSrc.value;
      soundSrc.value = resolvedSrc;
      const resolvedLoop = src === 'default' ? true : loop;
      if (adapter.playSync) {
        adapter.playSync(resolvedSrc, { loop: resolvedLoop, volume: volume.value });
      } else {
        void adapter.play(resolvedSrc, { loop: resolvedLoop, volume: volume.value });
      }
    } catch (error) {
      console.error('Sound playback failed:', error);
      adapter.stop();
    }
  }

  function stopSound() {
    held = null;
    if (gate !== undefined) keptOff = true;
    adapter.stop();
  }

  function pauseSound() {
    if (held) held.paused = true;
    adapter.pause();
  }

  function resumeSound() {
    if (held) {
      held.paused = false;
      if (isGateOpen()) releaseHeld();
      return;
    }
    if (adapter.state() === 'loaded') {
      adapter.resume();
    } else if (defaultBgm) {
      void playSound(defaultBgm, true);
    }
  }

  async function updateBackgroundMusic(
    route: string,
    routes?: Map<string, MicroRoute>
  ) {
    if (!routes) return;
    try {
      const routeKey = getLastSegment(route) || 'home';
      const registered = routes.get(routeKey);
      const newSrc = registered?.bgm || defaultBgm;

      if (newSrc && previousSoundSrc !== newSrc) {
        await playSound(newSrc, true);
      }
    } catch (error) {
      console.error('Error updating background music:', error);
    }
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined') return;
    try {
      if (document.hidden) {
        if (adapter.isPlaying()) {
          adapter.pause();
          isVisibilityChange = true;
        }
      } else if (isVisibilityChange && adapter.state() === 'loaded') {
        adapter.resume();
        isVisibilityChange = false;
      }
    } catch {
      adapter.stop();
    }
  }

  /** The `bgmStartRef` start: weaker than any request the app or a navigation made. */
  function startDefaultBgm() {
    if (keptOff || held) {
      if (isGateOpen()) releaseHeld();
      return;
    }
    // While closed, playSoundSync holds it.
    if (!isStarted()) playSoundSync(defaultBgm, true);
  }

  function isStarted() {
    return adapter.isPlaying() || adapter.state() === 'loaded';
  }

  function cleanup() {
    held = null;
    adapter.cleanup();
  }

  if (gate !== undefined) {
    // Sync: the held sound starts inside the gesture that opened the gate.
    watch(isGateOpen, (open) => {
      if (open) releaseHeld();
    }, { flush: 'sync' });
  }

  if (defaultBgm && config?.bgmStartRef) {
    watch(config.bgmStartRef, (ready) => {
      if (ready) startDefaultBgm();
    }, { flush: 'sync' });
  }

  watch(volume, (vol, oldVol) => {
    if (adapter.isPlaying()) {
      adapter.fade(oldVol ?? 0, vol, 300);
    } else if (vol > 0 && soundSrc.value) {
      // Volume changed from 0 to >0 but audio not playing — retry play
      void playSound(soundSrc.value, true);
    }
  });

  return {
    playSound,
    playSoundSync,
    stopSound,
    pauseSound,
    resumeSound,
    updateBackgroundMusic,
    isStarted,
    handleVisibilityChange,
    cleanup
  };
}
