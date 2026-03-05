import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Subnet } from '../src/js/core/subnet.js';
import {
  setNextNodeId, buildTreeKeepingIds, splitNode, mergeNodes,
  getLeaves, findNodeById, getInternalNodes,
  getLeafDescendants, getLeafIndex,
} from '../src/js/core/splitter.js';

beforeEach(() => {
  setNextNodeId(0);
});

describe('setNextNodeId + buildTreeKeepingIds', () => {
  it('IDs start from the set value', () => {
    setNextNodeId(100);
    const node = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    assert.equal(node.id, 100);
  });

  it('builds a leaf node with correct properties', () => {
    const node = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    assert.equal(node.id, 0);
    assert.equal(node.subnet.toString(), '10.0.0.0/8');
    assert.equal(node.children, null);
    assert.equal(node.parent, null);
  });

  it('auto-increments IDs', () => {
    const a = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    const b = buildTreeKeepingIds(Subnet.parse('172.16.0.0/12'));
    assert.equal(a.id, 0);
    assert.equal(b.id, 1);
  });
});

describe('splitNode', () => {
  it('creates 2 children at prefix+1', () => {
    const root = buildTreeKeepingIds(Subnet.parse('192.168.0.0/24'));
    splitNode(root);
    assert.notEqual(root.children, null);
    assert.equal(root.children.length, 2);
    assert.equal(root.children[0].subnet.prefix, 25);
    assert.equal(root.children[1].subnet.prefix, 25);
  });

  it('children have parent pointer to the split node', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    assert.equal(root.children[0].parent, root);
    assert.equal(root.children[1].parent, root);
  });

  it('children are leaves', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    assert.equal(root.children[0].children, null);
    assert.equal(root.children[1].children, null);
  });

  it('assigns unique IDs to children', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    const ids = new Set([root.id, root.children[0].id, root.children[1].id]);
    assert.equal(ids.size, 3);
  });

  it('throws on non-leaf node', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    assert.throws(() => splitNode(root), /non-leaf/);
  });

  it('throws at /32 (cannot split further)', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.1/32'));
    assert.throws(() => splitNode(root), RangeError);
  });

  it('splits IPv6 subnet at /127', () => {
    const root = buildTreeKeepingIds(Subnet.parse('2001:db8::/127'));
    splitNode(root);
    assert.equal(root.children[0].subnet.prefix, 128);
  });

  it('throws at /128 (cannot split further)', () => {
    const root = buildTreeKeepingIds(Subnet.parse('::1/128'));
    assert.throws(() => splitNode(root), RangeError);
  });

  it('throws for /32 host route (cannot split further)', () => {
    const root = buildTreeKeepingIds(Subnet.parse('192.168.1.1/32'));
    assert.throws(() => splitNode(root), {
      name: 'RangeError',
      message: /Cannot split further.*\/32/,
    });
    // Tree must remain a leaf after the failed split.
    assert.equal(root.children, null);
  });

  it('throws for /128 host route (cannot split further)', () => {
    const root = buildTreeKeepingIds(Subnet.parse('2001:db8::1/128'));
    assert.throws(() => splitNode(root), {
      name: 'RangeError',
      message: /Cannot split further.*\/128/,
    });
    assert.equal(root.children, null);
  });
});

describe('mergeNodes', () => {
  it('merges siblings back to parent', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    const [a, b] = root.children;
    const result = mergeNodes(a, b);
    assert.equal(result, root);
    assert.equal(root.children, null);
  });

  it('throws on root nodes', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    const root2 = buildTreeKeepingIds(Subnet.parse('172.16.0.0/12'));
    assert.throws(() => mergeNodes(root, root2), /root/);
  });

  it('throws on non-siblings', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    const root2 = buildTreeKeepingIds(Subnet.parse('172.16.0.0/12'));
    splitNode(root2);
    assert.throws(() => mergeNodes(root.children[0], root2.children[0]), /siblings/);
  });

  it('throws on non-leaves', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    splitNode(root.children[0]);
    assert.throws(() => mergeNodes(root.children[0], root.children[1]), /leaves/);
  });
});

