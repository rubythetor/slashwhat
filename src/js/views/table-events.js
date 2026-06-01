/*\! © 2026 slashwhat. MIT License. */
// table-events.js — Event wiring for the splitter table.
// Attaches click/keyboard handlers for divide, join, inline editing,
// tree header controls, and the forest input row. Separated from
// rendering so each module has a single responsibility.

import { splitNode, mergeNodes } from '../core/splitter.js';
import { initChildNames } from '../core/naming.js';
import { parseSubnetInput } from '../core/parse.js';
import { Subnet } from '../core/subnet.js';
import { showToast } from '../ui/toast.js';
import { showMergeConflict } from './merge-conflict.js';
import { showNotesPopup } from './notes-popup.js';
import { applySubnetValidation, applyDigitValidation, applyLengthValidation } from './input-validation.js';

// --- Focus Management ---
// Move focus to a leaf's <tr> after split/join so keyboard and screen
// reader users stay oriented after the table rebuilds (F-04).
function focusLeafRow(container, nodeId) {
  const row = container.querySelector(`tr[data-leaf-id="${nodeId}"]`);
  if (row) row.focus({ preventScroll: false });
}

// --- Inline Edit (shared) ---
// Generic click-to-edit behavior: clicking a span replaces it with an input,
// and blur/Enter commits the change. Used for both name labels and separators.
// Parameters are callbacks so this function stays generic:
//   getNode: resolves a node ID to a tree node
//   getProp/setProp: read/write the specific property being edited
//   placeholder: shown in the input when the value is empty
//   onCommit: called after the value is set (typically re-renders the table)

export function attachInlineEdit(container, selector, getNode, getProp, setProp, editClass, placeholder, onCommit, { idAttr = 'nodeId', onInput = null } = {}) {
  container.querySelectorAll(selector).forEach(span => {
    // Keyboard accessibility: let users activate inline edit with Enter/Space.
    span.setAttribute('tabindex', '0');
    span.setAttribute('role', 'button');
    span.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); span.click(); }
    });

    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = parseInt(span.dataset[idAttr], 10);
      const node = getNode(nodeId);
      if (!node) return;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = editClass;
      input.value = getProp(node);
      if (placeholder) input.placeholder = placeholder;

      const commit = () => {
        setProp(node, input.value);
        onCommit();
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
        // Escape cancels: remove the blur handler first to prevent committing,
        // then re-render to restore the original span.
        if (ke.key === 'Escape') { input.removeEventListener('blur', commit); onCommit(); }
      });

      // Optional live validation callback fires on every keystroke.
      if (onInput) {
        input.addEventListener('input', () => onInput(input));
        onInput(input);
      }

      span.replaceWith(input);
      input.focus();
      input.select();
    });
  });
}

// --- Divide Handlers ---
// Wire up "Divide" links to split a leaf into two children at prefix + 1.

