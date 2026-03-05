import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Subnet } from '../src/js/core/subnet.js';
import { setNextNodeId, buildTreeKeepingIds, splitNode } from '../src/js/core/splitter.js';
import { initNodeName, initChildNames, getNamePath, buildDisplayName, convertManualToAutomatic, convertAutomaticToManual, clearAllNames } from '../src/js/core/naming.js';

beforeEach(() => {
  setNextNodeId(0);
});

describe('initNodeName', () => {
  it('sets label to empty string and separator to "-"', () => {
    const node = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(node);
    assert.equal(node.label, '');
    assert.equal(node.separator, '-');
  });

  it('sets description and notes to empty strings', () => {
    const node = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(node);
    assert.equal(node.description, '');
    assert.equal(node.notes, '');
  });
});

describe('initChildNames', () => {
  it('assigns "1" and "2" to children', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    splitNode(root);
    initChildNames(root);
    assert.equal(root.children[0].label, '1');
    assert.equal(root.children[1].label, '2');
  });

  it('children inherit description and notes from parent', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.description = 'Server block';
    root.notes = 'Primary DC';
    splitNode(root);
    initChildNames(root);
    assert.equal(root.children[0].description, 'Server block');
    assert.equal(root.children[1].description, 'Server block');
    assert.equal(root.children[0].notes, 'Primary DC');
    assert.equal(root.children[1].notes, 'Primary DC');
  });

  it('children inherit parent separator', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.separator = '.';
    splitNode(root);
    initChildNames(root);
    assert.equal(root.children[0].separator, '.');
    assert.equal(root.children[1].separator, '.');
  });

  it('defaults separator to "-" when parent has none', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    splitNode(root);
    // Node has no separator property at all
    delete root.separator;
    initChildNames(root);
    assert.equal(root.children[0].separator, '-');
    assert.equal(root.children[1].separator, '-');
  });

  it('no-op on leaf (no children)', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    // Should not throw
    initChildNames(root);
    assert.equal(root.children, null);
  });

  it('assigns empty labels when autoLabel is false and parent unnamed', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    splitNode(root);
    initChildNames(root, false);
    assert.equal(root.children[0].label, '');
    assert.equal(root.children[1].label, '');
  });

  it('copies parent label with suffix in manual mode', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Chicken';
    splitNode(root);
    initChildNames(root, false);
    assert.equal(root.children[0].label, 'Chicken 1');
    assert.equal(root.children[1].label, 'Chicken 2');
  });

  it('still inherits separator/desc/notes when autoLabel is false', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.separator = '.';
    root.description = 'Block A';
    root.notes = 'Note A';
    splitNode(root);
    initChildNames(root, false);
    assert.equal(root.children[0].separator, '.');
    assert.equal(root.children[1].separator, '.');
    assert.equal(root.children[0].description, 'Block A');
    assert.equal(root.children[1].notes, 'Note A');
  });

  it('backward compat: initChildNames(parent) still gives "1"/"2"', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    splitNode(root);
    initChildNames(root);
    assert.equal(root.children[0].label, '1');
    assert.equal(root.children[1].label, '2');
  });
});

describe('getNamePath', () => {
  it('single node returns path of length 1', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    const path = getNamePath(root);
    assert.equal(path.length, 1);
    assert.equal(path[0].label, 'Servers');
    assert.equal(path[0].id, root.id);
  });

  it('3-level tree returns root-to-leaf path', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    splitNode(root);
    initChildNames(root);
    root.children[0].label = 'Web';
    splitNode(root.children[0]);
    initChildNames(root.children[0]);

    const leaf = root.children[0].children[0];
    const path = getNamePath(leaf);
    assert.equal(path.length, 3);
    assert.equal(path[0].label, 'Servers');
    assert.equal(path[1].label, 'Web');
    assert.equal(path[2].label, '1');
  });

  it('handles nodes without label/separator via ?? fallback', () => {
    const node = { id: 42, parent: null };
    const path = getNamePath(node);
    assert.equal(path.length, 1);
    assert.equal(path[0].label, '');
    assert.equal(path[0].separator, '-');
  });

  it('path is in root-to-leaf order', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Root';
    splitNode(root);
    initChildNames(root);

    const leaf = root.children[1];
    const path = getNamePath(leaf);
    assert.equal(path[0].label, 'Root');
    assert.equal(path[1].label, '2');
  });
});

