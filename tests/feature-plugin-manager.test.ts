import { describe, expect, mock, test } from 'bun:test';

import {
  defineFeaturePlugin,
  registerFeaturePlugins,
} from '../libs/plugins/feature-plugin-manager';
import type { MicroRouterStore } from '../libs/core/types';

describe('defineFeaturePlugin', () => {
  test('returns plugin config as-is', () => {
    const config = {
      name: 'test-plugin',
      routes: [{ path: 'test', component: {}, attrs: {} }],
    };
    const plugin = defineFeaturePlugin(config as any);
    expect(plugin.name).toBe('test-plugin');
    expect(plugin.routes).toHaveLength(1);
  });
});

describe('registerFeaturePlugins', () => {
  test('registers routes, dialogs, and controls', () => {
    const registerRoutes = mock(() => {});
    const registerDialogs = mock(() => {});
    const registerControls = mock(() => {});

    const store = {
      registerRoutes,
      registerDialogs,
      registerControls,
    } as unknown as MicroRouterStore;

    const plugins = [
      defineFeaturePlugin({
        name: 'plugin-a',
        routes: [{ path: 'a', component: {} }] as any,
        dialogs: [{ path: 'dialog-a', component: {}, activated: false }] as any,
      }),
      defineFeaturePlugin({
        name: 'plugin-b',
        controls: [{ name: 'ctrl-b', component: {}, activated: false }] as any,
      }),
    ];

    registerFeaturePlugins(plugins, store);

    expect(registerRoutes).toHaveBeenCalledTimes(1);
    expect(registerDialogs).toHaveBeenCalledTimes(1);
    expect(registerControls).toHaveBeenCalledTimes(1);
  });

  test('skips empty arrays', () => {
    const registerRoutes = mock(() => {});
    const registerDialogs = mock(() => {});
    const registerControls = mock(() => {});

    const store = {
      registerRoutes,
      registerDialogs,
      registerControls,
    } as unknown as MicroRouterStore;

    registerFeaturePlugins(
      [defineFeaturePlugin({ name: 'empty' })],
      store,
    );

    expect(registerRoutes).not.toHaveBeenCalled();
    expect(registerDialogs).not.toHaveBeenCalled();
    expect(registerControls).not.toHaveBeenCalled();
  });
});
