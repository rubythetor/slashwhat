/*! © 2026 slashwhat. MIT License. */
// simple-mode.js — Simple/Advanced mode toggle.
// Persists the user's choice in localStorage so it survives page reloads.
// Sets a data-simple-mode attribute on <html> that CSS uses to hide
// advanced controls (column reorder, font/padding, settings popups).

const MODE_KEY = 'slashwhat-simple-mode';
const ADV_STATE_KEY = 'slashwhat-advanced-state';
let _simple = false;
let _toggleEl = null;

// Whether simple mode is currently active.
export function isSimpleMode() {
  return _simple;
}

// Apply mode to the DOM, persist to localStorage, and sync the toggle checkbox.
export function setSimpleMode(simple) {
  _simple = simple;
  document.documentElement.setAttribute('data-simple-mode', String(simple));
  localStorage.setItem(MODE_KEY, String(simple));
  if (_toggleEl) {
    // checked = Advanced (knob right), unchecked = Simple (knob left)
    _toggleEl.checked = !simple;
  }
}

// Persist the user's advanced column/padding state so toggling back restores it.
export function saveAdvancedState(state) {
  localStorage.setItem(ADV_STATE_KEY, JSON.stringify(state));
}

// Retrieve saved advanced state, or null if none exists.
export function loadAdvancedState() {
  const raw = localStorage.getItem(ADV_STATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Read saved preference, wire checkbox change event, call onToggle on click.
export function initSimpleMode(onToggle) {
  _toggleEl = document.getElementById('mode-toggle');
  const stored = localStorage.getItem(MODE_KEY);
  _simple = stored === 'true';
  document.documentElement.setAttribute('data-simple-mode', String(_simple));
  if (_toggleEl) {
    _toggleEl.checked = !_simple;
    _toggleEl.addEventListener('change', () => {
      const wantSimple = !_toggleEl.checked;
      onToggle(wantSimple);
    });
  }
}
