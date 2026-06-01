/*\! © 2026 slashwhat. MIT License. */
// merge-conflict.js — Popup UI for resolving description/notes conflicts
// when joining two children that have different values. Lets the user
// pick one child's value, combine both, type something new, or clear.

// Keeps button labels within popup width without wrapping.
const BTN_LABEL_MAX = 20;

// Build a labeled textarea with quick-fill buttons for one conflicting field.
// Each button pre-fills the textarea with the left child's value, right child's
// value, both combined, or empty — so the user can pick without retyping.
function buildFieldSection(label, leftVal, rightVal) {
  const section = document.createElement('div');
  section.className = 'merge-field';

  const lbl = document.createElement('div');
  lbl.className = 'merge-field-label';
  lbl.textContent = label;
  section.appendChild(lbl);

  const textarea = document.createElement('textarea');
  textarea.className = 'merge-textarea';
  textarea.placeholder = `Choose or type ${label.toLowerCase()}\u2026`;

  // Quick-fill buttons above the textarea
  const btns = document.createElement('div');
  btns.className = 'merge-options';
  const addBtn = (text, val) => {
    const b = document.createElement('button');
    b.className = 'merge-option-btn';
    b.textContent = text;
    b.addEventListener('click', () => { textarea.value = val; });
    btns.appendChild(b);
  };
  const clip = (s) => s.length > BTN_LABEL_MAX ? s.slice(0, BTN_LABEL_MAX) + '\u2026' : s;
  if (leftVal) addBtn('1: ' + clip(leftVal), leftVal);
  if (rightVal) addBtn('2: ' + clip(rightVal), rightVal);
  if (leftVal && rightVal) addBtn('Both', leftVal + '\n' + rightVal);
  addBtn('Clear', '');

  section.appendChild(btns);
  section.appendChild(textarea);
  return { section, textarea };
}

// Trap focus inside the dialog so keyboard users can't escape to the
// background while the modal is open. Tab wraps from last→first and
// Shift+Tab wraps from first→last.
function trapFocus(popup, e) {
  const focusable = popup.querySelectorAll('button, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// Show a centered modal with a section per conflicting field.
// onMerge(resolvedDesc, resolvedNotes) is called when the user clicks Merge.
export function showMergeConflict(leftDesc, rightDesc, leftNotes, rightNotes, onMerge) {
  // Save focus so we can restore it when the dialog closes.
  const previousFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'merge-overlay';
  const popup = document.createElement('div');
  popup.className = 'merge-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-labelledby', 'merge-conflict-title');

  const title = document.createElement('h3');
  title.className = 'merge-title';
  title.id = 'merge-conflict-title';
  title.textContent = 'Resolve merge conflict';
  popup.appendChild(title);

  const descConflict = leftDesc !== rightDesc;
  const notesConflict = leftNotes !== rightNotes;

  let descTA = null, notesTA = null;
  if (descConflict) {
    const { section, textarea } = buildFieldSection('Description', leftDesc, rightDesc);
    popup.appendChild(section);
    descTA = textarea;
  }
  if (notesConflict) {
    const { section, textarea } = buildFieldSection('Notes', leftNotes, rightNotes);
    popup.appendChild(section);
    notesTA = textarea;
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'merge-btn-row';

  // Shared cleanup: remove overlay, keyboard listener, and restore focus.
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') trapFocus(popup, e);
  };
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  };

  const saveBtn = document.createElement('button');
  saveBtn.className = 'notes-save-btn';
  saveBtn.textContent = '\u2713 Merge';
  saveBtn.addEventListener('click', () => {
    close();
    onMerge(descTA ? descTA.value : leftDesc, notesTA ? notesTA.value : leftNotes);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'notes-cancel-btn';
  cancelBtn.textContent = '\u2717 Cancel';
  cancelBtn.addEventListener('click', close);

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  popup.appendChild(btnRow);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKey);

  // Focus the first interactive element inside the dialog.
  const firstFocusable = popup.querySelector('button, textarea');
  if (firstFocusable) firstFocusable.focus();
}
