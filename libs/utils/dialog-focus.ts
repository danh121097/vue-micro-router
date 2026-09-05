const FOCUSABLE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);
const AUTOFOCUS_TAGS = new Set(['INPUT', 'TEXTAREA']);
const AUTOFOCUS_SELECTOR = 'input[autofocus],textarea[autofocus]';
const MOBILE_USER_AGENT = /iPhone|iPad|iPod|Android/i;
const MAX_AUTOFOCUS_ATTEMPTS = 12;

let mobilePrimeInput: HTMLInputElement | null = null;
let mobilePrimeTimer: ReturnType<typeof setTimeout> | null = null;
let mobileKeyboardPrimed = false;

function isDialogFocusableElement(el: HTMLElement): boolean {
  if (!FOCUSABLE_TAGS.has(el.tagName) && !el.hasAttribute('tabindex')) return false;
  if (el.tagName === 'A' && !el.hasAttribute('href')) return false;
  if (el.hidden || el.closest('[hidden],[inert]')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.getAttribute('tabindex') === '-1') return false;
  if (el.hasAttribute('disabled')) return false;
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  return true;
}

export function getDialogFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('*')
  ).filter(isDialogFocusableElement);
}

export function getDialogAutofocusTarget(root: HTMLElement): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>(AUTOFOCUS_SELECTOR)).find(
    (el) => AUTOFOCUS_TAGS.has(el.tagName) && isDialogFocusableElement(el)
  );
}

/**
 * Where focus came from when a dialog root opened.
 *
 * A dialog opened over another one records that dialog's root as its origin,
 * because the root now holds focus. That root is often already detached by the
 * time the upper dialog closes — `closeAllDialogs`, an out-of-order close, or a
 * close/open swap all unmount the lower dialog first — so the origin has to be
 * followed further back to find something still on screen.
 *
 * Entries are never removed: an out-of-order close needs the lower dialog's
 * entry after that dialog has unmounted. A `WeakMap` keyed on the detached
 * element handles the lifetime.
 */
const dialogFocusOrigins = new WeakMap<Element, HTMLElement | null>();

/** Record what held focus when `root` opened. */
export function rememberDialogFocusOrigin(
  root: HTMLElement,
  origin: HTMLElement | null
) {
  dialogFocusOrigins.set(root, origin);
}

/**
 * Resolve where focus should return to, following the origin chain past any
 * dialog roots that have since been removed from the document.
 */
export function resolveDialogFocusReturn(
  origin: HTMLElement | null
): HTMLElement | null {
  let candidate = origin;
  const seen = new Set<Element>();
  while (candidate && !document.contains(candidate)) {
    if (seen.has(candidate)) return null;
    seen.add(candidate);
    candidate = dialogFocusOrigins.get(candidate) ?? null;
  }
  return candidate;
}

/**
 * Give the dialog element itself keyboard focus, unless something inside it
 * already has it.
 *
 * The dialog root carries `tabindex="-1"`, so it is focusable from script
 * without joining the tab order, and — unlike focusing an input — it never
 * opens a mobile virtual keyboard. This matters because the Tab trap is a
 * `keydown` listener on that root: while focus stays outside the dialog the
 * listener never receives the event and the trap silently does nothing.
 */
function claimDialogRootFocus(root: HTMLElement) {
  if (root.contains(document.activeElement)) return;
  root.focus();
}

export function focusInputWhenReady(
  getRoot: () => HTMLElement | null | undefined,
  shouldWaitForInput = true,
  isActive: () => boolean = () => true
) {
  let cancelled = false;
  const focusWhenReady = (attempt = 0) => {
    const root = getRoot();
    if (cancelled || !root || !isActive()) return;

    const target = getDialogAutofocusTarget(root);
    if (target) {
      target.focus();
      consumeDialogMobileKeyboardPrime();
      return;
    }

    if (shouldWaitForInput && attempt < MAX_AUTOFOCUS_ATTEMPTS) {
      requestAnimationFrame(() => focusWhenReady(attempt + 1));
      return;
    }

    // This dialog has no autofocus input. Release the mobile keyboard prime
    // first — it parks focus on a hidden input — then hand focus to the dialog
    // so it is not left outside a modal that claims `aria-modal="true"`.
    consumeDialogMobileKeyboardPrime();
    claimDialogRootFocus(root);
  };

  requestAnimationFrame(() => focusWhenReady());
  return () => {
    cancelled = true;
  };
}

export function primeDialogMobileKeyboard() {
  if (
    typeof document === 'undefined' ||
    typeof navigator === 'undefined' ||
    !MOBILE_USER_AGENT.test(navigator.userAgent)
  ) return;

  mobileKeyboardPrimed = true;
  mobilePrimeInput?.remove();

  mobilePrimeInput = document.createElement('input');
  mobilePrimeInput.setAttribute('aria-label', 'Keyboard input');
  mobilePrimeInput.setAttribute('tabindex', '-1');
  mobilePrimeInput.setAttribute('autocomplete', 'off');
  mobilePrimeInput.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:1px',
    'height:1px',
    'opacity:0',
    'border:none',
    'outline:none',
    'padding:0',
    'pointer-events:none',
    'z-index:-1'
  ].join(';');

  document.body.appendChild(mobilePrimeInput);
  mobilePrimeInput.focus();

  if (mobilePrimeTimer) clearTimeout(mobilePrimeTimer);
  mobilePrimeTimer = setTimeout(() => {
    consumeDialogMobileKeyboardPrime();
  }, 1500);
}

export function consumeDialogMobileKeyboardPrime() {
  if (!mobileKeyboardPrimed && !mobilePrimeInput) return;

  mobileKeyboardPrimed = false;
  if (mobilePrimeTimer) {
    clearTimeout(mobilePrimeTimer);
    mobilePrimeTimer = null;
  }
  mobilePrimeInput?.remove();
  mobilePrimeInput = null;
}
