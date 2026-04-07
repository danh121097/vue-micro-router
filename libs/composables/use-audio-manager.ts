/**
 * Manages background music playback tied to route BGM fields.
 *
 * Accepts an optional AudioAdapter — defaults to HowlerAdapter (lazy-loaded).
 * BGM is driven by the bgm field on registered MicroRoute objects.
 * Volume fade 0 → target over 200ms on every new sound prevents audible pop/click.
 */
import { computed, ref, watch, type Ref } from 'vue';

import type { AudioAdapter } from '../audio/audio-adapter-types';
import { HowlerAdapter } from '../audio/howler-adapter';
import type { MicroRoute } from '../core/types';
import { delay } from '../utils/timer-manager';

export interface AudioManagerConfig {
  /** Volume ref (0-100). Defaults to 100. */
  volumeRef?: Ref<number>;
  /** Default BGM track name — played on mount and used as fallback. Defaults to 'default'. */
  defaultBgm?: string;
  /** Custom audio adapter. Defaults to HowlerAdapter (requires howler peer dep). */
  adapter?: AudioAdapter;
}

export interface AudioManagerState {
  playSound: (soundSrc: string, loop?: boolean) => Promise<void>;
  /** Synchronous play — no async gaps, safe in user gesture context for autoplay policy */
  playSoundSync: (soundSrc: string, loop?: boolean) => void;
  stopSound: () => void;
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

  const adapter: AudioAdapter = config?.adapter ?? new HowlerAdapter();
  const soundSrc = ref<string>('');
  const volume = computed(() => (config?.volumeRef?.value || 0) / 100);

  async function playSound(src: string, loop = false) {
    try {
      if (adapter.isPlaying() && soundSrc.value === src) return;

      previousSoundSrc = soundSrc.value;
      soundSrc.value = src;
      adapter.stop();
      await delay(50);

      await adapter.play(src, { loop, volume: volume.value });
    } catch (error) {
      console.error('Sound playback failed:', error);
      adapter.stop();
    }
  }

  /** Synchronous play — no async gaps, safe in user gesture context for autoplay */
  function playSoundSync(src: string, loop = false) {
    try {
      if (adapter.isPlaying() && soundSrc.value === src) return;
      previousSoundSrc = soundSrc.value;
      soundSrc.value = src;
      adapter.stop();
      if (adapter.playSync) {
        adapter.playSync(src, { loop, volume: volume.value });
      } else {
        void adapter.play(src, { loop, volume: volume.value });
      }
    } catch (error) {
      console.error('Sound playback failed:', error);
      adapter.stop();
    }
  }

  function stopSound() {
    adapter.stop();
  }

  async function updateBackgroundMusic(
    route: string,
    routes?: Map<string, MicroRoute>
  ) {
    if (!routes) return;
    try {
      const routeKey = route.split('/').pop() || 'home';
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

  function cleanup() {
    adapter.cleanup();
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
    updateBackgroundMusic,
    isStarted: () => adapter.isPlaying() || adapter.state() === 'loaded',
    handleVisibilityChange,
    cleanup
  };
}
