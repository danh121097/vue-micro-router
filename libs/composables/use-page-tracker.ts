/**
 * Normalizes optional PageTrackerHooks into a fully-required object with no-op fallbacks.
 * All managers receive Required<PageTrackerHooks> so they can call any hook unconditionally.
 */
import type { MicroMeta, PageTrackerHooks, TrackerEvent } from '../core/types';

const noop = () => {};

/**
 * `onEvent` behind a try/catch: tracking must never break navigation, and a
 * throw here would also skip the hooks and state changes after the call.
 */
function isolate(onEvent: (event: TrackerEvent) => void) {
  return (event: TrackerEvent) => {
    try {
      onEvent(event);
    } catch (error) {
      console.warn('[vue-micro-router] tracker.onEvent threw — event dropped.', error);
    }
  };
}

/** Create a page tracker with optional hook implementations. No-ops by default. */
export function usePageTracker(
  hooks?: PageTrackerHooks
): Required<PageTrackerHooks> {
  return {
    onEvent: hooks?.onEvent ? isolate(hooks.onEvent) : noop,
    trackPageEnter: hooks?.trackPageEnter ?? noop,
    trackPageLeave: hooks?.trackPageLeave ?? noop,
    trackDialogEnter: hooks?.trackDialogEnter ?? noop,
    trackDialogLeave: hooks?.trackDialogLeave ?? noop,
    trackGuiEnter: hooks?.trackGuiEnter ?? noop,
    trackGuiLeave: hooks?.trackGuiLeave ?? noop,
    cleanupAllSessions: hooks?.cleanupAllSessions ?? noop
  };
}

/**
 * A {@link TrackerEvent} with the optional fields that are unset left out, so
 * a consumer never sees `closeReason: undefined`.
 */
export function createTrackerEvent(
  base: Pick<TrackerEvent, 'kind' | 'phase' | 'name' | 'path' | 'from' | 'to'>,
  optional: Pick<TrackerEvent, 'navigationKind' | 'closeReason' | 'meta'>
): TrackerEvent {
  const event: TrackerEvent = { ...base };
  if (optional.navigationKind) event.navigationKind = optional.navigationKind;
  if (optional.closeReason) event.closeReason = optional.closeReason;
  if (optional.meta) event.meta = optional.meta;
  return event;
}

/** Registry snapshot of definitions keyed by `path` or `name`, `meta` only when set. */
export function listDefinitions<Key extends 'path' | 'name'>(
  definitions: Iterable<Record<Key, string> & { meta?: MicroMeta }>,
  key: Key
): Array<Record<Key, string> & { meta?: MicroMeta }> {
  return Array.from(definitions, (definition) => {
    const entry: Record<string, unknown> = { [key]: definition[key] };
    if (definition.meta) entry.meta = definition.meta;
    return entry as Record<Key, string> & { meta?: MicroMeta };
  });
}
