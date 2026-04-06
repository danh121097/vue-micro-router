import { describe, expect, test } from 'bun:test';

import { delay } from '../libs/utils/timer-manager';

describe('delay', () => {
  test('resolves after specified ms', async () => {
    const start = Date.now();
    await delay(20);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(15);
  });

  test('returns a promise', () => {
    const result = delay(1);
    expect(result).toBeInstanceOf(Promise);
  });
});
