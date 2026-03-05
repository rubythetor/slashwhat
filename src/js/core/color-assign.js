/*\! © 2026 slashwhat. MIT License. */
// color-assign.js — Assigns row colors based on the active color mode.
// Pure logic, no DOM. Takes tree leaves, join bars, color config, and
// theme state, and returns an array of CSS color strings (one per leaf).
// Also sets bar.color on mergeable bars for join cell rendering.

import { getThemeColors, ZEBRA_COLORS } from './color-themes.js';

// Set mergeable bar colors from the row color at each bar's start position.
function setBarColors(bars, colors) {
  for (const bar of bars) {
    if (bar.isMergeable) {
      bar.color = colors[bar.startRow];
    }
  }
}

// Assign a color to each row based on the active color mode.
// Returns string[] of CSS colors (one per leaf). Sets bar.color on
// mergeable bars so join-render can use it directly.
export function assignRowColors(leaves, bars, colorConfig, isDarkTheme) {
  const { mode, theme, altColors } = colorConfig;
  const palette = getThemeColors(theme);
  const zebraKey = isDarkTheme ? 'dark' : 'light';
  const zebra = ZEBRA_COLORS[zebraKey];

  switch (mode) {
    case 'sibling':
      return assignSibling(leaves, bars, palette);
    case 'cousins':
      return assignCousins(leaves, bars, palette);
    case 'cycle':
      return assignCycle(leaves, bars, palette);
    case 'alternating':
      return assignAlternating(leaves, bars, altColors);
    case 'zebra':
      return assignZebra(leaves, bars, zebra);
    case 'manual':
      return assignManual(leaves, bars, zebra);
    case 'none':
      return assignNone(leaves, bars);
    default:
      return assignSibling(leaves, bars, palette);
  }
}

// Sibling mode: mergeable pairs share a color from the palette.
// Colors cycle through the palette and restart per tree (the caller
// invokes assignRowColors once per tree).
function assignSibling(leaves, bars, palette) {
  const mergeableAtRow = new Map();
  for (const bar of bars) {
    if (bar.isMergeable) mergeableAtRow.set(bar.startRow, bar);
  }

  const colors = new Array(leaves.length).fill('');
  let colorIdx = 0;
  for (let i = 0; i < leaves.length; i++) {
    if (colors[i] !== '') continue;
    const c = palette[colorIdx % palette.length];
    colors[i] = c;
    const bar = mergeableAtRow.get(i);
    if (bar) {
      bar.color = c;
      colors[i + 1] = c;
    }
    colorIdx++;
  }
  return colors;
}

// Cousins mode: consecutive leaves with the same prefix length share
// a color. This groups subnets at the same depth regardless of whether
// they are siblings.
function assignCousins(leaves, bars, palette) {
  const colors = new Array(leaves.length).fill('');
  let colorIdx = 0;
  let prevPrefix = -1;
  for (let i = 0; i < leaves.length; i++) {
    const prefix = leaves[i].subnet.prefix;
    if (prefix !== prevPrefix) {
      colorIdx = prevPrefix === -1 ? 0 : colorIdx + 1;
      prevPrefix = prefix;
    }
    colors[i] = palette[colorIdx % palette.length];
  }

  setBarColors(bars, colors);
  return colors;
}

// Cycle mode: each row gets the next palette color, wrapping at the end.
// Unlike sibling (which pairs) or cousins (which groups by depth), cycle
// assigns one color per row sequentially regardless of tree structure.
function assignCycle(leaves, bars, palette) {
  const colors = leaves.map((_, i) => palette[i % palette.length]);
  setBarColors(bars, colors);
  return colors;
}

// Alternating mode: rows alternate between two user-chosen colors.
function assignAlternating(leaves, bars, altColors) {
  const c0 = altColors[0] || '#7DD3FC';
  const c1 = altColors[1] || '#FCA5A5';
  const colors = leaves.map((_, i) => i % 2 === 0 ? c0 : c1);
  setBarColors(bars, colors);
  return colors;
}

// Zebra mode: gray/white alternating, ignores theme palette.
function assignZebra(leaves, bars, zebra) {
  const colors = leaves.map((_, i) => zebra[i % 2]);
  setBarColors(bars, colors);
  return colors;
}

// Manual mode: each leaf can have a custom color; falls back to zebra.
function assignManual(leaves, bars, zebra) {
  const colors = leaves.map((leaf, i) => leaf.color || zebra[i % 2]);
  setBarColors(bars, colors);
  return colors;
}

// None mode: uniform gray matching the section header background.
const NONE_COLOR = '#6b7280';

function assignNone(leaves, bars) {
  for (const bar of bars) {
    if (bar.isMergeable) {
      bar.color = NONE_COLOR;
    }
  }
  return new Array(leaves.length).fill(NONE_COLOR);
}
