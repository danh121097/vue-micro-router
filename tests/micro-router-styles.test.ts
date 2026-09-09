/**
 * Stylesheet guards for the CSS-only findings in Phase 4.
 *
 * These are invisible to every behavioural test — the pages render the same
 * either way — so they are asserted against the stylesheet source. That is a
 * weak check on its own, which is why each one states the property it is
 * standing in for.
 */
import { describe, expect, test } from 'bun:test';

const css = await Bun.file(
  new URL('../libs/styles/micro-router-transitions.css', import.meta.url)
).text();

describe('page slide compositor hint (F9)', () => {
  test('will-change is on the active classes, not on .route-page', () => {
    const active = css.split('.page-slide-leave-active {')[1]!.split('}')[0]!;
    expect(active).toContain('will-change: transform');

    // A permanent hint on every stacked page wastes compositor memory.
    const routePage = css.match(/\n\.route-page\s*\{[^}]*\}/)?.[0] ?? '';
    expect(routePage).not.toContain('will-change');
  });
});
