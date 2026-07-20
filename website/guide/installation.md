# Installation

## Add the package

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

## Import styles

Styles ship separately (not bundled with JS). Import them once, typically in your app entry:

```ts
import 'vue-micro-router/styles';
```

This includes page slide/fade transitions, dialog animations, control fade transitions, and GUI layer positioning.

## Peer dependencies

- `vue` >= 3.4.0
- `howler` >= 2.2.0 *(optional — only for `vue-micro-router/audio`)*
- `@vue/devtools-api` >= 6.0.0 *(optional — only for the devtools inspector)*

## Entry points

| Import | Provides |
|--------|----------|
| `vue-micro-router` | Core composables, components, types |
| `vue-micro-router/audio` | Optional audio manager (requires `howler`) |
| `vue-micro-router/styles` | CSS transitions and dialog styles |

## Next

Continue to [Basic Usage](/guide/basic-usage) to declare a feature plugin and mount the router.
