/**
 * Abstract audio adapter interface — decouples audio playback from a specific library.
 *
 * Ship a HowlerAdapter as default. Users can provide a custom adapter
 * (Web Audio API, Tone.js, etc.) via AudioManagerConfig.adapter.
 */
export interface AudioAdapter {
  /** Play a sound from the given source URL */
  play(src: string, options: { loop?: boolean; volume?: number }): Promise<void>;
  /** Stop and unload the current sound */
  stop(): void;
  /** Pause playback (preserves position) */
  pause(): void;
  /** Resume from paused state */
  resume(): void;
  /** Crossfade volume from→to over duration ms */
  fade(from: number, to: number, duration: number): void;
  /** Whether audio is currently playing */
  isPlaying(): boolean;
  /** Current load state */
  state(): 'unloaded' | 'loading' | 'loaded';
  /** Clean up all resources */
  cleanup(): void;
}
