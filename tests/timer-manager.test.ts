import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { createTimerManager } from '../libs/utils/timer-manager';

describe('createTimerManager', () => {
  let manager: ReturnType<typeof createTimerManager>;

  beforeEach(() => {
    manager = createTimerManager();
  });

  afterEach(() => {
    manager.cleanup();
  });

  test('schedule executes callback after delay', async () => {
    const fn = mock(() => {});
    manager.schedule(fn, 10);
    expect(fn).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 20));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('cleanup cancels pending timers', async () => {
    const fn = mock(() => {});
    manager.schedule(fn, 50);
    manager.cleanup();
    await new Promise((r) => setTimeout(r, 60));
    expect(fn).not.toHaveBeenCalled();
  });

  test('multiple timers can run independently', async () => {
    const fn1 = mock(() => {});
    const fn2 = mock(() => {});
    manager.schedule(fn1, 10);
    manager.schedule(fn2, 20);
    await new Promise((r) => setTimeout(r, 30));
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});
