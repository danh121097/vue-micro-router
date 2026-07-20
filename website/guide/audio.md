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

## Styles

Import styles separately (not bundled with JS):

```ts
import 'vue-micro-router/styles';
```

Includes page slide/fade transitions, dialog animations, control fade transitions, and GUI layer positioning.
