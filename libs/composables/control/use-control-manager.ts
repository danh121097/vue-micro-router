/**
 * Manages GUI overlay controls (main_gui, onboarding_main_gui, inventory, etc.).
 *
 * Controls are named overlays above the page stack. The defaultControl is always visible
 * when no other control is active. Only one non-default control can be active at a time.
 *
 * isProcessing guard applies only to activation. Deactivation is always allowed.
 */
import {
  computed,
  defineAsyncComponent,
  shallowReactive,
  type ComputedRef
} from 'vue';

import type {
  CloseReason,
  MicroControl,
  MicroRouterRegistry,
  PageTrackerHooks
} from '../../core/types';
import { isAsyncLoader, safeMarkRaw } from '../../utils/path-utils';
import { createTrackerEvent, listDefinitions } from '../use-page-tracker';
import { createTimerManager } from '../../utils/timer-manager';

interface ControlManagerConfig {
  defaultControlName: string;
  onboardingControlName?: string;
}

export interface ControlManagerState {
  resolveControls: ComputedRef<MicroControl[]>;
  activeControl: ComputedRef<boolean>;
  currentControl: ComputedRef<string>;
  toggleControl: (
    name: string,
    active: boolean,
    attrs?: Record<string, unknown>
  ) => void;
  registerControl: (control: MicroControl) => void;
  registerControls: (controls: MicroControl[]) => void;
  getControlAttrs: (name: string) => Record<string, unknown> | undefined;
  updateControlAttrs: (name: string, attrs: Record<string, unknown>) => void;
  /** Registered control names with their `meta`, in registration order */
  listControls: () => MicroRouterRegistry['controls'];
  cleanup: () => void;
}

export function useControlManager(
  config: ControlManagerConfig,
  tracker?: Required<PageTrackerHooks>
): ControlManagerState {
  const defaultName = config.defaultControlName;
  const onboardingName = config.onboardingControlName;
  const STEP_DELAY = 300;

  const timers = createTimerManager();
  let isProcessing = false;

  const controls = shallowReactive(new Map<string, MicroControl>());
  const controlAttrs = shallowReactive(
    new Map<string, Record<string, unknown>>()
  );

  /** Single iteration over controls — all derived computeds read from this */
  const activeControls = computed(() => {
    const result: MicroControl[] = [];
    for (const ctrl of controls.values()) {
      if (ctrl.activated) result.push(ctrl);
    }
    return result;
  });

  // Expose activeControls directly — no proxy computed needed
  const resolveControls = activeControls;
  const activeControl = computed(() =>
    activeControls.value.some((c) => c.name !== defaultName)
  );
  const currentControl = computed(() => {
    const nonDefault = activeControls.value.find((c) => c.name !== defaultName);
    return nonDefault?.name ?? defaultName;
  });

  /**
   * `currentControl`, or `''` while no control is active — `currentControl`
   * names the default GUI even then, which would read as a GUI shown.
   */
  function shownControl() {
    return activeControls.value.length > 0 ? currentControl.value : '';
  }

  /**
   * Fire the tracker for one control whose `activated` flipped — never for a
   * set that leaves it as it was. Called after the toggle has settled, so
   * `to` is already the new one.
   */
  function emitControl(
    name: string,
    phase: 'enter' | 'leave',
    from: string,
    closeReason?: CloseReason
  ) {
    if (phase === 'enter') tracker?.trackGuiEnter?.(name);
    else tracker?.trackGuiLeave?.(name);
    tracker?.onEvent?.(
      createTrackerEvent(
        { kind: 'control', phase, name, path: name, from, to: shownControl() },
        { closeReason, meta: controls.get(name)?.meta }
      )
    );
  }

  function toggleControl(
    name: string,
    active: boolean,
    attrs?: Record<string, unknown>
  ) {
    if (active && isProcessing) return;
    if (active) isProcessing = true;
    try {
      const control = controls.get(name);
      if (!control) return;

      const from = shownControl();
      const defaultGUI = controls.get(defaultName);
      const isMainGui = name === defaultName || name === onboardingName;
      // Leaves first, then enters — collected while state changes, fired once it has.
      const left: Array<{ name: string; reason: CloseReason }> = [];
      const entered: string[] = [];

      if (active) {
        if (isMainGui) {
          controls.forEach((ctrl) => {
            if (ctrl.name !== defaultName && ctrl.name !== name && ctrl.activated) {
              left.push({ name: ctrl.name, reason: 'replace' });
              controls.set(ctrl.name, {
                ...ctrl,
                activated: false,
                attrs: undefined
              });
            }
          });
        } else if (defaultGUI?.activated) {
          left.push({ name: defaultName, reason: 'replace' });
          controls.set(defaultName, { ...defaultGUI, activated: false });
        }
        if (!control.activated) entered.push(name);
        if (attrs) controlAttrs.set(name, { ...attrs });
        controls.set(name, {
          ...control,
          activated: true,
          componentKey: (control.componentKey || 0) + 1,
          attrs: attrs ? { ...attrs } : undefined
        });
      } else {
        if (control.activated) left.push({ name, reason: 'programmatic' });
        controlAttrs.delete(name);
        controls.set(name, { ...control, activated: false, attrs: undefined });
        const updatedDefaultGUI = controls.get(defaultName);
        if (
          !isMainGui &&
          updatedDefaultGUI &&
          !updatedDefaultGUI.activated &&
          updatedDefaultGUI.name !== onboardingName
        ) {
          entered.push(defaultName);
          controls.set(defaultName, { ...updatedDefaultGUI, activated: true });
        }
      }

      for (const leave of left) emitControl(leave.name, 'leave', from, leave.reason);
      for (const enter of entered) emitControl(enter, 'enter', from);
    } finally {
      if (active) {
        timers.schedule(() => {
          isProcessing = false;
        }, STEP_DELAY);
      }
    }
  }

  function registerControl(control: MicroControl) {
    if (controls.has(control.name)) {
      console.warn(`[vue-micro-router] Control "${control.name}" already registered. Overwriting.`);
    }
    let { component } = control;
    if (isAsyncLoader(component)) component = defineAsyncComponent(component);
    controls.set(control.name, {
      ...control,
      component: safeMarkRaw(component)
    });
  }

  function registerControls(ctrls: MicroControl[]) {
    ctrls.forEach(registerControl);
  }

  function getControlAttrs(name: string): Record<string, unknown> | undefined {
    return controlAttrs.get(name);
  }

  function updateControlAttrs(name: string, attrs: Record<string, unknown>) {
    const existing = controlAttrs.get(name);
    controlAttrs.set(name, { ...existing, ...attrs });
  }

  function listControls(): MicroRouterRegistry['controls'] {
    return listDefinitions(controls.values(), 'name');
  }

  return {
    resolveControls,
    activeControl,
    currentControl,
    toggleControl,
    registerControl,
    registerControls,
    getControlAttrs,
    updateControlAttrs,
    listControls,
    cleanup: timers.cleanup
  };
}
