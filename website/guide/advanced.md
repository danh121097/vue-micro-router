# Advanced Navigation

State persistence, preloading, gestures, nested routers, and step-wise navigation.

## State Serialization

Save and restore full router state for session persistence:

```ts
const router = useMicroRouter();

// Save state (e.g., on page hide)
const snapshot = router.serialize!();
localStorage.setItem('router-state', JSON.stringify(snapshot));

// Restore state (e.g., on page load)
const saved = localStorage.getItem('router-state');
if (saved) await router.restore!(JSON.parse(saved));
```

Serializes: navigation path + attrs, dialog stack + attrs, control state + attrs.

## Route Preloading

Preload async route components before they're needed:

```ts
defineFeaturePlugin({
  routes: [
    { path: 'home', component: () => import('./Home.vue') },
    { path: 'shop', component: () => import('./Shop.vue'), preload: 'eager' },     // loads on mount
    { path: 'cart', component: () => import('./Cart.vue'), preload: 'adjacent' },   // loads after each nav
  ],
});

// Manual preload
await router.preloadRoute('cart');
```

## Gesture Navigation (Swipe Back)

iOS-style swipe-back from the left edge:

```ts
const config = {
  gesture: {
    enabled: true,
    edgeWidth: 20,       // px from left edge (default: 20)
    threshold: 0.3,      // 30% screen width to trigger (default: 0.3)
    velocityThreshold: 0.5, // px/ms fast swipe (default: 0.5)
  },
};
```

## Nested Routers

Independent router instances within the same component tree:

```vue
<template>
  <!-- Root router -->
  <MicroRouterView :config="rootConfig" :plugins="[mainPlugin]">
    <!-- Inside a page component: -->
    <MicroRouterView nested :config="tabConfig" :plugins="[tabPlugin]" />
  </MicroRouterView>
</template>
```

```ts
// Access root router from within nested router
const rootRouter = useMicroRouter({ root: true });
const localRouter = useMicroRouter(); // nearest parent
```

## Step-Wise Navigation

Animate through intermediate pages one-by-one:

```ts
const { stepWisePush, stepWiseBack } = useMicroRouter();

// Walk through: home → home/onboarding → home/onboarding/step1
await stepWisePush('/home/onboarding/step1');

// Relative multi-segment paths are type-checked: every segment must be a
// known route, joined by `/`, in any order and to any depth.
await stepWisePush('onboarding/step1'); // ✅ each segment validated
await stepWisePush('onboarding/oops');  // ❌ compile error — unknown segment

// Step back through each page with animation
await stepWiseBack(3);
```
