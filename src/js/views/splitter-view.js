/*\! © 2026 slashwhat. MIT License. */
// splitter-view.js — Orchestrator for the subnet splitter UI.
// Coordinates the forest model, table rendering, event wiring, and
// column controls. This is the only view module that touches app-level
// state (the forest, column config, display preferences). Individual
// concerns are delegated to table-render.js, table-events.js,
// column-controls.js, header-menus.js, and config-io.js.

import { addTree, removeTree, moveTree, toggleCollapse, getEntries, clearForest, replaceForest, computeAllOverlaps } from '../core/forest.js';
import { showToast } from '../ui/toast.js';
import { getLeaves } from '../core/splitter.js';
import { DEFAULT_COLOR_CONFIG, getThemeColors } from '../core/color-themes.js';
import { getTheme } from '../ui/theme.js';

import { COLUMN_DEFS, computeJoinBars, renderInputRow, renderTableHeader, renderEmptyState } from './table-render.js';
import { renderTreeHeader, renderTreeDataRows } from './tree-rows.js';
import { attachInputRowHandlers } from './table-events.js';
import { serializeForest, deserializeConfig } from '../core/config.js';
import { autoLoad, saveConfig, loadConfig, loadExample, exportCsv } from './config-io.js';
import { createUndoManager } from '../core/undo.js';
import { wireHeroInput } from './hero-animation.js';
import { renderBelowTableControls } from './color-controls.js';
import { wireEventHandlers } from './event-wiring.js';
import { isSimpleMode, setSimpleMode, initSimpleMode, saveAdvancedState, loadAdvancedState } from '../ui/simple-mode.js';

// --- State ---
let tableContainer;
let colOrder = COLUMN_DEFS.map(c => c.key);
let visibleCols = new Set(COLUMN_DEFS.filter(c => c.defaultOn).map(c => c.key));
const DEFAULT_RANGE_COL = { style: 'short', sep: ' to ' };
let rangeDisplay = {
  range:  { ...DEFAULT_RANGE_COL },
  usable: { ...DEFAULT_RANGE_COL },
};

// Per-column number format — IPs and Hosts each track independently.
const DEFAULT_NUMBER_FMT = 'locale';
let numberDisplay = { ips: DEFAULT_NUMBER_FMT, hosts: DEFAULT_NUMBER_FMT };

// Notes column display: line clamp mode and font size.
const DEFAULT_NOTES_DISPLAY = { lines: '1', fontSize: 'normal' };
let notesDisplay = { ...DEFAULT_NOTES_DISPLAY };

// Color configuration: mode, theme, alternating colors.
let colorConfig = { ...DEFAULT_COLOR_CONFIG };

// Naming mode: 'manual' (flat, user-typed) or 'automatic' (hierarchical).
const DEFAULT_NAME_DISPLAY = { mode: 'manual' };
let nameDisplay = { ...DEFAULT_NAME_DISPLAY };

// VLAN macro display: global template and active preset name.
const DEFAULT_VLAN_DISPLAY = { template: '', presetName: '' };
let vlanDisplay = { ...DEFAULT_VLAN_DISPLAY };

// Column header tooltips: off by default, toggled via below-table controls.
let showTooltips = false;

// Unified warning toggle: gates overlap badges, VLAN warnings, and add-time toast.
let showWarnings = true;

// Padding 3px matches typical network tool density. Font ranges accommodate dense planning and presentation sizes.
const PAD_OPTS = { default: 3, min: 1, max: 12, step: 1 };
const cellPad = { value: PAD_OPTS.default };
// Font size controls (rem) for data rows and section headers independently.
const ROW_FONT_OPTS = { default: 0.875, min: 0.55, max: 1.25, step: 0.05 };
const HDR_FONT_OPTS = { default: 0.975, min: 0.55, max: 1.75, step: 0.05 };
const rowFontSize = { value: ROW_FONT_OPTS.default };
const hdrFontSize = { value: HDR_FONT_OPTS.default };
// Tracks the hero fade-out animation timeout so rapid renderTable() calls can cancel a stale fade.
let _fadeTimer = null;
// Read once from CSS --hero-fade-duration; parsed lazily on first use.
let _heroFadeMs = 0;
// Hero only shows on the very first load. Once dismissed (subnet added), it never returns.
let _heroDismissed = false;

