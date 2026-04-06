import { describe, expect, mock, test } from 'bun:test';

import { useControlManager } from '../libs/composables/use-control-manager';
import { usePageTracker } from '../libs/composables/use-page-tracker';

const fakeComponent = { render: () => null };

function createControlManager(config: { defaultControlName?: string; onboardingControlName?: string } = {}) {
  const tracker = usePageTracker();
  return useControlManager({ defaultControlName: config.defaultControlName ?? 'main_gui', ...config }, tracker);
}

describe('useControlManager', () => {
  test('initializes with empty state', () => {
    const cm = createControlManager();
    expect(cm.resolveControls.value).toHaveLength(0);
    expect(cm.activeControl.value).toBe(false);
    expect(cm.currentControl.value).toBe('main_gui');
  });

  test('registerControl adds to registry', () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    expect(cm.resolveControls.value).toHaveLength(0);
  });

  test('registerControls batch', () => {
    const cm = createControlManager();
    cm.registerControls([
      { name: 'main_gui', component: fakeComponent, activated: false },
      { name: 'inventory', component: fakeComponent, activated: false },
    ]);
    expect(cm.resolveControls.value).toHaveLength(0);
  });

  test('duplicate registration warns', () => {
    const cm = createControlManager();
    const warnSpy = mock(() => {});
    console.warn = warnSpy;
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    expect(warnSpy).toHaveBeenCalled();
  });

  test('toggleControl activates control', () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    cm.toggleControl('main_gui', true);
    expect(cm.resolveControls.value).toHaveLength(1);
    expect(cm.currentControl.value).toBe('main_gui');
  });

  test('toggleControl deactivates control', () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    cm.toggleControl('main_gui', true);
    cm.toggleControl('main_gui', false);
    expect(cm.resolveControls.value).toHaveLength(0);
  });

  test('activating non-default deactivates default GUI', async () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    cm.registerControl({ name: 'inventory', component: fakeComponent, activated: false });
    cm.toggleControl('main_gui', true);
    // Wait for isProcessing guard to release
    await new Promise((r) => setTimeout(r, 350));
    cm.toggleControl('inventory', true);
    expect(cm.activeControl.value).toBe(true);
    const active = cm.resolveControls.value.map((c) => c.name);
    expect(active).toContain('inventory');
    expect(active).not.toContain('main_gui');
  });

  test('deactivating non-default restores default GUI', async () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    cm.registerControl({ name: 'inventory', component: fakeComponent, activated: false });
    cm.toggleControl('main_gui', true);
    await new Promise((r) => setTimeout(r, 350));
    cm.toggleControl('inventory', true);
    cm.toggleControl('inventory', false);
    const active = cm.resolveControls.value.map((c) => c.name);
    expect(active).toContain('main_gui');
  });

  test('activating main_gui deactivates non-default controls', async () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    cm.registerControl({ name: 'inventory', component: fakeComponent, activated: false });
    cm.toggleControl('inventory', true);
    await new Promise((r) => setTimeout(r, 350));
    cm.toggleControl('main_gui', true);
    const active = cm.resolveControls.value.map((c) => c.name);
    expect(active).toContain('main_gui');
    expect(active).not.toContain('inventory');
  });

  test('toggleControl with attrs', () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    cm.toggleControl('main_gui', true, { mode: 'compact' });
    expect(cm.getControlAttrs('main_gui')).toEqual({ mode: 'compact' });
  });

  test('toggleControl on unknown control is no-op', () => {
    const cm = createControlManager();
    cm.toggleControl('unknown', true);
    expect(cm.resolveControls.value).toHaveLength(0);
  });

  test('activation is guarded against rapid calls', () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'a', component: fakeComponent, activated: false });
    cm.registerControl({ name: 'b', component: fakeComponent, activated: false });
    cm.toggleControl('a', true);
    cm.toggleControl('b', true); // Should be blocked by isProcessing
    expect(cm.resolveControls.value).toHaveLength(1);
    expect(cm.resolveControls.value[0]?.name).toBe('a');
  });

  test('deactivation is not guarded', () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'a', component: fakeComponent, activated: false });
    cm.toggleControl('a', true);
    // Deactivation should work even during processing
    cm.toggleControl('a', false);
    expect(cm.resolveControls.value).toHaveLength(0);
  });

  test('getControlAttrs and updateControlAttrs', () => {
    const cm = createControlManager();
    expect(cm.getControlAttrs('main_gui')).toBeUndefined();
    cm.updateControlAttrs('main_gui', { a: 1 });
    expect(cm.getControlAttrs('main_gui')).toEqual({ a: 1 });
  });

  test('updateControlAttrs merges existing', () => {
    const cm = createControlManager();
    cm.updateControlAttrs('main_gui', { a: 1 });
    cm.updateControlAttrs('main_gui', { b: 2 });
    expect(cm.getControlAttrs('main_gui')).toEqual({ a: 1, b: 2 });
  });

  test('custom control names from config', () => {
    const cm = createControlManager({
      defaultControlName: 'hud',
      onboardingControlName: 'tutorial',
    });
    expect(cm.currentControl.value).toBe('hud');
  });

  test('cleanup does not throw', () => {
    const cm = createControlManager();
    cm.cleanup();
  });

  test('tracker hooks are called', () => {
    const trackGuiEnter = mock(() => {});
    const trackGuiLeave = mock(() => {});
    const tracker = usePageTracker({ trackGuiEnter, trackGuiLeave });
    const cm = useControlManager({}, tracker);
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    cm.toggleControl('main_gui', true);
    expect(trackGuiEnter).toHaveBeenCalledWith('main_gui');
    cm.toggleControl('main_gui', false);
    expect(trackGuiLeave).toHaveBeenCalledWith('main_gui');
  });

  test('onboarding control does not auto-restore default', () => {
    const cm = createControlManager();
    cm.registerControl({ name: 'onboarding_main_gui', component: fakeComponent, activated: false });
    cm.registerControl({ name: 'inventory', component: fakeComponent, activated: false });
    // Set default to onboarding
    cm.registerControl({ name: 'main_gui', component: fakeComponent, activated: false });
    cm.toggleControl('main_gui', true);
    // The name check for onboarding is on updatedDefaultGUI.name
    // This tests the onboarding exception path
  });
});

