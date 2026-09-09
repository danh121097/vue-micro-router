/**
 * Gesture navigation — swipe-back from left edge to go back.
 *
 * Pointer-event based for cross-platform support (touch + mouse).
 * Threshold-based: <30% swipe snaps back, >30% completes navigation.
 * Fast swipe (velocity threshold) always triggers.
 *
 * Integrates with push(-1) for back navigation — guards are respected.
 */
import { onBeforeUnmount, onMounted, type Ref } from 'vue';

export interface GestureConfig {
  /** Enable gesture navigation. Default: false */
  enabled?: boolean;
  /** Pixels from left edge that starts gesture. Default: 20 */
  edgeWidth?: number;
  /** Percentage (0-1) to trigger navigation. Default: 0.3 */
  threshold?: number;
  /** px/ms — fast swipe always triggers. Default: 0.5 */
  velocityThreshold?: number;
}

interface GestureContext {
  /** The DOM element or Vue component instance ref to attach gesture listeners to */
  containerRef: Ref<HTMLElement | Record<string, unknown> | null>;
  /** Go back one step — respects guards */
  goBack: () => Promise<void>;
  /** Check if there's a page to go back to */
  canGoBack: () => boolean;
}

export function useGestureNavigation(
  config: GestureConfig,
  ctx: GestureContext
): void {
  if (!config.enabled) return;

  const edgeWidth = config.edgeWidth ?? 20;
  const threshold = config.threshold ?? 0.3;
  const velocityThreshold = config.velocityThreshold ?? 0.5;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let tracking = false;
  let currentPage: HTMLElement | null = null;
  let prevPage: HTMLElement | null = null;

  /**
   * Viewport width, read once per gesture.
   *
   * It cannot change mid-drag, and reading it in `onPointerMove` put a layout
   * read between two `style.transform` writes on every single move — a forced
   * synchronous layout for the whole length of the drag.
   */
  let viewportWidth = 0;

  /** Pending drag distance, applied on the next frame rather than per move. */
  let pendingDeltaX = 0;
  let frameHandle: number | null = null;

  /**
   * The settle timer that resets inline styles once the release animation ends.
   *
   * Tracked so it can be cancelled: a second gesture started inside that window
   * would otherwise have its page's styles wiped and `currentPage` nulled by the
   * previous gesture's timer, and a timer left running past unmount would call
   * `goBack()` on a store whose view is gone.
   */
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearSettleTimer() {
    if (settleTimer === null) return;
    clearTimeout(settleTimer);
    settleTimer = null;
  }

  function scheduleSettle(fn: () => void, ms: number) {
    clearSettleTimer();
    settleTimer = setTimeout(() => {
      settleTimer = null;
      fn();
    }, ms);
  }

  /**
   * The element the listeners are bound to, kept so unbinding uses the same one
   * even if the ref has already been torn down.
   */
  let boundEl: HTMLElement | null = null;

  /**
   * Resolve the actual DOM element — handles raw HTMLElement refs and Vue
   * component instance refs (`$el`).
   *
   * `MicroRouterView` gives its `<TransitionGroup>` a `tag`, so `$el` is the
   * page-stack element. Without one, TransitionGroup renders a fragment and
   * `$el` is the fragment's anchor **text node** — which is an `EventTarget`,
   * so binding succeeds silently, but a text node never receives pointer
   * events and the gesture could not fire at all. Falling back to the anchor's
   * parent is not a fix: that is the element the consumer mounted the app into,
   * which pulls in sibling layers and, for nested routers, the wrong pages.
   */
  function resolveElement(): HTMLElement | null {
    const ref = ctx.containerRef.value;
    if (!ref) return null;
    const node = ('$el' in ref ? (ref as any).$el : ref) as Node | null;
    if (!node || node.nodeType !== 1) return null;
    return node as HTMLElement;
  }

  function getPages(): { current: HTMLElement | null; previous: HTMLElement | null } {
    const container = resolveElement();
    if (!container) return { current: null, previous: null };
    // `:scope >` matters: a page hosting a nested router contains that router's
    // pages too, and an unscoped query would hand this router the inner
    // router's page as `current` and its own host page as `previous`.
    const pages = container.querySelectorAll<HTMLElement>(':scope > .route-page');
    if (pages.length < 2) return { current: pages[pages.length - 1] ?? null, previous: null };
    return {
      current: pages[pages.length - 1]!,
      previous: pages[pages.length - 2]!
    };
  }

  function onPointerDown(e: PointerEvent) {
    if (!ctx.canGoBack() || e.clientX > edgeWidth) return;
    const { current, previous } = getPages();
    if (!current) return;

    clearSettleTimer();
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    currentPage = current;
    prevPage = previous;
    viewportWidth = window.innerWidth;
    pendingDeltaX = 0;
    bindDragListeners();

    // Capture pointer on container to keep receiving events even if child elements change
    const container = resolveElement();
    container?.setPointerCapture?.(e.pointerId);

    currentPage.style.willChange = 'transform';
    if (prevPage) {
      prevPage.style.willChange = 'transform';
      prevPage.style.transition = 'none';
    }
    currentPage.style.transition = 'none';
  }

  function onPointerMove(e: PointerEvent) {
    if (!tracking || !currentPage) return;

    const deltaX = Math.max(0, e.clientX - startX);
    const deltaY = Math.abs(e.clientY - startY);

    // Cancel if vertical scroll dominates
    if (deltaY > deltaX * 1.5) {
      cancelGesture();
      return;
    }

    // A pointer can fire several moves per frame; only the last one is visible.
    // Recording the position and painting once per frame keeps the write count
    // tied to frames rather than to event count.
    pendingDeltaX = deltaX;
    if (frameHandle === null) {
      frameHandle = requestAnimationFrame(paintDrag);
    }
  }

  function paintDrag() {
    frameHandle = null;
    if (!tracking || !currentPage) return;

    currentPage.style.transform = `translateX(${pendingDeltaX}px)`;

    if (prevPage) {
      // Previous page peeks from -20% toward 0%
      const progress = viewportWidth > 0 ? pendingDeltaX / viewportWidth : 0;
      const prevOffset = -20 + (20 * progress);
      prevPage.style.transform = `translateX(${prevOffset}%)`;
    }
  }

  function cancelPendingFrame() {
    if (frameHandle === null) return;
    cancelAnimationFrame(frameHandle);
    frameHandle = null;
  }

  function onPointerUp(e: PointerEvent) {
    if (!tracking || !currentPage) {
      // Leaving `tracking` set here would strand the gesture in a half-armed
      // state until the next pointerdown happened to clear it.
      tracking = false;
      unbindDragListeners();
      return;
    }
    cancelPendingFrame();
    unbindDragListeners();
    // Validate DOM refs are still connected (Vue may have re-rendered)
    if (!currentPage.isConnected) { resetStyles(); tracking = false; return; }

    const deltaX = e.clientX - startX;
    const elapsed = Date.now() - startTime;
    const velocity = deltaX / elapsed; // px/ms
    const progress = viewportWidth > 0 ? deltaX / viewportWidth : 0;

    const shouldNavigate = progress > threshold || velocity > velocityThreshold;

    if (shouldNavigate) {
      // Complete: slide current page fully off-screen
      currentPage.style.transition = 'transform 0.2s ease-out';
      currentPage.style.transform = 'translateX(100%)';
      if (prevPage) {
        prevPage.style.transition = 'transform 0.2s ease-out';
        prevPage.style.transform = 'translateX(0)';
      }
      // Execute back navigation after animation
      scheduleSettle(() => {
        resetStyles();
        ctx.goBack();
      }, 200);
    } else {
      // Revert: snap back
      currentPage.style.transition = 'transform 0.2s ease-out';
      currentPage.style.transform = 'translateX(0)';
      if (prevPage) {
        prevPage.style.transition = 'transform 0.2s ease-out';
        prevPage.style.transform = 'translateX(-20%)';
      }
      scheduleSettle(resetStyles, 200);
    }

    tracking = false;
  }

  function cancelGesture() {
    cancelPendingFrame();
    unbindDragListeners();
    if (!tracking) return;
    if (currentPage) {
      currentPage.style.transition = 'transform 0.15s ease-out';
      currentPage.style.transform = 'translateX(0)';
    }
    if (prevPage) {
      prevPage.style.transition = 'transform 0.15s ease-out';
      prevPage.style.transform = 'translateX(-20%)';
    }
    scheduleSettle(resetStyles, 150);
    tracking = false;
  }

  function resetStyles() {
    cancelPendingFrame();
    if (currentPage) {
      currentPage.style.willChange = '';
      currentPage.style.transition = '';
      currentPage.style.transform = '';
    }
    if (prevPage) {
      prevPage.style.willChange = '';
      prevPage.style.transition = '';
      prevPage.style.transform = '';
    }
    currentPage = null;
    prevPage = null;
  }

  /**
   * `pointermove` fires continuously whenever a pointer is over the container,
   * dragging or not. Binding it only for the length of a gesture keeps the
   * handler off the hot path for every ordinary scroll and mouse move.
   */
  function bindDragListeners() {
    if (!boundEl) return;
    boundEl.addEventListener('pointermove', onPointerMove, { passive: true });
    boundEl.addEventListener('pointerup', onPointerUp, { passive: true });
    boundEl.addEventListener('pointercancel', cancelGesture, { passive: true });
  }

  function unbindDragListeners() {
    if (!boundEl) return;
    boundEl.removeEventListener('pointermove', onPointerMove);
    boundEl.removeEventListener('pointerup', onPointerUp);
    boundEl.removeEventListener('pointercancel', cancelGesture);
  }

  onMounted(() => {
    const el = resolveElement();
    if (!el?.addEventListener) return;
    boundEl = el;
    el.addEventListener('pointerdown', onPointerDown, { passive: true });
  });

  onBeforeUnmount(() => {
    cancelPendingFrame();
    clearSettleTimer();
    if (!boundEl?.removeEventListener) return;
    boundEl.removeEventListener('pointerdown', onPointerDown);
    unbindDragListeners();
    boundEl = null;
  });
}
