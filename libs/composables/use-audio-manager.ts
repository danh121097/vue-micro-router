/**
 * Manages background music playback tied to route BGM fields.
 *
 * Wraps Howler.js for audio. BGM is driven by the bgm field on registered MicroRoute objects.
 * Accepts a urlResolver config instead of hardcoded CDN util — user provides their own URL builder.
 *
 * Volume fade 0 → target over 200ms on every new sound prevents audible pop/click.
 * delay(50) before creating new Howl gives previous cleanSound() time to complete.
 */
import { computed, ref, watch, type Ref } from 'vue';

import type { MicroRoute } from '../core/types';
import { delay } from '../utils/timer-manager';

type HowlCtor = typeof import('howler').Howl;
type HowlInstance = InstanceType<HowlCtor>;

export interface AudioManagerConfig {
  /** Volume ref (0-100). Defaults to 100. */
  volumeRef?: Ref<number>;
  /** Resolve a sound name to a full URL. Defaults to identity (name returned as-is). */
  urlResolver?: (name: string) => string;
}

export interface AudioManagerState {
  playSound: (soundSrc: string, loop?: boolean) => Promise<void>;
  stopSound: () => void;
  updateBackgroundMusic: (
    route: string,
    routes?: Map<string, MicroRoute>
  ) => Promise<void>;
  handleVisibilityChange: () => void;
  cleanup: () => void;
}

export function useAudioManager(
  config?: AudioManagerConfig
): AudioManagerState {
  let sound: HowlInstance | null = null;
  let howlCtorPromise: Promise<HowlCtor> | null = null;
  let isVisibilityChange = false;
  let previousSoundSrc = 'default';

  const soundSrc = ref<string>('default');
  const resolveUrl = config?.urlResolver ?? ((name: string) => name);
  const volume = computed(() => (config?.volumeRef?.value ?? 100) / 100);

  function cleanSound() {
    try {
      if (sound) {
        sound.stop();
        sound.off();
        sound.unload();
        sound = null;
      }
    } catch {
      sound = null;
    }
  }

  /** Lazy-load Howler.js — only imported when first sound is played */
  async function getHowlCtor() {
    if (!howlCtorPromise) {
      howlCtorPromise = import('howler').then((mod) => mod.Howl);
    }
    return howlCtorPromise;
  }

  async function playSound(src: string, loop = false) {
    try {
      if (sound?.playing() && soundSrc.value === src) return;

      previousSoundSrc = soundSrc.value;
      soundSrc.value = src;
      cleanSound();
      await delay(50);
      const Howl = await getHowlCtor();

      sound = new Howl({
        src: [resolveUrl(src)],
        autoplay: true,
        loop,
        volume: 0
      });
      sound.play();
      sound.fade(0, volume.value, 200);
    } catch (error) {
      console.error('Sound playback failed:', error);
      cleanSound();
    }
  }

  function stopSound() {
    cleanSound();
  }

  async function updateBackgroundMusic(
    route: string,
    routes?: Map<string, MicroRoute>
  ) {
    if (!routes) return;
    try {
      const routeKey = route.split('/').pop() || 'home';
      const registered = routes.get(routeKey);
      const newSrc = registered?.bgm || soundSrc.value;

      const fromKey = previousSoundSrc;
      if (fromKey && newSrc && fromKey !== newSrc) {
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
        if (sound?.playing()) {
          sound.pause();
          isVisibilityChange = true;
        }
      } else if (sound && isVisibilityChange && sound.state() === 'loaded') {
        sound.play();
        isVisibilityChange = false;
      }
    } catch {
      cleanSound();
    }
  }

  function cleanup() {
    cleanSound();
  }

  watch(volume, (vol) => {
    if (sound?.playing()) {
      const current = sound.volume();
      sound.fade(current, vol, 300);
    }
  });

  return {
    playSound,
    stopSound,
    updateBackgroundMusic,
    handleVisibilityChange,
    cleanup
  };
}
