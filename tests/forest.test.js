import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Subnet } from '../src/js/core/subnet.js';
import { setNextNodeId, buildTreeKeepingIds } from '../src/js/core/splitter.js';
import {
  addTree, removeTree, moveTree, toggleCollapse,
  getEntries, findNodeAcrossForest, clearForest, replaceForest,
  checkOverlap, computeAllOverlaps,
} from '../src/js/core/forest.js';

beforeEach(() => {
  clearForest();
  setNextNodeId(0);
});

describe('addTree', () => {
  it('prepends entry and returns it', () => {
    const { entry } = addTree(Subnet.parse('10.0.0.0/8'));
    assert.equal(typeof entry.id, 'number');
    assert.equal(entry.collapsed, false);
    assert.notEqual(entry.tree, null);
    assert.equal(entry.tree.subnet.toString(), '10.0.0.0/8');
  });

  it('initializes naming on root node', () => {
    const { entry } = addTree(Subnet.parse('10.0.0.0/8'));
    assert.equal(entry.tree.label, '');
    assert.equal(entry.tree.separator, '-');
  });

  it('initializes description and notes to empty strings', () => {
    const { entry } = addTree(Subnet.parse('10.0.0.0/8'));
    assert.equal(entry.description, '');
    assert.equal(entry.notes, '');
  });

  it('multiple addTree: newest first', () => {
    const { entry: e1 } = addTree(Subnet.parse('10.0.0.0/8'));
    const { entry: e2 } = addTree(Subnet.parse('172.16.0.0/12'));
    const entries = getEntries();
    assert.equal(entries.length, 2);
    assert.equal(entries[0], e2);
    assert.equal(entries[1], e1);
  });

  it('assigns unique IDs', () => {
    const { entry: e1 } = addTree(Subnet.parse('10.0.0.0/8'));
    const { entry: e2 } = addTree(Subnet.parse('172.16.0.0/12'));
    assert.notEqual(e1.id, e2.id);
  });

  it('returns overlap info when subnets conflict', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    const result = addTree(Subnet.parse('10.0.1.0/24'));
    assert.equal(result.overlaps, true);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].relationship, 'contained-by');
  });

  it('returns no overlap for disjoint subnets', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    const result = addTree(Subnet.parse('172.16.0.0/12'));
    assert.equal(result.overlaps, false);
    assert.equal(result.conflicts.length, 0);
  });
});

describe('removeTree', () => {
  it('removes by forestId', () => {
    const { entry: e1 } = addTree(Subnet.parse('10.0.0.0/8'));
    addTree(Subnet.parse('172.16.0.0/12'));
    removeTree(e1.id);
    const entries = getEntries();
    assert.equal(entries.length, 1);
    assert.notEqual(entries[0].id, e1.id);
  });

  it('no-op for missing ID', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    removeTree(999);
    assert.equal(getEntries().length, 1);
  });
});

describe('moveTree', () => {
  it('swaps with neighbor (move down)', () => {
    const { entry: e1 } = addTree(Subnet.parse('10.0.0.0/8'));
    const { entry: e2 } = addTree(Subnet.parse('172.16.0.0/12'));
    // e2 is at index 0 (newest first), e1 at index 1
    moveTree(e2.id, 1); // move down
    const entries = getEntries();
    assert.equal(entries[0], e1);
    assert.equal(entries[1], e2);
  });

  it('swaps with neighbor (move up)', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    const { entry: e2 } = addTree(Subnet.parse('172.16.0.0/12'));
    const { entry: e3 } = addTree(Subnet.parse('192.168.0.0/16'));
    // Order: e3, e2, e1
    moveTree(e2.id, -1); // move up
    const entries = getEntries();
    assert.equal(entries[0], e2);
    assert.equal(entries[1], e3);
  });

  it('no-op at boundary (top)', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    const { entry: e2 } = addTree(Subnet.parse('172.16.0.0/12'));
    // e2 is at index 0
    moveTree(e2.id, -1);
    assert.equal(getEntries()[0], e2);
  });

  it('no-op at boundary (bottom)', () => {
    const { entry: e1 } = addTree(Subnet.parse('10.0.0.0/8'));
    addTree(Subnet.parse('172.16.0.0/12'));
    // e1 is at index 1 (last)
    moveTree(e1.id, 1);
    assert.equal(getEntries()[1], e1);
  });

  it('no-op for missing ID', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    moveTree(999, 1);
    assert.equal(getEntries().length, 1);
  });
});

