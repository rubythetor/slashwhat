/*\! © 2026 slashwhat. MIT License. */
// naming.js — Hierarchical subnet naming with inherited prefixes and separators.
// Pure data logic, no DOM or rendering.
//
// Each tree node has a label (user-editable name) and a separator (character
// between this label and its parent's label, default "-"). The full display
// name of a leaf is built by walking root→leaf and joining non-empty labels
// with their separators: e.g. "Servers" → "Servers-Web" → "Servers-Web-1".

// Initialize naming properties on the root node when a new tree is created.
// Called once when the user enters a subnet and the tree is first built.
export function initNodeName(node) {
  node.label = '';
  node.separator = '-';
  node.description = '';
  node.notes = '';
}

// Assign default labels to newly split children and inherit the parent's
// separator. When autoLabel is true (automatic naming mode), children always
// get "1"/"2". When false (manual mode), children only get "1"/"2" if the
// parent already has a label — so splitting "Servers" still produces
// "Servers-1"/"Servers-2", but splitting an unnamed node stays blank.
// Guard: if parent has no children (called on a leaf by mistake), bail out.
export function initChildNames(parent, autoLabel = true) {
  if (!parent.children) return;
  const [a, b] = parent.children;
  const parentLabel = parent.label ?? '';
  if (autoLabel) {
    // Automatic (hierarchical) mode: always "1"/"2", joined via separators.
    a.label = '1';
    b.label = '2';
  } else if (parentLabel) {
    // Manual (flat) mode with a named parent: copy the full name with a
    // numeric suffix so "Chicken" becomes "Chicken 1" / "Chicken 2".
    a.label = `${parentLabel} 1`;
    b.label = `${parentLabel} 2`;
  } else {
    a.label = '';
    b.label = '';
  }
  a.separator = parent.separator ?? '-';
  b.separator = parent.separator ?? '-';
  a.description = parent.description ?? '';
  b.description = parent.description ?? '';
  a.notes = parent.notes ?? '';
  b.notes = parent.notes ?? '';
  a.vlanTemplate = parent.vlanTemplate ?? '';
  b.vlanTemplate = parent.vlanTemplate ?? '';
}

// Walk from a leaf up to the root and return the naming path.
// Each entry has { id, label, separator } — the view uses this to render
// clickable name segments. Returned in root-to-leaf order so the display
// reads naturally left to right.
// The ?? fallbacks handle nodes that were created before naming was added
// (e.g. if the tree was built by an older version of splitter.js).
export function getNamePath(leaf) {
  const path = [];
  let node = leaf;
  while (node) {
    path.push({ id: node.id, label: node.label ?? '', separator: node.separator ?? '-' });
    node = node.parent;
  }
  path.reverse();
  return path;
}

// Walk all nodes in a tree (pre-order). Used by conversion functions
// that need to visit every node, not just leaves.
function walkAll(node, fn) {
  if (!node) return;
  fn(node);
  if (node.children) {
    walkAll(node.children[0], fn);
    walkAll(node.children[1], fn);
  }
}

// Convert manual flat labels to automatic hierarchical segments.
// Fills the root→leaf path with positional numbers ("1"/"2" for left/right),
// keeping only user-assigned leaf names. If root is unnamed but the entry has
// a section name, it's copied to root so it appears leftmost in the path.
// Leaves with default manual names ("{parent} 1"/"{parent} 2") are replaced
// with positional; user-renamed leaves are preserved.
// Returns count of labels converted (for toast feedback).
export function convertManualToAutomatic(entries) {
  let converted = 0;
  for (const entry of entries) {
    const root = entry.tree;

    // Copy section name to root if root is unnamed
    if (!(root.label ?? '') && (entry.name ?? '')) {
      root.label = entry.name;
      converted++;
    }

    // Snapshot original labels for default-name detection on leaves
    const originals = new Map();
    walkAll(root, node => originals.set(node, node.label ?? ''));

    walkAll(root, node => {
      if (!node.parent) return;
      const pos = node === node.parent.children[0] ? '1' : '2';
      const isLeaf = node.children === null;

      if (!isLeaf) {
        // Internal node: always positional
        if (node.label !== pos) { node.label = pos; converted++; }
        return;
      }

      // Leaf: check if it has the default manual name pattern
      const parentOrig = originals.get(node.parent);
      const nodeOrig = originals.get(node);
      const isDefault = parentOrig &&
        (nodeOrig === parentOrig + ' 1' || nodeOrig === parentOrig + ' 2');

      if (isDefault || !nodeOrig) {
        // Default or empty: set positional
        if (node.label !== pos) { node.label = pos; converted++; }
      }
      // Otherwise: user-renamed leaf, keep as-is
    });
  }
  return converted;
}

// Flatten automatic hierarchical names into manual flat labels.
// For each leaf, computes the full root→leaf display name (e.g. "Servers-Web-1")
// and stores it directly as the leaf's label so it renders correctly in manual
// mode. Non-leaf labels are cleared (invisible in manual mode, avoids stale
// data if the user switches back later). Returns count of converted labels.
export function convertAutomaticToManual(entries) {
  let converted = 0;
  const auto = { mode: 'automatic' };
  for (const entry of entries) {
    // Bake full path into each leaf's label
    walkAll(entry.tree, node => {
      if (node.children !== null) return;
      const display = buildDisplayName(node, auto);
      if (display !== (node.label ?? '')) {
        node.label = display;
        converted++;
      }
    });
    // Clear non-leaf labels (invisible in manual mode, avoids stale data)
    walkAll(entry.tree, node => {
      if (node.children !== null && (node.label ?? '') !== '') {
        node.label = '';
      }
    });
  }
  return converted;
}

// Clear every label in every tree. Used when the user wants a fresh start
// after switching to automatic naming mode.
export function clearAllNames(entries) {
  for (const entry of entries) {
    walkAll(entry.tree, node => { node.label = ''; });
  }
}

// Build the plain-text display name for a leaf, respecting the naming mode.
// In manual mode only the leaf's own label is returned. In automatic mode
// the full root→leaf path is joined with separators (e.g. "Servers-Web-1").
// This is the single source of truth for name→string conversion — CSV export,
// config serialization, and any future consumer should call this rather than
// reimplementing the path-joining logic.
export function buildDisplayName(leaf, nameDisplay) {
  const isManual = !nameDisplay || nameDisplay.mode !== 'automatic';
  if (isManual) return leaf.label ?? '';

  const path = getNamePath(leaf);
  const nonEmpty = path.filter(p => p.label !== '');
  if (nonEmpty.length === 0) return '';
  return nonEmpty.map((p, i) => {
    if (i === 0) return p.label;
    return p.separator + p.label;
  }).join('');
}