// Undo/redo: 50 levels of in-memory state snapshots (session-only).
const undoMgr = createUndoManager(50);
let _skipUndoCapture = false;

// --- Simple / Advanced mode helpers ---

// Snapshot current column/padding state so it can be restored when leaving simple mode.
function captureAdvancedState() {
  return {
    colOrder: [...colOrder],
    visibleCols: [...visibleCols],
    cellPad: cellPad.value,
    rowFontSize: rowFontSize.value,
    hdrFontSize: hdrFontSize.value,
  };
}

// Restore previously saved advanced state (columns, padding, font sizes).
function restoreAdvancedState(state) {
  if (!state) return;
  colOrder.length = 0;
  (state.colOrder || COLUMN_DEFS.map(c => c.key)).forEach(k => colOrder.push(k));
  visibleCols.clear();
  (state.visibleCols || COLUMN_DEFS.filter(c => c.defaultOn).map(c => c.key)).forEach(k => visibleCols.add(k));
  if (state.cellPad != null) cellPad.value = state.cellPad;
  if (state.rowFontSize != null) rowFontSize.value = state.rowFontSize;
  if (state.hdrFontSize != null) hdrFontSize.value = state.hdrFontSize;
}

// Strip columns to essentials and zero padding for maximum density.
function applySimpleOverrides() {
  colOrder.length = 0;
  ['subnet', 'name', 'ips', 'join'].forEach(k => colOrder.push(k));
  visibleCols.clear();
  ['subnet', 'name', 'ips', 'join'].forEach(k => visibleCols.add(k));
  cellPad.value = 0;
}

// Bundle display-preference settings into a single object so render and
// serialize functions don't need 5+ positional parameters.
function getDisplaySettings() {
  return { rangeDisplay, numberDisplay, notesDisplay, colorConfig, nameDisplay, vlanDisplay, showWarnings, showTooltips };
}

// Rebuild the entire table HTML from the forest on every change.
function renderTable() {
  const entries = getEntries();

  // Cancel any pending fade-out so rapid calls don't fire stale renders.
  if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }

  // Fade out the empty hero before replacing content, so the transition
  // is visible when the first subnet is added.
  const existingHero = tableContainer.querySelector('.empty-hero');
  if (existingHero && entries.length > 0) {
    _heroDismissed = true;
    existingHero.classList.add('empty-hero--fading');
    // Read CSS custom property so JS and CSS stay in sync (F-18).
    if (!_heroFadeMs) {
      _heroFadeMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hero-fade-duration')) || 300;
    }
    _fadeTimer = setTimeout(() => { _fadeTimer = null; doRender(entries); }, _heroFadeMs);
    return;
  }

  doRender(entries);
}

