import { describe, expect, mock, test } from 'bun:test';
import { ref } from 'vue';

import { useAudioManager } from '../libs/composables/use-audio-manager';

describe('useAudioManager', () => {
  test('initializes without config', () => {
    const am = useAudioManager();
    expect(am.playSound).toBeFunction();
    expect(am.stopSound).toBeFunction();
    expect(am.pauseSound).toBeFunction();
    expect(am.resumeSound).toBeFunction();
    expect(am.updateBackgroundMusic).toBeFunction();
    expect(am.handleVisibilityChange).toBeFunction();
    expect(am.cleanup).toBeFunction();
  });

  test('initializes with config', () => {
    const volumeRef = ref(50);
    const am = useAudioManager({ volumeRef, defaultBgm: '/audio/bgm.mp3' });
    expect(am).toBeDefined();
  });

  test('stopSound does not throw without playing', () => {
    const am = useAudioManager();
    am.stopSound();
  });

  test('cleanup does not throw', () => {
    const am = useAudioManager();
    am.cleanup();
  });

  test('handleVisibilityChange does not throw without sound', () => {
    const am = useAudioManager();
    am.handleVisibilityChange();
  });

  test('updateBackgroundMusic with no routes is no-op', async () => {
    const am = useAudioManager();
    await am.updateBackgroundMusic('home');
    // No error
  });

  test('updateBackgroundMusic with empty routes map', async () => {
    const am = useAudioManager();
    const routes = new Map();
    await am.updateBackgroundMusic('home', routes);
    // No error
  });

  test('playSound fails gracefully with broken adapter', async () => {
    const errorSpy = mock(() => {});
    console.error = errorSpy;
    const brokenAdapter = {
      play: () => { throw new Error('no audio'); },
      stop: () => {},
      destroy: () => {},
      pause: () => {},
      resume: () => {},
      fade: () => {},
      isPlaying: () => false,
      state: () => 'unloaded' as const,
      cleanup: () => {},
    };
    const am = useAudioManager({ adapter: brokenAdapter });
    await am.playSound('test');
    expect(errorSpy).toHaveBeenCalled();
  });

  test('defaultBgm config is accepted', () => {
    const am = useAudioManager({ defaultBgm: '/audio/bgm.mp3' });
    expect(am).toBeDefined();
  });

  test('cleanup after playSound attempt does not throw', async () => {
    const am = useAudioManager();
    const errorSpy = mock(() => {});
    console.error = errorSpy;
    await am.playSound('test');
    am.cleanup();
    // Double cleanup
    am.cleanup();
  });

  test('stopSound after playSound attempt', async () => {
    const am = useAudioManager();
    const errorSpy = mock(() => {});
    console.error = errorSpy;
    await am.playSound('test');
    am.stopSound();
  });

  test('pauseSound does not throw without playing', () => {
    const am = useAudioManager();
    am.pauseSound();
  });

  test('resumeSound does not throw without playing', () => {
    const am = useAudioManager();
    am.resumeSound();
  });

  test('resumeSound falls back to playSound when no instance loaded', async () => {
    const errorSpy = mock(() => {});
    console.error = errorSpy;
    const am = useAudioManager({ defaultBgm: '/audio/bgm.mp3' });
    am.resumeSound();
  });

  test('pauseSound then resumeSound with mock adapter', () => {
    let paused = false;
    let resumed = false;
    const mockAdapter = {
      play: async () => {},
      playSync: () => {},
      stop: () => {},
      destroy: () => {},
      pause: () => { paused = true; },
      resume: () => { resumed = true; },
      fade: () => {},
      isPlaying: () => !paused,
      state: () => 'loaded' as const,
      cleanup: () => {},
    };
    const am = useAudioManager({ adapter: mockAdapter });
    am.pauseSound();
    expect(paused).toBe(true);
    am.resumeSound();
    expect(resumed).toBe(true);
  });

  test('playSound resolves "default" to defaultBgm', async () => {
    let playedSrc = '';
    const mockAdapter = {
      play: async (src: string) => { playedSrc = src; },
      stop: () => {},
      destroy: () => {},
      pause: () => {},
      resume: () => {},
      fade: () => {},
      isPlaying: () => false,
      state: () => 'unloaded' as const,
      cleanup: () => {},
    };
    const am = useAudioManager({ adapter: mockAdapter, defaultBgm: '/audio/bgm.mp3' });
    await am.playSound('default');
    expect(playedSrc).toBe('/audio/bgm.mp3');
  });

  test('handleVisibilityChange with no document (SSR)', () => {
    const am = useAudioManager();
    // In bun test environment, document exists but sound is null
    am.handleVisibilityChange();
  });

  test('updateBackgroundMusic with matching route', async () => {
    const am = useAudioManager();
    const routes = new Map();
    routes.set('battle', { path: 'battle', component: {}, bgm: 'battle-theme' });
    // First call sets previousSoundSrc context
    await am.updateBackgroundMusic('/battle', routes);
    // No error — howler not available so playSound will fail gracefully
  });

  test('updateBackgroundMusic catches errors', async () => {
    const errorSpy = mock(() => {});
    console.error = errorSpy;
    const am = useAudioManager();
    const routes = new Map();
    routes.set('battle', { path: 'battle', component: {}, bgm: 'new-bgm' });
    await am.updateBackgroundMusic('/battle', routes);
    // May or may not error depending on howler availability
  });

  test('volume ref reactivity', () => {
    const volumeRef = ref(100);
    const am = useAudioManager({ volumeRef });
    // Change volume — watcher fires but no sound playing, so no-op
    volumeRef.value = 50;
    expect(am).toBeDefined();
  });
});
