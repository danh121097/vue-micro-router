import { describe, expect, mock, test } from 'bun:test';

import { usePageTracker } from '../libs/composables/use-page-tracker';

describe('usePageTracker', () => {
  test('returns no-op functions when no hooks provided', () => {
    const tracker = usePageTracker();
    // Should not throw
    tracker.trackPageEnter('home');
    tracker.trackPageLeave('home');
    tracker.trackDialogEnter('dialog');
    tracker.trackDialogLeave('dialog');
    tracker.trackGuiEnter('gui');
    tracker.trackGuiLeave('gui');
    tracker.cleanupAllSessions();
  });

  test('calls provided hooks', () => {
    const trackPageEnter = mock(() => {});
    const trackGuiLeave = mock(() => {});
    const tracker = usePageTracker({ trackPageEnter, trackGuiLeave });

    tracker.trackPageEnter('home', 'from', 'to');
    expect(trackPageEnter).toHaveBeenCalledWith('home', 'from', 'to');

    tracker.trackGuiLeave('main_gui');
    expect(trackGuiLeave).toHaveBeenCalledWith('main_gui');
  });

  test('missing hooks use no-ops', () => {
    const trackPageEnter = mock(() => {});
    const tracker = usePageTracker({ trackPageEnter });

    // These should not throw (no-op)
    tracker.trackPageLeave('home');
    tracker.trackDialogEnter('dialog');
    tracker.cleanupAllSessions();

    // Provided hook should still work
    expect(trackPageEnter).not.toHaveBeenCalled();
    tracker.trackPageEnter('home');
    expect(trackPageEnter).toHaveBeenCalledTimes(1);
  });
});