export function attachDivideHandlers(container, getNode, onRender, autoLabel = true) {
  container.querySelectorAll('.splitter-divide-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const node = getNode(parseInt(link.dataset.nodeId, 10));
      if (!node) return;
      try {
        // Capture parent color before split so children can inherit it.
        const parentColor = node.color || null;
        splitNode(node);
        initChildNames(node, autoLabel);
        if (parentColor) {
          node.children[0].color = parentColor;
          node.children[1].color = parentColor;
        }
        const childId = node.children[0].id;
        onRender();
        // Move focus to the first child row so keyboard/screen reader users
        // know where they are after the table rebuilds (F-04).
        focusLeafRow(container, childId);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

// --- Join Handlers ---
// Wire up mergeable join cells to merge sibling leaves back into parent.
// When children share the same description/notes, auto-copy to parent.
// When they differ, show a conflict popup so the user can choose.

export function attachJoinHandlers(container, getNode, onRender) {
  container.querySelectorAll('.splitter-join-cell.mergeable').forEach(cell => {
    // Keyboard activation: Enter or Space triggers the same merge as click.
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cell.click();
      }
    });
    cell.addEventListener('click', () => {
      const node = getNode(parseInt(cell.dataset.nodeId, 10));
      if (!node || !node.children) return;
      const [left, right] = node.children;
      const ld = left.description ?? '', rd = right.description ?? '';
      const ln = left.notes ?? '', rn = right.notes ?? '';

      const doMerge = (desc, notes) => {
        try {
          // Preserve the top child's color so the merged parent keeps it.
          const topColor = left.color || null;
          mergeNodes(left, right);
          node.description = desc;
          node.notes = notes;
          node.color = topColor;
          const parentId = node.id;
          onRender();
          // Move focus to the merged parent row (F-04).
          focusLeafRow(container, parentId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

      if (ld === rd && ln === rn) {
        doMerge(ld, ln);
      } else {
        showMergeConflict(ld, rd, ln, rn, doMerge);
      }
    });
  });
}

// --- Name Edit Handlers ---
// Wire up name segment click-to-edit on the table container.

export function attachNameEditHandlers(container, getNode, onRender) {
  attachInlineEdit(
    container, '.name-segment', getNode,
    (node) => node.label,
    (node, val) => { node.label = val.trim(); },
    'name-edit', 'name', onRender
  );
}

// --- Separator Edit Handlers ---
// Wire up separator click-to-edit (the character between name segments).

export function attachSeparatorEditHandlers(container, getNode, onRender) {
  attachInlineEdit(
    container, '.name-separator', getNode,
    (node) => node.separator,
    (node, val) => { node.separator = val || '-'; },
    'name-edit name-sep-edit', '', onRender
  );
}

// --- Description Edit Handlers ---
// Wire up click-to-edit on description cells, reusing the inline edit pattern.

export function attachDescriptionEditHandlers(container, getNode, onRender) {
  attachInlineEdit(
    container, '.desc-text', getNode,
    (node) => node.description ?? '',
    (node, val) => { node.description = val; },
    'name-edit desc-edit', 'description', onRender
  );
}

// --- Notes Edit Handlers ---
// Wire up hover popup on notes cells with a textarea for multiline editing.

export function attachNotesEditHandlers(container, getNode, onRender) {
  container.querySelectorAll('.notes-preview').forEach(span => {
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = parseInt(span.dataset.nodeId, 10);
      const node = getNode(nodeId);
      if (!node) return;

      showNotesPopup(span, node.notes ?? '',
        (val) => { node.notes = val; onRender(); },
        () => onRender());
    });
  });
}

// --- Tree Header Handlers ---
// Wire up collapse, delete, and move buttons on tree header rows.
// callbacks: { onCollapse(forestId), onDelete(forestId),
//              onMoveUp(forestId), onMoveDown(forestId) }

export function attachTreeHeaderHandlers(container, callbacks) {
  container.querySelectorAll('[data-action][data-forest-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const forestId = parseInt(btn.dataset.forestId, 10);
      const action = btn.dataset.action;

      switch (action) {
        case 'collapse':
          callbacks.onCollapse(forestId);
          break;
        case 'delete':
          callbacks.onDelete(forestId);
          break;
        case 'move-up':
          callbacks.onMoveUp(forestId);
          break;
        case 'move-down':
          callbacks.onMoveDown(forestId);
          break;
      }
    });
  });
}

// --- Input Row Handlers ---
// Wire up the forest input row with real-time validation (red/green text)
// and Enter-to-add behavior. The row contains three fields: subnet (required),
// section ID, and name. Tab moves between them; Enter submits from any field
// if the subnet is valid. onSubmit receives (subnet, sectionId, name).

export function attachInputRowHandlers(rowEl, onSubmit) {
  const subnetInput = rowEl.querySelector('.forest-input');
  const sidInput = rowEl.querySelector('.forest-input-sid');
  const nameInput = rowEl.querySelector('.forest-input-name');
  if (!subnetInput) return;

  // Real-time validation feedback on every keystroke.
  subnetInput.addEventListener('input', () => applySubnetValidation(subnetInput));
  if (sidInput) sidInput.addEventListener('input', () => applyDigitValidation(sidInput));
  // 30-char limit prevents names from overflowing tree header cells on typical viewports.
  if (nameInput) nameInput.addEventListener('input', () => applyLengthValidation(nameInput, 30));

  // Try to parse and submit all three fields. Returns true on success.
  function trySubmit() {
    const val = subnetInput.value.trim();
    if (!val) return false;
    try {
      const { addr, prefix } = parseSubnetInput(val);
      const subnet = new Subnet(addr, prefix);
      const sid = sidInput ? sidInput.value.replace(/\D/g, '') : '';
      const name = nameInput ? nameInput.value.trim() : '';
      subnetInput.value = '';
      subnetInput.classList.remove('input-valid', 'input-invalid');
      if (sidInput) { sidInput.value = ''; sidInput.classList.remove('input-valid', 'input-invalid'); }
      if (nameInput) { nameInput.value = ''; nameInput.classList.remove('input-valid', 'input-invalid'); }
      onSubmit(subnet, sid, name);
      return true;
    } catch {
      return false;
    }
  }

  // Enter from any of the three inputs submits when subnet is valid.
  const inputs = [subnetInput, sidInput, nameInput].filter(Boolean);
  for (const input of inputs) {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      trySubmit();
    });
  }
}
