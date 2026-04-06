/**
 * Centralized timer management — tracks pending timeouts for clean lifecycle disposal.
 *
 * Used by useNavigation, useDialogManager, and useControlManager to ensure
 * all scheduled timeouts are cancelled when the component unmounts (via cleanup()).
 * Prevents memory leaks and "setting state on unmounted component" warnings.
 *
 * @example
 * ```ts
 * const timers = createTimerManager();
 * timers.schedule(() => { isNavigating = false }, 600);
 * // On unmount:
 * timers.cleanup(); // cancels all pending timers
 * ```
 */
export function createTimerManager() {
  const timers = new Set<ReturnType<typeof setTimeout>>();

  /** Schedule a callback after `ms` milliseconds. Auto-removes from tracking set when fired. */
  function schedule(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  /** Cancel all pending timers — call in onBeforeUnmount */
  function cleanup() {
    timers.forEach(clearTimeout);
    timers.clear();
  }

  return { schedule, cleanup };
}

/** Promise-based delay — used for step-wise navigation timing between page transitions */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
