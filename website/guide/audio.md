# Audio Manager

Background music tied to route BGM fields. Optional — lives in the `vue-micro-router/audio` entry point and supports custom audio backends via `AudioAdapter`.

## Install howler

The default adapter uses [howler](https://howlerjs.com/):

```bash
bun add howler
```

## Basic usage

```ts
import { useAudioManager, HowlerAdapter } from 'vue-micro-router/audio';

const audio = useAudioManager({
  volumeRef: ref(80),
  urlResolver: (name) => `/assets/audio/${name}.mp3`,
  // adapter: new HowlerAdapter(), // default — or provide your own AudioAdapter
});
```

## Custom adapter

Implement `AudioAdapter` to plug in any backend (e.g. the Web Audio API):

```ts
import type { AudioAdapter } from 'vue-micro-router/audio';

class WebAudioAdapter implements AudioAdapter {
  async play(src, options) { /* Web Audio API */ }
  stop() { /* ... */ }
  pause() { /* ... */ }
  resume() { /* ... */ }
  fade(from, to, duration) { /* ... */ }
  isPlaying() { return false; }
  state() { return 'unloaded'; }
  cleanup() { /* ... */ }
}

const audio = useAudioManager({ adapter: new WebAudioAdapter() });
```

## Router background music

Pass `volumeRef` to the router config to turn on built-in background music. Each
navigation (`push`, `replace`, `stepWisePush`, `stepWiseBack`) switches to the
`bgm` of the page it lands on, or to `defaultBgm` when that page has none.

```ts
const unlocked = ref(false); // true after the page's first user gesture

const config: MicroRouterConfig = {
  defaultPath: 'home',
  defaultControlName: 'main_gui',
  volumeRef: musicVolume, // 0-100
  defaultBgm: '/audios/default.mp3',
  bgmStartRef: isLoaded, // starts defaultBgm when it turns true
  audioGate: () => unlocked.value // no sound until this reads true
};
```

Browsers refuse an `AudioContext` created before the page's first user gesture.
Chrome logs `The AudioContext was not allowed to start` for it. Use `audioGate`
to hold all music until your app says audio may start. It takes a ref or a
getter.

- **While it reads false, no sound is created.** The latest play asked for
  waits: a navigation's `bgm`, `playSound`, `resumeSound` or the `bgmStartRef`
  start. Each new request replaces the last.
- **When it turns true, the waiting track starts once.** It takes the path it
  would have taken without a gate: a `playSound` or navigation waits for the
  adapter to load, and the `bgmStartRef` start plays synchronously, inside the
  gesture that opened the gate.
- **`pauseSound` keeps the waiting track silent when the gate opens.**
  `resumeSound` plays it, as it would resume a paused track.
- **`stopSound` drops the waiting track and keeps the music off.** This holds
  before the gate opens too. The `bgmStartRef` start never overrides a stop or
  any other request; only a later play brings music back.

Without `audioGate`, every request plays at once, as in 1.1.5.

## Styles

Import styles separately (not bundled with JS):

```ts
import 'vue-micro-router/styles';
```

Includes page slide/fade transitions, dialog animations, control fade transitions, and GUI layer positioning.