describe('buildDisplayName', () => {
  it('returns leaf label in manual mode (no nameDisplay)', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    assert.equal(buildDisplayName(root, undefined), 'Servers');
  });

  it('returns leaf label in manual mode (explicit manual)', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Web';
    assert.equal(buildDisplayName(root, { mode: 'manual' }), 'Web');
  });

  it('returns empty string for unlabeled leaf in manual mode', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    assert.equal(buildDisplayName(root, undefined), '');
  });

  it('returns empty string when leaf has no label property in manual mode', () => {
    const node = { id: 1, parent: null };
    assert.equal(buildDisplayName(node, null), '');
  });

  it('joins root→leaf path with separators in automatic mode', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    splitNode(root);
    initChildNames(root);
    root.children[0].label = 'Web';
    splitNode(root.children[0]);
    initChildNames(root.children[0]);

    const leaf = root.children[0].children[0];
    const auto = { mode: 'automatic' };
    assert.equal(buildDisplayName(leaf, auto), 'Servers-Web-1');
  });

  it('uses custom separators in automatic mode', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'DC';
    splitNode(root);
    initChildNames(root);
    root.children[0].label = 'Rack';
    root.children[0].separator = '.';
    splitNode(root.children[0]);
    initChildNames(root.children[0]);
    root.children[0].children[1].label = 'B';

    const leaf = root.children[0].children[1];
    const auto = { mode: 'automatic' };
    assert.equal(buildDisplayName(leaf, auto), 'DC.Rack.B');
  });

  it('skips empty labels in automatic mode', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = '';
    splitNode(root);
    initChildNames(root);
    root.children[0].label = 'Web';

    const leaf = root.children[0];
    const auto = { mode: 'automatic' };
    assert.equal(buildDisplayName(leaf, auto), 'Web');
  });

  it('returns empty string when all labels are empty in automatic mode', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    splitNode(root);
    initChildNames(root);
    root.children[0].label = '';

    const leaf = root.children[0];
    const auto = { mode: 'automatic' };
    assert.equal(buildDisplayName(leaf, auto), '');
  });
});

// Helper: build a fake entry wrapping a tree root (mimics forest.js entries).
function makeEntry(root) {
  return { id: 0, tree: root, collapsed: false, description: '', notes: '', name: '', sectionId: '' };
}

