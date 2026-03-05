/*\! © 2026 slashwhat. MIT License. */
// splitter.js — Binary tree data model for interactive subnet splitting.
// The tree represents a hierarchical subnet division: each internal node
// is a subnet that has been split into two children (prefix + 1). Leaf
// nodes are the current visible subnets in the table. This module is
// pure data — no DOM, no rendering. The view layer consumes these
// functions to build and manipulate the tree.

// Monotonic counter ensures unique IDs for DOM data-attribute lookups. Advanced past deserialized IDs to avoid collisions.
let _nodeId = 0;

// Set the next ID to use for new nodes. Call this after deserializing a
// tree so that subsequent splitNode() calls don't produce duplicate IDs.
export function setNextNodeId(n) {
  _nodeId = n;
}

// Create a tree node from a subnet without resetting the ID counter.
// Used by the forest model so multiple trees can coexist with globally
// unique node IDs.
export function buildTreeKeepingIds(subnet) {
  return createNode(subnet, null);
}

// Internal factory. Each node has: a unique id (for DOM data attributes),
// the subnet it represents, optional children (null = leaf), and a parent
// pointer (null = root) for walking up to compute inherited names.
function createNode(subnet, parent) {
  return {
    id: _nodeId++,
    subnet,
    children: null,
    parent,
  };
}

// Split a leaf node into two children at prefix + 1.
// Modifies the node in place (the tree is mutable for simplicity).
// After calling this, the caller should also call initChildNames() from
// naming.js to set up default labels on the new children.
export function splitNode(node) {
  if (node.children !== null) {
    throw new Error('Cannot split a non-leaf node');
  }
  const maxPrefix = node.subnet.isIPv4 ? 32 : 128;
  const newPrefix = node.subnet.prefix + 1;
  if (newPrefix > maxPrefix) {
    throw new RangeError(`Cannot split further: already at /${node.subnet.prefix}`);
  }

  const halves = node.subnet.split(newPrefix);
  node.children = [
    createNode(halves[0], node),
    createNode(halves[1], node),
  ];
  return node;
}

// Merge two sibling leaves back into their parent (undo a split).
// Both nodes must be leaves and share the same parent. The parent
// becomes a leaf again, recovering its original subnet and label.
export function mergeNodes(node1, node2) {
  if (!node1.parent || !node2.parent) {
    throw new Error('Cannot merge root nodes');
  }
  if (node1.parent !== node2.parent) {
    throw new Error('Nodes must be siblings to merge');
  }
  if (node1.children !== null || node2.children !== null) {
    throw new Error('Both nodes must be leaves to merge');
  }

  const parent = node1.parent;
  parent.children = null;
  return parent;
}

// --- Tree traversal utilities ---
// These are used by the view layer to iterate over the tree without
// knowing its internal structure.

// Collect all leaf nodes in left-to-right (network address) order.
// These are the rows displayed in the splitter table.
export function getLeaves(node) {
  if (!node) return [];
  if (node.children === null) return [node];
  return [...getLeaves(node.children[0]), ...getLeaves(node.children[1])];
}

// Find any node by its numeric id. Used to resolve data-node-id
// attributes from DOM click events back to tree nodes.
export function findNodeById(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  if (node.children) {
    return findNodeById(node.children[0], id) || findNodeById(node.children[1], id);
  }
  return null;
}

// Collect all internal (non-leaf) nodes with their tree depth.
// Used to build the join column: each internal node becomes a vertical
// bar spanning its descendant leaf rows. Depth determines which column
// the bar occupies (deeper = further right).
export function getInternalNodes(node, depth = 0) {
  if (!node || node.children === null) return [];
  const result = [{ node, depth }];
  return [
    ...result,
    ...getInternalNodes(node.children[0], depth + 1),
    ...getInternalNodes(node.children[1], depth + 1),
  ];
}

// Get all leaf descendants of a specific subtree.
// Used to determine which table rows a join bar should span.
export function getLeafDescendants(node) {
  if (node.children === null) return [node];
  return [...getLeafDescendants(node.children[0]), ...getLeafDescendants(node.children[1])];
}

// Find the index of a target leaf in the flat leaves array.
// Used to map a join bar's first descendant to a table row number.
export function getLeafIndex(leaves, target) {
  return leaves.findIndex(l => l.id === target.id);
}
