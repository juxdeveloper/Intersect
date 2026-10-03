import type { MathfieldElement } from './setup';

const fields = new Map<MathfieldElement, () => void>();
let host: HTMLDivElement | null = null;
let touchPointer: number | null = null;
let pendingField: MathfieldElement | null = null;
let layoutFrame = 0;
let keyboardHeight = 0;

function keepFocusedFieldVisible(): void {
  layoutFrame = 0;
  const field = activeField();
  if (!field || !window.mathVirtualKeyboard.visible) return;
  const sidebar = field.closest<HTMLElement>('.sidebar');
  const app = field.closest<HTMLElement>('.app-container');
  if (!app) return;
  const viewport = app.getBoundingClientRect();
  const top = Math.max(0, viewport.top) + 8;
  const bottom = Math.min(window.innerHeight - keyboardHeight, viewport.bottom) - 8;
  for (const scroller of [sidebar, app]) {
    if (!scroller || !['auto', 'scroll'].includes(getComputedStyle(scroller).overflowY)) continue;
    const panel = scroller.getBoundingClientRect();
    const upper = Math.max(top, panel.top + 8);
    const lower = Math.min(bottom, panel.bottom - 8);
    if (lower <= upper) continue;
    const editor = field.getBoundingClientRect();
    if (editor.bottom > lower) scroller.scrollTop += editor.bottom - lower;
    else if (editor.top < upper) scroller.scrollTop += editor.top - upper;
  }
}

function activeField(): MathfieldElement | undefined {
  return [...fields.keys()].find((field) => document.activeElement === field);
}

function syncGeometry(): void {
  const keyboard = window.mathVirtualKeyboard;
  const backdrop = host?.querySelector('.MLK__backdrop');
  const padding = backdrop ? getComputedStyle(backdrop) : null;
  const height = keyboard.visible
    ? keyboard.boundingRect.height + (parseFloat(padding?.paddingTop ?? '') || 0) +
      (parseFloat(padding?.paddingBottom ?? '') || 0)
    : 0;
  keyboardHeight = height;
  document.documentElement.style.setProperty('--math-keyboard-height', `${height}px`);
  if (keyboard.visible && !layoutFrame) layoutFrame = requestAnimationFrame(keepFocusedFieldVisible);
  fields.forEach((notify) => notify());
}

function closeKeyboard(): void {
  pendingField = null;
  touchPointer = null;
  window.mathVirtualKeyboard.hide();
  syncGeometry();
}

function handlePointerDown(event: PointerEvent): void {
  const path = event.composedPath();
  const editor = path.find((node) => fields.has(node as MathfieldElement)) as MathfieldElement | undefined;
  if (editor) {
    if (event.pointerType === 'touch') {
      touchPointer = event.pointerId;
      pendingField = window.mathVirtualKeyboard.visible ? null : editor;
    }
    return;
  }
  if (path.some((node) => node === host ||
    (node instanceof Element && node.classList.contains('keyboard-icon-btn')))) return;
  activeField()?.blur();
  closeKeyboard();
}

function handlePointerEnd(event: PointerEvent): void {
  if (event.pointerId !== touchPointer) return;
  const field = pendingField;
  touchPointer = null;
  pendingField = null;
  // A pan cancels pointer tracking. A tap opens the keyboard after the finger lifts.
  if (event.type === 'pointercancel' || !field) return;
  requestAnimationFrame(() => {
    if (fields.has(field) && activeField() === field) showKeyboard(field);
  });
}

function handleFocusChange(): void {
  queueMicrotask(() => {
    if (!fields.size) return;
    if (!activeField() && !host?.contains(document.activeElement)) closeKeyboard();
    else syncGeometry();
  });
}

function handleVisibility(): void {
  if (document.hidden) closeKeyboard();
}

/** Keep MathLive out of the body flow so hiding it cannot leave page padding. */
export function registerKeyboardField(field: MathfieldElement, notify: () => void): () => void {
  if (!host) {
    host = document.createElement('div');
    host.className = 'math-keyboard-host';
    document.body.append(host);
    window.mathVirtualKeyboard.container = host;
    window.mathVirtualKeyboard.addEventListener('geometrychange', syncGeometry);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handlePointerEnd, true);
    document.addEventListener('pointercancel', handlePointerEnd, true);
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', closeKeyboard);
    window.addEventListener('resize', syncGeometry);
  }
  field.mathVirtualKeyboardPolicy = 'manual';
  field.setAttribute('inputmode', 'none');
  const sink = field.shadowRoot?.querySelector('[part="keyboard-sink"]');
  sink?.setAttribute('inputmode', 'none');
  sink?.setAttribute('virtualkeyboardpolicy', 'manual');
  const previousScrollHook = field.onScrollIntoView;
  // MathLive's default hook uses the full page, including the covered keyboard area.
  field.onScrollIntoView = () => {
    if (window.mathVirtualKeyboard.visible) {
      keepFocusedFieldVisible();
      if (!layoutFrame) layoutFrame = requestAnimationFrame(keepFocusedFieldVisible);
    } else field.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  fields.set(field, notify);
  return () => {
    field.onScrollIntoView = previousScrollHook;
    fields.delete(field);
    if (fields.size) return;
    closeKeyboard();
    window.mathVirtualKeyboard.removeEventListener('geometrychange', syncGeometry);
    document.removeEventListener('pointerdown', handlePointerDown, true);
    document.removeEventListener('pointerup', handlePointerEnd, true);
    document.removeEventListener('pointercancel', handlePointerEnd, true);
    document.removeEventListener('focusin', handleFocusChange);
    document.removeEventListener('focusout', handleFocusChange);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('blur', closeKeyboard);
    window.removeEventListener('resize', syncGeometry);
    cancelAnimationFrame(layoutFrame);
    layoutFrame = 0;
    window.mathVirtualKeyboard.container = null;
    host?.remove();
    host = null;
    document.documentElement.style.removeProperty('--math-keyboard-height');
  };
}

export function showKeyboard(field: MathfieldElement): void {
  if (touchPointer !== null && !window.mathVirtualKeyboard.visible) {
    pendingField = field;
    return;
  }
  field.focus();
  window.mathVirtualKeyboard.show();
  syncGeometry();
  requestAnimationFrame(() => {
    if (activeField() === field && window.mathVirtualKeyboard.visible) {
      syncGeometry();
      keepFocusedFieldVisible();
    }
  });
}

export function toggleKeyboard(field: MathfieldElement): void {
  if (window.mathVirtualKeyboard.visible && activeField() === field) closeKeyboard();
  else showKeyboard(field);
}
