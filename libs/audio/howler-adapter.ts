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
  private howlCtorPromise: Promise<HowlCtor> | null = null;

  /** Lazy-load Howler.js — only imported when first sound is played */
  private async getHowlCtor(): Promise<HowlCtor> {
    if (!this.howlCtorPromise) {
      this.howlCtorPromise = import('howler').then((mod) => mod.Howl);
    }
    return this.howlCtorPromise;
  }

  async play(
    src: string,
    options: { loop?: boolean; volume?: number } = {}
  ): Promise<void> {
    this.stop();
    const Howl = await this.getHowlCtor();
    this.sound = new Howl({
      src: [src],
      autoplay: true,
      loop: options.loop ?? false,
      volume: 0
    });
    // Fade in to prevent audible pop/click (autoplay handles initial play)
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
