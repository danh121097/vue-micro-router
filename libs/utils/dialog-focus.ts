const FOCUSABLE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

function isDialogFocusableElement(el: HTMLElement): boolean {
  if (!FOCUSABLE_TAGS.has(el.tagName) && !el.hasAttribute('tabindex')) return false;
  if (el.tagName === 'A' && !el.hasAttribute('href')) return false;
  if (el.offsetParent === null) return false;
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

export function getDialogInitialFocusTarget(root: HTMLElement): HTMLElement {
  const list = getDialogFocusableElements(root);
  return list.find((el) => el.hasAttribute('autofocus')) ?? list[0] ?? root;
}
