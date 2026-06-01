/*\! © 2026 slashwhat. MIT License. */
// config.js — Serialize and deserialize slashwhat configurations.
// Pure logic, no DOM. Validation is delegated to config-validate.js.

import { Subnet } from './subnet.js';
import { setNextNodeId } from './splitter.js';
import { COLOR_MODES, THEMES, DEFAULT_COLOR_CONFIG } from './color-themes.js';

const APP_ID = 'slashwhat';
const CURRENT_VERSION = 2;

// Max lengths for user-editable text fields from config files.
// Silently truncates rather than rejecting, so crafted configs degrade gracefully.
const MAX_LABEL = 200;
const MAX_SEP = 10;
const MAX_DESC = 200;
const MAX_NOTES = 2000;
const MAX_NAME = 200;
const MAX_SECTION_ID = 10;

// Truncate a string to maxLen characters. Returns '' for non-string input.
function clampStr(val, maxLen) {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen);
}

// Re-export validateConfig from the dedicated validation module so
// existing import sites don't need to change their import paths.
export { validateConfig } from './config-validate.js';
import { KNOWN_COLS } from './config-validate.js';

// --- Internal helpers ---

// Walk a single tree breadth-first and flatten every node into a plain
// object. Each node stores its children as [id, id] or null (leaf).
function flattenTree(tree) {
  const nodes = [];
  const queue = [tree];

  while (queue.length > 0) {
    const node = queue.shift();
    nodes.push({
      id: node.id,
      cidr: node.subnet.toString(),
      label: node.label ?? '',
      separator: node.separator ?? '-',
      description: node.description ?? '',
      notes: node.notes ?? '',
      color: node.color ?? null,
      children: node.children
        ? [node.children[0].id, node.children[1].id]
        : null,
    });
    if (node.children) {
      queue.push(node.children[0], node.children[1]);
    }
  }
  return nodes;
}

// Rebuild a live tree from a flat node array. Creates Subnet objects,
// links parent/child pointers, and restores labels and separators.
function rebuildTree(nodes) {
  const nodeMap = new Map();

  // First pass: create all nodes with subnets but no links yet.
  for (const n of nodes) {
    nodeMap.set(n.id, {
      id: n.id,
      subnet: Subnet.parse(n.cidr),
      label: clampStr(n.label ?? '', MAX_LABEL),
      separator: clampStr(n.separator ?? '-', MAX_SEP),
      description: clampStr(n.description ?? '', MAX_DESC),
      notes: clampStr(n.notes ?? '', MAX_NOTES),
      color: n.color ?? null,
      children: null,
      parent: null,
    });
  }

  // Second pass: wire up children and parent pointers.
  for (const n of nodes) {
    if (n.children) {
      const parent = nodeMap.get(n.id);
      const left = nodeMap.get(n.children[0]);
      const right = nodeMap.get(n.children[1]);
      parent.children = [left, right];
      left.parent = parent;
      right.parent = parent;
    }
  }

  // Find the root (the node with no parent after linking).
  let tree = null;
  for (const node of nodeMap.values()) {
    if (node.parent === null) { tree = node; break; }
  }
  return tree;
}

// --- Serialization ---

// Serialize the full forest state into the v2 JSON format. Each tree
// becomes an entry in the "trees" array with its metadata.
export function serializeForest(entries, colOrder, visibleCols, ds) {
  const { rangeDisplay, numberDisplay, notesDisplay, colorConfig, nameDisplay, vlanDisplay } = ds;
  const trees = entries.map(entry => ({
    forestId: entry.id,
    rootCIDR: entry.tree.subnet.toString(),
    collapsed: entry.collapsed,
    description: entry.description ?? '',
    notes: entry.notes ?? '',
    name: entry.name ?? '',
    sectionId: entry.sectionId ?? '',
    vlanTemplate: entry.vlanTemplate ?? '',
    nodes: flattenTree(entry.tree),
  }));

  return {
    app: APP_ID,
    description: 'Subnet configuration exported from slashwhat.net',
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    trees,
    colOrder: [...colOrder],
    visibleCols: [...visibleCols],
    rangeDisplay,
    numberDisplay,
    notesDisplay: notesDisplay ?? { lines: '1', fontSize: 'normal' },
    colorConfig: colorConfig ?? { ...DEFAULT_COLOR_CONFIG },
    nameDisplay: nameDisplay ?? { mode: 'manual' },
    vlanDisplay: vlanDisplay ?? { template: '', presetName: '' },
  };
}

// --- Deserialization ---

