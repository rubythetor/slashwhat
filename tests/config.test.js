import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Subnet } from '../src/js/core/subnet.js';
import { setNextNodeId, buildTreeKeepingIds, splitNode } from '../src/js/core/splitter.js';
import { initNodeName, initChildNames } from '../src/js/core/naming.js';
import { serializeForest, deserializeConfig, validateConfig } from '../src/js/core/config.js';
import { DEFAULT_COLOR_CONFIG } from '../src/js/core/color-themes.js';

beforeEach(() => {
  setNextNodeId(0);
});

function makeEntry(cidr, id = 0) {
  const tree = buildTreeKeepingIds(Subnet.parse(cidr));
  initNodeName(tree);
  return { id, tree, collapsed: false, name: '', sectionId: '' };
}

function defaultDisplaySettings() {
  return {
    colOrder: ['subnet', 'name', 'range', 'usable', 'ips', 'hosts'],
    visibleCols: ['subnet', 'name', 'range', 'ips', 'hosts'],
    rangeDisplay: { range: { style: 'short', sep: ' to ' }, usable: { style: 'short', sep: ' to ' } },
    numberDisplay: { ips: 'locale', hosts: 'locale' },
    notesDisplay: { lines: '1', fontSize: 'normal' },
    colorConfig: { ...DEFAULT_COLOR_CONFIG },
    nameDisplay: { mode: 'manual' },
  };
}

describe('serializeForest', () => {
  it('produces correct top-level shape', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    assert.equal(json.app, 'slashwhat');
    assert.equal(json.version, 2);
    assert.equal(typeof json.exportedAt, 'string');
    assert.equal(Array.isArray(json.trees), true);
    assert.equal(json.trees.length, 1);
    assert.deepEqual(json.colOrder, ['subnet', 'name', 'range', 'usable', 'ips', 'hosts']);
    assert.deepEqual(json.visibleCols, ['subnet', 'name', 'range', 'ips', 'hosts']);
    assert.equal(typeof json.rangeDisplay, 'object');
    assert.equal(typeof json.numberDisplay, 'object');
  });

  it('serializes a single-node tree correctly', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    assert.equal(json.trees.length, 1);
    const tree = json.trees[0];
    assert.equal(tree.nodes.length, 1);
    assert.equal(tree.nodes[0].cidr, '10.0.0.0/8');
    assert.equal(tree.nodes[0].children, null);
  });

  it('serializes node with correct shape', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.tree.label = 'Servers';
    entry.tree.separator = '/';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    const node = json.trees[0].nodes[0];
    assert.equal(typeof node.id, 'number');
    assert.equal(node.cidr, '10.0.0.0/8');
    assert.equal(node.label, 'Servers');
    assert.equal(node.separator, '/');
  });

  it('serializes description and notes', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.tree.description = 'Main server block';
    entry.tree.notes = 'Line 1\nLine 2';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    const node = json.trees[0].nodes[0];
    assert.equal(node.description, 'Main server block');
    assert.equal(node.notes, 'Line 1\nLine 2');
  });

  it('serializes split tree with children references', () => {
    const entry = makeEntry('192.168.0.0/24');
    splitNode(entry.tree);
    initChildNames(entry.tree);
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    const nodes = json.trees[0].nodes;
    assert.equal(nodes.length, 3);
    const root = nodes.find(n => n.cidr === '192.168.0.0/24');
    assert.ok(Array.isArray(root.children));
    assert.equal(root.children.length, 2);
  });
});

