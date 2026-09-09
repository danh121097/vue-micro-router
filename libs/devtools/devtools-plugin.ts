/**
 * Vue Devtools integration — custom inspector and timeline for micro-router.
 *
 * Shows: current path, page stack, registered routes, dialog state, control state.
 * Records: a `navigate` timeline event per page change. Dialog and control
 * activity is visible in the inspector tree but is not on the timeline.
 *
 * Opt-in through `config.devtools` and loaded with a dynamic `import()`, so
 * this module ships as its own chunk and the core entry carries none of it.
 * Requires @vue/devtools-api as an optional peer dependency.
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
 * Every store currently reporting to devtools, in registration order.
 *
 * The devtools API registers one plugin per page, not one per store, so the
 * registration below must happen exactly once while the inspector still has to
 * describe every live router — a library whose headline feature is nested
 * routers will routinely have more than one. The set is also what makes
 * teardown safe: unmounting one router must not blank the inspector for the
 * others still on screen.
 */
const stores = new Set<MicroRouterStore>();

/** Resolved once the API hands us its handle; null before that and after the last teardown. */
let devtoolsApi: DevtoolsApi | null = null;
/** Guards the one-time plugin registration against a second enabled router. */
let registered = false;

/** `r0:`-style prefix so node ids stay unique once several routers report. */
function storePrefix(index: number): string {
  return `r${index}:`;
}

/** The store a prefixed node id belongs to, or the only store when unprefixed. */
function storeForNode(nodeId: string): { store: MicroRouterStore; rest: string } | null {
  const list = Array.from(stores);
  const match = /^r(\d+):(.*)$/.exec(nodeId);
  if (!match) {
    return list.length === 1 ? { store: list[0]!, rest: nodeId } : null;
  }
  const store = list[Number(match[1])];
  return store ? { store, rest: match[2]! } : null;
}

function sectionNodes(store: MicroRouterStore, prefix: string) {
  return [
    {
      id: `${prefix}routes`,
      label: `Routes (${store.resolveRoutes.value.length} active)`,
      children: store.resolveRoutes.value.map((r) => ({
        id: `${prefix}route-${r.path}`,
        label: r.path
      }))
    },
    {
      id: `${prefix}dialogs`,
      label: `Dialogs (${store.resolveDialogs.value.length} open)`,
      children: store.resolveDialogs.value.map((d) => ({
        id: `${prefix}dialog-${d.path}`,
        label: d.path
      }))
    },
    {
      id: `${prefix}controls`,
      label: `Controls (${store.resolveControls.value.length} active)`,
      children: store.resolveControls.value.map((c) => ({
        id: `${prefix}control-${c.name}`,
        label: c.name
      }))
    }
  ];
}

/**
 * Inspector roots: the three sections directly when a single router reports,
 * one labelled node per router once more than one does. A single router — the
 * common case — keeps unprefixed ids, so its nodes read the same as they did
 * before nesting was accounted for.
 */
function inspectorRootNodes() {
  const list = Array.from(stores);
  if (list.length === 1) return sectionNodes(list[0]!, '');
  return list.map((store, i) => ({
    id: `r${i}`,
    label: `Router ${i + 1}`,
    children: sectionNodes(store, storePrefix(i))
  }));
}

function inspectorState(nodeId: string): Record<string, unknown> | undefined {
  const resolved = storeForNode(nodeId);
  if (!resolved) return undefined;
  const { store, rest } = resolved;

  if (rest === 'routes') {
    return {
      'Navigation': [
        { key: 'activePath', value: store.activePath.value },
        { key: 'fromPath', value: store.fromPath.value },
        { key: 'toPath', value: store.toPath.value },
        { key: 'activePage', value: store.activePage.value }
      ]
    };
  }
  if (rest.startsWith('route-')) {
    const segment = rest.slice('route-'.length);
    return {
      'Route': [
        { key: 'path', value: segment },
        { key: 'attrs', value: store.getRouteAttrs(segment) ?? {} }
      ]
    };
  }
  if (rest.startsWith('dialog-')) {
    const path = rest.slice('dialog-'.length);
    return {
      'Dialog': [
        { key: 'path', value: path },
        { key: 'attrs', value: store.getDialogAttrs(path) ?? {} }
      ]
    };
  }
  if (rest.startsWith('control-')) {
    const name = rest.slice('control-'.length);
    return {
      'Control': [
        { key: 'name', value: name },
        { key: 'attrs', value: store.getControlAttrs(name) ?? {} }
      ]
    };
  }
  return undefined;
}

/**
 * Start reporting `store` to devtools. Called by `useGlobalMicroRouter` when
 * `config.devtools` is on — the caller owns the decision, so there is no
 * self-gating here. The guard that used to stand at the top of this function
 * was substituted to a constant `false` by the library build, which is what
 * made the whole module unreachable while still shipping in the bundle.
 *
 * Registration with the devtools API happens on the first call only; later
 * routers join the inspector through {@link stores} instead of registering a
 * second plugin under the same ids.
 */
export async function setupDevtoolsPlugin(store: MicroRouterStore): Promise<void> {
  stores.add(store);

  if (registered) {
    refreshDevtoolsInspector();
    return;
  }

  let setupDevtools: any;
  try {
    // Dynamic import — @vue/devtools-api is an optional peer dependency
    const mod = await import(/* @vite-ignore */ '@vue/devtools-api');
    setupDevtools = mod.setupDevtoolsPlugin;
  } catch {
    // `config.devtools` is on, so this is a misconfiguration rather than a
    // choice — and every failure below this point is swallowed, which makes a
    // silent return the hardest possible thing to diagnose.
    console.warn(
      '[vue-micro-router] config.devtools is on but @vue/devtools-api is not installed; the inspector will not appear.'
    );
    return;
  }

  if (!setupDevtools) return;
  registered = true;

  setupDevtools(
    {
      id: 'vue-micro-router',
      label: 'Micro Router',
      packageName: 'vue-micro-router',
      homepage: 'https://github.com/danh121097/vue-micro-router'
    },
    (api: DevtoolsApi) => {
      devtoolsApi = api;

      api.addInspector({
        id: INSPECTOR_ID,
        label: 'Micro Router',
        icon: 'route'
      });

      api.addTimelineLayer({
        id: TIMELINE_LAYER_ID,
        label: 'Micro Router',
        color: 0x42b883
      });

      api.on.getInspectorTree((payload: any) => {
        if (payload.inspectorId !== INSPECTOR_ID) return;
        payload.rootNodes = inspectorRootNodes();
      });

      api.on.getInspectorState((payload: any) => {
        if (payload.inspectorId !== INSPECTOR_ID) return;
        const state = inspectorState(payload.nodeId);
        if (state) payload.state = state;
      });
    }
  );
}

/**
 * Stop reporting `store`. Without this the inspector closure keeps an unmounted
 * store — and everything its refs reach — alive for the life of the page, and
 * goes on describing a router that is no longer on screen.
 */
export function teardownDevtoolsPlugin(store: MicroRouterStore): void {
  if (!stores.delete(store)) return;

  if (stores.size > 0) {
    refreshDevtoolsInspector();
    return;
  }

  // Nothing is reporting any more, so drop the API handle rather than hold it —
  // and let a router mounted later register again from a clean slate.
  devtoolsApi = null;
  registered = false;
}
