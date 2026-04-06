import { describe, expect, mock, test } from 'bun:test';

import { useDialogManager } from '../libs/composables/use-dialog-manager';
import { usePageTracker } from '../libs/composables/use-page-tracker';

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
});
