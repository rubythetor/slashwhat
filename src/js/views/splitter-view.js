/*\! © 2026 slashwhat. MIT License. */
// splitter-view.js — Orchestrator for splitter state and app-level wiring.
// Keeps mutable UI state in one place while delegating rendering, event
// wiring, and editing behavior to focused modules.

import { addTree, removeTree, moveTree, toggleCollapse, getEntries, clearForest, replaceForest } from '../core/forest.js';
import { getLeaves } from '../core/splitter.js';
import { DEFAULT_COLOR_CONFIG } from '../core/color-themes.js';
import { serializeForest, deserializeConfig } from '../core/config.js';
import { createUndoManager } from '../core/undo.js';
import { showToast } from '../ui/toast.js';
import { isSimpleMode, setSimpleMode, initSimpleMode, saveAdvancedState, loadAdvancedState } from '../ui/simple-mode.js';
import { COLUMN_DEFS } from './table-render.js';
import { autoLoad, saveConfig, loadConfig, loadExample, exportCsv } from './config-io.js';
import { wireEventHandlers } from './event-wiring.js';
import { renderSplitterTable } from './splitter-table-cycle.js';
import { isTextEditingTarget, isSameTabInternalNavigation } from './navigation-guards.js';

let tableContainer;
let colOrder = COLUMN_DEFS.map(c => c.key);
let visibleCols = new Set(COLUMN_DEFS.filter(c => c.defaultOn).map(c => c.key));
const DEFAULT_RANGE_COL = { style: 'short', sep: ' to ' };
let rangeDisplay = { range: { ...DEFAULT_RANGE_COL }, usable: { ...DEFAULT_RANGE_COL } };
const DEFAULT_NUMBER_FMT = 'locale';
let numberDisplay = { ips: DEFAULT_NUMBER_FMT, hosts: DEFAULT_NUMBER_FMT };
const DEFAULT_NOTES_DISPLAY = { lines: '1', fontSize: 'normal' };
let notesDisplay = { ...DEFAULT_NOTES_DISPLAY };
let colorConfig = { ...DEFAULT_COLOR_CONFIG };
const DEFAULT_NAME_DISPLAY = { mode: 'manual' };
let nameDisplay = { ...DEFAULT_NAME_DISPLAY };
const DEFAULT_VLAN_DISPLAY = { template: '', presetName: '' };
let vlanDisplay = { ...DEFAULT_VLAN_DISPLAY };
let showTooltips = false;
let showWarnings = true;

const PAD_OPTS = { default: 3, min: 1, max: 12, step: 1 };
const cellPad = { value: PAD_OPTS.default };
const ROW_FONT_OPTS = { default: 0.875, min: 0.55, max: 1.25, step: 0.05 };
const HDR_FONT_OPTS = { default: 0.975, min: 0.55, max: 1.75, step: 0.05 };
const rowFontSize = { value: ROW_FONT_OPTS.default };
const hdrFontSize = { value: HDR_FONT_OPTS.default };

// Hero state is stored in a mutable object so renderer and orchestrator share
// fade timing and dismissal behavior without hidden globals.
const heroState = { fadeTimer: null, heroFadeMs: 0, dismissed: false };

const undoMgr = createUndoManager(8);
let _skipUndoCapture = false;

// Snapshot advanced layout choices so simple mode can temporarily override them.
function captureAdvancedState() {
  return {
    colOrder: [...colOrder],
    visibleCols: [...visibleCols],
    cellPad: cellPad.value,
    rowFontSize: rowFontSize.value,
    hdrFontSize: hdrFontSize.value,
  };
}

// Restore advanced-mode layout state when exiting simple mode.
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

// Simple mode prioritizes density and speed for rapid subnet splitting sessions.
function applySimpleOverrides() {
  colOrder.length = 0;
  ['subnet', 'name', 'ips', 'join'].forEach(k => colOrder.push(k));
  visibleCols.clear();
  ['subnet', 'name', 'ips', 'join'].forEach(k => visibleCols.add(k));
  cellPad.value = 0;
}

// Bundle display settings so persistence, rendering, and export stay in sync.
function getDisplaySettings() {
  return { rangeDisplay, numberDisplay, notesDisplay, colorConfig, nameDisplay, vlanDisplay, showWarnings, showTooltips };
}

