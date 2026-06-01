/*! © 2026 slashwhat. MIT License. */
// about.js — Tab switching, theme, ambient, and code viewer for the About page.
// Shared boilerplate (tabs, theme, ambient) lives in ui/page-utils.js;
// the code viewer modal is unique to this page.

import { initTabs, initTheme, initAmbient } from './ui/page-utils.js';

initTabs();
initTheme();

// Code viewer modal — clicking a module box fetches the source file
// and shows it in a scrollable overlay. Tries the dev path first
// (bare /js/), then falls back to the prod path (/source/js/).
(function initCodeViewer() {
  let overlay = null;
  let lastFocused = null;  // Return focus here when the modal closes.

  // Build the modal DOM once and cache it; re-use on subsequent opens.
  function getOrCreateModal() {
    if (overlay) return overlay;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'code-modal-close';
    closeBtn.setAttribute('aria-label', 'Close source viewer');
    closeBtn.textContent = '\u00D7';

    // id so aria-labelledby can point at it from the dialog element.
    const titleEl = document.createElement('h3');
    titleEl.className = 'code-modal-title';
    titleEl.id = 'code-modal-label';

    const header = document.createElement('div');
    header.className = 'code-modal-header';
    header.append(titleEl, closeBtn);

    const codeEl = document.createElement('code');
    const pre = document.createElement('pre');
    pre.append(codeEl);

    const body = document.createElement('div');
    body.className = 'code-modal-body';
    body.append(pre);

    const modal = document.createElement('div');
    modal.className = 'code-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'code-modal-label');
    modal.append(header, body);

    overlay = document.createElement('div');
    overlay.className = 'code-modal-overlay';
    overlay.append(modal);
    document.body.append(overlay);

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    return overlay;
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('active');
    // Return focus to the module card that opened the modal so keyboard
    // users don't land in an unexpected place after closing.
    if (lastFocused) { lastFocused.focus(); lastFocused = null; }
  }

  // Build a human-readable label from a module card element.
  // The card structure is: <strong>filename.js</strong> one-line description.
  // Result: "filename.js — one-line description"
  function moduleLabel(mod) {
    const name = mod.querySelector('strong')?.textContent || '';
    const rest = mod.textContent.slice(name.length).trim();
    return rest ? `${name} \u2014 ${rest}` : name;
  }

  async function showCode(path, label, triggerEl) {
    // Only allow paths under core/, views/, or ui/ to prevent directory traversal.
    if (!/^(core|views|ui)\/[\w.-]+\.js$/.test(path)) return;

    lastFocused = triggerEl;

    const modal = getOrCreateModal();
    modal.querySelector('#code-modal-label').textContent = label;
    const codeEl = modal.querySelector('.code-modal-body code');
    codeEl.textContent = 'Loading\u2026';
    modal.classList.add('active');

    // Move focus into the modal so screen readers enter the dialog context.
    modal.querySelector('.code-modal-close').focus();

    let text;
    try {
      const res = await fetch('/js/' + path);
      if (res.ok) { text = await res.text(); }
    } catch (_) { /* dev path failed, try prod */ }

    if (!text) {
      try {
        const res = await fetch('/source/js/' + path);
        if (res.ok) { text = await res.text(); }
      } catch (_) { /* both failed */ }
    }

    codeEl.textContent = text || 'Could not load source file.';
  }

  document.addEventListener('click', (e) => {
    const mod = e.target.closest('.module[data-path]');
    if (mod) showCode(mod.dataset.path, moduleLabel(mod), mod);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
})();

initAmbient();
