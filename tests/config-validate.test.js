import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setNextNodeId, buildTreeKeepingIds, splitNode } from '../src/js/core/splitter.js';
import { initNodeName, initChildNames } from '../src/js/core/naming.js';
import { Subnet } from '../src/js/core/subnet.js';
import { validateConfig, KNOWN_COLS } from '../src/js/core/config-validate.js';
import { serializeForest } from '../src/js/core/config.js';

beforeEach(() => {
  setNextNodeId(0);
});

// Minimal display settings for validation tests — only rangeDisplay and
// numberDisplay are needed; others fall back to defaults during serialization.
const minDs = {
  rangeDisplay: { range: { style: 'short', sep: ' to ' }, usable: { style: 'short', sep: ' to ' } },
  numberDisplay: { ips: 'locale', hosts: 'locale' },
};

function makeValidConfig() {
  const tree = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
  initNodeName(tree);
  const entry = { id: 0, tree, collapsed: false };
  return serializeForest([entry], ['subnet', 'name'], ['subnet', 'name'], minDs);
}

describe('KNOWN_COLS', () => {
  it('is a Set', () => {
    assert.ok(KNOWN_COLS instanceof Set);
  });

  it('contains all 12 expected column keys', () => {
    const expected = ['subnet', 'name', 'desc', 'notes', 'vlan', 'netmask', 'wildcard', 'range', 'usable', 'ips', 'hosts', 'join'];
    for (const col of expected) {
      assert.ok(KNOWN_COLS.has(col), `missing: ${col}`);
    }
    assert.equal(KNOWN_COLS.size, 12);
  });
});

describe('validateConfig — top-level', () => {
  it('non-object → error', () => {
    assert.ok(validateConfig(null));
    assert.ok(validateConfig(42));
    assert.ok(validateConfig('string'));
    assert.ok(validateConfig([]));
  });

  it('wrong app → error', () => {
    assert.match(validateConfig({ app: 'other', version: 2 }), /not a slashwhat/);
  });

  it('wrong version → error', () => {
    assert.match(validateConfig({ app: 'slashwhat', version: 1 }), /Unsupported/);
  });

  it('valid config → null', () => {
    const json = makeValidConfig();
    assert.equal(validateConfig(json), null);
  });
});

describe('validateConfig — trees array', () => {
  it('missing trees → error', () => {
    const json = makeValidConfig();
    delete json.trees;
    assert.match(validateConfig(json), /missing or empty trees/);
  });

  it('empty trees → error', () => {
    const json = makeValidConfig();
    json.trees = [];
    assert.match(validateConfig(json), /missing or empty trees/);
  });

  it('tree missing nodes → error', () => {
    const json = makeValidConfig();
    delete json.trees[0].nodes;
    assert.match(validateConfig(json), /missing nodes/);
  });
});

describe('validateConfig — node validation', () => {
  it('node missing id → error', () => {
    const json = makeValidConfig();
    delete json.trees[0].nodes[0].id;
    assert.match(validateConfig(json), /missing id or cidr/);
  });

  it('node missing cidr → error', () => {
    const json = makeValidConfig();
    delete json.trees[0].nodes[0].cidr;
    assert.match(validateConfig(json), /missing id or cidr/);
  });

  it('duplicate node ID → error', () => {
    const json = makeValidConfig();
    json.trees[0].nodes.push({ ...json.trees[0].nodes[0] });
    assert.match(validateConfig(json), /Duplicate node ID/);
  });

  it('invalid CIDR → error', () => {
    const json = makeValidConfig();
    json.trees[0].nodes[0].cidr = 'not-a-cidr';
    assert.match(validateConfig(json), /Invalid CIDR/);
  });

  it('bad children (not array of 2) → error', () => {
    const json = makeValidConfig();
    json.trees[0].nodes[0].children = [1];
    assert.match(validateConfig(json), /Invalid children/);
  });

  it('children referencing missing node → error', () => {
    const json = makeValidConfig();
    json.trees[0].nodes[0].children = [999, 998];
    assert.match(validateConfig(json), /missing child/);
  });

  it('multiple parents → error', () => {
    const tree = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(tree);
    splitNode(tree);
    initChildNames(tree);
    const entry = { id: 0, tree, collapsed: false };
    const json = serializeForest([entry], ['subnet'], ['subnet'], minDs);
    // Make both nodes claim the same child
    const childId = json.trees[0].nodes[1].id;
    json.trees[0].nodes[0].children = [childId, json.trees[0].nodes[2].id];
    // Add a fake parent that also claims childId
    json.trees[0].nodes.push({
      id: 500, cidr: '172.16.0.0/12', label: '', separator: '-',
      children: [childId, json.trees[0].nodes[2].id],
    });
    assert.ok(validateConfig(json));
  });

  it('wrong root count → error', () => {
    const json = makeValidConfig();
    // Add a second orphan node (no one references it as child)
    json.trees[0].nodes.push({
      id: 500, cidr: '172.16.0.0/12', label: '', separator: '-', children: null,
    });
    assert.match(validateConfig(json), /root/);
  });

  // TEST-010: invalid node.color variations
  it('rejects 3-digit hex color', () => {
    const json = makeValidConfig();
    json.trees[0].nodes[0].color = '#FFF';
    assert.match(validateConfig(json), /Invalid color/);
  });
  it('rejects non-hex characters in color', () => {
    const json = makeValidConfig();
    json.trees[0].nodes[0].color = '#GGGGGG';
    assert.match(validateConfig(json), /Invalid color/);
  });
  it('rejects empty string color', () => {
    const json = makeValidConfig();
    json.trees[0].nodes[0].color = '';
    assert.match(validateConfig(json), /Invalid color/);
  });
  it('rejects numeric color value', () => {
    const json = makeValidConfig();
    json.trees[0].nodes[0].color = 123;
    assert.match(validateConfig(json), /Invalid color/);
  });
});

