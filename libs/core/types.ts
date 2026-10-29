/**
 * Central type definitions for the micro-router system.
 *
 * Three first-class concepts:
 *   - MicroRoute   → a page rendered inside the page stack
 *   - MicroDialog  → a modal overlay rendered on top of the page stack
 *   - MicroControl → a persistent GUI overlay (e.g. main_gui, inventory)
 */
import type { AsyncComponentLoader, Component, ComputedRef, Ref } from 'vue';

// ── Navigation Guards ─────────────────────────────────────────────────────────

/**
 * Guard called before navigation. Return false (or resolve to false) to cancel.
 * @param to - target path
 * @param from - current path
 */
export type NavigationGuard = (
  to: string,
  from: string,
) => boolean | Promise<boolean>;

/**
 * Hook called after navigation completes. Cannot cancel — purely observational.
 */
export type NavigationAfterHook = (to: string, from: string) => void;

// ── Enums & Literals ──────────────────────────────────────────────────────────

export type TransitionType = 'fade' | 'slide' | 'scale';

/** Kind of a page navigation — `'replace'` swaps the top page and still slides forward */
export type NavigationKind = 'push' | 'back' | 'replace';

export type DialogPosition = 'standard' | 'top' | 'right' | 'bottom' | 'left';

/**
 * Free-form data attached to a route, dialog or control definition. The router
 * never reads it: it is handed back on every {@link TrackerEvent} and by
 * `getRegistry()`, so analytics names, opt-outs or owners live next to the
 * definition they describe.
 */
export type MicroMeta = Record<string, unknown>;

// ── Route ─────────────────────────────────────────────────────────────────────

