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

export type DialogPosition = 'standard' | 'top' | 'right' | 'bottom' | 'left';

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
  /** Animation type: 'fade' (scale+fade), 'scale' (pop), 'slide' (page-style) */
  transition?: TransitionType;
  /** If true (default), dialog has transparent background and no shadow */
  seamless?: boolean;
  /** Prime mobile keyboard on open — set true for dialogs with autofocus inputs */
  focusInput?: boolean;
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
  /** Internal: incremented on each activation to force component remount */
  componentKey?: number;
}

// ── Page Tracker ──────────────────────────────────────────────────────────────

export interface PageTrackerHooks {
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
  /** Navigate through intermediate pages one-by-one with stepDelay between each */
  stepWisePush: (
    targetPath: string,
    props?: Record<string, unknown>
  ) => Promise<void>;
  /** Go back N steps, animating through each intermediate page */
  stepWiseBack: (steps: number) => Promise<void>;
  registerRoute: (route: MicroRoute) => void;
  registerRoutes: (routes: MicroRoute[]) => void;
  updateRouteAttrs: (segment: string, attrs: Record<string, unknown>) => void;
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
  /** Close a specific dialog by path. Triggers exit animation. */
  closeDialog: (path: string) => void;
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
  updateBackgroundMusic?: (route: string) => Promise<void>;
}