// Separated from renderTable so the hero fade-out path (setTimeout 300ms)
// and the immediate path share identical rendering logic.
function doRender(entries) {
  const ds = getDisplaySettings();

  // Sync header/footer orb colors with the active color theme so the
  // ambient glow reflects whichever palette the user has chosen.
  const themeColors = getThemeColors(colorConfig.theme);
  const root = document.documentElement;
  root.style.setProperty('--orb-c1', themeColors[0]);
  root.style.setProperty('--orb-c2', themeColors[2]);

  // Compute global max depth across all non-collapsed trees so the join
  // column width is consistent. Add 1 so the rightmost column is always
  // free for the leaf's own prefix (green divide link).
  let maxBarDepth = 0;
  for (const entry of entries) {
    if (entry.collapsed) continue;
    const leaves = getLeaves(entry.tree);
    const { maxDepth } = computeJoinBars(entry.tree, leaves);
    if (maxDepth > maxBarDepth) maxBarDepth = maxDepth;
  }
  const globalMaxDepth = maxBarDepth + 1;

  // Save input state before rebuild so we can restore it after innerHTML
  // replacement (the inputs are inside the table).
  const existingInput = tableContainer.querySelector('.forest-input');
  const existingSid = tableContainer.querySelector('.forest-input-sid');
  const existingName = tableContainer.querySelector('.forest-input-name');
  const savedInputValue = existingInput ? existingInput.value : '';
  const savedSidValue = existingSid ? existingSid.value : '';
  const savedNameValue = existingName ? existingName.value : '';
  const focusedClass = document.activeElement?.classList;
  const savedFocusTarget = focusedClass?.contains('forest-input') ? 'subnet'
    : focusedClass?.contains('forest-input-sid') ? 'sid'
    : focusedClass?.contains('forest-input-name') ? 'name' : null;

  // --- Build table HTML ---
  let html = `<table class="splitter-table" aria-label="Subnet split results" style="--cell-pad-v:${cellPad.value}px;--cell-pad-h:${cellPad.value}px;--row-font-size:${rowFontSize.value}rem;--header-font-size:${hdrFontSize.value}rem">`;

  const isDarkTheme = getTheme() === 'dark';

  html += renderTableHeader(colOrder, visibleCols, globalMaxDepth, colorConfig, showTooltips);

  // Compute which entries overlap so tree headers can show a persistent warning (F-01).
  const overlappingIds = computeAllOverlaps(entries);
  // Bundle warning context so tree-rows can render overlap badges and RFC tooltips.
  const warnings = showWarnings ? { overlappingIds, entries, showTooltips } : null;

  html += '<tbody>';
  html += renderInputRow(colOrder, visibleCols, globalMaxDepth);
  entries.forEach((entry, idx) => {
    html += renderTreeHeader(entry, colOrder, visibleCols, globalMaxDepth, idx === 0, idx === entries.length - 1, ds, warnings);
    if (!entry.collapsed) {
      const { html: rowsHtml } = renderTreeDataRows(entry, globalMaxDepth, colOrder, visibleCols, ds, isDarkTheme);
      html += rowsHtml;
    }
  });
  html += '</tbody></table>';

  // Padding and color controls below the table
  if (entries.length > 0) {
    html += renderBelowTableControls(colorConfig, showTooltips, showWarnings);
  }

  // Show empty hero only on initial load (before any subnet has been added).
  // After the hero is dismissed, reset shows the normal empty table instead.
  if (entries.length === 0 && !_heroDismissed) {
    html += renderEmptyState();
  }

  tableContainer.innerHTML = html;

  // --- Restore input state ---
  const inputRow = tableContainer.querySelector('.forest-input-row');
  const newInput = tableContainer.querySelector('.forest-input');
  const newSid = tableContainer.querySelector('.forest-input-sid');
  const newName = tableContainer.querySelector('.forest-input-name');
  if (inputRow) {
    if (newInput) newInput.value = savedInputValue;
    if (newSid) newSid.value = savedSidValue;
    if (newName) newName.value = savedNameValue;
    attachInputRowHandlers(inputRow, onSubnetSubmit);
    if (savedInputValue && newInput) newInput.dispatchEvent(new Event('input'));
    // Restore focus to whichever input had it before re-render.
    const focusMap = { subnet: newInput, sid: newSid, name: newName };
    const restoreEl = focusMap[savedFocusTarget];
    if (restoreEl) {
      restoreEl.focus();
      restoreEl.setSelectionRange(restoreEl.value.length, restoreEl.value.length);
    }
  }

  // --- Wire hero input if visible ---
  const heroInput = tableContainer.querySelector('.hero-input');
  if (heroInput) {
    const dismissHero = wireHeroInput(heroInput, onSubnetSubmit);

    // Clicking the table input row dismisses the hero permanently and
    // lets the user type directly into the top row instead.
    if (inputRow) {
      inputRow.querySelectorAll('input').forEach(el => {
        el.addEventListener('focus', () => {
          dismissHero();
          _heroDismissed = true;
          if (!_heroFadeMs) {
            _heroFadeMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hero-fade-duration')) || 300;
          }
          // Remove hero from DOM after fade completes.
          const hero = tableContainer.querySelector('.empty-hero');
          if (hero) setTimeout(() => hero.remove(), _heroFadeMs);
        }, { once: true });
      });
    }
  }

  // Delegate all event handler wiring to the extracted module (F-02).
  wireEventHandlers(tableContainer, entries, ds, {
    renderTable, colOrder, visibleCols, colorConfig, vlanDisplay,
    rangeDisplay, numberDisplay, notesDisplay, nameDisplay,
    cellPad, PAD_OPTS, rowFontSize, ROW_FONT_OPTS, hdrFontSize, HDR_FONT_OPTS,
    undoMgr, skipUndoCapture: () => _skipUndoCapture,
    toggleCollapse, removeTree, moveTree,
    showTooltips, showWarnings,
    setColorConfig: (v) => { colorConfig = v; },
    setNotesDisplay: (v) => { notesDisplay = v; },
    setNameDisplay: (v) => { nameDisplay = v; },
    setVlanDisplay: (v) => { vlanDisplay = v; },
    setShowTooltips: (v) => { showTooltips = v; },
    setShowWarnings: (v) => { showWarnings = v; },
  });
}

