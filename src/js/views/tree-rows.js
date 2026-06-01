/*\! © 2026 slashwhat. MIT License. */
// tree-rows.js — HTML generation for per-tree rows: section headers and
// data rows. Extracted from table-render.js to keep files under 300 lines.
// The tree header shows the root subnet with collapse/move/delete controls.
// Data rows show one leaf per row with per-column cell content and join bars.

import { getLeaves } from '../core/splitter.js';
import { escapeHtml, renderCellContent, formatCellValue } from './table-render.js';
import { computeJoinBars, renderJoinCells } from './join-render.js';
import { assignRowColors } from '../core/color-assign.js';
import { computeVlan } from '../core/vlan-macro.js';
import { warningBadge, overlapTooltip, subnetTooltip } from './warning-badges.js';

// Relative luminance per WCAG formula — decides whether a background
// color needs light or dark foreground text for contrast (F-08).
function hexLuminance(hex) {
  if (!hex || hex.length < 7) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Render a tree header row that mirrors the data columns, populated
// with the root subnet's values. Move arrows and collapse chevron
// sit in the left margin; the delete button sits in the right margin.
export function renderTreeHeader(entry, colOrder, visibleCols, globalMaxDepth, isFirst, isLast, ds, warnings = null) {
  const { rangeDisplay, numberDisplay, notesDisplay } = ds;
  const s = entry.tree.subnet;
  const fid = entry.id;
  const hasOverlap = warnings && warnings.overlappingIds.has(fid);
  const chevronCls = entry.collapsed ? 'tree-header-chevron collapsed' : 'tree-header-chevron';

  const cells = [];
  let firstCellIdx = -1;

  for (const key of colOrder) {
    if (!visibleCols.has(key)) continue;

    if (key === 'join') {
      for (let d = 0; d < globalMaxDepth; d++) {
        cells.push('<td class="tree-header-cell"></td>');
      }
      continue;
    }

    // Pure format columns use shared formatter — avoids duplicating
    // range/number logic that already lives in table-render.js.
    let content = formatCellValue(key, s, rangeDisplay, numberDisplay);
    if (content === null) {
      content = '';
      switch (key) {
        case 'subnet': {
          const overlapBadge = hasOverlap ? warningBadge(overlapTooltip(entry, warnings.entries)) : '';
          const rfcTip = warnings && warnings.showTooltips ? ` title="${escapeHtml(subnetTooltip(s))}"` : '';
          content = `${overlapBadge}<strong${rfcTip}>${escapeHtml(s.toString())}</strong>`;
          break;
        }
        case 'name': {
          // Section header shows optional numeric ID + entry.name inline.
          // Two separate click targets so each can be edited independently.
          const sid = escapeHtml(entry.sectionId ?? '');
          const nv = escapeHtml(entry.name ?? '');
          const sidHtml = sid
            ? `<span class="header-sid-text" data-forest-id="${fid}">${sid}</span>`
            : `<span class="header-sid-text header-sid-placeholder" data-forest-id="${fid}">#</span>`;
          const sep = sid ? ' \u2014 ' : '';
          const nameHtml = `<span class="header-name-text" data-forest-id="${fid}">${nv || '<span class="name-placeholder">name</span>'}</span>`;
          content = sidHtml + sep + nameHtml;
          break;
        }
        case 'desc': {
          const dv = escapeHtml(entry.description ?? '');
          content = `<span class="header-desc-text" data-forest-id="${fid}">${dv || '<span class="desc-placeholder">description</span>'}</span>`;
          break;
        }
        case 'notes': {
          const nv = entry.notes ?? '';
          const nd = notesDisplay || {};
          const lineCls = nd.lines === '2' ? ' notes-2line' : nd.lines === '3' ? ' notes-3line' : nd.lines === 'all' ? '' : ' notes-1line';
          const escapedNv = escapeHtml(nv);
          content = `<span class="header-notes-text${lineCls}" data-forest-id="${fid}">${escapedNv || '<span class="notes-placeholder">notes</span>'}</span>`;
          break;
        }
        case 'vlan': {
          // Show a scope label instead of the raw macro formula —
          // "local" when the section has its own template, "global"
          // when inheriting, empty when unset.  The actual formula
          // is available as a tooltip on hover.
          const globalTpl = ds.vlanDisplay?.template || '';
          const sectionTpl = entry.vlanTemplate || '';
          const effectiveTpl = sectionTpl || globalTpl;
          const inherited = !sectionTpl && !!globalTpl;
          const cls = inherited ? ' vlan-inherited' : '';
          const label = sectionTpl ? 'local' : inherited ? 'global' : '';
          const tip = effectiveTpl ? ` title="${escapeHtml(effectiveTpl)}"` : '';
          content = `<span class="header-vlan-text${cls}" data-forest-id="${fid}"${tip}>${label}</span>`;
          break;
        }
      }
    }

    // First visible cell gets move arrows and collapse chevron
    // positioned in the left margin via CSS absolute positioning.
    let marginHtml = '';
    let extraCls = '';
    if (firstCellIdx === -1) {
      const upDis = isFirst ? ' disabled' : '';
      const dnDis = isLast ? ' disabled' : '';
      marginHtml =
        `<span class="tree-header-arrows">` +
          `<button class="tree-header-arrow" data-action="move-up" data-forest-id="${fid}" title="Move up" aria-label="Move section up"${upDis}>&#9650;</button>` +
          `<button class="tree-header-arrow" data-action="move-down" data-forest-id="${fid}" title="Move down" aria-label="Move section down"${dnDis}>&#9660;</button>` +
        `</span>` +
        `<button class="${chevronCls}" data-action="collapse" data-forest-id="${fid}" title="Collapse/expand" aria-label="Collapse or expand section">&#9654;</button>`;
      extraCls = ' tree-header-first-cell';
      firstCellIdx = cells.length;
    }

    let colCls = '';
    if (key === 'notes') {
      const nd = notesDisplay || {};
      const sizeCls = nd.fontSize === 'small' ? ' notes-size-small' : nd.fontSize === 'smallest' ? ' notes-size-smallest' : '';
      colCls = ` notes-cell${sizeCls}`;
    }
    cells.push(`<td class="tree-header-cell${extraCls}${colCls}">${marginHtml}${content}</td>`);
  }

  // Last cell's class may have extra classes, so regex matches any class string and appends tree-header-last-cell.
  const deleteHtml = `<button class="tree-header-delete" data-action="delete" data-forest-id="${fid}" title="Delete tree" aria-label="Delete section">&#10005;</button>`;
  const lastIdx = cells.length - 1;
  cells[lastIdx] = cells[lastIdx].replace(/class="tree-header-cell([^"]*)">/,
    'class="tree-header-cell$1 tree-header-last-cell">' + deleteHtml);

  const overlapCls = hasOverlap ? ' tree-header-overlap' : '';
  let html = `<tr class="tree-header-row${overlapCls}" data-forest-id="${fid}">`;
  html += cells.join('');
  html += '</tr>';
  return html;
}

