/**
 * Body scroll lock with refcount — handles stacked dialogs/overlays.
 * First lock saves & overrides body overflow; last unlock restores.
 */
let lockCount = 0;
let savedOverflow = '';

export function lockBodyScroll() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount++;
}

export function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
  }
}
