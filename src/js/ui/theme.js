/*\! © 2026 slashwhat. MIT License. */
// theme.js — Dark/light theme toggle.
// Persists the user's choice in localStorage so it survives page reloads.
// Falls back to the OS-level prefers-color-scheme media query when no
// explicit choice has been saved.

const STORAGE_KEY = 'theme';
let _theme = 'dark';
let toggleEl = null;

// Current theme value for callers that branch on dark/light (e.g. color assignment).
export function getTheme() {
  return _theme;
}

// Apply theme to the DOM, persist to localStorage, and sync the toggle
// checkbox so its visual state always matches the current theme.
export function setTheme(theme) {
  _theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
  if (toggleEl) {
    toggleEl.checked = theme === 'dark';
    // Communicate current state to assistive technology.
    toggleEl.setAttribute('aria-checked', String(theme === 'dark'));
  }
}

// Flip between dark and light — convenience wrapper for setTheme.
function toggleTheme() {
  setTheme(_theme === 'dark' ? 'light' : 'dark');
}

// Respond to OS-level theme changes, but only if the user hasn't made an
// explicit choice (otherwise their preference takes priority).
function onMediaChange(e) {
  if (!localStorage.getItem(STORAGE_KEY)) {
    setTheme(e.matches ? 'dark' : 'light');
  }
}

export function initTheme() {
  toggleEl = document.getElementById('theme-toggle');
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // Restore saved preference, or default to dark on first visit.
  const stored = localStorage.getItem(STORAGE_KEY);
  setTheme(stored || 'dark');

  if (toggleEl) {
    toggleEl.addEventListener('change', () => {
      setTheme(toggleEl.checked ? 'dark' : 'light');
    });
  }

  mediaQuery.addEventListener('change', onMediaChange);
}
