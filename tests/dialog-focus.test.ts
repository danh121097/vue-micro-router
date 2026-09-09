import { afterEach, describe, expect, test } from 'bun:test';

import {
  consumeDialogMobileKeyboardPrime,
  getDialogFocusableElements,
  getDialogAutofocusTarget,
  primeDialogMobileKeyboard,
} from '../libs/utils/dialog-focus';

/**
 * `userAgent` is a prototype getter, so these tests shadow it with an own
 * property. The DOM is shared process-wide (see `tests/setup-sfc.ts`), so the
 * shadow must be removed again or it leaks a mobile UA into other files.
 */
function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value });
}

function restoreUserAgent() {
  Reflect.deleteProperty(navigator, 'userAgent');
}

function setupRoot() {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

function getTarget(root: HTMLElement): HTMLElement {
  const target = Array.from(root.getElementsByTagName('input')).find((el) =>
    el.hasAttribute('data-target')
  );
  if (!target) throw new Error('Missing target input');
  return target;
}

describe('dialog focus helpers', () => {
  afterEach(() => {
    consumeDialogMobileKeyboardPrime();
    restoreUserAgent();
    document.body.innerHTML = '';
  });

  test('ignores hidden proxy and tabindex -1 controls before autofocus input', () => {
    const root = setupRoot();
    root.innerHTML = [
      '<input hidden>',
      '<input aria-hidden="true" tabindex="-1" readonly>',
      '<button tabindex="-1" type="button">country</button>',
      '<input autofocus data-target="real">',
    ].join('');

    const target = getTarget(root);
    expect(getDialogFocusableElements(root)).toEqual([target]);
    expect(getDialogAutofocusTarget(root)).toBe(target);
  });

  test('prefers autofocus target on every lookup', () => {
    const root = setupRoot();
    root.innerHTML = [
      '<button type="button">first</button>',
      '<input autofocus data-target="real">',
    ].join('');

    // The lookup is re-run on every focus attempt, so it must be stable and
    // must not prefer the earlier plain button.
    const target = getTarget(root);
    expect(getDialogAutofocusTarget(root)).toBe(target);
    expect(getDialogAutofocusTarget(root)).toBe(target);
  });

  test('auto-targets only autofocus input or textarea', () => {
    const root = setupRoot();
    root.innerHTML = [
      '<button type="button">first</button>',
      '<input>',
      '<select><option>SG</option></select>',
      '<textarea autofocus data-target="real"></textarea>',
    ].join('');

    const target = root.querySelector<HTMLElement>('[data-target="real"]')!;
    expect(getDialogAutofocusTarget(root)).toBe(target);
  });

  test('does not auto-target input or textarea without autofocus', () => {
    const root = setupRoot();
    root.innerHTML = [
      '<button type="button">first</button>',
      '<input>',
      '<textarea></textarea>',
    ].join('');

    expect(getDialogAutofocusTarget(root)).toBeUndefined();
  });

  test('mobile keyboard prime creates and consumes a proxy input synchronously', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');

    primeDialogMobileKeyboard();

    const proxy = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Keyboard input"][tabindex="-1"]'
    );
    expect(proxy).toBeTruthy();
    expect(document.activeElement).toBe(proxy);

    const target = document.createElement('input');
    document.body.appendChild(target);
    target.focus();
    consumeDialogMobileKeyboardPrime();

    expect(document.body.contains(proxy!)).toBe(false);
    expect(document.activeElement).toBe(target);
  });

  test('mobile keyboard prime is a no-op outside mobile user agents', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X)');

    primeDialogMobileKeyboard();

    expect(document.body.querySelector('input[aria-label="Keyboard input"]')).toBeNull();
  });
});

/**
 * F5 — the focusable scan used to be `querySelectorAll('*')` filtered down,
 * running on every Tab keypress and on up to 12 animation frames while
 * autofocus settles. These pin the narrowed selector against the old
 * behaviour rather than trusting that the filter covers the same ground.
 */