describe('convertManualToAutomatic', () => {
  it('replaces default manual names with positional in a single split', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    splitNode(root);
    initChildNames(root, false);
    // Manual mode created "Servers 1" / "Servers 2"
    assert.equal(root.children[0].label, 'Servers 1');
    assert.equal(root.children[1].label, 'Servers 2');

    const count = convertManualToAutomatic([makeEntry(root)]);
    assert.equal(root.children[0].label, '1');
    assert.equal(root.children[1].label, '2');
    assert.equal(root.label, 'Servers');
    assert.equal(count, 2);
  });

  it('fills intermediates with positional and produces clean display names', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    splitNode(root);
    initChildNames(root, false);
    // "Servers 1" / "Servers 2"
    splitNode(root.children[0]);
    initChildNames(root.children[0], false);
    // "Servers 1 1" / "Servers 1 2"

    convertManualToAutomatic([makeEntry(root)]);
    // Intermediate gets positional
    assert.equal(root.children[0].label, '1');
    // Leaves get positional
    assert.equal(root.children[0].children[0].label, '1');
    assert.equal(root.children[0].children[1].label, '2');
    const auto = { mode: 'automatic' };
    assert.equal(buildDisplayName(root.children[0].children[0], auto), 'Servers-1-1');
  });

  it('fills unnamed intermediates with positional numbers', () => {
    // Deep split with unnamed intermediates and a named leaf (5 levels)
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    splitNode(root);
    initChildNames(root, false);
    splitNode(root.children[0]);
    initChildNames(root.children[0], false);
    splitNode(root.children[0].children[1]);
    initChildNames(root.children[0].children[1], false);
    splitNode(root.children[0].children[1].children[0]);
    initChildNames(root.children[0].children[1].children[0], false);
    // Name a deep leaf
    root.children[0].children[1].children[0].children[1].label = 'Beaver';

    convertManualToAutomatic([makeEntry(root)]);
    const auto = { mode: 'automatic' };
    const leaf = root.children[0].children[1].children[0].children[1];
    // root("") → [0]("1") → [1]("2") → [0]("1") → [1]("Beaver")
    assert.equal(buildDisplayName(leaf, auto), '1-2-1-Beaver');
  });

  it('copies section name to unnamed root', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    splitNode(root);
    initChildNames(root, false);
    splitNode(root.children[0]);
    initChildNames(root.children[0], false);
    root.children[0].children[0].label = 'Beaver';

    const entry = makeEntry(root);
    entry.name = 'AWS';

    const count = convertManualToAutomatic([entry]);
    assert.equal(root.label, 'AWS');
    assert.ok(count >= 1);
    const auto = { mode: 'automatic' };
    assert.equal(buildDisplayName(root.children[0].children[0], auto), 'AWS-1-Beaver');
  });

  it('preserves user-renamed leaf that does not match parent prefix', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    splitNode(root);
    initChildNames(root, false);
    root.children[0].label = 'Beaver';  // User renamed

    const count = convertManualToAutomatic([makeEntry(root)]);
    assert.equal(root.children[0].label, 'Beaver');
    assert.equal(root.children[1].label, '2');
    assert.equal(count, 1);
  });

  it('overwrites internal node labels with positional regardless of name', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'DC';
    splitNode(root);
    initChildNames(root, false);
    root.children[0].label = 'CustomInternal';
    splitNode(root.children[0]);
    initChildNames(root.children[0], false);

    convertManualToAutomatic([makeEntry(root)]);
    // Internal node overwritten with positional
    assert.equal(root.children[0].label, '1');
    assert.equal(root.children[0].children[0].label, '1');
    assert.equal(root.children[0].children[1].label, '2');
  });

  it('sets positional on all empty nodes', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    splitNode(root);
    initChildNames(root, false);
    // Parent unnamed → children are empty strings

    const count = convertManualToAutomatic([makeEntry(root)]);
    assert.equal(root.children[0].label, '1');
    assert.equal(root.children[1].label, '2');
    assert.equal(count, 2);
  });

  it('handles multiple entries independently', () => {
    const r1 = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(r1);
    r1.label = 'A';
    splitNode(r1);
    initChildNames(r1, false);

    const r2 = buildTreeKeepingIds(Subnet.parse('172.16.0.0/12'));
    initNodeName(r2);
    r2.label = 'B';
    splitNode(r2);
    initChildNames(r2, false);

    const count = convertManualToAutomatic([makeEntry(r1), { ...makeEntry(r2), id: 1 }]);
    assert.equal(r1.children[0].label, '1');
    assert.equal(r2.children[0].label, '1');
    assert.equal(count, 4);
  });

  it('does not copy section name when root already has a label', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Blubber';
    splitNode(root);
    initChildNames(root, false);

    const entry = makeEntry(root);
    entry.name = 'AWS';

    convertManualToAutomatic([entry]);
    assert.equal(root.label, 'Blubber');
  });
});