// --- Undo / Redo ---

// Snapshot current app state as a JSON string for the undo manager.
function currentSnapshot() {
  return JSON.stringify(
    serializeForest(getEntries(), colOrder, [...visibleCols], getDisplaySettings())
  );
}

function performUndo() {
  const snap = undoMgr.undo(currentSnapshot());
  if (!snap) return;
  _skipUndoCapture = true;
  restoreState(deserializeConfig(JSON.parse(snap)));
  _skipUndoCapture = false;
}

function performRedo() {
  const snap = undoMgr.redo(currentSnapshot());
  if (!snap) return;
  _skipUndoCapture = true;
  restoreState(deserializeConfig(JSON.parse(snap)));
  _skipUndoCapture = false;
}

// --- Actions ---

// Called when the user presses Enter on a valid subnet in the input row.
// Optional sectionId and name are applied to the new entry if provided.
function onSubnetSubmit(subnet, sectionId, name) {
  const { entry, overlaps, conflicts } = addTree(subnet);
  if (sectionId) entry.sectionId = sectionId;
  if (name) entry.name = name;
  if (overlaps && showWarnings) {
    showToast(formatOverlapWarning(subnet, conflicts), 'warning', 5000);
  }
  renderTable();
}

// Build a human-readable warning from the conflicts array returned by addTree().
// Groups by relationship type so the message stays concise even with many conflicts.
function formatOverlapWarning(subnet, conflicts) {
  const label = subnet.toString();
  const parts = conflicts.map(({ entry: e, relationship }) => {
    const other = e.tree.subnet.toString();
    if (relationship === 'contained-by') return `${label} is contained by ${other}`;
    if (relationship === 'contains') return `${label} contains ${other}`;
    return `${label} overlaps ${other}`;
  });
  return parts.join('; ');
}

// Replace current state with deserialized config and re-render everything.
function restoreState(c) {
  replaceForest(c.entries);
  if (c.colOrder) colOrder = c.colOrder;
  if (c.visibleCols) visibleCols = new Set(c.visibleCols);
  if (c.rangeDisplay) rangeDisplay = c.rangeDisplay;
  if (c.numberDisplay) numberDisplay = c.numberDisplay;
  if (c.notesDisplay != null) notesDisplay = c.notesDisplay;
  if (c.colorConfig != null) colorConfig = c.colorConfig;
  if (c.nameDisplay != null) nameDisplay = c.nameDisplay;
  if (c.vlanDisplay != null) vlanDisplay = c.vlanDisplay;
  // Preserve loaded config as the advanced baseline, then enforce simple overrides.
  if (isSimpleMode()) {
    saveAdvancedState(captureAdvancedState());
    applySimpleOverrides();
  }
  renderTable();
}

