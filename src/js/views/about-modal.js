/*! © 2026 slashwhat. MIT License. */
// about-modal.js — Undo/redo shortcut hint and page links below the table.

// Platform-aware undo/redo shortcut hint below the table controls.
export function renderFooter() {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '\u2318' : 'Ctrl+';
  return `<div class="table-control-hint">UNDO <kbd>${mod}Z</kbd> REDO <kbd>${mod}Shift+Z</kbd></div>`;
}
