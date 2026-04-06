/**
 * iOS-style viewWillAppear/viewWillDisappear lifecycle hooks for micro-router pages.
 *
 * Must be called inside a component rendered by MicroRouterView. Reads MICRO_ROUTE_PATH_KEY
 * and watches activePage to detect enter/leave transitions.
 */
import { inject, onMounted, watch } from 'vue';

import { MICRO_ROUTE_PATH_KEY } from '../../core/constants';
import { useMicroRouter } from '../use-micro-router';

export interface RouteLifecycleHooks {
  onRouteEnter?: () => void;
  onRouteLeave?: () => void;
}

/**
 * Route lifecycle hooks — fire when a route becomes/stops being the active (top) page.
 * Similar to iOS viewWillAppear/viewWillDisappear or Vue Router's navigation guards.
 *
 * @example
 * ```ts
 * useRouteLifecycle({
 *   onRouteEnter: () => console.log('Page visible'),
 *   onRouteLeave: () => console.log('Page hidden'),
 * });
 * ```
 */
export function useRouteLifecycle(hooks: RouteLifecycleHooks) {
  const routePath = inject(MICRO_ROUTE_PATH_KEY);
  if (!routePath) {
    console.warn(
      '[vue-micro-router] useRouteLifecycle() must be called inside a route component rendered by <MicroRouterView>.'
    );
    return;
  }

  const { activePage } = useMicroRouter();

  let wasActive = activePage.value === routePath;

  if (wasActive) onMounted(() => hooks.onRouteEnter?.());

  watch(activePage, (newPage) => {
    const isActive = newPage === routePath;

    if (isActive && !wasActive) hooks.onRouteEnter?.();
    else if (!isActive && wasActive) hooks.onRouteLeave?.();

    wasActive = isActive;
  });
}
