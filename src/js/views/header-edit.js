/*\! © 2026 slashwhat. MIT License. */
// header-edit.js — Edit handlers for forest entry-level description/notes.
// These are independent from node-level properties, so the tree header row
// has its own values even when the tree is unsplit (root === leaf).

import { attachInlineEdit } from './table-events.js';
import { showNotesPopup } from './notes-popup.js';
import { computeVlan } from '../core/vlan-macro.js';
import { Subnet } from '../core/subnet.js';

// Click-to-edit for the header row's description cell.
// Delegates to attachInlineEdit with forestId lookup instead of nodeId.
export function attachHeaderDescEditHandlers(container, getEntry, onRender) {
  attachInlineEdit(
    container, '.header-desc-text', getEntry,
    (entry) => entry.description ?? '',
    (entry, val) => { entry.description = val; },
    'name-edit desc-edit', 'description', onRender,
    { idAttr: 'forestId' }
  );
}

// Click-to-edit for the header row's section name cell.
export function attachHeaderNameEditHandlers(container, getEntry, onRender) {
  attachInlineEdit(
    container, '.header-name-text', getEntry,
    (entry) => entry.name ?? '',
    (entry, val) => { entry.name = val; },
    'name-edit desc-edit', 'name', onRender,
    { idAttr: 'forestId' }
  );
}

// Click-to-edit for the header row's section ID (numeric only).
// Strips non-digits on commit so only numeric IDs are stored.
export function attachHeaderSectionIdEditHandlers(container, getEntry, onRender) {
  attachInlineEdit(
    container, '.header-sid-text', getEntry,
    (entry) => entry.sectionId ?? '',
    (entry, val) => { entry.sectionId = val.replace(/\D/g, ''); },
    'name-edit sid-edit', '#', onRender,
    { idAttr: 'forestId' }
  );
}

// Click-to-edit for the header row's VLAN template cell.
// Pre-fills with the effective template (section override or global default)
// so users see the active value when editing. Clearing reverts to inheriting.
// Input text turns red when the macro produces an invalid VLAN.
export function attachHeaderVlanEditHandlers(container, getEntry, globalTemplate, onRender) {
  const sample = Subnet.parse('10.1.50.0/24');
  attachInlineEdit(
    container, '.header-vlan-text', getEntry,
    (entry) => entry.vlanTemplate || globalTemplate || '',
    (entry, val) => { entry.vlanTemplate = val; },
    'name-edit vlan-edit', '{o3}', onRender,
    { idAttr: 'forestId', onInput: (input) => {
      if (!input.value) { input.style.color = ''; return; }
      const r = computeVlan(input.value, sample, '5', 0);
      input.style.color = r.valid ? 'var(--success)' : 'var(--error)';
    }}
  );
}

// Click-to-open popup for the header row's notes cell.
// Keeps its own pattern (popup, not inline input) since it's fundamentally
// different from the click-to-edit flow.
export function attachHeaderNotesEditHandlers(container, getEntry, onRender) {
  container.querySelectorAll('.header-notes-text').forEach(span => {
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = getEntry(parseInt(span.dataset.forestId, 10));
      if (!entry) return;

      showNotesPopup(span, entry.notes ?? '',
        (val) => { entry.notes = val; onRender(); },
        () => onRender());
    });
  });
}
