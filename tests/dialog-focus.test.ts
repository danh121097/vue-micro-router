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