describe('deserializeConfig', () => {
  it('roundtrips: serialize → deserialize preserves entries', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.tree.label = 'Test';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    setNextNodeId(0);
    const result = deserializeConfig(json);

    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].tree.subnet.toString(), '10.0.0.0/8');
    assert.equal(result.entries[0].tree.label, 'Test');
  });

  it('roundtrips description and notes', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.tree.description = 'Test desc';
    entry.tree.notes = 'Multi\nline\nnotes';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].tree.description, 'Test desc');
    assert.equal(result.entries[0].tree.notes, 'Multi\nline\nnotes');
  });

  it('roundtrips column settings', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    const result = deserializeConfig(json);
    assert.deepEqual(result.colOrder, ds.colOrder);
    assert.deepEqual(result.visibleCols, ds.visibleCols);
  });

  it('rebuilds tree with parent pointers', () => {
    const entry = makeEntry('192.168.0.0/24');
    splitNode(entry.tree);
    initChildNames(entry.tree);
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    const tree = result.entries[0].tree;
    assert.equal(tree.parent, null);
    assert.notEqual(tree.children, null);
    assert.equal(tree.children[0].parent, tree);
    assert.equal(tree.children[1].parent, tree);
  });

  it('advances _nodeId past max existing ID', () => {
    setNextNodeId(100);
    const entry = makeEntry('10.0.0.0/8', 0);
    splitNode(entry.tree);
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    setNextNodeId(0);
    deserializeConfig(json);

    // Next node created should have an ID higher than any in the deserialized tree
    const newNode = buildTreeKeepingIds(Subnet.parse('172.16.0.0/12'));
    const maxExistingId = Math.max(...json.trees[0].nodes.map(n => n.id));
    assert.ok(newNode.id > maxExistingId);
  });

  it('filters unknown column keys', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    json.colOrder.push('nonexistent_col');
    json.visibleCols.push('bad_col');

    const result = deserializeConfig(json);
    assert.ok(!result.colOrder.includes('nonexistent_col'));
    assert.ok(!result.visibleCols.includes('bad_col'));
  });

  it('rangeDisplay: valid styles pass through', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    ds.rangeDisplay = { range: { style: 'dots', sep: ' - ' }, usable: { style: 'tail', sep: '\u2013' } };
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    const result = deserializeConfig(json);
    assert.equal(result.rangeDisplay.range.style, 'dots');
    assert.equal(result.rangeDisplay.usable.style, 'tail');
  });

  it('rangeDisplay: invalid style defaults to "short"', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    json.rangeDisplay = { range: { style: 'invalid' }, usable: { style: 'also_invalid' } };

    const result = deserializeConfig(json);
    assert.equal(result.rangeDisplay.range.style, 'short');
    assert.equal(result.rangeDisplay.usable.style, 'short');
  });

  // TEST-012: valid style but invalid sep defaults sep to " to "
  it('rangeDisplay: valid style with invalid sep defaults sep', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    json.rangeDisplay = { range: { style: 'dots', sep: '>>>' }, usable: { style: 'tail', sep: '!!!' } };

    const result = deserializeConfig(json);
    assert.equal(result.rangeDisplay.range.style, 'dots');
    assert.equal(result.rangeDisplay.range.sep, ' to ');
    assert.equal(result.rangeDisplay.usable.style, 'tail');
    assert.equal(result.rangeDisplay.usable.sep, ' to ');
  });

  it('numberDisplay: valid formats pass through', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    ds.numberDisplay = { ips: 'si', hosts: 'raw' };
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    const result = deserializeConfig(json);
    assert.equal(result.numberDisplay.ips, 'si');
    assert.equal(result.numberDisplay.hosts, 'raw');
  });

  it('numberDisplay: invalid formats default to "locale"', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    json.numberDisplay = { ips: 'bad', hosts: 'nope' };

    const result = deserializeConfig(json);
    assert.equal(result.numberDisplay.ips, 'locale');
    assert.equal(result.numberDisplay.hosts, 'locale');
  });
});

describe('deserializeConfig — missing optional fields', () => {
  it('defaults colOrder to null when missing', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    delete json.colOrder;
    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.colOrder, null);
  });

  it('defaults visibleCols to null when missing', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    delete json.visibleCols;
    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.visibleCols, null);
  });

  it('defaults rangeDisplay when missing', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    delete json.rangeDisplay;
    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.rangeDisplay.range.style, 'short');
    assert.equal(result.rangeDisplay.usable.style, 'short');
  });

  it('defaults numberDisplay when missing', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    delete json.numberDisplay;
    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.numberDisplay.ips, 'locale');
    assert.equal(result.numberDisplay.hosts, 'locale');
  });

  it('defaults notesDisplay when missing', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    delete json.notesDisplay;
    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.notesDisplay.lines, '1');
    assert.equal(result.notesDisplay.fontSize, 'normal');
  });

  // TEST-011: roundtrip notesDisplay with non-default values
  it('roundtrips notesDisplay with custom values', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    ds.notesDisplay = { lines: '3', fontSize: 'small' };
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.notesDisplay.lines, '3');
    assert.equal(result.notesDisplay.fontSize, 'small');
  });
});