// Deserialize a validated v2 config into forest entries plus display settings.
export function deserializeConfig(json) {
  const entries = json.trees.map(t => ({
    id: t.forestId ?? 0,
    tree: rebuildTree(t.nodes),
    collapsed: t.collapsed ?? false,
    description: clampStr(t.description ?? '', MAX_DESC),
    notes: clampStr(t.notes ?? '', MAX_NOTES),
    name: clampStr(t.name ?? '', MAX_NAME),
    sectionId: clampStr(t.sectionId ?? '', MAX_SECTION_ID),
    vlanTemplate: clampStr(t.vlanTemplate ?? '', MAX_LABEL),
  }));

  // Advance the global ID counter past all existing node IDs so future
  // splitNode() calls don't create nodes with duplicate IDs.
  let maxNodeId = 0;
  for (const entry of entries) {
    const findMax = (node) => {
      if (!node) return;
      if (node.id > maxNodeId) maxNodeId = node.id;
      if (node.children) {
        findMax(node.children[0]);
        findMax(node.children[1]);
      }
    };
    findMax(entry.tree);
  }
  setNextNodeId(maxNodeId + 1);

  // Only keep columns that still exist so configs with unknown
  // column keys don't cause rendering errors.
  const colOrder = Array.isArray(json.colOrder)
    ? json.colOrder.filter(k => KNOWN_COLS.has(k))
    : null;
  const visibleCols = Array.isArray(json.visibleCols)
    ? json.visibleCols.filter(k => KNOWN_COLS.has(k))
    : null;

  // Allowlist of values accepted by formatRange() — rejects unknown values from crafted configs.
  const VALID_STYLES = new Set(['short', 'shorter', 'full', 'tail', 'dots']);
  const VALID_SEPS = new Set(['-', ' - ', '\u2013', '\u2014', ' to ', ' To ', ':', '_', ' ']);
  const defaultCol = { style: 'short', sep: ' to ' };

  // Clamp each range-display setting to known-safe values so malformed configs degrade to defaults.
  function sanitizeCol(raw) {
    if (!raw || typeof raw !== 'object') return { ...defaultCol };
    return {
      style: VALID_STYLES.has(raw.style) ? raw.style : defaultCol.style,
      sep: VALID_SEPS.has(raw.sep) ? raw.sep : defaultCol.sep,
    };
  }

  const rd = json.rangeDisplay && typeof json.rangeDisplay === 'object'
    ? json.rangeDisplay
    : {};
  const rangeDisplay = {
    range: sanitizeCol(rd.range),
    usable: sanitizeCol(rd.usable),
  };

  // Per-column number format with validation.
  const VALID_NUM_FMTS = new Set(['locale', 'si', 'si1', 'raw']);
  const nd = json.numberDisplay && typeof json.numberDisplay === 'object'
    ? json.numberDisplay
    : {};
  const numberDisplay = {
    ips: VALID_NUM_FMTS.has(nd.ips) ? nd.ips : 'locale',
    hosts: VALID_NUM_FMTS.has(nd.hosts) ? nd.hosts : 'locale',
  };

  // Notes display settings with validation.
  const VALID_LINES = new Set(['1', '2', '3', 'all']);
  const VALID_SIZES = new Set(['normal', 'small', 'smallest']);
  const ndd = json.notesDisplay && typeof json.notesDisplay === 'object'
    ? json.notesDisplay
    : {};
  const notesDisplay = {
    lines: VALID_LINES.has(ndd.lines) ? ndd.lines : '1',
    fontSize: VALID_SIZES.has(ndd.fontSize) ? ndd.fontSize : 'normal',
  };

  // Color config with validation — unknown modes/themes fall back to defaults.
  const VALID_MODES = new Set(COLOR_MODES);
  const VALID_THEMES = new Set(THEMES.map(t => t.name));
  const cc = json.colorConfig && typeof json.colorConfig === 'object'
    ? json.colorConfig
    : {};
  const colorConfig = {
    mode: VALID_MODES.has(cc.mode) ? cc.mode : DEFAULT_COLOR_CONFIG.mode,
    theme: VALID_THEMES.has(cc.theme) ? cc.theme : DEFAULT_COLOR_CONFIG.theme,
    altColors: Array.isArray(cc.altColors) && cc.altColors.length === 2
      && cc.altColors.every(c => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c))
      ? cc.altColors
      : [...DEFAULT_COLOR_CONFIG.altColors],
  };

  // Name display mode with validation.
  const VALID_NAME_MODES = new Set(['manual', 'automatic']);
  const nmd = json.nameDisplay && typeof json.nameDisplay === 'object'
    ? json.nameDisplay
    : {};
  const nameDisplay = {
    mode: VALID_NAME_MODES.has(nmd.mode) ? nmd.mode : 'manual',
  };

  // VLAN display settings with validation.
  const vd = json.vlanDisplay && typeof json.vlanDisplay === 'object'
    ? json.vlanDisplay
    : {};
  const vlanDisplay = {
    template: clampStr(vd.template ?? '', MAX_LABEL),
    presetName: clampStr(vd.presetName ?? '', MAX_LABEL),
  };

  return { entries, colOrder, visibleCols, rangeDisplay, numberDisplay, notesDisplay, colorConfig, nameDisplay, vlanDisplay };
}
