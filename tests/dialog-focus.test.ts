import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

import {
  getDialogFocusableElements,
  getDialogInitialFocusTarget,
} from '../libs/utils/dialog-focus';

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
  beforeAll(() => {
    const window = new Window();
    Object.assign(window, { SyntaxError });

    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      HTMLInputElement: window.HTMLInputElement,
    });

    Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get() {
        return this.parentElement;
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('ignores hidden proxy and tabindex -1 controls before autofocus input', () => {
    const root = setupRoot();
    root.innerHTML = [
      '<input aria-hidden="true" tabindex="-1" readonly>',
      '<button tabindex="-1" type="button">country</button>',
      '<input autofocus data-target="real">',
    ].join('');

    const target = getTarget(root);
    expect(getDialogFocusableElements(root)).toEqual([target]);
    expect(getDialogInitialFocusTarget(root)).toBe(target);
  });

  test('prefers autofocus target on every lookup', () => {
    const root = setupRoot();
    root.innerHTML = [
      '<button type="button">first</button>',
      '<input autofocus data-target="real">',
    ].join('');

    const target = getTarget(root);
    expect(getDialogInitialFocusTarget(root)).toBe(target);
    expect(getDialogInitialFocusTarget(root)).toBe(target);
  });
});
