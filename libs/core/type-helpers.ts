/**
 * Type-level helpers for opt-in route type safety.
 *
 * Users define a RouteMap interface mapping route names to their expected props.
 * When passed as a generic to useMicroRouter<T>(), push() validates route names and props at compile time.
 *
 * Untyped usage (no generic) continues to work with loose string types.
 *
 * @example
 * ```ts
 * interface AppRoutes {
 *   home: undefined;
 *   profile: { userId: number };
 *   settings: { tab?: string };
 * }
 *
 * const router = useMicroRouter<AppRoutes>();
 * router.push('profile', { userId: 42 }); // OK
 * router.push('profile');                  // Error: missing props
 * router.push('typo');                     // Error: not in AppRoutes
 * ```
 */

/** Route map: keys are route segment names, values are props type or undefined (no props) */
export type RouteMap = Record<string, Record<string, unknown> | undefined>;

/** Extract route names that require props (value is not undefined) */
export type RoutesWithProps<T extends RouteMap> = {
  [K in keyof T]: T[K] extends undefined ? never : K;
}[keyof T];

/** Extract route names that don't require props (value is undefined) */
export type RoutesWithoutProps<T extends RouteMap> = {
  [K in keyof T]: T[K] extends undefined ? K : never;
}[keyof T];

/**
 * Typed push overloads:
 * - Routes with undefined props: push('home') — no props required
 * - Routes with props: push('profile', { userId: 42 }) — props required
 * - Numeric back navigation: push(-1) — always allowed
 */
export interface TypedPush<T extends RouteMap> {
  (destination: RoutesWithoutProps<T>): Promise<void>;
  <K extends RoutesWithProps<T>>(destination: K, props: T[K]): Promise<void>;
  (destination: number): Promise<void>;
  /** Absolute path — loose string, not validated against route map */
  (destination: `/${string}`, props?: Record<string, unknown>): Promise<void>;
}
