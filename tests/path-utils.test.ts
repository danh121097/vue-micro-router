import { describe, expect, test } from 'bun:test';

import {
  buildPathFromSegments,
  getLastSegment,
  isAsyncLoader,
  normalizePath,
  parsePathSegments,
  safeMarkRaw,
  warmLoaderCache,
} from '../libs/utils/path-utils';

describe('normalizePath', () => {
  test('adds leading slash', () => {
    expect(normalizePath('home')).toBe('/home');
  });

  test('keeps existing slash', () => {
    expect(normalizePath('/home')).toBe('/home');
  });

  test('handles nested path', () => {
    expect(normalizePath('home/menu/settings')).toBe('/home/menu/settings');
  });
});

describe('parsePathSegments', () => {
  test('splits slash-separated path', () => {
    expect(parsePathSegments('/home/menu/settings')).toEqual(['home', 'menu', 'settings']);
  });

  test('handles path without leading slash', () => {
    expect(parsePathSegments('home/menu')).toEqual(['home', 'menu']);
  });

  test('handles single segment', () => {
    expect(parsePathSegments('home')).toEqual(['home']);
  });

  test('filters empty segments', () => {
    expect(parsePathSegments('/home//menu/')).toEqual(['home', 'menu']);
  });
});

describe('buildPathFromSegments', () => {
  test('joins segments with slashes', () => {
    expect(buildPathFromSegments(['home', 'menu', 'settings'])).toBe('/home/menu/settings');
  });

  test('single segment', () => {
    expect(buildPathFromSegments(['home'])).toBe('/home');
  });

  test('empty array returns root', () => {
    expect(buildPathFromSegments([])).toBe('/');
  });
});

describe('getLastSegment', () => {
  test('returns last segment', () => {
    expect(getLastSegment('/home/menu/settings')).toBe('settings');
  });

  test('returns single segment', () => {
    expect(getLastSegment('home')).toBe('home');
  });

  test('returns empty for empty string', () => {
    expect(getLastSegment('')).toBe('');
  });
});

describe('isAsyncLoader', () => {
  test('returns true for arrow function (async loader)', () => {
    const loader = () => import('../libs/core/types');
    expect(isAsyncLoader(loader)).toBe(true);
  });

  test('returns false for object with setup', () => {
    const component = { setup: () => {} };
    expect(isAsyncLoader(component)).toBe(false);
  });

  test('returns false for object with render', () => {
    const component = { render: () => {} };
    expect(isAsyncLoader(component)).toBe(false);
  });
});

describe('safeMarkRaw', () => {
  test('marks object as raw', () => {
    const obj = { foo: 'bar' };
    const result = safeMarkRaw(obj);
    expect(result).toBe(obj);
  });

  test('returns object unchanged if markRaw throws', () => {
    // Proxy that throws on defineProperty (markRaw internals)
    const obj = new Proxy({}, { defineProperty: () => { throw new Error('fail'); } });
    const result = safeMarkRaw(obj);
    expect(result).toBe(obj);
  });
});

describe('warmLoaderCache', () => {
  test('calls loader function', async () => {
    const loader = async () => ({ default: {} });
    await warmLoaderCache(loader);
  });

  test('silently fails on error', async () => {
    const loader = async () => { throw new Error('fail'); };
    await warmLoaderCache(loader); // Should not throw
  });
});