describe('toggleCollapse', () => {
  it('flips collapsed state', () => {
    const { entry } = addTree(Subnet.parse('10.0.0.0/8'));
    assert.equal(entry.collapsed, false);
    toggleCollapse(entry.id);
    assert.equal(entry.collapsed, true);
    toggleCollapse(entry.id);
    assert.equal(entry.collapsed, false);
  });

  it('no-op for missing ID', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    toggleCollapse(999);
    assert.equal(getEntries()[0].collapsed, false);
  });
});

describe('getEntries', () => {
  it('returns empty array initially', () => {
    assert.deepEqual(getEntries(), []);
  });

  it('returns current entries', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    addTree(Subnet.parse('172.16.0.0/12'));
    assert.equal(getEntries().length, 2);
  });
});

describe('findNodeAcrossForest', () => {
  it('finds node in correct tree', () => {
    const { entry: e1 } = addTree(Subnet.parse('10.0.0.0/8'));
    addTree(Subnet.parse('172.16.0.0/12'));
    const found = findNodeAcrossForest(e1.tree.id);
    assert.equal(found, e1.tree);
  });

  it('returns null for missing ID', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    assert.equal(findNodeAcrossForest(999), null);
  });

  it('returns null when forest is empty', () => {
    assert.equal(findNodeAcrossForest(0), null);
  });
});

describe('clearForest', () => {
  it('empties entries', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    addTree(Subnet.parse('172.16.0.0/12'));
    clearForest();
    assert.deepEqual(getEntries(), []);
  });

  it('resets forest ID counter (new entries start from 0)', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    addTree(Subnet.parse('172.16.0.0/12'));
    clearForest();
    setNextNodeId(0);
    const { entry: e } = addTree(Subnet.parse('192.168.0.0/16'));
    assert.equal(e.id, 0);
  });
});

describe('replaceForest', () => {
  it('replaces array with given entries', () => {
    addTree(Subnet.parse('10.0.0.0/8'));
    const newEntries = [
      { id: 5, tree: buildTreeKeepingIds(Subnet.parse('172.16.0.0/12')), collapsed: true },
      { id: 10, tree: buildTreeKeepingIds(Subnet.parse('192.168.0.0/16')), collapsed: false },
    ];
    replaceForest(newEntries);
    assert.equal(getEntries().length, 2);
    assert.equal(getEntries()[0].id, 5);
    assert.equal(getEntries()[1].id, 10);
  });

  it('advances forestId past max existing', () => {
    const newEntries = [
      { id: 42, tree: buildTreeKeepingIds(Subnet.parse('10.0.0.0/8')), collapsed: false },
    ];
    replaceForest(newEntries);
    // Next addTree should get id > 42
    const { entry: e } = addTree(Subnet.parse('172.16.0.0/12'));
    assert.ok(e.id > 42);
  });
});

