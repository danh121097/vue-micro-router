/**
 * Mount tests for `MicroDialog`.
 *
 * The dialog teleports to `document.body`, so assertions query the document
 * rather than the mount wrapper. Close is animated: the manager keeps the
 * instance rendered with `closing: true` for the transition duration and only
 * then drops it, which is when focus is restored.
 */
/* eslint-disable vue/one-component-per-file -- dialog bodies are test fixtures, not app components */
import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, markRaw } from 'vue';

import {
  cleanupRouters,
  createPage,
  flush,
  mountRouter
} from './support/router-test-utils';

/** scale transition (300ms) + the manager's 200ms unmount buffer. */
const CLOSE_SETTLE_MS = 600;

function dialogEl(): HTMLElement | null {
  return document.querySelector('.micro-dialog');
}

function portalEl(): HTMLElement | null {
  return document.querySelector('.micro-dialog-portal');
}

function press(el: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init
  });
  el.dispatchEvent(event);
  return event;
}

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Dialog body with two focusable controls — the shape the Tab trap wraps around. */
function createButtonsDialog() {
  return markRaw(
    defineComponent({
      name: 'ButtonsDialog',
      setup: () => () =>
        h('div', [
          h('button', { class: 'btn-first', type: 'button' }, 'first'),
          h('button', { class: 'btn-last', type: 'button' }, 'last')
        ])
    })
  );
}

/** Dialog body with an autofocus input — takes focus in preference to the root. */
function createAutofocusDialog() {
  return markRaw(
    defineComponent({
      name: 'AutofocusDialog',
      setup: () => () => h('input', { autofocus: '' })
    })
  );
}

function mountWithDialogs(persistent = false) {
  return mountRouter({
    routes: [{ path: 'home', component: createPage('home') }],
    dialogs: [
      {
        path: 'confirm',
        component: createPage('confirm'),
        activated: false,
        persistent
      }
    ]
  });
}

afterEach(cleanupRouters);

describe('MicroDialog — open and close', () => {
  test('openDialog teleports the dialog into the body', async () => {
    const r = mountWithDialogs();
    await flush();
    expect(dialogEl()).toBeNull();

    r.store.openDialog('confirm', { title: 'Delete?' });
    await flush(6);

    const el = dialogEl();
    expect(el).not.toBeNull();
    expect(el!.getAttribute('role')).toBe('dialog');
    expect(el!.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('.page--confirm')).not.toBeNull();
    expect(r.store.activeDialog.value).toBe('confirm');
  });

  test('closeDialog clears the active dialog and unmounts after the transition', async () => {
    const r = mountWithDialogs();
    await flush();
    r.store.openDialog('confirm');
    await flush(6);

    r.store.closeDialog('confirm');
    await flush(6);
    expect(r.store.activeDialog.value).toBe('');
    // Still rendered while closing — the exit transition needs the node.
    expect(dialogEl()).not.toBeNull();

    await wait(CLOSE_SETTLE_MS);
    await flush(6);
    expect(dialogEl()).toBeNull();
  });

  test('stacked dialogs get increasing z-index', async () => {
    const r = mountRouter({
      routes: [{ path: 'home', component: createPage('home') }],
      dialogs: [
        { path: 'first', component: createPage('first'), activated: false },
        { path: 'second', component: createPage('second'), activated: false }
      ]
    });
    await flush();

    r.store.openDialog('first');
    await flush(6);
    await wait(350); // openDialog is guarded for DIALOG_STEP_DELAY
    r.store.openDialog('second');
    await flush(6);

    const portals = [...document.querySelectorAll<HTMLElement>('.micro-dialog-portal')];
    expect(portals).toHaveLength(2);
    expect(portals[0]!.style.zIndex).toBe('100');
    expect(portals[1]!.style.zIndex).toBe('101');
  });
});