describe('validateConfig — cross-tree duplicate IDs', () => {
  it('rejects duplicate IDs across trees', () => {
    setNextNodeId(0);
    const tree1 = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(tree1);
    // Deliberately reuse ID 0
    setNextNodeId(0);
    const tree2 = buildTreeKeepingIds(Subnet.parse('172.16.0.0/12'));
    initNodeName(tree2);

    const json = serializeForest(
      [{ id: 0, tree: tree1, collapsed: false }, { id: 1, tree: tree2, collapsed: false }],
      ['subnet'], ['subnet'], minDs,
    );

    assert.match(validateConfig(json), /Duplicate node ID/);
  });
});

describe('validateConfig — node count limit', () => {
  it('rejects configs with > 500 nodes', () => {
    const json = makeValidConfig();
    // Fill with 501 nodes total
    const nodes = [];
    for (let i = 0; i < 501; i++) {
      nodes.push({ id: i, cidr: '10.0.0.0/8', label: '', separator: '-', children: null });
    }
    json.trees[0].nodes = nodes;
    assert.match(validateConfig(json), /too large/);
  });
});

describe('validateConfig — column validation', () => {
  it('non-string column key → error', () => {
    const json = makeValidConfig();
    json.colOrder = [42];
    assert.match(validateConfig(json), /Invalid column key/);
  });

  it('non-string in visibleCols → error', () => {
    const json = makeValidConfig();
    json.visibleCols = [null];
    assert.match(validateConfig(json), /Invalid column key/);
  });

  it('string column keys pass', () => {
    const json = makeValidConfig();
    json.colOrder = ['subnet', 'name', 'unknown_but_string'];
    assert.equal(validateConfig(json), null);
  });
});

// TEST-013: empty nodes array triggers the "missing or empty nodes" path
describe('validateConfig — empty nodes array', () => {
  it('rejects tree with empty nodes array', () => {
    const json = makeValidConfig();
    json.trees[0].nodes = [];
    assert.match(validateConfig(json), /missing or empty nodes/);
  });
});

describe('validateConfig — tree depth limit', () => {
  it('accepts a valid 8-level deep tree (/24 → /32)', () => {
    setNextNodeId(0);
    let tree = buildTreeKeepingIds(Subnet.parse('10.0.0.0/24'));
    initNodeName(tree);
    let node = tree;
    for (let i = 0; i < 8; i++) {
      splitNode(node);
      initChildNames(node);
      node = node.children[0];
    }
    const entry = { id: 0, tree, collapsed: false };
    const json = serializeForest([entry], ['subnet'], ['subnet'], minDs);
    assert.equal(validateConfig(json), null);
  });
});

describe('validateConfig — subnet topology', () => {
  // Build a split tree to test topology validation (lines 91-110)
  function makeSplitConfig() {
    setNextNodeId(0);
    const tree = buildTreeKeepingIds(Subnet.parse('10.0.0.0/24'));
    initNodeName(tree);
    splitNode(tree);
    initChildNames(tree);
    const entry = { id: 0, tree, collapsed: false };
    return serializeForest([entry], ['subnet'], ['subnet'], minDs);
  }

  it('accepts valid binary split (parent /24 → children /25)', () => {
    const json = makeSplitConfig();
    assert.equal(validateConfig(json), null);
  });

  it('rejects child with wrong prefix (expects parent+1)', () => {
    const json = makeSplitConfig();
    // Change child CIDR from /25 to /26 — wrong prefix depth
    const childNode = json.trees[0].nodes.find(n => n.cidr === '10.0.0.0/25');
    childNode.cidr = '10.0.0.0/26';
    assert.match(validateConfig(json), /prefix \/26 is not \/25/);
  });

  it('rejects child outside parent range', () => {
    const json = makeSplitConfig();
    // Replace child with a /25 outside the parent's 10.0.0.0/24 range
    const childNode = json.trees[0].nodes.find(n => n.cidr === '10.0.0.0/25');
    childNode.cidr = '192.168.0.0/25';
    assert.match(validateConfig(json), /not within parent/);
  });

  it('accepts valid deep tree (/24 → /25 → /26)', () => {
    setNextNodeId(0);
    const tree = buildTreeKeepingIds(Subnet.parse('10.0.0.0/24'));
    initNodeName(tree);
    splitNode(tree);
    initChildNames(tree);
    // Split the left child (/25) further into /26s
    splitNode(tree.children[0]);
    initChildNames(tree.children[0]);
    const entry = { id: 0, tree, collapsed: false };
    const json = serializeForest([entry], ['subnet'], ['subnet'], minDs);
    assert.equal(validateConfig(json), null);
  });
});
