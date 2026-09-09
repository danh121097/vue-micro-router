/**
 * Stylesheet guards for the two CSS-only findings in Phase 4.
 *
 * Both are invisible to every behavioural test — the pages render the same
 * either way — so they are asserted against the stylesheet source. That is a
 * weak check on its own, which is why each one states the property it is
 * standing in for.
 */
import { describe, expect, test } from 'bun:test';

const css = await Bun.file(
  new URL('../libs/styles/micro-router-transitions.css', import.meta.url)
).text();

/** Selectors only, with comments and declaration bodies stripped. */
function selectors(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((block) => block.split('{')[0]?.trim() ?? '')
    .filter(Boolean)
    .flatMap((group) => group.split(',').map((s) => s.trim()))
    .filter(Boolean);
}

describe('navigation lock (F6, AC8)', () => {
  test('no universal selector is toggled per navigation', () => {
    const universal = selectors(css).filter((s) => s.includes('*'));
    // `.micro-router--navigating *` forced a style recalc across every
    // descendant of every page, twice per navigation.
    expect(universal).toEqual([]);
  });

  test('the lock itself is still applied to the page', () => {
    expect(css).toContain('.micro-router--navigating {');
    const block = css.split('.micro-router--navigating {')[1]!.split('}')[0]!;
    expect(block).toContain('pointer-events: none !important');
  });
});

describe('page slide compositor hint (F9)', () => {
  test('will-change is on the active classes, not on .route-page', () => {
    const active = css.split('.page-slide-leave-active {')[1]!.split('}')[0]!;
    expect(active).toContain('will-change: transform');

    // A permanent hint on every stacked page wastes compositor memory.
    const routePage = css.match(/\n\.route-page\s*\{[^}]*\}/)?.[0] ?? '';
    expect(routePage).not.toContain('will-change');
  });
});
