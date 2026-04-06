/**
 * Route registration — handles registering routes (sync and async) and tracking async loaders.
 *
 * Extracted from use-navigation.ts to keep each module under 200 LOC.
 * The asyncLoaders map is returned so useNavigation can access it for pre-warming module cache.
 */
import {
  defineAsyncComponent,
  shallowReactive,
  type AsyncComponentLoader
} from 'vue';

import type { MicroRoute } from '../core/types';
import { isAsyncLoader, safeMarkRaw, warmLoaderCache } from '../utils/path-utils';

export interface RouteRegistry {
  /** Registered route definitions keyed by segment name */
  routes: Map<string, MicroRoute>;
  /** Async loaders keyed by segment — used by navigation to pre-warm module cache */
  asyncLoaders: Map<string, AsyncComponentLoader>;
  registerRoute: (route: MicroRoute) => void;
  registerRoutes: (routes: MicroRoute[]) => void;
  /** Manually preload an async route's component module */
  preloadRoute: (segment: string) => Promise<void>;
  /** Preload all routes marked with preload: 'adjacent' that are reachable from current segments */
  preloadAdjacent: (currentSegments: string[]) => void;
}

export function createRouteRegistry(): RouteRegistry {
  const routes = shallowReactive(new Map<string, MicroRoute>());
  const asyncLoaders = new Map<string, AsyncComponentLoader>();

  function registerRoute(route: MicroRoute) {
    if (routes.has(route.path)) {
      console.warn(`[vue-micro-router] Route "${route.path}" already registered. Overwriting.`);
    }

    let { component } = route;

    if (isAsyncLoader(component)) {
      asyncLoaders.set(route.path, component);
      component = defineAsyncComponent(component);
    }

    routes.set(route.path, {
      ...route,
      component: safeMarkRaw(component)
    });

    // Eager preload: immediately warm the async loader cache on registration
    if (route.preload === 'eager' && asyncLoaders.has(route.path)) {
      warmLoaderCache(asyncLoaders.get(route.path)!);
    }
  }

  function registerRoutes(routeList: MicroRoute[]) {
    routeList.forEach(registerRoute);
  }

  /** Preload a single route's async component by segment name */
  async function preloadRoute(segment: string): Promise<void> {
    const loader = asyncLoaders.get(segment);
    if (loader) await warmLoaderCache(loader);
  }

  /** Preload all 'adjacent' routes not currently in the active segments */
  function preloadAdjacent(currentSegments: string[]): void {
    for (const [segment, route] of routes.entries()) {
      if (route.preload === 'adjacent' && !currentSegments.includes(segment)) {
        const loader = asyncLoaders.get(segment);
        if (loader) warmLoaderCache(loader);
      }
    }
  }

  return { routes, asyncLoaders, registerRoute, registerRoutes, preloadRoute, preloadAdjacent };
}
