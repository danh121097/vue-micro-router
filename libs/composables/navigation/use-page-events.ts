/**
 * Page events for `tracker.onEvent`: one enter/leave per page mounted into or
 * removed from the stack, and a cover/uncover when the page on top changes.
 *
 * Diffs the last reported stack against the new one rather than trusting the
 * path a navigation starts from: a multi-step back collapses the intermediate
 * pages without reporting, and they still need their leave.
 */
import type {
  CloseReason,
  MicroMeta,
  NavigationKind,
  PageTrackerHooks,
  TrackerEventPhase
} from '../../core/types';
import {
  buildPathFromSegments,
  normalizePath,
  parsePathSegments
} from '../../utils/path-utils';
import { createTrackerEvent } from '../use-page-tracker';

interface PageEventConfig {
  tracker?: Required<PageTrackerHooks>;
  getMeta: (segment: string) => MicroMeta | undefined;
  /** Remount version of a segment — a page re-pushed in place is a new page */
  getVersion: (segment: string) => number;
}

export interface PageEvents {
  /** Report the change from the last reported stack to `toPath` */
  sync: (toPath: string, kind: NavigationKind) => void;
  /**
   * Run a navigation whose leaves report `reason` (the swipe-back gesture).
   * Cleared when `run` settles, so a navigation that was skipped or rejected
   * by a guard never hands it to the next one.
   */
  withLeaveReason: (reason: CloseReason, run: () => Promise<void>) => Promise<void>;
}

export function createPageEvents(config: PageEventConfig): PageEvents {
  let reported: Array<{ segment: string; version: number }> = [];
  let leaveReason: CloseReason | undefined;

  function sync(toPath: string, kind: NavigationKind) {
    const onEvent = config.tracker?.onEvent;
    const next = parsePathSegments(toPath).map((segment) => ({
      segment,
      version: config.getVersion(segment)
    }));
    const prev = reported;
    reported = next;
    if (!onEvent) return;

    let shared = 0;
    while (
      shared < prev.length &&
      shared < next.length &&
      prev[shared]!.segment === next[shared]!.segment &&
      prev[shared]!.version === next[shared]!.version
    ) {
      shared++;
    }

    // From the reported stack, not the caller's path: a multi-step back has
    // already collapsed `activePath` to an intermediate one.
    const from = prev.length ? buildPathFromSegments(prev.map((p) => p.segment)) : '';
    const to = normalizePath(toPath);
    const emit = (
      stack: typeof prev,
      index: number,
      phase: TrackerEventPhase,
      closeReason?: CloseReason
    ) => {
      const segment = stack[index]!.segment;
      const path = buildPathFromSegments(stack.slice(0, index + 1).map((p) => p.segment));
      onEvent(
        createTrackerEvent(
          { kind: 'page', phase, name: segment, path, from, to },
          { navigationKind: kind, closeReason, meta: config.getMeta(segment) }
        )
      );
    };

    const removed = prev.length - shared;
    const added = next.length - shared;
    const reason: CloseReason =
      leaveReason ?? (kind === 'replace' ? 'replace' : 'programmatic');

    for (let i = prev.length - 1; i >= shared; i--) emit(prev, i, 'leave', reason);
    // The kept page under the change: covered when pages go on top of it,
    // uncovered when it is on top again. Swapped tops leave it covered.
    if (shared > 0 && removed === 0 && added > 0) emit(prev, shared - 1, 'cover');
    if (shared > 0 && removed > 0 && added === 0) emit(next, shared - 1, 'uncover');
    for (let i = shared; i < next.length; i++) {
      emit(next, i, 'enter');
      if (i < next.length - 1) emit(next, i, 'cover');
    }
  }

  async function withLeaveReason(reason: CloseReason, run: () => Promise<void>) {
    leaveReason = reason;
    try {
      await run();
    } finally {
      leaveReason = undefined;
    }
  }

  return { sync, withLeaveReason };
}
