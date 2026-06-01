import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { assignRowColors } from '../src/js/core/color-assign.js';
import { getThemeColors, DEFAULT_COLOR_CONFIG, ZEBRA_COLORS } from '../src/js/core/color-themes.js';
import { Subnet } from '../src/js/core/subnet.js';
import { setNextNodeId, buildTreeKeepingIds, splitNode, getLeaves } from '../src/js/core/splitter.js';
import { computeJoinBars } from '../src/js/views/join-render.js';

beforeEach(() => {
  setNextNodeId(0);
});

function makeTree(cidr) {
  return buildTreeKeepingIds(Subnet.parse(cidr));
}

function getLeavesAndBars(tree) {
  const leaves = getLeaves(tree);
  const { bars } = computeJoinBars(tree, leaves);
  return { leaves, bars };
}

describe('assignRowColors — sibling mode', () => {
  const config = { mode: 'sibling', theme: 'Pastel', altColors: [] };

  it('single leaf gets first palette color', () => {
    const tree = makeTree('10.0.0.0/8');
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    assert.equal(colors.length, 1);
    assert.equal(colors[0], getThemeColors('Pastel')[0]);
  });

  it('sibling pair shares a color', () => {
    const tree = makeTree('192.168.0.0/24');
    splitNode(tree);
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    assert.equal(colors.length, 2);
    assert.equal(colors[0], colors[1]);
  });

  it('sets bar.color on mergeable bars', () => {
    const tree = makeTree('192.168.0.0/24');
    splitNode(tree);
    const { leaves, bars } = getLeavesAndBars(tree);
    assignRowColors(leaves, bars, config, true);
    const mergeable = bars.filter(b => b.isMergeable);
    assert.equal(mergeable.length, 1);
    assert.equal(typeof mergeable[0].color, 'string');
    assert.ok(mergeable[0].color.startsWith('#'));
  });

  it('non-sibling leaves get different colors', () => {
    const tree = makeTree('192.168.0.0/24');
    splitNode(tree);
    splitNode(tree.children[0]);
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    // 3 leaves: children[0].children[0], children[0].children[1], children[1]
    // First two are siblings (share color), third is separate
    assert.equal(colors[0], colors[1]);
    assert.notEqual(colors[0], colors[2]);
  });

  it('wraps palette at 8 colors', () => {
    const tree = makeTree('10.0.0.0/8');
    // Split enough times to get more than 8 leaves
    splitNode(tree);
    splitNode(tree.children[0]);
    splitNode(tree.children[1]);
    splitNode(tree.children[0].children[0]);
    splitNode(tree.children[0].children[1]);
    splitNode(tree.children[1].children[0]);
    splitNode(tree.children[1].children[1]);
    // Now we have exactly 8 leaf-level siblings, each pair shares color
    // -> 4 unique colors from pairs. Split more to exceed 8 unique.
    splitNode(tree.children[0].children[0].children[0]);
    splitNode(tree.children[0].children[0].children[1]);
    splitNode(tree.children[0].children[1].children[0]);
    splitNode(tree.children[0].children[1].children[1]);

    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    // Should have wrapped around the 8-color palette
    assert.ok(colors.length > 8);
    const palette = getThemeColors('Pastel');
    for (const c of colors) {
      assert.ok(palette.includes(c), `${c} should be in palette`);
    }
  });
});

describe('assignRowColors — cousins mode', () => {
  const config = { mode: 'cousins', theme: 'Pastel', altColors: [] };

  it('groups consecutive same-prefix leaves', () => {
    const tree = makeTree('10.0.0.0/8');
    splitNode(tree);
    splitNode(tree.children[0]);
    // Leaves: /10, /10, /9 — first two share prefix length, third differs
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    assert.equal(colors[0], colors[1]);
    assert.notEqual(colors[0], colors[2]);
  });

  it('single leaf gets first palette color', () => {
    const tree = makeTree('10.0.0.0/8');
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    assert.equal(colors[0], getThemeColors('Pastel')[0]);
  });
});

describe('assignRowColors — cycle mode', () => {
  const config = { mode: 'cycle', theme: 'Pastel', altColors: [] };

  it('assigns sequential palette colors to each row', () => {
    const tree = makeTree('10.0.0.0/8');
    splitNode(tree);
    splitNode(tree.children[0]);
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    const palette = getThemeColors('Pastel');
    assert.equal(colors[0], palette[0]);
    assert.equal(colors[1], palette[1]);
    assert.equal(colors[2], palette[2]);
  });

  it('wraps around the palette', () => {
    const tree = makeTree('10.0.0.0/8');
    splitNode(tree);
    splitNode(tree.children[0]);
    splitNode(tree.children[1]);
    splitNode(tree.children[0].children[0]);
    splitNode(tree.children[0].children[1]);
    splitNode(tree.children[1].children[0]);
    splitNode(tree.children[1].children[1]);
    splitNode(tree.children[0].children[0].children[0]);
    splitNode(tree.children[0].children[0].children[1]);
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    const palette = getThemeColors('Pastel');
    assert.ok(colors.length > palette.length);
    // Ninth row wraps to first palette color
    assert.equal(colors[8], palette[0]);
  });

  it('sets bar.color from row start position', () => {
    const tree = makeTree('192.168.0.0/24');
    splitNode(tree);
    const { leaves, bars } = getLeavesAndBars(tree);
    assignRowColors(leaves, bars, config, true);
    const mergeable = bars.filter(b => b.isMergeable);
    assert.equal(mergeable.length, 1);
    assert.ok(mergeable[0].color.startsWith('#'));
  });
});

