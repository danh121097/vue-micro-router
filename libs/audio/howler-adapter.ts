/**
 * Default AudioAdapter implementation backed by Howler.js.
 *
 * Lazy-loads howler on first play() call. Handles autoplay policy,
 * iOS silent mode quirks, and fade-in to prevent audible pops.
 *
 * Users who don't need Howler can provide their own AudioAdapter implementation.
 */
import type { AudioAdapter } from './audio-adapter-types';

type HowlCtor = typeof import('howler').Howl;
type HowlInstance = InstanceType<HowlCtor>;

export class HowlerAdapter implements AudioAdapter {
  private sound: HowlInstance | null = null;
  private HowlCtor: HowlCtor | null = null;

  constructor() {
    // Preload Howler.js eagerly so play() is synchronous (no async gap = no autoplay block)
    import('howler')
      .then((mod) => { this.HowlCtor = mod.Howl; })
      .catch(() => { /* howler not installed — play() will error */ });
  }

  async play(
    src: string,
    options: { loop?: boolean; volume?: number } = {}
  ): Promise<void> {
    this.stop();
    // Wait for preload if not ready yet (first call only)
    if (!this.HowlCtor) {
      const mod = await import('howler');
      this.HowlCtor = mod.Howl;
    }
    this.sound = new this.HowlCtor({
      src: [src],
      autoplay: true,
      loop: options.loop ?? false,
      volume: 0,
    });
    this.sound.play();
    this.sound.fade(0, options.volume ?? 1, 200);
  }

  /** Fully synchronous play — uses preloaded HowlCtor. No-op if not preloaded yet. */
  playSync(src: string, options: { loop?: boolean; volume?: number } = {}): void {
    if (!this.HowlCtor) return; // not preloaded yet — first gesture missed
    this.stop();
    this.sound = new this.HowlCtor({
      src: [src],
      autoplay: true,
      loop: options.loop ?? false,
      volume: 0,
    });
    this.sound.play();
    this.sound.fade(0, options.volume ?? 1, 200);
  }

  stop(): void {
    try {
      if (this.sound) {
        this.sound.stop();
        this.sound.off();
        this.sound.unload();
        this.sound = null;
      }
    } catch {
      this.sound = null;
    }
  }

  pause(): void {
    if (this.sound?.playing()) {
      this.sound.pause();
    }
  }

  resume(): void {
    if (this.sound && this.state() === 'loaded') {
      this.sound.play();
    }
  }

  fade(from: number, to: number, duration: number): void {
    if (this.sound?.playing()) {
      this.sound.fade(from, to, duration);
    }
  }

  isPlaying(): boolean {
    return this.sound?.playing() ?? false;
  }

  state(): 'unloaded' | 'loading' | 'loaded' {
    if (!this.sound) return 'unloaded';
    return this.sound.state() as 'unloaded' | 'loading' | 'loaded';
  }

  cleanup(): void {
    this.stop();
  }
}
