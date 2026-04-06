/**
 * Navigation history tracking — records the sequence of full paths visited.
 *
 * Opt-in via config.history.enabled. Tracks entries as an ordered array with cursor.
 * back()/forward()/go(delta) navigate by re-pushing stored entries via the provided push function.
 *
 * Browser-like behavior: back() + push(new) truncates forward entries.
 */
import { computed, ref, type ComputedRef } from 'vue';

export interface NavigationHistoryEntry {
  path: string;
  timestamp: number;
  props?: Record<string, unknown>;
}

export interface NavigationHistoryConfig {
  enabled?: boolean;
  maxEntries?: number;
}

export interface NavigationHistory {
  entries: ComputedRef<NavigationHistoryEntry[]>;
  canGoBack: ComputedRef<boolean>;
  canGoForward: ComputedRef<boolean>;
  /** Navigate to the previous history entry */
  back: () => Promise<void>;
  /** Navigate to the next history entry (after going back) */
  forward: () => Promise<void>;
  /** Navigate by delta: negative = back, positive = forward */
  go: (delta: number) => Promise<void>;
  /** Clear all history entries */
  clear: () => void;
  /** Record a navigation event — called internally after successful push */
  record: (path: string, props?: Record<string, unknown>) => void;
}

/**
 * Create a navigation history tracker.
 * @param config - History configuration (enabled, maxEntries)
 * @param pushFn - Function to execute navigation (bypasses isNavigating lock)
 */
export function createNavigationHistory(
  config: NavigationHistoryConfig,
  pushFn: (path: string) => Promise<void>
): NavigationHistory {
  const maxEntries = config.maxEntries ?? 50;
  const historyEntries: NavigationHistoryEntry[] = [];
  let cursor = -1;
  /** True when navigating via back/forward/go — prevents recording duplicate entries */
  let isHistoryNavigation = false;
  /** Reactive version counter — incremented on every mutation to trigger computed re-evaluation */
  const version = ref(0);

  function record(path: string, props?: Record<string, unknown>) {
    if (!config.enabled || isHistoryNavigation) return;

    // Truncate forward entries when pushing after back()
    if (cursor < historyEntries.length - 1) {
      historyEntries.splice(cursor + 1);
    }

    historyEntries.push({ path, timestamp: Date.now(), props: props ? { ...props } : undefined });
    cursor = historyEntries.length - 1;

    // FIFO eviction when exceeding maxEntries
    if (historyEntries.length > maxEntries) {
      historyEntries.shift();
      cursor--;
    }

    version.value++;
  }

  const entries = computed(() => {
    void version.value; // track reactivity
    return [...historyEntries];
  });

  const canGoBack = computed(() => {
    void version.value;
    return cursor > 0;
  });

  const canGoForward = computed(() => {
    void version.value;
    return cursor < historyEntries.length - 1;
  });

  async function navigateToEntry(index: number) {
    if (index < 0 || index >= historyEntries.length) return;
    const entry = historyEntries[index];
    if (!entry) return;

    cursor = index;
    isHistoryNavigation = true;
    version.value++;
    try {
      await pushFn(entry.path);
    } finally {
      isHistoryNavigation = false;
    }
  }

  async function back() {
    if (!canGoBack.value) return;
    await navigateToEntry(cursor - 1);
  }

  async function forward() {
    if (!canGoForward.value) return;
    await navigateToEntry(cursor + 1);
  }

  async function go(delta: number) {
    const target = cursor + delta;
    await navigateToEntry(target);
  }

  function clear() {
    historyEntries.length = 0;
    cursor = -1;
    version.value++;
  }

  return { entries, canGoBack, canGoForward, back, forward, go, clear, record };
}