describe('convertAutomaticToManual', () => {
  it('flattens simple split into leaf labels and clears non-leaf', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    splitNode(root);
    initChildNames(root);
    // Automatic: root "Servers", children "1"/"2"

    const count = convertAutomaticToManual([makeEntry(root)]);
    // Leaves get flattened display names
    assert.equal(root.children[0].label, 'Servers-1');
    assert.equal(root.children[1].label, 'Servers-2');
    // Non-leaf label cleared
    assert.equal(root.label, '');
    assert.equal(count, 2);
  });

  it('flattens deep tree path into leaf label', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    splitNode(root);
    initChildNames(root);
    root.children[0].label = 'Web';
    splitNode(root.children[0]);
    initChildNames(root.children[0]);

    convertAutomaticToManual([makeEntry(root)]);
    assert.equal(root.children[0].children[0].label, 'Servers-Web-1');
    assert.equal(root.children[0].children[1].label, 'Servers-Web-2');
    // Internal nodes cleared
    assert.equal(root.label, '');
    assert.equal(root.children[0].label, '');
  });

  it('preserves custom separators in flattened name', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'DC';
    splitNode(root);
    initChildNames(root);
    root.children[0].label = 'Rack';
    root.children[0].separator = '.';
    splitNode(root.children[0]);
    initChildNames(root.children[0]);
    root.children[0].children[1].label = 'B';

    convertAutomaticToManual([makeEntry(root)]);
    assert.equal(root.children[0].children[1].label, 'DC.Rack.B');
  });

  it('does not count already-matching labels', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'X';
    splitNode(root);
    initChildNames(root);

    // First conversion flattens both leaves
    const first = convertAutomaticToManual([makeEntry(root)]);
    assert.equal(first, 2);
    assert.equal(root.children[0].label, 'X-1');
    assert.equal(root.children[1].label, 'X-2');

    // Second conversion: labels already match display names, count is 0
    const second = convertAutomaticToManual([makeEntry(root)]);
    assert.equal(second, 0);
  });

  it('handles empty labels producing empty display name (no change)', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    splitNode(root);
    initChildNames(root);
    // All labels are empty in automatic mode
    root.children[0].label = '';
    root.children[1].label = '';

    const count = convertAutomaticToManual([makeEntry(root)]);
    // Empty display name matches empty label — no conversion needed
    assert.equal(count, 0);
    assert.equal(root.children[0].label, '');
    assert.equal(root.children[1].label, '');
  });

  it('handles multiple entries independently', () => {
    const r1 = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(r1);
    r1.label = 'A';
    splitNode(r1);
    initChildNames(r1);

    const r2 = buildTreeKeepingIds(Subnet.parse('172.16.0.0/12'));
    initNodeName(r2);
    r2.label = 'B';
    splitNode(r2);
    initChildNames(r2);

    const count = convertAutomaticToManual([makeEntry(r1), { ...makeEntry(r2), id: 1 }]);
    assert.equal(r1.children[0].label, 'A-1');
    assert.equal(r2.children[0].label, 'B-1');
    assert.equal(r1.label, '');
    assert.equal(r2.label, '');
    assert.equal(count, 4);
  });

  it('handles unsplit root (leaf at root level)', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';

    const count = convertAutomaticToManual([makeEntry(root)]);
    // Root is a leaf: display name "Servers" already matches label
    assert.equal(root.label, 'Servers');
    assert.equal(count, 0);
  });
});

describe('clearAllNames', () => {
  it('blanks all labels across all entries', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Servers';
    splitNode(root);
    initChildNames(root);
    root.children[0].label = 'Web';

    clearAllNames([makeEntry(root)]);
    assert.equal(root.label, '');
    assert.equal(root.children[0].label, '');
    assert.equal(root.children[1].label, '');
  });

  it('handles unsplit root', () => {
    const root = buildTreeKeepingIds(Subnet.parse('10.0.0.0/8'));
    initNodeName(root);
    root.label = 'Test';

    clearAllNames([makeEntry(root)]);
    assert.equal(root.label, '');
  });
});
