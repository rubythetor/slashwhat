/*\! © 2026 slashwhat. MIT License. */
// forest.js — Ordered collection of independent subnet trees.
// Pure logic, no DOM. The forest model allows users to work with multiple
// subnets simultaneously. Each entry wraps a tree root with metadata
// (id, collapsed state). The view layer iterates entries to render
// per-tree sections in a single table.

import { buildTreeKeepingIds, findNodeById } from './splitter.js';
import { initNodeName } from './naming.js';

// Unique ID for each tree entry, used as DOM data-attribute. Never reused after deletion to avoid stale references.
let _forestId = 0;

// The ordered list of tree entries. New trees prepend (appear at top,
// directly below the input row).
let _entries = [];

// Detect whether a new subnet overlaps any existing tree root in the forest.
// Returns overlap info so the caller can warn the user without blocking the add.
export function checkOverlap(subnet, entries) {
  const conflicts = [];
  for (const entry of entries) {
    const root = entry.tree.subnet;
    if (root.isIPv4 !== subnet.isIPv4) continue;

    if (subnet.containsSubnet(root)) {
      conflicts.push({ entry, relationship: 'contains' });
    } else if (root.containsSubnet(subnet)) {
      conflicts.push({ entry, relationship: 'contained-by' });
    } else if (root.overlaps(subnet)) {
      conflicts.push({ entry, relationship: 'overlaps' });
    }
  }
  return { overlaps: conflicts.length > 0, conflicts };
}

// Add a new subnet tree to the forest. Prepends so it appears directly
// below the input row, pushing existing trees down. Returns the new entry
// plus overlap info so the view can warn about conflicting address space.
export function addTree(subnet) {
  const overlapInfo = checkOverlap(subnet, _entries);
  const tree = buildTreeKeepingIds(subnet);
  initNodeName(tree);
  const entry = { id: _forestId++, tree, collapsed: false, description: '', notes: '', name: '', sectionId: '' };
  _entries.unshift(entry);
  return { entry, ...overlapInfo };
}

// Remove a tree by its forest entry ID. Used when the user clicks the
// delete button on a tree header row.
export function removeTree(forestId) {
  _entries = _entries.filter(e => e.id !== forestId);
}

// Swap a tree with its neighbor to reorder. Direction is -1 (move up,
// toward the input row) or +1 (move down, away from input row).
// No-op if the tree is already at the boundary.
export function moveTree(forestId, direction) {
  const idx = _entries.findIndex(e => e.id === forestId);
  if (idx === -1) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= _entries.length) return;
  [_entries[idx], _entries[targetIdx]] = [_entries[targetIdx], _entries[idx]];
}

// Toggle the collapsed state of a tree. Collapsed trees only show their
// header row; their data rows are hidden.
export function toggleCollapse(forestId) {
  const entry = _entries.find(e => e.id === forestId);
  if (entry) entry.collapsed = !entry.collapsed;
}

// Return the full ordered entries array. The view iterates this to
// render tree sections in order.
export function getEntries() {
  return [..._entries];
}

// Search all trees for a node by its globally unique ID. Needed because
// DOM events only carry a node ID and we need to find which tree it
// belongs to for split/merge/name operations.
export function findNodeAcrossForest(nodeId) {
  for (const entry of _entries) {
    const found = findNodeById(entry.tree, nodeId);
    if (found) return found;
  }
  return null;
}

// Compute pairwise overlaps across all tree roots. Returns a Set of entry IDs
// that overlap with at least one other entry. O(n²) but n is the number of
// trees (typically < 20), so negligible. Used by the view to mark overlapping
// section headers with a persistent visual indicator.
export function computeAllOverlaps(entries) {
  const overlapping = new Set();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i].tree.subnet;
      const b = entries[j].tree.subnet;
      if (a.isIPv4 !== b.isIPv4) continue;
      if (a.containsSubnet(b) || b.containsSubnet(a) || a.overlaps(b)) {
        overlapping.add(entries[i].id);
        overlapping.add(entries[j].id);
      }
    }
  }
  return overlapping;
}

// Remove all entries and reset the ID counter. Used when the user
// loads a new config or wants a clean slate.
export function clearForest() {
  _entries = [];
  _forestId = 0;
}

// Replace the entire entries array. Used by deserialization to load
// a saved forest state. Also advances the forestId counter past
// existing IDs to avoid collisions with future addTree() calls.
export function replaceForest(entries) {
  _entries = entries;
  const maxId = entries.reduce((m, e) => Math.max(m, e.id), -1);
  _forestId = maxId + 1;
}