describe('MicroDialog — dismissal', () => {
  test('Escape closes a non-persistent dialog', async () => {
    const r = mountWithDialogs();
    await flush();
    r.store.openDialog('confirm');
    await flush(6);

    press(dialogEl()!, 'Escape');
    await flush(6);

    expect(r.store.activeDialog.value).toBe('');
  });

  test('Escape does not close a persistent dialog', async () => {
    const r = mountWithDialogs(true);
    await flush();
    r.store.openDialog('confirm');
    await flush(6);

    press(dialogEl()!, 'Escape');
    await flush(6);

    expect(r.store.activeDialog.value).toBe('confirm');
    expect(dialogEl()).not.toBeNull();
  });

  test('backdrop click closes a non-persistent dialog', async () => {
    const r = mountWithDialogs();
    await flush();
    r.store.openDialog('confirm');
    await flush(6);

    click(portalEl()!);
    await flush(6);

    expect(r.store.activeDialog.value).toBe('');
  });

  test('backdrop click does not close a persistent dialog', async () => {
    const r = mountWithDialogs(true);
    await flush();
    r.store.openDialog('confirm');
    await flush(6);

    click(portalEl()!);
    await flush(6);

    expect(r.store.activeDialog.value).toBe('confirm');
  });

  test('a click inside the dialog content does not close it', async () => {
    const r = mountWithDialogs();
    await flush();
    r.store.openDialog('confirm');
    await flush(6);

    click(document.querySelector('.micro-dialog__content')!);
    await flush(6);

    expect(r.store.activeDialog.value).toBe('confirm');
  });
});

describe('MicroDialog — focus', () => {
  test('a dialog without an autofocus input focuses the dialog element itself', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const r = mountWithDialogs();
    await flush();
    r.store.openDialog('confirm');
    await flush(6);
    await wait(50); // the focus attempt runs on a rAF tick after mount

    // The root carries tabindex="-1" so it can hold focus without joining the
    // tab order. Focus has to land inside the dialog for the Tab trap below to
    // ever receive a keydown.
    expect(document.activeElement).toBe(dialogEl());
    expect(document.activeElement).not.toBe(opener);
  });

  test('focus returns to the opener when such a dialog closes', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const r = mountWithDialogs();
    await flush();
    r.store.openDialog('confirm');
    await flush(6);
    await wait(50);
    expect(document.activeElement).toBe(dialogEl());

    r.store.closeDialog('confirm');
    await flush(6);
    await wait(CLOSE_SETTLE_MS);
    await flush(6);

    expect(document.activeElement).toBe(opener);
  });

  test('focus moves to an autofocus input and returns to the opener on close', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const r = mountRouter({
      routes: [{ path: 'home', component: createPage('home') }],
      dialogs: [
        {
          path: 'confirm',
          component: createAutofocusDialog(),
          activated: false,
          focusInput: true
        }
      ]
    });
    await flush();

    r.store.openDialog('confirm');
    await flush(6);
    await wait(50);

    const input = document.querySelector('input[autofocus]');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);

    r.store.closeDialog('confirm');
    await flush(6);
    await wait(CLOSE_SETTLE_MS);
    await flush(6);

    expect(document.activeElement).toBe(opener);
  });
});

/**
 * The trap is a `keydown` listener on the dialog root, so it only ever runs
 * while focus is inside the dialog. These tests are what makes the initial
 * focus above load-bearing rather than cosmetic.
 */
