/**
 * Navigation guard runner — executes global and per-route guards sequentially.
 *
 * Guard execution order:
 *   1. Global beforeEach guards (sequential, first-reject-wins)
 *   2. Target route's beforeEnter guard
 *   3. Source route's beforeLeave guard
 *
 * If any guard returns false or rejects, navigation is aborted.
 * Guards have a configurable timeout (default 5s) to prevent infinite awaits.
 */
import type { MicroRoute, NavigationAfterHook, NavigationGuard } from '../core/types';

const DEFAULT_GUARD_TIMEOUT = 5000;

export interface GuardConfig {
  beforeEach?: NavigationGuard[];
  afterEach?: NavigationAfterHook[];
  guardTimeout?: number;
}

export interface GuardContext {
  /** Look up a route definition by segment name */
  getRoute: (segment: string) => MicroRoute | undefined;
}

/**
 * Run a single guard with timeout protection.
 * Returns false if guard rejects, throws, or times out.
 */
async function runGuard(
  guard: NavigationGuard,
  to: string,
  from: string,
  timeout: number
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Promise.resolve(guard(to, from)),
      new Promise<boolean>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Navigation guard timed out')), timeout);
      })
    ]);
    clearTimeout(timer);
    return result !== false;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

/**
 * Run all guards in sequence. Returns true if all pass, false if any rejects.
 */
export async function runGuards(
  guards: NavigationGuard[],
  to: string,
  from: string,
  timeout: number = DEFAULT_GUARD_TIMEOUT
): Promise<boolean> {
  for (const guard of guards) {
    const allowed = await runGuard(guard, to, from, timeout);
    if (!allowed) return false;
  }
  return true;
}

/**
 * Execute the full guard pipeline for a navigation.
 * Order: global beforeEach -> target beforeEnter -> source beforeLeave
 */
export async function executeGuardPipeline(
  to: string,
  from: string,
  config: GuardConfig,
  ctx: GuardContext
): Promise<boolean> {
  const timeout = config.guardTimeout ?? DEFAULT_GUARD_TIMEOUT;

  // 1. Global beforeEach guards
  if (config.beforeEach?.length) {
    const allowed = await runGuards(config.beforeEach, to, from, timeout);
    if (!allowed) return false;
  }

  // 2. Target route's beforeEnter guard
  const toSegment = to.split('/').filter(Boolean).at(-1);
  if (toSegment) {
    const targetRoute = ctx.getRoute(toSegment);
    if (targetRoute?.beforeEnter) {
      const allowed = await runGuard(targetRoute.beforeEnter, to, from, timeout);
      if (!allowed) return false;
    }
  }

  // 3. Source route's beforeLeave guard
  const fromSegment = from.split('/').filter(Boolean).at(-1);
  if (fromSegment) {
    const sourceRoute = ctx.getRoute(fromSegment);
    if (sourceRoute?.beforeLeave) {
      const allowed = await runGuard(sourceRoute.beforeLeave, to, from, timeout);
      if (!allowed) return false;
    }
  }

  return true;
}

/**
 * Run afterEach hooks (fire-and-forget, cannot cancel).
 */
export function executeAfterHooks(
  to: string,
  from: string,
  hooks?: NavigationAfterHook[]
): void {
  if (!hooks?.length) return;
  for (const hook of hooks) {
    try {
      hook(to, from);
    } catch {
      // afterEach hooks should not break navigation
    }
  }
}
