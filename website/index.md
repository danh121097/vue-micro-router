---
layout: home

hero:
  name: 'vue-micro-router'
  text: 'Mobile-app-style navigation for Vue 3'
  tagline: 'Animated page stacks, modal dialogs, HUD controls — no URL routing. Just push(''profile'') and watch it animate.'
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/danh121097/vue-micro-router

features:
  - icon: 📱
    title: Mobile-App Feel
    details: Pages slide in/out with smooth transitions, dialogs stack as modals, and persistent HUD controls float above everything.
  - icon: 🧭
    title: Segment Stack Navigation
    details: No /path/:param URLs. Navigate a segment stack — push('menu') slides a page on, push(-1) slides it back.
  - icon: 🎯
    title: Full TypeScript
    details: Auto-typed push/openDialog/toggleControl via the Register pattern. Optional codegen for typed per-route props.
  - icon: 🛡️
    title: Route Guards
    details: beforeEach, beforeEnter, beforeLeave with async support and a 5s safety timeout.
  - icon: 💬
    title: First-Class Dialogs & HUDs
    details: Stacking modals with focus trap, backdrop, escape key — plus auto-managed overlay controls.
  - icon: ⚡
    title: Tiny & Fast
    details: 10.35 kB gzip core, < 0.01 ms navigation latency, 150 tests, ~96% coverage.
---

## Quick Start

::: code-group
```bash [bun]
bun add vue-micro-router
```
```bash [npm]
npm install vue-micro-router
```
```bash [yarn]
yarn add vue-micro-router
```
```bash [pnpm]
pnpm add vue-micro-router
```
:::

```vue
<!-- App.vue -->
<script setup>
import { MicroRouterView } from 'vue-micro-router';
import 'vue-micro-router/styles';
import { appPlugin } from './app-plugin';

const config = {
  defaultPath: 'home',
  history: { enabled: true, maxEntries: 50 },
  gesture: { enabled: true },
};
</script>

<template>
  <MicroRouterView :config :plugins="[appPlugin]" />
</template>
```

## Why not vue-router?

| | vue-router | vue-micro-router |
|---|---|---|
| Navigation model | URL-based (`/path/:param`) | Segment stack (`home → home/menu → home/menu/settings`) |
| Page transitions | Manual (TransitionGroup) | Built-in slide/fade + per-route customization |
| Multiple visible pages | No (one route = one view) | Yes — stacked pages render simultaneously |
| Modal dialogs | DIY | First-class with stacking, backdrop, focus trap |
| GUI overlays / HUD | DIY | First-class controls with auto-show/hide |
| Gesture navigation | None | Swipe-back from left edge |
| State persistence | None | `serialize()` / `restore()` |
| Use case | Websites, SPAs | Games, mobile-style apps, kiosks, wizards |

[See the full comparison →](/guide/getting-started)
