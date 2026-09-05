/**
 * Registers a happy-dom browser environment on `globalThis` for `bun test`.
 *
 * `bun test` runs with no DOM, so mounting SFCs requires DOM globals to exist
 * before any test module is imported. This module is invoked from the preload
 * (`tests/setup-sfc.ts`) so registration happens once per test process.
 *
 * Copy rules — deliberately conservative so Bun's own runtime stays intact:
 *   - a key already present on globalThis is skipped unless it is in
 *     `FORCED_OVERRIDES`, so Bun's runtime keeps its own intrinsics;
 *   - camelCase functions are window methods and are bound to the window;
 *   - PascalCase functions are DOM interface constructors and are copied as-is
 *     so `new` and `instanceof` keep working.
 */
import { Window } from 'happy-dom';

/**
 * The only globals Bun already defines that must come from happy-dom instead:
 * the document tree the tests render into and the two objects the library
 * reads off it. Deliberately minimal — overriding `Event`/`EventTarget` too
 * would break Bun's own `instanceof` checks (`AbortSignal`, for one) for no
 * benefit, since happy-dom's event classes are reached through its elements.
 */
const FORCED_OVERRIDES = new Set(['window', 'document', 'navigator', 'location']);

/** Never copied — these are JS/Bun runtime intrinsics, not DOM surface. */
const NEVER_COPY = new Set([
  'constructor',
  'globalThis',
  'global',
  'process',
  'Buffer',
  'require',
  'module',
  'exports',
  'eval',
  'undefined'
]);

/**
 * Error constructors happy-dom reads off its own `window` (e.g. when reporting
 * an invalid `querySelectorAll` selector). A standalone `Window` leaves them
 * unset, so calls that hit an error path throw `undefined is not a constructor`
 * instead of the real DOM error.
 */
const WINDOW_INTRINSICS = {
  Error,
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError
};

let registered = false;

/** Collect own property names across the whole Window prototype chain. */
function collectWindowKeys(win: object): string[] {
  const keys = new Set<string>();
  let current: object | null = win;
  while (current && current !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(current)) keys.add(key);
    current = Object.getPrototypeOf(current);
  }
  return [...keys];
}

/** True for window methods (camelCase) as opposed to DOM constructors (PascalCase). */
function isWindowMethod(key: string, value: unknown): boolean {
  return typeof value === 'function' && /^[a-z]/.test(key);
}

/**
 * Install happy-dom globals. Idempotent — later calls are no-ops so every test
 * file in the process shares one document.
 */
export function registerDomEnvironment(): void {
  if (registered) return;

  const win = new Window({ url: 'http://localhost/' }) as Window & Record<string, unknown>;
  Object.assign(win, WINDOW_INTRINSICS);
  const target = globalThis as Record<string, unknown>;

  for (const key of collectWindowKeys(win)) {
    if (NEVER_COPY.has(key)) continue;
    if (key in target && !FORCED_OVERRIDES.has(key)) continue;

    let value: unknown;
    try {
      value = win[key];
    } catch {
      continue; // getter threw (happy-dom guards a few unimplemented props)
    }
    if (value === undefined) continue;

    target[key] = isWindowMethod(key, value)
      ? (value as (...args: unknown[]) => unknown).bind(win)
      : value;
  }

  registered = true;
}
