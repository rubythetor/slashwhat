/*\! © 2026 slashwhat. MIT License. */
// notes-popup.js — Reusable notes editing popup.
// Creates a fixed-positioned popup with a textarea and save/cancel buttons.
// Extracted from table-events.js because it's a cross-cutting UI component
// shared by both node-level and header-level notes editing.

// Shared notes popup: creates a fixed popup with textarea and save/cancel.
// Handles click-outside dismiss and Escape key. Returns the popup element
// so callers can track it for cleanup on table re-render.
export function showNotesPopup(anchorEl, currentValue, onSave, onCancel) {
  // Prevent duplicate popups
  const existing = document.querySelector('.notes-popup');
  if (existing) existing.remove();

  const rect = anchorEl.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className = 'notes-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Edit notes');
  popup.style.position = 'fixed';
  popup.style.left = rect.left + 'px';
  popup.style.top = (rect.bottom + 4) + 'px';

  const textarea = document.createElement('textarea');
  textarea.className = 'notes-textarea';
  textarea.value = currentValue;
  textarea.placeholder = 'Add notes\u2026';
  textarea.setAttribute('aria-label', 'Notes text');

  const close = () => { popup.remove(); document.removeEventListener('mousedown', outsideClick); };

  textarea.addEventListener('keydown', (ke) => {
    if (ke.key === 'Escape') { close(); onCancel(); }
  });

  const btnRow = document.createElement('div');
  btnRow.className = 'notes-btn-row';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'notes-save-btn';
  saveBtn.textContent = '\u2713';
  saveBtn.title = 'Save';
  saveBtn.setAttribute('aria-label', 'Save notes');
  saveBtn.addEventListener('click', () => { close(); onSave(textarea.value); });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'notes-cancel-btn';
  cancelBtn.textContent = '\u2717';
  cancelBtn.title = 'Cancel';
  cancelBtn.setAttribute('aria-label', 'Cancel editing');
  cancelBtn.addEventListener('click', () => { close(); onCancel(); });

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  popup.appendChild(textarea);
  popup.appendChild(btnRow);
  document.body.appendChild(popup);
  textarea.focus();

  // Dismiss on click outside the popup (delayed so the opening click doesn't
  // immediately close it).
  function outsideClick(e) {
    if (!popup.contains(e.target)) { close(); onCancel(); }
  }
  requestAnimationFrame(() => document.addEventListener('mousedown', outsideClick));

  return popup;
}