describe('checkOverlap', () => {
  // Helper to create a fake entry matching the shape addTree produces.
  function fakeEntry(cidr) {
    return { tree: { subnet: Subnet.parse(cidr) } };
  }

  it('non-overlapping subnets: 10.0.0.0/8 and 172.16.0.0/12', () => {
    const entries = [fakeEntry('10.0.0.0/8')];
    const result = checkOverlap(Subnet.parse('172.16.0.0/12'), entries);
    assert.equal(result.overlaps, false);
    assert.equal(result.conflicts.length, 0);
  });

  it('supernet contains subnet: 10.0.0.0/8 then 10.0.1.0/24', () => {
    const entries = [fakeEntry('10.0.0.0/8')];
    const result = checkOverlap(Subnet.parse('10.0.1.0/24'), entries);
    assert.equal(result.overlaps, true);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].relationship, 'contained-by');
  });

  it('subnet contained by supernet: 10.0.1.0/24 then 10.0.0.0/8', () => {
    const entries = [fakeEntry('10.0.1.0/24')];
    const result = checkOverlap(Subnet.parse('10.0.0.0/8'), entries);
    assert.equal(result.overlaps, true);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].relationship, 'contains');
  });

  it('CIDR blocks cannot partially overlap — disjoint siblings are disjoint', () => {
    const entries = [fakeEntry('10.0.0.0/9')];
    const result = checkOverlap(Subnet.parse('10.128.0.0/9'), entries);
    assert.equal(result.overlaps, false);
  });

  it('same subnet twice: 10.0.0.0/24 and 10.0.0.0/24', () => {
    const entries = [fakeEntry('10.0.0.0/24')];
    const result = checkOverlap(Subnet.parse('10.0.0.0/24'), entries);
    assert.equal(result.overlaps, true);
    assert.equal(result.conflicts.length, 1);
  });

  it('IPv6 overlap: 2001:db8::/32 and 2001:db8:1::/48', () => {
    const entries = [fakeEntry('2001:db8::/32')];
    const result = checkOverlap(Subnet.parse('2001:db8:1::/48'), entries);
    assert.equal(result.overlaps, true);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].relationship, 'contained-by');
  });

  it('skips entries with different address family', () => {
    const entries = [fakeEntry('10.0.0.0/8')];
    const result = checkOverlap(Subnet.parse('2001:db8::/32'), entries);
    assert.equal(result.overlaps, false);
  });

  it('detects multiple conflicts', () => {
    const entries = [fakeEntry('10.0.1.0/24'), fakeEntry('10.0.2.0/24')];
    const result = checkOverlap(Subnet.parse('10.0.0.0/8'), entries);
    assert.equal(result.overlaps, true);
    assert.equal(result.conflicts.length, 2);
    assert.equal(result.conflicts[0].relationship, 'contains');
    assert.equal(result.conflicts[1].relationship, 'contains');
  });

  it('empty entries means no overlap', () => {
    const result = checkOverlap(Subnet.parse('10.0.0.0/8'), []);
    assert.equal(result.overlaps, false);
    assert.equal(result.conflicts.length, 0);
  });
});

describe('computeAllOverlaps', () => {
  // Helper to create a fake entry with an id and tree.subnet.
  function fakeEntry(id, cidr) {
    return { id, tree: { subnet: Subnet.parse(cidr) } };
  }

  it('two disjoint entries return empty Set', () => {
    const entries = [fakeEntry(0, '10.0.0.0/8'), fakeEntry(1, '172.16.0.0/12')];
    const result = computeAllOverlaps(entries);
    assert.equal(result.size, 0);
  });

  it('two overlapping entries return both IDs', () => {
    const entries = [fakeEntry(0, '10.0.0.0/8'), fakeEntry(1, '10.0.1.0/24')];
    const result = computeAllOverlaps(entries);
    assert.equal(result.size, 2);
    assert.ok(result.has(0));
    assert.ok(result.has(1));
  });

  it('three entries where only two overlap return only those two IDs', () => {
    const entries = [
      fakeEntry(0, '10.0.0.0/8'),
      fakeEntry(1, '10.0.1.0/24'),
      fakeEntry(2, '172.16.0.0/12'),
    ];
    const result = computeAllOverlaps(entries);
    assert.equal(result.size, 2);
    assert.ok(result.has(0));
    assert.ok(result.has(1));
    assert.ok(!result.has(2));
  });

  it('mixed IPv4 and IPv6 produce no cross-family false positives', () => {
    const entries = [fakeEntry(0, '10.0.0.0/8'), fakeEntry(1, '2001:db8::/32')];
    const result = computeAllOverlaps(entries);
    assert.equal(result.size, 0);
  });

  it('empty entries return empty Set', () => {
    const result = computeAllOverlaps([]);
    assert.equal(result.size, 0);
  });
});
