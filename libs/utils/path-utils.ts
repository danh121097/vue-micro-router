import { markRaw, type AsyncComponentLoader, type Component } from 'vue';

/** Ensure path starts with / */
export function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Split path into segments: "/home/missions/detail" → ["home", "missions", "detail"] */
export function parsePathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** Join segments into path: ["home", "missions"] → "/home/missions" */
export function buildPathFromSegments(segments: string[]): string {
  return `/${segments.join('/')}`;
}

/** Get last segment from path: "/home/missions/detail" → "detail" */
export function getLastSegment(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? '';
}

/** Safely mark a Vue component as raw to prevent reactivity */
export function safeMarkRaw<T extends object>(component: T): T {
  try {
    return markRaw(component) as T;
  } catch {
    return component;
  }
}

/**
 * Check if a value is an async component loader (arrow fn returning import()),
 * not a Vue component object or functional component.
 */
export function isAsyncLoader(
  component: AsyncComponentLoader | Component
): component is AsyncComponentLoader {
  return (
    typeof component === 'function' &&
    !('__name' in component) &&
    !('setup' in component) &&
    !('render' in component)
  );
}

/**
 * Pre-invoke an async loader to warm the ES module cache.
 * When defineAsyncComponent later calls the same loader, import() returns instantly.
 */
export async function warmLoaderCache(loader: AsyncComponentLoader) {
  try {
    await loader();
  } catch {
    // Silently fail — defineAsyncComponent will handle the error on render
  }
}