describe('getLeaves', () => {
  it('single leaf → array of 1', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    const leaves = getLeaves(root);
    assert.equal(leaves.length, 1);
    assert.equal(leaves[0], root);
  });

  it('split tree → 2 leaves', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    const leaves = getLeaves(root);
    assert.equal(leaves.length, 2);
  });

  it('nested split → 3 leaves', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    splitNode(root.children[0]);
    const leaves = getLeaves(root);
    assert.equal(leaves.length, 3);
  });

  it('null → empty array', () => {
    assert.deepEqual(getLeaves(null), []);
  });

  it('returns leaves in left-to-right order', () => {
    const root = buildTreeKeepingIds(Subnet.parse('192.168.0.0/24'));
    splitNode(root);
    const leaves = getLeaves(root);
    const first = leaves[0].subnet.network.toNumber();
    const second = leaves[1].subnet.network.toNumber();
    assert.ok(first < second);
  });
});

describe('findNodeById', () => {
  it('finds root', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    assert.equal(findNodeById(root, root.id), root);
  });

  it('finds child', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    const child = root.children[1];
    assert.equal(findNodeById(root, child.id), child);
  });

  it('returns null for missing ID', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    assert.equal(findNodeById(root, 999), null);
  });

  it('returns null for null tree', () => {
    assert.equal(findNodeById(null, 0), null);
  });

  // Regression: if node IDs collide (e.g. from duplicate module loading),
  // findNodeById can return an internal node when asked for a leaf.
  // This test splits one sibling and verifies the other (still a leaf)
  // is found correctly — not confused with the root or internal node.
  it('finds the correct leaf when sibling subtree has been split', () => {
    const root = buildTreeKeepingIds(Subnet.parse('192.168.1.0/24'));
    splitNode(root);
    const [left, right] = root.children;
    splitNode(right);

    // All IDs in the tree must be unique
    const allNodes = [root, left, right, right.children[0], right.children[1]];
    const ids = allNodes.map(n => n.id);
    assert.equal(new Set(ids).size, ids.length, 'All node IDs must be unique');

    // findNodeById for the left leaf must return the leaf itself, not root
    const found = findNodeById(root, left.id);
    assert.equal(found, left);
    assert.equal(found.children, null, 'Found node must be a leaf (splittable)');
  });
});

describe('getInternalNodes', () => {
  it('returns empty for leaf', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    assert.deepEqual(getInternalNodes(root), []);
  });

  it('returns 1 node at depth 0 after single split', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    const internals = getInternalNodes(root);
    assert.equal(internals.length, 1);
    assert.equal(internals[0].depth, 0);
    assert.equal(internals[0].node, root);
  });

  it('nested splits produce increasing depths', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    splitNode(root.children[0]);
    const internals = getInternalNodes(root);
    assert.equal(internals.length, 2);
    const depths = internals.map(i => i.depth).sort();
    assert.deepEqual(depths, [0, 1]);
  });

  it('returns empty for null', () => {
    assert.deepEqual(getInternalNodes(null), []);
  });
});

describe('getLeafDescendants', () => {
  it('leaf returns itself', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    const desc = getLeafDescendants(root);
    assert.equal(desc.length, 1);
    assert.equal(desc[0], root);
  });

  it('subtree returns correct leaves', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    splitNode(root.children[0]);
    const desc = getLeafDescendants(root.children[0]);
    assert.equal(desc.length, 2);
  });
});

describe('getLeafIndex', () => {
  it('finds correct index', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    const leaves = getLeaves(root);
    assert.equal(getLeafIndex(leaves, leaves[0]), 0);
    assert.equal(getLeafIndex(leaves, leaves[1]), 1);
  });

  it('returns -1 for missing leaf', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    const leaves = getLeaves(root);
    assert.equal(getLeafIndex(leaves, { id: 999 }), -1);
  });
});