describe('colorConfig serialization', () => {
  it('roundtrips colorConfig', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    ds.colorConfig = { mode: 'zebra', theme: 'Neon', altColors: ['#AAA000', '#BBB000'] };
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    const result = deserializeConfig(json);
    assert.equal(result.colorConfig.mode, 'zebra');
    assert.equal(result.colorConfig.theme, 'Neon');
    assert.deepEqual(result.colorConfig.altColors, ['#AAA000', '#BBB000']);
  });

  it('defaults colorConfig when missing from JSON', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    delete json.colorConfig;
    setNextNodeId(0);

    const result = deserializeConfig(json);
    assert.equal(result.colorConfig.mode, 'sibling');
    assert.equal(result.colorConfig.theme, 'Neon');
    assert.equal(result.colorConfig.altColors.length, 2);
  });

  it('defaults invalid mode to sibling', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.colorConfig = { mode: 'invalid', theme: 'Pastel', altColors: ['#AAA000', '#BBB000'] };

    const result = deserializeConfig(json);
    assert.equal(result.colorConfig.mode, 'sibling');
  });

  it('rejects malicious altColors — falls back to defaults', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.colorConfig = { mode: 'alternating', theme: 'Pastel', altColors: ['red;position:fixed', '#BBB000'] };

    const result = deserializeConfig(json);
    assert.deepEqual(result.colorConfig.altColors, [...DEFAULT_COLOR_CONFIG.altColors]);
  });

  it('rejects non-hex altColors (3-digit hex)', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.colorConfig = { mode: 'alternating', theme: 'Pastel', altColors: ['#FFF', '#000'] };

    const result = deserializeConfig(json);
    assert.deepEqual(result.colorConfig.altColors, [...DEFAULT_COLOR_CONFIG.altColors]);
  });

  it('accepts valid 6-digit hex altColors', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.colorConfig = { mode: 'alternating', theme: 'Pastel', altColors: ['#AABBCC', '#112233'] };

    const result = deserializeConfig(json);
    assert.deepEqual(result.colorConfig.altColors, ['#AABBCC', '#112233']);
  });

  it('defaults invalid theme to Neon', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.colorConfig = { mode: 'sibling', theme: 'FakeTheme', altColors: ['#AAA000', '#BBB000'] };

    const result = deserializeConfig(json);
    assert.equal(result.colorConfig.theme, 'Neon');
  });

  // TEST-012: altColors with wrong length falls back to defaults
  it('rejects altColors with 3 elements — falls back to defaults', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.colorConfig = { mode: 'alternating', theme: 'Pastel', altColors: ['#AA0000', '#BB0000', '#CC0000'] };

    const result = deserializeConfig(json);
    assert.deepEqual(result.colorConfig.altColors, [...DEFAULT_COLOR_CONFIG.altColors]);
  });

  it('rejects altColors with 1 element — falls back to defaults', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.colorConfig = { mode: 'alternating', theme: 'Pastel', altColors: ['#AA0000'] };

    const result = deserializeConfig(json);
    assert.deepEqual(result.colorConfig.altColors, [...DEFAULT_COLOR_CONFIG.altColors]);
  });
});

describe('node.color serialization', () => {
  it('roundtrips node.color', () => {
    const entry = makeEntry('192.168.0.0/24');
    splitNode(entry.tree);
    entry.tree.children[0].color = '#FF0000';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    const node = json.trees[0].nodes.find(n => n.color === '#FF0000');
    assert.ok(node);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    const tree = result.entries[0].tree;
    assert.equal(tree.children[0].color, '#FF0000');
    assert.equal(tree.children[1].color, null);
  });

  it('defaults null color when not set', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    assert.equal(json.trees[0].nodes[0].color, null);
  });

  it('validates color format — rejects invalid hex', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.trees[0].nodes[0].color = 'not-a-color';

    const error = validateConfig(json);
    assert.ok(error);
    assert.ok(error.includes('Invalid color'));
  });
});