describe('MicroDialog — Tab trap', () => {
  async function openButtonsDialog() {
    const r = mountRouter({
      routes: [{ path: 'home', component: createPage('home') }],
      dialogs: [
        { path: 'confirm', component: createButtonsDialog(), activated: false }
      ]
    });
    await flush();
    r.store.openDialog('confirm');
    await flush(6);
    await wait(50);

    return {
      first: document.querySelector<HTMLElement>('.btn-first')!,
      last: document.querySelector<HTMLElement>('.btn-last')!
    };
  }

  test('Tab on the last focusable wraps to the first', async () => {
    const { first, last } = await openButtonsDialog();
    last.focus();

    // preventDefault matters as much as the focus move: without it the browser
    // would also run its own Tab and land somewhere else.
    expect(press(last, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  test('Shift+Tab on the first focusable wraps to the last', async () => {
    const { first, last } = await openButtonsDialog();
    first.focus();

    expect(press(first, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  test('Shift+Tab from the focused dialog root wraps to the last, not out', async () => {
    const { first, last } = await openButtonsDialog();
    expect(document.activeElement).toBe(dialogEl());

    // The root precedes every control in DOM order, so backwards Tab would
    // otherwise step out of the dialog entirely.
    expect(press(dialogEl()!, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(document.activeElement).not.toBe(first);
  });

  test('forward Tab from the root is left to the browser', async () => {
    const { first } = await openButtonsDialog();
    expect(document.activeElement).toBe(dialogEl());

    // The root precedes every control, so native Tab already reaches the first
    // one — intercepting here would fight the browser instead of helping it.
    expect(press(dialogEl()!, 'Tab').defaultPrevented).toBe(false);
    expect(first).not.toBeNull();
  });
});

/**
 * Focus restore across a dialog stack.
 *
 * Since a dialog claims focus for its own root, the dialog stacked above it
 * records *that root* as the element to restore to — and in each flow below the
 * lower dialog is unmounted first, so the recorded element is gone by the time
 * the upper one closes. Restore has to walk further back to the opener.
 */
describe('MicroDialog — focus restore across a stack', () => {
  async function openTwoDialogs() {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const r = mountRouter({
      routes: [{ path: 'home', component: createPage('home') }],
      dialogs: [
        { path: 'first', component: createPage('first'), activated: false },
        { path: 'second', component: createPage('second'), activated: false }
      ]
    });
    await flush();

    r.store.openDialog('first');
    await flush(6);
    await wait(350); // openDialog is guarded for DIALOG_STEP_DELAY
    r.store.openDialog('second');
    await flush(6);
    await wait(50);

    return { r, opener };
  }

  async function settleClose() {
    await flush(6);
    await wait(CLOSE_SETTLE_MS);
    await flush(6);
  }

  test('closeAllDialogs returns focus to the opener', async () => {
    const { r, opener } = await openTwoDialogs();

    r.store.closeAllDialogs();
    await settleClose();

    expect(document.querySelectorAll('.micro-dialog')).toHaveLength(0);
    expect(document.activeElement).toBe(opener);
  });

  test('closing the lower dialog first still returns focus to the opener', async () => {
    const { r, opener } = await openTwoDialogs();

    r.store.closeDialog('first');
    await settleClose();
    // The upper dialog keeps focus while the lower one goes away.
    expect(document.activeElement).toBe(document.querySelector('.micro-dialog'));

    r.store.closeDialog('second');
    await settleClose();

    expect(document.activeElement).toBe(opener);
  });

  test('swapping one dialog for another returns focus to the opener', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const r = mountRouter({
      routes: [{ path: 'home', component: createPage('home') }],
      dialogs: [
        { path: 'first', component: createPage('first'), activated: false },
        { path: 'second', component: createPage('second'), activated: false }
      ]
    });
    await flush();
    r.store.openDialog('first');
    await flush(6);
    await wait(50);

    // Close and open in the same tick. Whether the replacement mounts early
    // enough to record the outgoing dialog's root depends on the manager's
    // timers, so this asserts the outcome rather than the internal ordering.
    r.store.closeDialog('first');
    r.store.openDialog('second');
    await settleClose();
    await wait(50);

    r.store.closeDialog('second');
    await settleClose();

    expect(document.activeElement).toBe(opener);
  });
});

/**
 * F5a — `.micro-dialog` is `pointer-events: none`, so a click on the dimmed
 * area lands on the non-focusable portal and the browser moves focus to
 * `<body>`. A non-persistent dialog closes on that click so it never mattered;
 * a persistent one stays open with focus outside itself, and because the Tab
 * trap is a `keydown` listener on the dialog root, the next Tab never reaches
 * it. `@mousedown.self.prevent` stops the focus move without touching the click
 * that closes non-persistent dialogs.
 */
describe('MicroDialog — backdrop focus (F5a)', () => {
  function mousedown(el: Element): MouseEvent {
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  }

  test('mousedown on the portal is prevented, so focus cannot leave', async () => {
    const r = mountWithDialogs(true);
    await flush(2);
    r.store.openDialog('confirm');
    await flush(4);
    await wait(60);

    const portal = portalEl()!;
    const event = mousedown(portal);

    // preventDefault on mousedown is what stops the browser moving focus.
    expect(event.defaultPrevented).toBe(true);
  });

  test('mousedown inside the dialog content is left alone', async () => {
    const r = mountWithDialogs(true);
    await flush(2);
    r.store.openDialog('confirm');
    await flush(4);
    await wait(60);

    const content = document.querySelector('.micro-dialog__content')!;
    const event = mousedown(content);

    // Only `.self` mousedowns are prevented — a control inside the dialog must
    // still be able to take focus on press.
    expect(event.defaultPrevented).toBe(false);
  });

  test('a persistent dialog still does not close on a backdrop press', async () => {
    const r = mountWithDialogs(true);
    await flush();
    r.store.openDialog('confirm');
    await flush(6);

    mousedown(portalEl()!);
    click(portalEl()!);
    await flush(6);

    expect(r.store.activeDialog.value).toBe('confirm');
  });

  test('a non-persistent dialog still closes on a backdrop press', async () => {
    const r = mountWithDialogs();
    await flush();
    r.store.openDialog('confirm');
    await flush(6);

    // The prevented mousedown must not swallow the click that closes it.
    mousedown(portalEl()!);
    click(portalEl()!);
    await flush(6);

    expect(r.store.activeDialog.value).toBe('');
  });
});
