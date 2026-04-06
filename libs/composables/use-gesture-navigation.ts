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
  /** The DOM element to attach gesture listeners to */
  containerRef: Ref<HTMLElement | null>;
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

  function getPages(): { current: HTMLElement | null; previous: HTMLElement | null } {
    const container = ctx.containerRef.value;
    if (!container) return { current: null, previous: null };
    const pages = container.querySelectorAll<HTMLElement>('.route-page');
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

    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    currentPage = current;
    prevPage = previous;

    // Capture pointer to keep receiving events even if pointer leaves the element
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);

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

    const progress = deltaX / window.innerWidth;
    currentPage.style.transform = `translateX(${deltaX}px)`;

    if (prevPage) {
      // Previous page peeks from -20% toward 0%
      const prevOffset = -20 + (20 * progress);
      prevPage.style.transform = `translateX(${prevOffset}%)`;
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!tracking || !currentPage) return;

    const deltaX = e.clientX - startX;
    const elapsed = Date.now() - startTime;
    const velocity = deltaX / elapsed; // px/ms
    const progress = deltaX / window.innerWidth;

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
      setTimeout(() => {
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
      setTimeout(resetStyles, 200);
    }

    tracking = false;
  }

  function cancelGesture() {
    if (!tracking) return;
    if (currentPage) {
      currentPage.style.transition = 'transform 0.15s ease-out';
      currentPage.style.transform = 'translateX(0)';
    }
    if (prevPage) {
      prevPage.style.transition = 'transform 0.15s ease-out';
      prevPage.style.transform = 'translateX(-20%)';
    }
    setTimeout(resetStyles, 150);
    tracking = false;
  }

  function resetStyles() {
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

  onMounted(() => {
    const el = ctx.containerRef.value;
    if (!el) return;
    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('pointercancel', cancelGesture, { passive: true });
  });

  onBeforeUnmount(() => {
    const el = ctx.containerRef.value;
    if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', cancelGesture);
  });
}