describe('nameDisplay serialization', () => {
  it('roundtrips nameDisplay', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    ds.nameDisplay = { mode: 'automatic' };
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    const result = deserializeConfig(json);
    assert.equal(result.nameDisplay.mode, 'automatic');
  });

  it('defaults nameDisplay to manual when missing from JSON', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    delete json.nameDisplay;
    setNextNodeId(0);

    const result = deserializeConfig(json);
    assert.equal(result.nameDisplay.mode, 'manual');
  });

  it('defaults invalid name mode to manual', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.nameDisplay = { mode: 'invalid' };

    const result = deserializeConfig(json);
    assert.equal(result.nameDisplay.mode, 'manual');
  });
});

describe('entry.name serialization', () => {
  it('roundtrips entry.name', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.name = 'Production';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].name, 'Production');
  });

  it('defaults entry.name to empty string when missing', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    delete json.trees[0].name;

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].name, '');
  });
});

describe('entry.sectionId serialization', () => {
  it('roundtrips entry.sectionId', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.sectionId = '42';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].sectionId, '42');
  });

  it('defaults entry.sectionId to empty string when missing', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    delete json.trees[0].sectionId;

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].sectionId, '');
  });
});

describe('SEC-002: text field length truncation', () => {
  it('truncates oversized node label to 200 chars', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.tree.label = 'X';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.trees[0].nodes[0].label = 'A'.repeat(500);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].tree.label.length, 200);
  });

  it('truncates oversized node separator to 10 chars', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.trees[0].nodes[0].separator = '-'.repeat(50);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].tree.separator.length, 10);
  });

  it('truncates oversized node description to 200 chars', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.trees[0].nodes[0].description = 'D'.repeat(400);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].tree.description.length, 200);
  });

  it('truncates oversized node notes to 2000 chars', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.trees[0].nodes[0].notes = 'N'.repeat(5000);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].tree.notes.length, 2000);
  });

  it('truncates oversized entry name to 200 chars', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.name = 'Short';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.trees[0].name = 'Z'.repeat(300);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].name.length, 200);
  });

  it('truncates oversized entry sectionId to 10 chars', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.sectionId = '1';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.trees[0].sectionId = '9'.repeat(50);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].sectionId.length, 10);
  });

  it('truncates oversized entry description to 200 chars', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.trees[0].description = 'E'.repeat(400);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].description.length, 200);
  });

  it('truncates oversized entry notes to 2000 chars', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    json.trees[0].notes = 'W'.repeat(5000);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].notes.length, 2000);
  });

  it('leaves short strings unchanged', () => {
    const entry = makeEntry('10.0.0.0/8');
    entry.tree.label = 'Hello';
    entry.tree.separator = '/';
    entry.tree.description = 'Short desc';
    entry.tree.notes = 'Brief notes';
    entry.name = 'Prod';
    entry.sectionId = 'abc';
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);

    setNextNodeId(0);
    const result = deserializeConfig(json);
    assert.equal(result.entries[0].tree.label, 'Hello');
    assert.equal(result.entries[0].tree.separator, '/');
    assert.equal(result.entries[0].tree.description, 'Short desc');
    assert.equal(result.entries[0].tree.notes, 'Brief notes');
    assert.equal(result.entries[0].name, 'Prod');
    assert.equal(result.entries[0].sectionId, 'abc');
  });
});

describe('validateConfig re-export', () => {
  it('validateConfig is a function', () => {
    assert.equal(typeof validateConfig, 'function');
  });

  it('returns null for valid config', () => {
    const entry = makeEntry('10.0.0.0/8');
    const ds = defaultDisplaySettings();
    const json = serializeForest([entry], ds.colOrder, ds.visibleCols, ds);
    assert.equal(validateConfig(json), null);
  });
});
