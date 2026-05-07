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

export function getDialogInitialFocusTarget(root: HTMLElement): HTMLElement {
  const list = getDialogFocusableElements(root);
  return list.find((el) => el.hasAttribute('autofocus')) ??
    list[0] ??
    root;
}

export function focusInputWhenReady(
  getRoot: () => HTMLElement | null | undefined,
  shouldWaitForInput = true,
  shouldConsumePrime = true,
  isActive: () => boolean = () => true
) {
  let cancelled = false;
  const focusWhenReady = (attempt = 0) => {
    const root = getRoot();
    if (cancelled || !root || !isActive()) return;

    const target = getDialogAutofocusTarget(root);
    if (target) {
      target.focus();
      if (shouldConsumePrime) consumeDialogMobileKeyboardPrime();
      return;
    }

    if (shouldWaitForInput && attempt < MAX_AUTOFOCUS_ATTEMPTS) {
      requestAnimationFrame(() => focusWhenReady(attempt + 1));
      return;
    }

    if (shouldConsumePrime) consumeDialogMobileKeyboardPrime();
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
