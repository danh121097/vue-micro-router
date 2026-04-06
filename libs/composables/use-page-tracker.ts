/**
 * Normalizes optional PageTrackerHooks into a fully-required object with no-op fallbacks.
 * All managers receive Required<PageTrackerHooks> so they can call any hook unconditionally.
 */
import type { PageTrackerHooks } from '../core/types';

const noop = () => {};

/** Create a page tracker with optional hook implementations. No-ops by default. */
export function usePageTracker(
  hooks?: PageTrackerHooks
): Required<PageTrackerHooks> {
  return {
    trackPageEnter: hooks?.trackPageEnter ?? noop,
    trackPageLeave: hooks?.trackPageLeave ?? noop,
    trackDialogEnter: hooks?.trackDialogEnter ?? noop,
    trackDialogLeave: hooks?.trackDialogLeave ?? noop,
    trackGuiEnter: hooks?.trackGuiEnter ?? noop,
    trackGuiLeave: hooks?.trackGuiLeave ?? noop,
    cleanupAllSessions: hooks?.cleanupAllSessions ?? noop
  };
}