export interface MicroRoute {
  /** Unique segment name, e.g. "home", "settings" — used in path like "home/settings" */
  path: string;
  /** Vue component or async loader (() => import('./MyPage.vue')) */
  component: AsyncComponentLoader | Component;
  /** Props passed to the component via useMicroState */
  attrs?: Record<string, unknown>;
  /** Background music track name — resolved by audio manager's urlResolver */
  bgm?: string;
  /** Preloading strategy: 'eager' (on mount), 'adjacent' (after each nav), false (default) */
  preload?: 'eager' | 'adjacent' | false;
  /** Page transition type: 'slide' (default), 'fade', or 'none' to disable */
  transition?: TransitionType | 'none';
  /** Custom transition duration in ms. Defaults: slide=500ms, fade=300ms */
  transitionDuration?: number;
  /** Guard called before navigating TO this route. Return false to cancel. */
  beforeEnter?: NavigationGuard;
  /** Guard called before navigating AWAY from this route. Return false to cancel. */
  beforeLeave?: NavigationGuard;
  /** Free-form data — passed to `tracker.onEvent` and `getRegistry()`, never read by the router */
  meta?: MicroMeta;
  /** Internal: cache key for transition identity */
  key?: string;
  /** Internal: incremented to force full component remount */
  componentKey?: number;
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export interface MicroDialog {
  /** Unique dialog identifier, e.g. "confirm", "settings-modal" */
  path: string;
  /** Vue component or async loader */
  component: AsyncComponentLoader | Component;
  /** Whether the dialog is currently visible */
  activated: boolean;
  /** True during exit animation — keeps dialog in DOM until animation completes */
  closing?: boolean;
  /** Render dialog at full viewport size */
  fullscreen?: boolean;
  /** If true, clicking backdrop or pressing Escape won't close the dialog */
  persistent?: boolean;
  /** Props passed to the component, includes injected onClose callback */
  attrs?: Record<string, unknown>;
  /** Where the dialog appears: 'standard' (center), 'top', 'right', 'bottom', 'left' */
  position?: DialogPosition;
  /** Custom transition duration in ms. Defaults: slide=500ms, fade/scale=300ms */
  transitionDuration?: number;
  /** Animation type: 'fade' (pure opacity), 'scale' (pop), 'slide' (page-style) */
  transition?: TransitionType;
  /** If true, dialog has no backdrop overlay (see-through to app behind). Default: false */
  seamless?: boolean;
  /** Prime mobile keyboard on open — set true for dialogs with autofocus inputs */
  focusInput?: boolean;
  /** Free-form data — passed to `tracker.onEvent` and `getRegistry()`, never read by the router */
  meta?: MicroMeta;
  /** Internal: incremented on each open to force component remount */
  componentKey?: number;
}

export interface DialogProps {
  path: string;
  open?: boolean;
  attrs?: Record<string, unknown>;
}

export interface DialogInstance {
  path: string;
  attrs?: Record<string, unknown>;
}

// ── Control ───────────────────────────────────────────────────────────────────

export interface MicroControl {
  /** Unique control name, e.g. "main_gui", "inventory" */
  name: string;
  /** Whether the control overlay is currently visible */
  activated: boolean;
  /** Vue component or async loader */
  component: AsyncComponentLoader | Component;
  /** Props passed to the component */
  attrs?: Record<string, unknown>;
  /** Free-form data — passed to `tracker.onEvent` and `getRegistry()`, never read by the router */
  meta?: MicroMeta;
  /** Internal: incremented on each activation to force component remount */
  componentKey?: number;
}

// ── Page Tracker ──────────────────────────────────────────────────────────────

/** What a {@link TrackerEvent} is about */
export type TrackerEventKind = 'page' | 'dialog' | 'control';

/**
 * - `enter` / `leave` — the page, dialog or control was mounted into / removed
 *   from its stack (for a control: activated / deactivated).
 * - `cover` / `uncover` — it stays mounted but another one of the same kind
 *   went on top of it / the one on top of it went away. Pages cover pages and
 *   dialogs cover dialogs; nothing covers across kinds, and controls never
 *   cover.
 */
export type TrackerEventPhase = 'enter' | 'leave' | 'cover' | 'uncover';

/**
 * Why a page, dialog or control left (only on `leave` events).
 *
 * - `escape` / `backdrop` — the dialog closed itself on Escape or a backdrop
 *   click (never for a `persistent` dialog).
 * - `close_button` — the caller said so: `closeDialog(path, 'close_button')`.
 * - `gesture` — the page left on the swipe-back gesture.
 * - `replace` — `replace()` swapped the page out, or another control took
 *   this control's place.
 * - `programmatic` — anything else: `push`, `closeDialog(path)`,
 *   `closeAllDialogs()`, the dialog's injected `onClose`, `toggleControl(name, false)`.
 */
export type CloseReason =
  | 'close_button'
  | 'backdrop'
  | 'escape'
  | 'gesture'
  | 'programmatic'
  | 'replace';

/**
 * One change to the page stack, the dialog stack or the active controls,
 * delivered to `tracker.onEvent`. Within one change, leaves come first; a page
 * is covered only after its own enter.
 */
export interface TrackerEvent {
  kind: TrackerEventKind;
  phase: TrackerEventPhase;
  /** Route segment, dialog path or control name */
  name: string;
  /**
   * Pages: the full path of this page in the stack (`/home/menu` for `menu`).
   * Dialogs and controls: same as `name`.
   */
  path: string;
  /**
   * State before → after the change. Pages: the active path. Dialogs: the
   * top dialog (`''` when none). Controls: `currentControl` (`''` when none
   * is active).
   */
  from: string;
  to: string;
  /** Page events only: the kind of navigation that caused it */
  navigationKind?: NavigationKind;
  /** `leave` events only */
  closeReason?: CloseReason;
  /** The definition's `meta`, when it has one */
  meta?: MicroMeta;
}

export interface PageTrackerHooks {
  /**
   * Every page, dialog and control change, with the close reason and the
   * definition's `meta`. Additive: the `track*` hooks below still fire. A throw
   * is caught and logged, never breaking navigation.
   */
  onEvent?: (event: TrackerEvent) => void;
  trackPageEnter?: (page: string, from?: string, to?: string) => void;
  trackPageLeave?: (page: string, from?: string, to?: string) => void;
  trackDialogEnter?: (dialog: string, from?: string, to?: string) => void;
  trackDialogLeave?: (dialog: string, from?: string, to?: string) => void;
  trackGuiEnter?: (name: string) => void;
  trackGuiLeave?: (name: string) => void;
  cleanupAllSessions?: () => void;
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface MicroRouterConfig {
  /** Initial page path on mount — must match a registered route segment */
  defaultPath: string;
  /** Delay between step-wise navigation transitions in ms. Defaults to 600 */
  stepDelay?: number;
  /** Name of the default GUI control — auto-activated on mount, auto-restored on deactivate */
  defaultControlName: string;
  /** Name of the onboarding control (exempt from auto-restore). Optional — only needed for onboarding flows. */
  onboardingControlName?: string;
  /** Navigation history tracking — opt-in, records sequence of paths visited */
  history?: {
    enabled?: boolean;
    /** Max entries before FIFO eviction. Default: 50 */
    maxEntries?: number;
  };
  /** Swipe-back gesture navigation config (opt-in) */
  gesture?: {
    enabled?: boolean;
    edgeWidth?: number;
    threshold?: number;
    velocityThreshold?: number;
  };
  /** Navigation guard hooks — beforeEach runs before every navigation, afterEach runs after */
  guards?: {
    beforeEach?: NavigationGuard[];
    afterEach?: NavigationAfterHook[];
  };
  /** Analytics hooks for page/dialog/control enter/leave events */
  tracker?: PageTrackerHooks;
  /** Reactive volume ref (0-100) for audio manager. Enables built-in BGM when provided. */
  volumeRef?: Ref<number>;
  /** Default BGM audio path — used as initial track and fallback when route has no bgm field. Example: '/audios/default.mp3' */
  defaultBgm?: string;
  /** Set to true (in a user gesture handler) to start default BGM. Watched with flush:'sync' to preserve gesture context for autoplay policy. */
  bgmStartRef?: Ref<boolean>;
  /**
   * Vue Devtools inspector and timeline — opt-in, development only.
   *
   * Loaded with a dynamic `import()`, so the inspector ships as its own chunk
   * and is never fetched while this is off. Also needs `@vue/devtools-api`
   * installed (optional peer dependency); without it the load no-ops.
   */
  devtools?: boolean;
}

// ── Serialized State ─────────────────────────────────────────────────────────

export interface SerializedState {
  /** Schema version for future migration support */
  version: 1;
  navigation: {
    activePath: string;
    routeAttrs: Record<string, Record<string, unknown>>;
  };
  dialogs: {
    /** Open dialog paths in stack order */
    stack: string[];
    attrs: Record<string, Record<string, unknown>>;
  };
  controls: {
    /** Active control names */
    active: string[];
    attrs: Record<string, Record<string, unknown>>;
  };
}

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Plain snapshot of what is registered on a router, from `getRegistry()`.
 * In registration order; components and runtime state are left out.
 */
export interface MicroRouterRegistry {
  routes: Array<{ path: string; meta?: MicroMeta }>;
  dialogs: Array<{ path: string; meta?: MicroMeta }>;
  controls: Array<{ name: string; meta?: MicroMeta }>;
}

// ── Feature Plugin ────────────────────────────────────────────────────────────

/**
 * Bundle of routes, dialogs, and controls to register as a single feature.
 *
 * @example
 * ```ts
 * const shopPlugin = defineFeaturePlugin({
 *   name: 'shop',
 *   routes: [{ path: 'shop', component: ShopPage }],
 *   dialogs: [{ path: 'buy-confirm', component: BuyDialog, activated: false }],
 * });
 * ```
 */
export interface FeaturePluginConfig {
  name: string;
  routes?: MicroRoute[];
  dialogs?: MicroDialog[];
  controls?: MicroControl[];
}

export type FeaturePlugin = FeaturePluginConfig;

// ── Store ─────────────────────────────────────────────────────────────────────

/**
 * Main store interface — injected by useMicroRouter(), provided by useGlobalMicroRouter().
 * Contains all navigation, dialog, control, and optional audio APIs.
 */
export interface MicroRouterStore {
  // ── Navigation ────────────────────────────────────────────────────────────
  /** Current full path, e.g. "/home/menu/settings" */
  activePath: ComputedRef<string>;
  fromPath: ComputedRef<string>;
  toPath: ComputedRef<string>;
  activePage: ComputedRef<string>;
  fromPage: ComputedRef<string>;
  toPage: ComputedRef<string>;
  /** True while a navigation animation (push/replace/stepWisePush/stepWiseBack) is in progress */
  isNavigating: ComputedRef<boolean>;
  /**
   * Kind of the last navigation: `'push'` (forward), `'back'`, or `'replace'`.
   * `MicroRouterView` reads it to pick the slide direction.
   */
  navigationKind: ComputedRef<NavigationKind>;
  resolveRoutes: ComputedRef<MicroRoute[]>;
  /**
   * Navigate to a destination. Guarded against rapid double-clicks.
   * @param destination - Relative segment ("menu"), absolute path ("/home/menu"), or negative number (-1 = back)
   * @param props - Optional attrs to pass to the target page via useMicroState
   */
  push: (
    destination: string | number,
    props?: Record<string, unknown>
  ) => Promise<void>;
  /**
   * Swap the top page for another route and animate forward: the new page
   * slides in over the old one, which stays put. Back from the new page returns
   * to the page under it. With history enabled the current entry is replaced.
   * Same lock, guards and afterEach as push.
   * @param segment - Route segment name that takes the top page's place ("result")
   * @param props - Optional attrs to pass to the new page via useMicroState
   */
  replace: (
    segment: string,
    props?: Record<string, unknown>
  ) => Promise<void>;
  /** Navigate through intermediate pages one-by-one with stepDelay between each */
  stepWisePush: (
    targetPath: string,
    props?: Record<string, unknown>
  ) => Promise<void>;
  /** Go back N steps, animating through each intermediate page */
  stepWiseBack: (steps: number) => Promise<void>;
  registerRoute: (route: MicroRoute) => void;
  registerRoutes: (routes: MicroRoute[]) => void;
  /** Merge attrs into a segment and notify readers — the mounted page re-renders. */
  updateRouteAttrs: (segment: string, attrs: Record<string, unknown>) => void;
  /**
   * Merge attrs into a segment for persistence only — no reactive notification,
   * so a mounted page is not re-rendered with props it already holds. This is
   * the path `useMicroState` writes back on; use `updateRouteAttrs` when the
   * page must see the change.
   */
  persistRouteAttrs: (segment: string, attrs: Record<string, unknown>) => void;
  /**
   * The stored attrs object for a segment — live, not a snapshot:
   * `persistRouteAttrs` merges into it in place. Copy it if you need to keep it.
   */
  getRouteAttrs: (segment: string) => Record<string, unknown> | undefined;
  /** Manually preload an async route component by segment name */
  preloadRoute: (segment: string) => Promise<void>;