// Build event-wiring context from current state so each rerender wires handlers
// against fresh values and state-mutating callbacks.
function buildWireContext() {
  return {
    renderTable, colOrder, visibleCols, colorConfig, vlanDisplay,
    rangeDisplay, numberDisplay, notesDisplay, nameDisplay,
    cellPad, PAD_OPTS, rowFontSize, ROW_FONT_OPTS, hdrFontSize, HDR_FONT_OPTS,
    undoMgr, skipUndoCapture: () => _skipUndoCapture,
    toggleCollapse, removeTree, moveTree, showTooltips, showWarnings,
    setColorConfig: (v) => { colorConfig = v; },
    setNotesDisplay: (v) => { notesDisplay = v; },
    setNameDisplay: (v) => { nameDisplay = v; },
    setVlanDisplay: (v) => { vlanDisplay = v; },
    setShowTooltips: (v) => { showTooltips = v; },
    setShowWarnings: (v) => { showWarnings = v; },
    resetToSimpleMode: () => { setSimpleMode(true); applySimpleOverrides(); },
  };
}

// Render through the dedicated cycle module so orchestrator code stays focused
// on state transitions rather than DOM reconstruction details.
function renderTable() {
  renderSplitterTable({
    tableContainer,
    getEntries,
    getDisplaySettings,
    colOrder,
    visibleCols,
    cellPad,
    rowFontSize,
    hdrFontSize,
    heroState,
    onSubnetSubmit,
    onAfterRender: (entries, ds) => {
      wireEventHandlers(tableContainer, entries, ds, buildWireContext());
    },
  });
}

// Serialize current state into an undo snapshot for cross-feature consistency.
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

// Add subnet tree and immediately surface overlap context when warnings are enabled.
function onSubnetSubmit(subnet, sectionId, name) {
  const { entry, overlaps, conflicts } = addTree(subnet);
  if (sectionId) entry.sectionId = sectionId;
  if (name) entry.name = name;
  if (overlaps && showWarnings) {
    showToast(formatOverlapWarning(subnet, conflicts), 'warning', 5000);
  }
  renderTable();
}

// Explain overlap relationships explicitly so warnings are actionable.
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

// Replace in-memory state from a validated config payload.
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
  if (isSimpleMode()) {
    saveAdvancedState(captureAdvancedState());
    applySimpleOverrides();
  }
  renderTable();
}

// Reset all persisted display/tree state while preserving the hero dismissal rule.
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
  if (isSimpleMode()) {
    saveAdvancedState(captureAdvancedState());
    applySimpleOverrides();
  }
  renderTable();
}

// Called once from main.js. Wires controls, global shortcuts, unload guard,
// and restores autosaved state before first interaction.
export function initSplitterView() {
  tableContainer = document.getElementById('splitter-table-container');
  tableContainer.setAttribute('aria-live', 'polite');

  const saveBtn = document.getElementById('save-config-btn');
  const loadBtn = document.getElementById('load-config-btn');
  const exportBtn = document.getElementById('export-csv-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveConfig(getEntries(), colOrder, [...visibleCols], getDisplaySettings());
    });
  }
  if (loadBtn) loadBtn.addEventListener('click', () => loadConfig(restoreState));
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const entries = getEntries();
      const allLeaves = entries.flatMap(e => getLeaves(e.tree));
      exportCsv(entries, allLeaves, colOrder, visibleCols, getDisplaySettings());
    });
  }
  if (resetBtn) resetBtn.addEventListener('click', resetAll);

  const exampleLink = document.querySelector('.load-example-link');
  if (exampleLink) exampleLink.addEventListener('click', () => loadExample(restoreState));

  // Respect native text-editing undo/redo while still offering app-level undo.
  document.addEventListener('keydown', (e) => {
    if (isTextEditingTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      performUndo();
    } else if (key === 'z' && e.shiftKey) {
      e.preventDefault();
      performRedo();
    } else if (key === 'y') {
      e.preventDefault();
      performRedo();
    }
  });

  // Allow intentional same-tab internal navigation without stale unload bypass.
  let allowUnloadForNavigation = false;
  document.addEventListener('click', (e) => {
    if (!isSameTabInternalNavigation(e, location.origin)) return;
    allowUnloadForNavigation = true;
    setTimeout(() => { allowUnloadForNavigation = false; }, 0);
  });
  window.addEventListener('pageshow', () => { allowUnloadForNavigation = false; });
  window.addEventListener('beforeunload', (e) => {
    if (allowUnloadForNavigation || getEntries().length === 0) return;
    e.preventDefault();
    e.returnValue = '';
  });

  // Apply mode before first render so column defaults match user preference.
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

  const saved = autoLoad();
  if (saved) {
    restoreState(saved);
  } else {
    if (isSimpleMode()) applySimpleOverrides();
    renderTable();
  }
}
