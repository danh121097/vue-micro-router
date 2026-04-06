/**
 * State serialization/restore — save and restore full router state as JSON.
 *
 * Serializes: navigation path + attrs, dialog stack + attrs, control state + attrs.
 * Components are NOT serializable — restore re-resolves them from registered definitions.
 *
 * Use cases: page refresh persistence, session resume, deep linking via external state.
 */
import type { MicroRouterStore, SerializedState } from '../core/types';

/**
 * Serialize the current router state into a JSON-safe object.
 */
export function serializeState(store: MicroRouterStore): SerializedState {
  // Collect route attrs for active segments
  const activeSegments = store.activePath.value.split('/').filter(Boolean);
  const routeAttrs: Record<string, Record<string, unknown>> = {};
  for (const segment of activeSegments) {
    const attrs = store.getRouteAttrs(segment);
    if (attrs) routeAttrs[segment] = { ...attrs };
  }

  // Collect open dialog paths and attrs
  const dialogStack: string[] = [];
  const dialogAttrs: Record<string, Record<string, unknown>> = {};
  for (const dialog of store.resolveDialogs.value) {
    // Skip dialogs mid-close animation — they're not truly open
    if (dialog.closing) continue;
    dialogStack.push(dialog.path);
    const attrs = store.getDialogAttrs(dialog.path);
    if (attrs) dialogAttrs[dialog.path] = { ...attrs };
  }

  // Collect active controls and attrs
  const activeControls: string[] = [];
  const controlAttrs: Record<string, Record<string, unknown>> = {};
  for (const control of store.resolveControls.value) {
    activeControls.push(control.name);
    const attrs = store.getControlAttrs(control.name);
    if (attrs) controlAttrs[control.name] = { ...attrs };
  }

  return {
    version: 1,
    navigation: { activePath: store.activePath.value, routeAttrs },
    dialogs: { stack: dialogStack, attrs: dialogAttrs },
    controls: { active: activeControls, attrs: controlAttrs }
  };
}

/**
 * Restore router state from a serialized snapshot.
 * Navigates to the saved path, reopens dialogs in order, activates controls.
 * Warns for unknown paths/dialogs/controls that are no longer registered.
 */
export async function restoreState(
  store: MicroRouterStore,
  state: SerializedState
): Promise<void> {
  if (state.version !== 1) {
    console.warn('[vue-micro-router] Unknown serialized state version:', state.version);
    return;
  }

  // 1. Restore navigation
  const { activePath, routeAttrs } = state.navigation;
  await store.push(activePath);

  // Restore route attrs
  for (const [segment, attrs] of Object.entries(routeAttrs)) {
    store.updateRouteAttrs(segment, attrs);
  }

  // 2. Restore dialogs in stack order
  for (const dialogPath of state.dialogs.stack) {
    const attrs = state.dialogs.attrs[dialogPath];
    store.openDialog(dialogPath, attrs);
  }

  // 3. Restore controls
  for (const controlName of state.controls.active) {
    const attrs = state.controls.attrs[controlName];
    store.toggleControl(controlName, true, attrs);
  }
}