  // ── Dialogs ──────────────────────────────────────────────────────────────
  /** Path of the topmost open dialog, or "" if none */
  activeDialog: ComputedRef<string>;
  fromDialog: ComputedRef<string>;
  toDialog: ComputedRef<string>;
  resolveDialogs: ComputedRef<MicroDialog[]>;
  /** Open a dialog by path. Returns a DialogInstance handle. Props available via useMicroState inside the dialog. */
  openDialog: (path: string, props?: Record<string, unknown>) => DialogInstance;
  /**
   * Close a specific dialog by path. Triggers exit animation.
   * @param reason - Reported as `closeReason` on `tracker.onEvent`. Default `'programmatic'`;
   *   pass `'close_button'` from a dialog's own close button.
   */
  closeDialog: (path: string, reason?: CloseReason) => void;
  /** Close all open dialogs at once. Invokes onClose callbacks after DOM updates. */
  closeAllDialogs: () => void;
  registerDialog: (dialog: MicroDialog) => void;
  registerDialogs: (dialogs: MicroDialog[]) => void;
  getDialogAttrs: (path: string) => Record<string, unknown> | undefined;
  updateDialogAttrs: (path: string, attrs: Record<string, unknown>) => void;

  // ── Controls ─────────────────────────────────────────────────────────────
  /** All currently activated controls */
  resolveControls: ComputedRef<MicroControl[]>;
  activeControl: ComputedRef<boolean>;
  currentControl: ComputedRef<string>;
  /**
   * Activate or deactivate a GUI control by name.
   * Activating a non-default control auto-hides the default GUI.
   * Deactivating a non-default control auto-restores the default GUI.
   */
  toggleControl: (
    name: string,
    active: boolean,
    attrs?: Record<string, unknown>
  ) => void;
  registerControl: (control: MicroControl) => void;
  registerControls: (controls: MicroControl[]) => void;
  getControlAttrs: (name: string) => Record<string, unknown> | undefined;
  updateControlAttrs: (name: string, attrs: Record<string, unknown>) => void;

  // ── Registry ─────────────────────────────────────────────────────────────
  /** Snapshot of the registered routes, dialogs and controls with their `meta` */
  getRegistry: () => MicroRouterRegistry;

  // ── History (only present when config.history.enabled) ────────────────────
  /** Whether there's a previous entry to go back to */
  canGoBack?: ComputedRef<boolean>;
  /** Whether there's a forward entry (after going back) */
  canGoForward?: ComputedRef<boolean>;
  /** Navigate to previous history entry */
  historyBack?: () => Promise<void>;
  /** Navigate to next history entry */
  historyForward?: () => Promise<void>;
  /** Navigate by delta in history */
  historyGo?: (delta: number) => Promise<void>;

  // ── Serialization ────────────────────────────────────────────────────────
  /** Serialize current router state to a JSON-safe object */
  serialize?: () => SerializedState;
  /** Restore router state from a serialized snapshot */
  restore?: (state: SerializedState) => Promise<void>;

  // Audio (only present when audio sub-path is used)
  playSound?: (soundSrc: string, loop?: boolean) => Promise<void>;
  stopSound?: () => void;
  pauseSound?: () => void;
  resumeSound?: () => void;
  updateBackgroundMusic?: (route: string) => Promise<void>;
}
