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

import type { MicroControl, PageTrackerHooks } from '../../core/types';
import { isAsyncLoader, safeMarkRaw } from '../../utils/path-utils';
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

      const defaultGUI = controls.get(defaultName);
      const isMainGui = name === defaultName || name === onboardingName;

      if (active) {
        tracker?.trackGuiEnter?.(name);
        if (isMainGui) {
          controls.forEach((ctrl) => {
            if (ctrl.name !== defaultName && ctrl.activated) {
              tracker?.trackGuiLeave?.(ctrl.name);
              controls.set(ctrl.name, {
                ...ctrl,
                activated: false,
                attrs: undefined
              });
            }
          });
        } else if (defaultGUI?.activated) {
          tracker?.trackGuiLeave?.(defaultName);
          controls.set(defaultName, { ...defaultGUI, activated: false });
        }
        if (attrs) controlAttrs.set(name, { ...attrs });
        controls.set(name, {
          ...control,
          activated: true,
          componentKey: (control.componentKey || 0) + 1,
          attrs: attrs ? { ...attrs } : undefined
        });
      } else {
        tracker?.trackGuiLeave?.(name);
        controlAttrs.delete(name);
        controls.set(name, { ...control, activated: false, attrs: undefined });
        const updatedDefaultGUI = controls.get(defaultName);
        if (!isMainGui && updatedDefaultGUI && !updatedDefaultGUI.activated) {
          if (updatedDefaultGUI.name === onboardingName) return;
          controls.set(defaultName, { ...updatedDefaultGUI, activated: true });
        }
      }
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

  return {
    resolveControls,
    activeControl,
    currentControl,
    toggleControl,
    registerControl,
    registerControls,
    getControlAttrs,
    updateControlAttrs,
    cleanup: timers.cleanup
  };
}