// Clear all trees and display settings after user confirmation.
function resetAll() {
  if (!confirm('Remove all subnets and start fresh?')) return;
  undoMgr.clear();
  clearForest();
  colOrder = COLUMN_DEFS.map(c => c.key);
  visibleCols = new Set(COLUMN_DEFS.filter(c => c.defaultOn).map(c => c.key));
  rangeDisplay = { range: { ...DEFAULT_RANGE_COL }, usable: { ...DEFAULT_RANGE_COL } };
  numberDisplay = { ips: DEFAULT_NUMBER_FMT, hosts: DEFAULT_NUMBER_FMT };
  notesDisplay = { ...DEFAULT_NOTES_DISPLAY };
  colorConfig = { ...DEFAULT_COLOR_CONFIG };
  nameDisplay = { ...DEFAULT_NAME_DISPLAY };
  vlanDisplay = { ...DEFAULT_VLAN_DISPLAY };
  // After resetting defaults, save them as advanced baseline and re-apply simple overrides.
  if (isSimpleMode()) {
    saveAdvancedState(captureAdvancedState());
    applySimpleOverrides();
  }
  renderTable();
}

// --- Init ---

// Called once from main.js on boot. Wires up DOM references, event
// listeners, and renders the initial empty state.
export function initSplitterView() {
  tableContainer = document.getElementById('splitter-table-container');
  tableContainer.setAttribute('aria-live', 'polite');

  const saveBtn = document.getElementById('save-config-btn');
  const loadBtn = document.getElementById('load-config-btn');
  const exportBtn = document.getElementById('export-csv-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (saveBtn) saveBtn.addEventListener('click', () =>
    saveConfig(getEntries(), colOrder, [...visibleCols], getDisplaySettings()));
  if (loadBtn) loadBtn.addEventListener('click', () =>
    loadConfig(restoreState));
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const entries = getEntries();
    const allLeaves = entries.flatMap(e => getLeaves(e.tree));
    exportCsv(entries, allLeaves, colOrder, visibleCols, getDisplaySettings());
  });
  if (resetBtn) resetBtn.addEventListener('click', resetAll);

  // "Load Example" in the page footer — one-click demo for new users.
  const exampleLink = document.querySelector('.load-example-link');
  if (exampleLink) exampleLink.addEventListener('click', () => loadExample(restoreState));

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y = redo.
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); performUndo(); }
    else if (e.key === 'z' && e.shiftKey) { e.preventDefault(); performRedo(); }
    else if (e.key === 'y') { e.preventDefault(); performRedo(); }
  });

  // Warn before closing the tab when there's active subnet data,
  // since localStorage could be cleared between sessions.
  // Skip the warning for same-origin navigation (e.g. the about page link).
  let _navigatingAway = false;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a && a.origin === location.origin) _navigatingAway = true;
  });
  window.addEventListener('beforeunload', (e) => {
    if (_navigatingAway) return;
    if (getEntries().length > 0) e.preventDefault();
  });

  // Wire simple/advanced mode toggle before loading saved state,
  // so the mode is set before the first render.
  initSimpleMode((wantSimple) => {
    _skipUndoCapture = true;
    if (wantSimple) {
      saveAdvancedState(captureAdvancedState());
      setSimpleMode(true);
      applySimpleOverrides();
    } else {
      setSimpleMode(false);
      const adv = loadAdvancedState();
      if (adv) restoreAdvancedState(adv);
      showToast(
        'Advanced mode: column reorder/hide, Description, Notes, VLAN, '
        + 'Mask, Wildcard, Usable, Hosts columns, font & padding controls, '
        + 'column settings menus, and tree move arrows',
        'info', 5000
      );
    }
    renderTable();
    _skipUndoCapture = false;
  });

  // Restore previous session from localStorage if available, otherwise
  // show the empty state (just the input row, ready for user input).
  const saved = autoLoad();
  if (saved) {
    restoreState(saved);
  } else {
    // Apply simple overrides on fresh load if the user left simple mode active.
    if (isSimpleMode()) applySimpleOverrides();
    renderTable();
  }
}