/**
 * Injection keys and default constants for the micro-router system.
 *
 * Injection key pairs follow a read/write pattern:
 *   - MICRO_ATTRS_READ_KEY  → getter injected by RoutePage / MicroDialog / MicroControlWrapper
 *   - MICRO_ATTRS_WRITE_KEY → setter injected alongside the getter
 */
import type { InjectionKey } from 'vue';

import type { MicroRouterStore } from './types';

/** Default inject/provide key for the MicroRouterStore — used by useGlobalMicroRouter / useMicroRouter */
export const MICRO_ROUTER_KEY: InjectionKey<MicroRouterStore> =
  Symbol('micro-router');

/** Factory to create unique injection keys for nested routers */
export function createRouterKey(): InjectionKey<MicroRouterStore> {
  return Symbol('micro-router-nested');
}

/** Inject/provide key for the ROOT router — always points to the outermost MicroRouterView */
export const MICRO_ROUTER_ROOT_KEY: InjectionKey<MicroRouterStore> =
  Symbol('micro-router-root');

/** Inject/provide key for the current route path — injected per RoutePage slot for useRouteLifecycle */
export const MICRO_ROUTE_PATH_KEY: InjectionKey<string> =
  Symbol('micro-route-path');

/** Inject/provide key for the current dialog path — injected per MicroDialog for useDialogLifecycle */
export const MICRO_DIALOG_PATH_KEY: InjectionKey<string> =
  Symbol('micro-dialog-path');

/** Inject/provide key for the current control name — injected per MicroControlWrapper for useControlLifecycle */
export const MICRO_CONTROL_NAME_KEY: InjectionKey<string> =
  Symbol('micro-control-name');

/** Inject/provide key for reading attrs — consumed by useMicroState to read parent-injected props */
export const MICRO_ATTRS_READ_KEY: InjectionKey<
  () => Record<string, unknown> | undefined
> = Symbol('micro-attrs-read');

/** Inject/provide key for writing attrs — consumed by useMicroState to sync mutations back to store */
export const MICRO_ATTRS_WRITE_KEY: InjectionKey<
  (attrs: Record<string, unknown>) => void
> = Symbol('micro-attrs-write');

/** Default delay (ms) between step-wise navigation transitions and navigation lock release */
export const STEP_DELAY = 600;
