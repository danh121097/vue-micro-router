/**
 * Vue Devtools integration — custom inspector and timeline for micro-router.
 *
 * Shows: current path, page stack, registered routes, dialog state, control state.
 * Records: push, back, dialog open/close, control toggle as timeline events.
 *
 * Guarded by __DEV__ / import.meta.env.DEV — zero cost in production builds.
 * Requires @vue/devtools-api as optional peer dependency.
 */
import type { MicroRouterStore } from '../core/types';

const INSPECTOR_ID = 'micro-router-inspector';
const TIMELINE_LAYER_ID = 'micro-router-events';

interface DevtoolsApi {
  addInspector: (options: Record<string, unknown>) => void;
  addTimelineLayer: (options: Record<string, unknown>) => void;
  on: {
    getInspectorTree: (cb: (payload: any) => void) => void;
    getInspectorState: (cb: (payload: any) => void) => void;
  };
  addTimelineEvent: (options: Record<string, unknown>) => void;
  sendInspectorTree: (inspectorId: string) => void;
  sendInspectorState: (inspectorId: string) => void;
}

let devtoolsApi: DevtoolsApi | null = null;

/**
 * Emit a timeline event to Vue Devtools.
 * Safe to call even if devtools not connected — silently no-ops.
 */
export function emitDevtoolsEvent(
  label: string,
  data: Record<string, unknown>
): void {
  if (!devtoolsApi) return;
  try {
    devtoolsApi.addTimelineEvent({
      layerId: TIMELINE_LAYER_ID,
      event: {
        time: Date.now(),
        title: label,
        data
      }
    });
  } catch {
    // Devtools not connected — ignore
  }
}

/**
 * Refresh the devtools inspector panel.
 */
export function refreshDevtoolsInspector(): void {
  if (!devtoolsApi) return;
  try {
    devtoolsApi.sendInspectorTree(INSPECTOR_ID);
    devtoolsApi.sendInspectorState(INSPECTOR_ID);
  } catch {
    // Devtools not connected
  }
}

/**
 * Setup the devtools plugin. Call once in useGlobalMicroRouter (dev mode only).
 */
export async function setupDevtoolsPlugin(store: MicroRouterStore): Promise<void> {
  // Only in development
  if (typeof import.meta !== 'undefined' && !(import.meta as any).env?.DEV) return;

  let setupDevtools: any;
  try {
    // Dynamic import — @vue/devtools-api is an optional peer dependency
    const mod = await import(/* @vite-ignore */ '@vue/devtools-api');
    setupDevtools = mod.setupDevtoolsPlugin;
  } catch {
    // @vue/devtools-api not installed — skip silently
    return;
  }

  if (!setupDevtools) return;

  setupDevtools(
    {
      id: 'vue-micro-router',
      label: 'Micro Router',
      packageName: 'vue-micro-router',
      homepage: 'https://github.com/danh121097/vue-micro-router'
    },
    (api: DevtoolsApi) => {
      devtoolsApi = api;

      // Register inspector
      api.addInspector({
        id: INSPECTOR_ID,
        label: 'Micro Router',
        icon: 'route'
      });

      // Register timeline layer
      api.addTimelineLayer({
        id: TIMELINE_LAYER_ID,
        label: 'Micro Router',
        color: 0x42b883
      });

      // Inspector tree
      api.on.getInspectorTree((payload: any) => {
        if (payload.inspectorId !== INSPECTOR_ID) return;
        payload.rootNodes = [
          {
            id: 'routes',
            label: `Routes (${store.resolveRoutes.value.length} active)`,
            children: store.resolveRoutes.value.map((r) => ({
              id: `route-${r.path}`,
              label: r.path
            }))
          },
          {
            id: 'dialogs',
            label: `Dialogs (${store.resolveDialogs.value.length} open)`,
            children: store.resolveDialogs.value.map((d) => ({
              id: `dialog-${d.path}`,
              label: d.path
            }))
          },
          {
            id: 'controls',
            label: `Controls (${store.resolveControls.value.length} active)`,
            children: store.resolveControls.value.map((c) => ({
              id: `control-${c.name}`,
              label: c.name
            }))
          }
        ];
      });

      // Inspector state
      api.on.getInspectorState((payload: any) => {
        if (payload.inspectorId !== INSPECTOR_ID) return;

        if (payload.nodeId === 'routes') {
          payload.state = {
            'Navigation': [
              { key: 'activePath', value: store.activePath.value },
              { key: 'fromPath', value: store.fromPath.value },
              { key: 'toPath', value: store.toPath.value },
              { key: 'activePage', value: store.activePage.value }
            ]
          };
        } else if (payload.nodeId.startsWith('route-')) {
          const segment = payload.nodeId.replace('route-', '');
          payload.state = {
            'Route': [
              { key: 'path', value: segment },
              { key: 'attrs', value: store.getRouteAttrs(segment) ?? {} }
            ]
          };
        } else if (payload.nodeId.startsWith('dialog-')) {
          const path = payload.nodeId.replace('dialog-', '');
          payload.state = {
            'Dialog': [
              { key: 'path', value: path },
              { key: 'attrs', value: store.getDialogAttrs(path) ?? {} }
            ]
          };
        } else if (payload.nodeId.startsWith('control-')) {
          const name = payload.nodeId.replace('control-', '');
          payload.state = {
            'Control': [
              { key: 'name', value: name },
              { key: 'attrs', value: store.getControlAttrs(name) ?? {} }
            ]
          };
        }
      });
    }
  );
}
