/**
 * Type-level tests for the Register pattern.
 * These tests verify compile-time behavior — they don't run runtime assertions.
 * If this file compiles, the types are correct.
 */
import { describe, test, expect } from 'bun:test';
import type {
  Register,
  HasRegisteredPlugin,
  ExtractRoutePaths,
  ExtractDialogPaths,
  ExtractControlNames,
  PluginTypedStepWisePush,
  PluginTypedReplace,
  TypedReplace,
} from '../libs/core/type-helpers';

/* ── Helpers ── */
type _Expect<T extends true> = T;
type _Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;

describe('Register type helpers', () => {
  test('Register is exported and augmentable', () => {
    const _check = {} as Register;
    expect(_check).toBeDefined();
  });

  test('HasRegisteredPlugin reflects augmentation state', () => {
    // True when Register is augmented (app-plugin.ts augments it in this project)
    type _Check = _Expect<_Equal<HasRegisteredPlugin, true>>;
    expect(true).toBe(true);
  });

  test('ExtractRoutePaths extracts literal path strings', () => {
    const _plugin = {
      name: 'test',
      routes: [
        { path: 'home' as const, component: {} },
        { path: 'shop' as const, component: {} },
      ],
    } as const;

    type Paths = ExtractRoutePaths<typeof _plugin>;
    type _Check = _Expect<_Equal<Paths, 'home' | 'shop'>>;
    expect(true).toBe(true);
  });

  test('ExtractDialogPaths extracts literal dialog paths', () => {
    const _plugin = {
      name: 'test',
      dialogs: [
        { path: 'confirm' as const, component: {}, activated: false },
      ],
    } as const;

    type Paths = ExtractDialogPaths<typeof _plugin>;
    type _Check = _Expect<_Equal<Paths, 'confirm'>>;
    expect(true).toBe(true);
  });

  test('ExtractControlNames extracts literal control names', () => {
    const _plugin = {
      name: 'test',
      controls: [
        { name: 'hud' as const, component: {}, activated: false },
      ],
    } as const;

    type Names = ExtractControlNames<typeof _plugin>;
    type _Check = _Expect<_Equal<Names, 'hud'>>;
    expect(true).toBe(true);
  });

  test('RouteSegmentPath validates slash-joined route segments at call sites', () => {
    const stepWisePush = (() => Promise.resolve()) as PluginTypedStepWisePush<'a' | 'b'>;

    // Single segments
    void stepWisePush('a');
    void stepWisePush('b');
    // Slash-joined combinations, any order and arbitrary depth
    void stepWisePush('a/b');
    void stepWisePush('b/a');
    void stepWisePush('a/b/a/b/a');
    // Absolute paths still allowed (untyped escape hatch)
    void stepWisePush('/anything/here');
    // Unknown segments are rejected
    // @ts-expect-error 'x' is not a known route
    void stepWisePush('x');
    // @ts-expect-error 'a/x' contains an unknown segment
    void stepWisePush('a/x');

    expect(true).toBe(true);
  });

  test('PluginTypedReplace takes known segments and their typed props only', () => {
    const replace = (() => Promise.resolve()) as PluginTypedReplace<
      'a' | 'b',
      { b: { id: number } }
    >;

    void replace('a');
    void replace('b', { id: 1 });
    // @ts-expect-error 'b' requires its props
    void replace('b');
    // @ts-expect-error 'x' is not a known route
    void replace('x');
    // @ts-expect-error replace has no back step
    void replace(-1);
    // @ts-expect-error replace takes a segment, not an absolute path
    void replace('/a/b');

    expect(true).toBe(true);
  });

  test('TypedReplace follows the manual RouteMap', () => {
    const replace = (() => Promise.resolve()) as TypedReplace<{
      home: undefined;
      profile: { userId: number };
    }>;

    void replace('home');
    void replace('profile', { userId: 1 });
    // @ts-expect-error 'profile' requires its props
    void replace('profile');

    expect(true).toBe(true);
  });
});