describe('focusable scan (F5)', () => {
  /**
   * The pre-F5 implementation, kept as the oracle.
   *
   * It carries the `aria-hidden` ancestor fix that landed alongside F5, so this
   * comparison isolates exactly one variable: `'*'` versus the narrowed
   * candidate selector.
   */
  function scanEveryNode(root: HTMLElement): HTMLElement[] {
    const FOCUSABLE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);
    return Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) => {
      if (!FOCUSABLE_TAGS.has(el.tagName) && !el.hasAttribute('tabindex')) return false;
      if (el.tagName === 'A' && !el.hasAttribute('href')) return false;
      if (el.hidden || el.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
      if (el.getAttribute('tabindex') === '-1') return false;
      if (el.hasAttribute('disabled')) return false;
      if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
      return true;
    });
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('a 500-node dialog yields exactly what scanning every node did', () => {
    const root = setupRoot();
    const parts: string[] = [];
    for (let i = 0; i < 100; i++) {
      parts.push(
        `<div><span>text ${i}</span><p>copy</p>`,
        `<button>btn ${i}</button>`,
        i % 3 === 0 ? `<input disabled />` : `<input />`,
        i % 5 === 0 ? `<a>no href</a>` : `<a href="#">link ${i}</a>`,
        `<div tabindex="${i % 7 === 0 ? '-1' : '0'}">tab ${i}</div>`,
        `<section aria-hidden="true"><button>hidden ${i}</button></section>`,
        `</div>`
      );
    }
    root.innerHTML = parts.join('');
    expect(root.querySelectorAll('*').length).toBeGreaterThan(500);

    const narrowed = getDialogFocusableElements(root);
    const everyNode = scanEveryNode(root);

    expect(narrowed).toEqual(everyNode);
    expect(narrowed.length).toBeGreaterThan(0);
  });

  test('the narrowed selector still excludes each disqualifying case', () => {
    const root = setupRoot();
    root.innerHTML = [
      '<button>keep</button>',
      '<button disabled>drop</button>',
      '<a href="#">keep</a>',
      '<a>drop</a>',
      '<input type="hidden" />',
      '<input hidden />',
      '<div tabindex="0">keep</div>',
      '<div tabindex="-1">drop</div>',
      '<div aria-hidden="true"><button>drop</button></div>',
      '<button aria-hidden="true">drop</button>',
      '<div inert><button>drop</button></div>',
      '<span>drop</span>'
    ].join('');

    const labels = getDialogFocusableElements(root).map(
      (el) => el.textContent || el.tagName
    );
    expect(labels).toEqual(['keep', 'keep', 'keep']);
  });
});

/**
 * F5b — a `v-show`-hidden trailing control is still in the DOM and still
 * matches every other filter, so it becomes `last` and `active === last` never
 * holds for the control the user can see, letting Tab escape.
 *
 * happy-dom implements neither `checkVisibility()` nor `offsetParent`, so the
 * real hiding cannot be reproduced here. These drive `checkVisibility` directly
 * to pin that the check is consulted at all — the fallback path is left to a
 * real browser.
 */
describe('rendered check (F5b)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('an element reporting itself invisible is dropped', () => {
    const root = setupRoot();
    root.innerHTML = '<button>first</button><button>last</button>';
    const [first, last] = Array.from(root.querySelectorAll('button'));

    expect(getDialogFocusableElements(root)).toEqual([first!, last!]);

    Object.defineProperty(last!, 'checkVisibility', {
      configurable: true,
      value: () => false
    });

    expect(getDialogFocusableElements(root)).toEqual([first!]);
  });

  test('an element reporting itself visible is kept', () => {
    const root = setupRoot();
    root.innerHTML = '<button>only</button>';
    const button = root.querySelector('button')!;
    Object.defineProperty(button, 'checkVisibility', {
      configurable: true,
      value: () => true
    });

    expect(getDialogFocusableElements(root)).toEqual([button]);
  });
});
