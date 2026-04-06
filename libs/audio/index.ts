/**
 * Optional audio sub-path — import from 'vue-micro-router/audio'.
 *
 * Requires `howler` as a peer dependency (installed separately by consumer).
 * Provides background music management tied to route BGM fields.
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
 */
export { useAudioManager } from '../composables/use-audio-manager';
export type {
  AudioManagerConfig,
  AudioManagerState
} from '../composables/use-audio-manager';
