/*\! © 2026 slashwhat. MIT License. */
// config-io.js — Save, load, export, and autosave operations.
// Handles JSON config files, CSV export, and localStorage autosave.
// All functions take explicit parameters so this module has no
// mutable state of its own.

import { serializeForest, validateConfig, deserializeConfig } from '../core/config.js';
import { buildDisplayName } from '../core/naming.js';
import { showToast } from '../ui/toast.js';
import { COL_DEF_MAP, formatCellValue } from './table-render.js';

// Guard against loading huge files — 100KB is generous for even very large subnet configs.
const MAX_FILE_SIZE = 100 * 1024;
const AUTOSAVE_KEY = 'slashwhat-autosave';
// Re-warn about autosave failure every 5 minutes so users don't lose data.
const AUTOSAVE_REWARN_MS = 5 * 60 * 1000;

// FNV-1a 32-bit hash for autosave integrity checks (F-20).
// Not cryptographic — detects accidental corruption or extension tampering.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

// --- Autosave ---

// Persist the current forest + display state to localStorage so it
// survives page refreshes.
export function autoSave(entries, colOrder, visibleCols, ds) {
  try {
    if (entries.length === 0) {
      localStorage.removeItem(AUTOSAVE_KEY);
      return;
    }
    // Keep a backup of the previous save so accidental destructive actions
    // (delete tree + immediate autosave) don't permanently lose the prior state.
    const prev = localStorage.getItem(AUTOSAVE_KEY);
    if (prev) localStorage.setItem(AUTOSAVE_KEY + '-prev', prev);
    const json = serializeForest(entries, colOrder, [...visibleCols], ds);
    const raw = JSON.stringify(json);
    localStorage.setItem(AUTOSAVE_KEY, raw);
    localStorage.setItem(AUTOSAVE_KEY + '-hash', fnv1a(raw));
  } catch {
    // localStorage full or unavailable — re-warn periodically so users
    // don't unknowingly lose work (F-09: was warn-once, now re-warns).
    const now = Date.now();
    if (!autoSave._lastWarn || now - autoSave._lastWarn > AUTOSAVE_REWARN_MS) {
      autoSave._lastWarn = now;
      showToast('Autosave failed \u2014 export your work to avoid data loss', 'warning');
    }
  }
}

// Try to restore state from localStorage. Returns the deserialized
// config object, or null if nothing is stored or the data is invalid.
export function autoLoad() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    // Integrity check: reject data that doesn't match its stored hash.
    // Missing hash (pre-F-20 saves) is allowed so existing data loads fine.
    const storedHash = localStorage.getItem(AUTOSAVE_KEY + '-hash');
    if (storedHash && storedHash !== fnv1a(raw)) {
      console.warn('slashwhat: autosave integrity check failed, discarding');
      localStorage.removeItem(AUTOSAVE_KEY);
      localStorage.removeItem(AUTOSAVE_KEY + '-hash');
      return null;
    }
    const json = JSON.parse(raw);
    const error = validateConfig(json);
    if (error) return null;
    return deserializeConfig(json);
  } catch {
    return null;
  }
}

// --- Save / Load ---

// Trigger a JSON file download containing the serialized config.
export function saveConfig(entries, colOrder, visibleCols, ds) {
  if (entries.length === 0) {
    showToast('Nothing to save — add a subnet first', 'warning');
    return;
  }
  const json = serializeForest(entries, colOrder, [...visibleCols], ds);
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'slashwhat-config.json';
  a.click();
  // Defer revocation so the browser has time to start the async download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Configuration saved', 'success');
}

// Open a file picker and load a previously saved config JSON.
// Calls onLoad(config) with the deserialized config on success.
// The input must be in the DOM for Safari to reliably open the dialog.
export function loadConfig(onLoad) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  document.body.appendChild(input);

  // Clean up the hidden input whether the user selects a file or cancels.
  // The 'change' event fires on selection; if the user cancels, the input
  // loses focus, so we also listen for focusin on the window as a fallback.
  const cleanup = () => { if (input.parentNode) input.remove(); };
  window.addEventListener('focus', cleanup, { once: true });

  input.addEventListener('change', () => {
    window.removeEventListener('focus', cleanup);
    const file = input.files[0];
    input.remove();
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showToast(`File too large (${Math.round(file.size / 1024)} KB, max 100 KB)`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      let json;
      try {
        json = JSON.parse(reader.result);
      } catch {
        showToast('Invalid JSON file', 'error');
        return;
      }

      const error = validateConfig(json);
      if (error) {
        showToast(error, 'error');
        return;
      }

      try {
        onLoad(deserializeConfig(json));
        showToast('Configuration loaded', 'success');
      } catch (err) {
        showToast(`Failed to load: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// --- Load Example ---

// Fetch the bundled example config and restore it, giving new users a
// one-click demo of what a populated subnet plan looks like.
export function loadExample(onLoad) {
  fetch('example.json')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(json => {
      const error = validateConfig(json);
      if (error) { showToast(error, 'error'); return; }
      onLoad(deserializeConfig(json));
      showToast('Example loaded', 'success');
    })
    .catch(() => showToast('Failed to load example', 'error'));
}

// --- CSV Export ---

// Prevent CSV injection and field misalignment by quoting values with
// delimiters, quotes, or newlines. Prefix formula-trigger characters so
// spreadsheet apps don't execute cell values as formulas (OWASP).
function csvEscape(val) {
  const str = String(val);
  const safe = /^[=+\-@\t\r]/.test(str) ? "'" + str : str;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  return safe;
}

// Export all visible leaf rows across all trees as a CSV file.
// Uses the currently visible columns (excluding join).
export function exportCsv(entries, leaves, colOrder, visibleCols, ds) {
  const { rangeDisplay, numberDisplay, nameDisplay } = ds;
  if (entries.length === 0) {
    showToast('Nothing to export — add a subnet first', 'warning');
    return;
  }

  const csvCols = colOrder.filter(k => visibleCols.has(k) && k !== 'join');
  const headerRow = csvCols.map(k => csvEscape(COL_DEF_MAP[k].label));
  const rows = [headerRow.join(',')];

  for (const leaf of leaves) {
    const s = leaf.subnet;
    const vals = csvCols.map(key => {
      // Reuse shared formatting for numeric/range columns; only
      // text columns need CSV-specific handling (no HTML markup).
      const shared = formatCellValue(key, s, rangeDisplay, numberDisplay);
      if (shared !== null) return shared;
      switch (key) {
        case 'subnet':   return s.toString();
        case 'name':     return buildDisplayName(leaf, nameDisplay);
        case 'desc':     return leaf.description ?? '';
        case 'notes':    return leaf.notes ?? '';
        case 'vlan': {
          const v = leaf._vlanComputed;
          return (v && v.value != null) ? String(v.value) : '';
        }
        default:         return '';
      }
    });
    rows.push(vals.map(csvEscape).join(','));
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'slashwhat-export.csv';
  a.click();
  // Defer revocation so the browser has time to start the async download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('CSV exported', 'success');
}
