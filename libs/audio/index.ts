/**
 * Optional audio sub-path — import from 'vue-micro-router/audio'.
 *
 * Requires `howler` as a peer dependency (installed separately by consumer).
 * Provides background music management tied to route BGM fields.
 *
 * Custom audio backends can be provided via the AudioAdapter interface.
 *
 * @example
 * ```ts
 * import { useAudioManager } from 'vue-micro-router/audio';
 *
 * const audio = useAudioManager({
 *   volumeRef: ref(80),
 *   urlResolver: (name) => `/assets/audio/${name}.mp3`,
 * });
 * ```
 *
 * @example Custom adapter
 * ```ts
 * import { useAudioManager, type AudioAdapter } from 'vue-micro-router/audio';
 *
 * class MyAdapter implements AudioAdapter { ... }
 * const audio = useAudioManager({ adapter: new MyAdapter() });
 * ```
 */
export { useAudioManager } from '../composables/use-audio-manager';
export type {
  AudioManagerConfig,
  AudioManagerState
} from '../composables/use-audio-manager';
export type { AudioAdapter } from './audio-adapter-types';
export { HowlerAdapter } from './howler-adapter';
