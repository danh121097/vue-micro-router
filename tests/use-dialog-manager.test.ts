import { describe, expect, mock, test } from 'bun:test';

import { useDialogManager } from '../libs/composables/dialog/use-dialog-manager';
import { usePageTracker } from '../libs/composables/use-page-tracker';
import type { TrackerEvent } from '../libs/core/types';

function createDialogManager() {
  const tracker = usePageTracker();
  return useDialogManager(tracker);
}

const fakeComponent = { render: () => null };

describe('useDialogManager', () => {
  test('initializes with empty state', () => {
    const dm = createDialogManager();
    expect(dm.activeDialog.value).toBe('');
    expect(dm.resolveDialogs.value).toHaveLength(0);
  });

  test('registerDialog adds to registry', () => {
    const dm = createDialogManager();
    dm.registerDialog({ path: 'confirm', component: fakeComponent, activated: false });
    // Not activated yet, so resolveDialogs is empty
    expect(dm.resolveDialogs.value).toHaveLength(0);
  });

  test('registerDialogs batch', () => {
    const dm = createDialogManager();
    dm.registerDialogs([
      { path: 'a', component: fakeComponent, activated: false },
      { path: 'b', component: fakeComponent, activated: false },
    ]);
    expect(dm.resolveDialogs.value).toHaveLength(0);
  });

  test('duplicate registration warns', () => {
    const dm = createDialogManager();
    const warnSpy = mock(() => {});
    console.warn = warnSpy;
    dm.registerDialog({ path: 'confirm', component: fakeComponent, activated: false });
    dm.registerDialog({ path: 'confirm', component: fakeComponent, activated: false });
    expect(warnSpy).toHaveBeenCalled();
  });

  test('openDialog returns instance', () => {
    const dm = createDialogManager();
    dm.registerDialog({ path: 'confirm', component: fakeComponent, activated: false });
    const instance = dm.openDialog('confirm', { title: 'Test' });
    expect(instance.path).toBe('confirm');
    expect(instance.attrs).toEqual({ title: 'Test' });
  });

  test('openDialog on unregistered dialog returns instance', () => {
    const dm = createDialogManager();
    const instance = dm.openDialog('unknown');
    expect(instance.path).toBe('unknown');
  });

  test('openDialog is guarded against rapid calls', () => {
    const dm = createDialogManager();
    dm.registerDialog({ path: 'a', component: fakeComponent, activated: false });
    dm.registerDialog({ path: 'b', component: fakeComponent, activated: false });
    dm.openDialog('a');
    const result = dm.openDialog('b');
    // Second call should return instance but not activate
    expect(result.path).toBe('b');
  });

  test('closeDialog works', async () => {
    const dm = createDialogManager();
    dm.registerDialog({ path: 'confirm', component: fakeComponent, activated: false });
    dm.openDialog('confirm');
    dm.closeDialog('confirm');
    // After close, fromDialog tracks
    expect(dm.fromDialog.value).toBe('');
  });

  test('closeAllDialogs closes all active', async () => {
    const dm = createDialogManager();
    dm.registerDialog({ path: 'a', component: fakeComponent, activated: false });
    dm.openDialog('a');
    await new Promise((r) => setTimeout(r, 350));
    dm.registerDialog({ path: 'b', component: fakeComponent, activated: false });
    dm.openDialog('b');
    dm.closeAllDialogs();
    expect(dm.activeDialog.value).toBe('');
  });

  test('closeAllDialogs invokes onClose callbacks after iteration', async () => {
    const dm = createDialogManager();
    const onClose = mock(() => {});
    dm.registerDialog({ path: 'a', component: fakeComponent, activated: false });
    dm.openDialog('a', { onClose });
    // Wait for nextTick to set attrs
    await new Promise((r) => setTimeout(r, 50));
    dm.closeAllDialogs();
    expect(onClose).toHaveBeenCalled();
  });

  test('getDialogAttrs and updateDialogAttrs', () => {
    const dm = createDialogManager();
    expect(dm.getDialogAttrs('confirm')).toBeUndefined();
    dm.updateDialogAttrs('confirm', { key: 'value' });
    expect(dm.getDialogAttrs('confirm')).toEqual({ key: 'value' });
  });

  test('updateDialogAttrs merges existing', () => {
    const dm = createDialogManager();
    dm.updateDialogAttrs('confirm', { a: 1 });
    dm.updateDialogAttrs('confirm', { b: 2 });
    expect(dm.getDialogAttrs('confirm')).toEqual({ a: 1, b: 2 });
  });

  test('fromDialog and toDialog track transitions', async () => {
    const dm = createDialogManager();
    dm.registerDialog({ path: 'a', component: fakeComponent, activated: false });
    dm.openDialog('a');
    // executeDialog uses nextTick, so wait for state update
    await new Promise((r) => setTimeout(r, 50));
    expect(dm.toDialog.value).toBe('a');
    expect(dm.fromDialog.value).toBe('');
  });

  test('cleanup does not throw', () => {
    const dm = createDialogManager();
    dm.cleanup();
  });

  test('closeDialog on unregistered path does not throw', () => {
    const dm = createDialogManager();
    dm.closeDialog('nonexistent');
  });

  test('closeAllDialogs with no active dialogs is safe', () => {
    const dm = createDialogManager();
    dm.closeAllDialogs();
    expect(dm.activeDialog.value).toBe('');
  });

  test('tracker hooks are called', () => {
    const trackDialogEnter = mock(() => {});
    const trackDialogLeave = mock(() => {});
    const tracker = usePageTracker({ trackDialogEnter, trackDialogLeave });
    const dm = useDialogManager(tracker);
    dm.registerDialog({ path: 'a', component: fakeComponent, activated: false });
    dm.openDialog('a');
    expect(trackDialogEnter).toHaveBeenCalled();
    dm.closeDialog('a');
    expect(trackDialogLeave).toHaveBeenCalled();
  });

  describe('onEvent', () => {
    const settle = (ms = 350) => new Promise((r) => setTimeout(r, ms));

    function createTracked() {
      const events: TrackerEvent[] = [];
      const dm = useDialogManager(usePageTracker({ onEvent: (e) => events.push(e) }));
      dm.registerDialogs([
        { path: 'a', component: fakeComponent, activated: false },
        { path: 'b', component: fakeComponent, activated: false, meta: { screen: 'bee' } }
      ]);
      return { dm, events };
    }

    test('a dialog over another covers it; closing it uncovers the one below', async () => {
      const { dm, events } = createTracked();
      dm.openDialog('a');
      await settle();
      dm.openDialog('b');
      await settle(50);
      dm.closeDialog('b');
      await settle(50);

      expect(events).toEqual([
        { kind: 'dialog', phase: 'enter', name: 'a', path: 'a', from: '', to: 'a' },
        { kind: 'dialog', phase: 'cover', name: 'a', path: 'a', from: 'a', to: 'b' },
        { kind: 'dialog', phase: 'enter', name: 'b', path: 'b', from: 'a', to: 'b', meta: { screen: 'bee' } },
        { kind: 'dialog', phase: 'leave', name: 'b', path: 'b', from: 'b', to: 'a', closeReason: 'programmatic', meta: { screen: 'bee' } },
        { kind: 'dialog', phase: 'uncover', name: 'a', path: 'a', from: 'b', to: 'a' }
      ]);
      dm.cleanup();
    });

    test('closeDialog reports the reason it is given', async () => {
      const { dm, events } = createTracked();
      dm.openDialog('a');
      await settle(50);
      dm.closeDialog('a', 'close_button');
      await settle(50);
      expect(events.at(-1)).toMatchObject({ phase: 'leave', name: 'a', closeReason: 'close_button' });
      dm.cleanup();
    });

    test('closing a dialog that is not open reports nothing', async () => {
      const { dm, events } = createTracked();
      dm.closeDialog('a');
      await settle(50);
      expect(events).toEqual([]);
      dm.cleanup();
    });

    test('closeAllDialogs reports each open dialog leaving, top first', async () => {
      const { dm, events } = createTracked();
      dm.openDialog('a');
      await settle();
      dm.openDialog('b');
      await settle(50);
      events.length = 0;

      dm.closeAllDialogs();
      expect(events.map((e) => [e.phase, e.name, e.closeReason, e.to])).toEqual([
        ['leave', 'b', 'programmatic', ''],
        ['leave', 'a', 'programmatic', '']
      ]);
      dm.cleanup();
    });

    test('listDialogs returns paths and meta in registration order', () => {
      const { dm } = createTracked();
      expect(dm.listDialogs()).toEqual([{ path: 'a' }, { path: 'b', meta: { screen: 'bee' } }]);
    });
  });
});
