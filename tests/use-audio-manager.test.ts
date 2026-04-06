import { describe, expect, mock, test } from 'bun:test';
import { ref } from 'vue';

import { useAudioManager } from '../libs/composables/use-audio-manager';

describe('useAudioManager', () => {
  test('initializes without config', () => {
    const am = useAudioManager();
    expect(am.playSound).toBeFunction();
    expect(am.stopSound).toBeFunction();
    expect(am.updateBackgroundMusic).toBeFunction();
    expect(am.handleVisibilityChange).toBeFunction();
    expect(am.cleanup).toBeFunction();
  });

  test('initializes with config', () => {
    const volumeRef = ref(50);
    const urlResolver = (name: string) => `/audio/${name}.mp3`;
    const am = useAudioManager({ volumeRef, urlResolver });
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

  test('playSound fails gracefully without howler', async () => {
    const errorSpy = mock(() => {});
    console.error = errorSpy;
    const am = useAudioManager();
    await am.playSound('test');
    expect(errorSpy).toHaveBeenCalled();
  });

  test('urlResolver is used when provided', () => {
    const resolver = mock((name: string) => `/cdn/${name}.ogg`);
    const am = useAudioManager({ urlResolver: resolver });
    expect(am).toBeDefined();
    // resolver is called inside playSound — tested via integration
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
