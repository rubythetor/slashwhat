/*\! © 2026 slashwhat. MIT License. */
// navigation-guards.js — Event-target guards for keyboard and navigation UX.
// Keeps shortcut and unload heuristics in pure helpers so behavior is testable
// without rendering the full splitter view.

const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'hidden',
  'image', 'radio', 'range', 'reset', 'submit',
]);

// Detect whether a keyboard event target is a text-editing context.
// App-level undo/redo should never intercept browser-native text undo.
export function isTextEditingTarget(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function') {
    const editableAncestor = target.closest('[contenteditable=""],[contenteditable="true"]');
    if (editableAncestor) return true;
  }
  const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  const type = typeof target.type === 'string' ? target.type.toLowerCase() : 'text';
  return !NON_TEXT_INPUT_TYPES.has(type);
}

// Detect a same-tab, same-origin anchor click that should bypass beforeunload.
// Ignores modified clicks/new-tab/download/hash links where unload should remain guarded.
export function isSameTabInternalNavigation(event, currentOrigin) {
  if (!event || !event.target || event.defaultPrevented) return false;
  if ((event.button ?? 0) !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (typeof event.target.closest !== 'function') return false;
  const anchor = event.target.closest('a[href]');
  if (!anchor) return false;
  const hrefAttr = typeof anchor.getAttribute === 'function' ? anchor.getAttribute('href') : anchor.href;
  if (!hrefAttr || hrefAttr.startsWith('#')) return false;
  const target = (anchor.target || '').toLowerCase();
  if (target && target !== '_self') return false;
  if (typeof anchor.hasAttribute === 'function' && anchor.hasAttribute('download')) return false;
  return anchor.origin === currentOrigin;
}
