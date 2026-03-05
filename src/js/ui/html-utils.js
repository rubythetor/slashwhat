/*! © 2026 slashwhat. MIT License. */
// html-utils.js — Shared HTML string utilities.
// Lives in ui/ so both table-render.js (views/) and warning-badges.js (views/)
// can import it without creating a circular dependency between those two files.

// Escape user-supplied strings before inserting them into HTML attributes or
// text content, preventing XSS when rendering names, descriptions, and tooltips.
export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