// Render data rows for one tree. Each tree gets its own color cycle
// starting from index 0. Returns the HTML string and the number of
// join columns needed (maxDepth).
export function renderTreeDataRows(entry, globalMaxDepth, colOrder, visibleCols, ds, isDarkTheme) {
  const { rangeDisplay, numberDisplay, notesDisplay, colorConfig, nameDisplay, vlanDisplay } = ds;
  const leaves = getLeaves(entry.tree);
  const { bars, maxDepth } = computeJoinBars(entry.tree, leaves);

  // Pre-compute VLAN for each leaf using the inheritance model:
  // section override takes priority over global default.
  const globalTemplate = vlanDisplay?.template || '';
  const sectionTemplate = entry.vlanTemplate || '';
  const effectiveTemplate = sectionTemplate || globalTemplate;
  if (effectiveTemplate && visibleCols.has('vlan')) {
    leaves.forEach((leaf, idx) => {
      leaf._vlanComputed = computeVlan(effectiveTemplate, leaf.subnet, entry.sectionId, idx);
    });
  }
  const showJoin = visibleCols.has('join');

  // Build join grid for this tree
  const joinGrid = leaves.map(() => new Array(globalMaxDepth).fill(null));
  const consumed = leaves.map(() => new Array(globalMaxDepth).fill(false));

  // Offset bars so shallower trees align with deeper ones. The rightmost
  // column is reserved for the leaf's own prefix, so subtract 1.
  const depthOffset = (globalMaxDepth - 1) - maxDepth;
  for (const bar of bars) {
    const adjustedDepth = bar.depth + depthOffset;
    joinGrid[bar.startRow][adjustedDepth] = bar;
    for (let r = bar.startRow + 1; r < bar.startRow + bar.spanRows; r++) {
      consumed[r][adjustedDepth] = true;
    }
  }

  // Color assignment is now handled by the pure-logic color-assign module.
  const rowColors = assignRowColors(leaves, bars, colorConfig, isDarkTheme);
  const isManual = colorConfig && colorConfig.mode === 'manual';

  // Build row HTML
  let html = '';
  let firstVisibleKey = null;
  for (const key of colOrder) {
    if (visibleCols.has(key) && key !== 'join') { firstVisibleKey = key; break; }
  }

  // Track color group index so alternating groups get a CSS marker for
  // colorblind users — subtle left border toggles between groups (F-27).
  let prevColor = null;
  let groupIdx = 0;

  leaves.forEach((leaf, rowIdx) => {
    const rowBg = rowColors[rowIdx];
    if (rowBg !== prevColor) { groupIdx++; prevColor = rowBg; }
    // Dark backgrounds need light text for WCAG AA contrast (F-08).
    const isDark = hexLuminance(rowBg) < 0.4;
    const classes = [isDark ? 'dark-bg' : '', groupIdx % 2 ? 'group-a' : 'group-b'].filter(Boolean).join(' ');
    const clsAttr = classes ? ` class="${classes}"` : '';
    html += `<tr data-leaf-id="${leaf.id}" tabindex="-1"${clsAttr}>`;

    for (const key of colOrder) {
      if (!visibleCols.has(key)) continue;
      if (key === 'join') {
        if (showJoin) {
          html += renderJoinCells(rowIdx, leaf, joinGrid, consumed, globalMaxDepth, rowColors);
        } else {
          for (let d = 0; d < globalMaxDepth; d++) {
            html += '<td class="splitter-join-cell splitter-join-empty"></td>';
          }
        }
        continue;
      }
      let cell = renderCellContent(key, leaf, rowBg, ds);
      // Manual mode: inject flat color dot into the first visible data cell's left margin.
      if (isManual && key === firstVisibleKey) {
        const swatchBg = leaf.color || 'var(--text-muted)';
        const bucket = `<span class="color-bucket" data-node-id="${leaf.id}" style="background:${swatchBg}"></span>`;
        const insertAt = cell.indexOf('>') + 1;
        cell = cell.slice(0, insertAt) + bucket + cell.slice(insertAt);
      }
      html += cell;
    }

    html += '</tr>';
  });

  return { html, maxDepth };
}
