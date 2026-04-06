/** Nested router plugin — shared so sub-pages can type useMicroRouter<typeof nestedPlugin>() */
import { defineFeaturePlugin } from '../../libs/index';

export const nestedPlugin = defineFeaturePlugin({
  name: 'nested-demo',
  routes: [
    { path: 'sub-a', component: () => import('./NestedSubPageA.vue'), transition: 'slide' },
    { path: 'sub-b', component: () => import('./NestedSubPageB.vue'), transition: 'fade' },
  ],
} as const);
