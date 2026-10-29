/**
 * Dialog events for `tracker.onEvent`, reported by the dialog manager when
 * its stack actually changes. Dialogs cover dialogs only.
 */
import type {
  CloseReason,
  MicroDialog,
  PageTrackerHooks,
  TrackerEventPhase
} from '../../core/types';
import { createTrackerEvent } from '../use-page-tracker';

export interface DialogEvents {
  /** An open of `path` over `prevTop`: covers it first, then enters */
  opened: (path: string, prevTop: string) => void;
  /** A close of `path`: leaves, then uncovers the dialog now on top */
  closed: (path: string, prevTop: string, nextTop: string, reason: CloseReason) => void;
  /**
   * `closeAllDialogs`: a leave for every open dialog, top first, as if each
   * closed in turn. One open but not in the stack (never the case through
   * `openDialog`) comes last.
   */
  closedAll: (stack: readonly string[], prevTop: string) => void;
}

export function createDialogEvents(
  dialogs: Map<string, MicroDialog>,
  tracker?: Required<PageTrackerHooks>
): DialogEvents {
  function emit(
    path: string,
    phase: TrackerEventPhase,
    from: string,
    to: string,
    closeReason?: CloseReason
  ) {
    tracker?.onEvent?.(
      createTrackerEvent(
        { kind: 'dialog', phase, name: path, path, from, to },
        { closeReason, meta: dialogs.get(path)?.meta }
      )
    );
  }

  function opened(path: string, prevTop: string) {
    if (prevTop && prevTop !== path) emit(prevTop, 'cover', prevTop, path);
    emit(path, 'enter', prevTop, path);
  }

  function closed(path: string, prevTop: string, nextTop: string, reason: CloseReason) {
    emit(path, 'leave', prevTop, nextTop, reason);
    if (nextTop && nextTop !== prevTop) emit(nextTop, 'uncover', prevTop, nextTop);
  }

  function closedAll(stack: readonly string[], prevTop: string) {
    const order = [...stack].reverse();
    dialogs.forEach((dialog, path) => {
      if (dialog.activated && !order.includes(path)) order.push(path);
    });
    for (const path of order) {
      if (dialogs.get(path)?.activated) emit(path, 'leave', prevTop, '', 'programmatic');
    }
  }

  return { opened, closed, closedAll };
}
