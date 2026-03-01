/*\! © 2026 slashwhat. MIT License. */
// main.js — Application entry point.
// Boots all subsystems in dependency order: theme first (so initial paint
// uses the right colors), then toast (so errors during init can display),
// then the splitter view itself.

import { initTheme } from './ui/theme.js';
import { initToast } from './ui/toast.js';
import { initSplitterView } from './views/splitter-view.js';

// Initialize all subsystems in dependency order and log readiness.
function boot() {
  initTheme();
  initToast();
  initSplitterView();

  console.log('slash/what — ready');
}

// Handle both synchronous and deferred DOM readiness so the script tag
// can appear anywhere (head with defer, end of body, etc.)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
