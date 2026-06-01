/*\! © 2026 slashwhat. MIT License. */
// toast.js — Lightweight toast notification system.
// Provides non-blocking feedback for user actions (errors, confirmations).
// Toasts auto-dismiss after a duration and can be clicked to dismiss early.

import { escapeHtml } from './html-utils.js';

let containerEl = null;

// Inline SVG icons avoid external dependencies and load instantly.
const ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
  error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

// Show a toast notification. Type determines the icon and left-border color.
// Duration controls auto-dismiss timing and the CSS progress bar animation.
export function showToast(message, type = 'info', duration = 3000) {
  if (!containerEl) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
    <span class="toast-message">${escapeHtml(String(message))}</span>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;

  toast.addEventListener('click', () => dismiss(toast));

  containerEl.appendChild(toast);

  // Force a reflow before adding the visible class so the browser registers
  // the initial transform state and plays the entry animation.
  toast.offsetHeight;
  toast.classList.add('toast-visible');

  setTimeout(() => dismiss(toast), duration);
}

// Animate the toast out, then remove it from the DOM.
// The 400ms fallback timeout ensures cleanup even if animationend doesn't
// fire (e.g. reduced-motion is on, or the element is already detached).
function dismiss(toast) {
  if (!toast.parentNode) return;
  toast.classList.remove('toast-visible');
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, { once: true });
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 400);
}

// Capture the toast container DOM element. Called once from main.js on boot.
// Ensures ARIA live-region attributes are present so screen readers announce toasts.
export function initToast() {
  containerEl = document.getElementById('toast-container');
  if (containerEl) {
    containerEl.setAttribute('role', 'status');
    containerEl.setAttribute('aria-live', 'polite');
  }
}
