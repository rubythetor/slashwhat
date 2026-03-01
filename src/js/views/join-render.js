/*\! © 2026 slashwhat. MIT License. */
// join-render.js — Join column rendering for the splitter table.
// Computes the vertical bar layout from the binary tree structure
// and renders the multi-column join cells for each row. The join
// column visualizes the tree hierarchy: each internal node becomes
// a vertical bar spanning its leaf descendants, and leaf nodes show
// a clickable prefix link for further splitting.

import { getInternalNodes, getLeafDescendants, getLeafIndex } from '../core/splitter.js';

// --- Join Bar Computation ---
// Maps each internal tree node to a visual "bar" in the join column.
// Each bar spans the rows of its leaf descendants and shows the parent's
// prefix. A bar is "mergeable" only when both its children are leaves
// (i.e. the user can undo exactly one split level).

export function computeJoinBars(tree, leaves) {
  const internals = getInternalNodes(tree);
  if (internals.length === 0) return { bars: [], maxDepth: 0 };

  const bars = internals.map(({ node, depth }) => {
    const descendants = getLeafDescendants(node);
    const startRow = getLeafIndex(leaves, descendants[0]);
    const spanRows = descendants.length;
    // Only allow merging when both children are leaves — can't merge if
    // either child has been further subdivided.
    const isMergeable = node.children[0].children === null && node.children[1].children === null;
    return { node, depth, startRow, spanRows, prefix: node.subnet.prefix, isMergeable };
  });

  // maxDepth + 1 because depth is 0-indexed but we need column count.
  const maxDepth = bars.reduce((m, b) => Math.max(m, b.depth), 0) + 1;
  return { bars, maxDepth };
}

// --- Join Cell Rendering ---
// Renders the multi-column join cells for a single row.

export function renderJoinCells(rowIdx, leaf, joinGrid, consumed, maxDepth, rowColors) {
  let out = '';

  // Count trailing empty columns (deepest first) — these become a
  // horizontal group showing the leaf's own prefix.
  let emptyCount = 0;
  for (let d = maxDepth - 1; d >= 0; d--) {
    if (consumed[rowIdx][d] || joinGrid[rowIdx][d]) break;
    emptyCount++;
  }

  // Render the horizontal group cells (leaf's own prefix display).
  // The rightmost cell shows the prefix as a green clickable link
  // (divide action) when the subnet can be further split.
  if (emptyCount > 0) {
    // 20% alpha tint (hex '33' = 51/255) so row color fills the cell without obscuring divide link text.
    const hgroupBg = rowColors[rowIdx];
    const bgStyle = hgroupBg ? ` style="background:${hgroupBg}33 !important"` : '';
    const maxPrefix = leaf.subnet.isIPv4 ? 32 : 128;
    const canDivide = leaf.subnet.prefix < maxPrefix;

    for (let i = 0; i < emptyCount; i++) {
      const isFirst = i === 0;
      const isLast = i === emptyCount - 1;
      let cls = 'splitter-join-cell';
      if (emptyCount > 1) {
        if (isFirst) cls += ' splitter-hgroup-left';
        else if (isLast) cls += ' splitter-hgroup-right';
        else cls += ' splitter-hgroup-mid';
      }
      let text = '';
      if (isLast) {
        if (canDivide) {
          text = `<a href="#" class="splitter-divide-link" data-node-id="${leaf.id}">/${leaf.subnet.prefix}</a>`;
        } else {
          text = `/${leaf.subnet.prefix}`;
        }
      }
      out += `<td class="${cls}"${bgStyle}>${text}</td>`;
    }
  }

  // Render vertical bar cells for ancestor nodes.
  for (let d = maxDepth - 1 - emptyCount; d >= 0; d--) {
    if (consumed[rowIdx][d]) continue;
    const bar = joinGrid[rowIdx][d];
    if (bar) {
      const clickAttr = bar.isMergeable ? `data-node-id="${bar.node.id}"` : '';
      if (bar.isMergeable) {
        // 5% alpha (hex '0D' = 13/255) — subtle tint so mergeable bars show color without competing with borders.
        const joinBg = bar.color || '';
        const bgAttr = joinBg ? ` style="background:${joinBg}0D !important"` : '';
        out += `<td class="splitter-join-cell mergeable" rowspan="${bar.spanRows}" ${clickAttr}${bgAttr} tabindex="0" role="button" aria-label="Join /${bar.prefix}">`;
      } else {
        out += `<td class="splitter-join-cell" rowspan="${bar.spanRows}" ${clickAttr}>`;
      }
      out += `/${bar.prefix}</td>`;
    } else {
      out += '<td class="splitter-join-cell splitter-join-empty"></td>';
    }
  }
  return out;
}