describe('assignRowColors — alternating mode', () => {
  const config = { mode: 'alternating', theme: 'Pastel', altColors: ['#AAA', '#BBB'] };

  it('alternates between two colors', () => {
    const tree = makeTree('10.0.0.0/8');
    splitNode(tree);
    splitNode(tree.children[0]);
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    assert.equal(colors[0], '#AAA');
    assert.equal(colors[1], '#BBB');
    assert.equal(colors[2], '#AAA');
  });

  it('uses fallback colors when altColors are empty', () => {
    const cfg = { mode: 'alternating', theme: 'Pastel', altColors: ['', ''] };
    const tree = makeTree('10.0.0.0/8');
    splitNode(tree);
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, cfg, true);
    assert.equal(colors[0], '#7DD3FC');
    assert.equal(colors[1], '#FCA5A5');
  });
});

describe('assignRowColors — zebra mode', () => {
  const config = { mode: 'zebra', theme: 'Pastel', altColors: [] };

  it('uses dark zebra colors when isDarkTheme is true', () => {
    const tree = makeTree('192.168.0.0/24');
    splitNode(tree);
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, true);
    assert.equal(colors[0], ZEBRA_COLORS.dark[0]);
    assert.equal(colors[1], ZEBRA_COLORS.dark[1]);
  });

  it('uses light zebra colors when isDarkTheme is false', () => {
    const tree = makeTree('192.168.0.0/24');
    splitNode(tree);
    const { leaves, bars } = getLeavesAndBars(tree);
    const colors = assignRowColors(leaves, bars, config, false);
    assert.equal(colors[0], ZEBRA_COLORS.light[0]);
    assert.equal(colors[1], ZEBRA_COLORS.light[1]);
  });
});

describe('assignRowColors — manual mode', () => {
  it('uses leaf.color when set', () => {
    const tree = makeTree('192.168.0.0/24');
    splitNode(tree);
    const { leaves, bars } = getLeavesAndBars(tree);
    leaves[0].color = '#FF0000';
    const config = { mode: 'manual', theme: 'Pastel', altColors: [] };
    const colors = assignRowColors(leaves, bars, config, true);
    assert.equal(colors[0], '#FF0000');
    // Second leaf falls back to zebra
    assert.equal(colors[1], ZEBRA_COLORS.dark[1]);
  });

  it('falls back to zebra when no color set', () => {
    const tree = makeTree('10.0.0.0/8');
    const { leaves, bars } = getLeavesAndBars(tree);
    const config = { mode: 'manual', theme: 'Pastel', altColors: [] };
    const colors = assignRowColors(leaves, bars, config, false);
    assert.equal(colors[0], ZEBRA_COLORS.light[0]);
  });
});

describe('assignRowColors — none mode', () => {
  it('returns uniform gray for all rows', () => {
    const tree = makeTree('192.168.0.0/24');
    splitNode(tree);
    const { leaves, bars } = getLeavesAndBars(tree);
    const config = { mode: 'none', theme: 'Pastel', altColors: [] };
    const colors = assignRowColors(leaves, bars, config, true);
    assert.equal(colors[0], '#6b7280');
    assert.equal(colors[1], '#6b7280');
  });

  it('sets bar.color to gray', () => {
    const tree = makeTree('192.168.0.0/24');
    splitNode(tree);
    const { leaves, bars } = getLeavesAndBars(tree);
    const config = { mode: 'none', theme: 'Pastel', altColors: [] };
    assignRowColors(leaves, bars, config, true);
    for (const bar of bars) {
      if (bar.isMergeable) {
        assert.equal(bar.color, '#6b7280');
      }
    }
  });
});

describe('assignRowColors — empty tree', () => {
  it('returns empty array for no leaves', () => {
    const config = { mode: 'sibling', theme: 'Pastel', altColors: [] };
    const colors = assignRowColors([], [], config, true);
    assert.equal(colors.length, 0);
  });
});

describe('assignRowColors — unknown mode fallback', () => {
  it('falls back to sibling for unknown modes', () => {
    const tree = makeTree('10.0.0.0/8');
    const { leaves, bars } = getLeavesAndBars(tree);
    const config = { mode: 'invalid_mode', theme: 'Pastel', altColors: [] };
    const colors = assignRowColors(leaves, bars, config, true);
    assert.equal(colors[0], getThemeColors('Pastel')[0]);
  });
});
