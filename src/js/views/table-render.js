/*\! © 2026 slashwhat. MIT License. */
// table-render.js — Pure HTML generation for the splitter table.
// Contains column definitions, cell renderers, table header, input row,
// and empty state. Per-tree row renderers (tree headers, data rows) live
// in tree-rows.js. Join bar rendering is in join-render.js.

import { getNamePath } from '../core/naming.js';
import { formatRange } from '../core/parse.js';
import { computeJoinBars } from './join-render.js';
import { warningBadge, subnetTooltip } from './warning-badges.js';
import { escapeHtml } from '../ui/html-utils.js';

// Re-export so callers (splitter-view.js, tree-rows.js) don't need separate imports.
export { computeJoinBars, escapeHtml };

// --- Column Definitions ---
// Defines all available table columns. Users can toggle visibility and
// reorder columns via the toggle bar. 'defaultOn' controls initial state.

export const COLUMN_DEFS = [
  { key: 'subnet',  label: 'Subnet',      defaultOn: true  },
  { key: 'name',    label: 'Name',        defaultOn: true  },
  { key: 'desc',    label: 'Description', defaultOn: false },
  { key: 'notes',   label: 'Notes',       defaultOn: false },
  { key: 'vlan',    label: 'VLAN',        defaultOn: false },
  { key: 'netmask', label: 'Mask',        defaultOn: false },
  { key: 'wildcard', label: 'Wildcard',   defaultOn: false },
  { key: 'range',   label: 'Range',       defaultOn: true  },
  { key: 'usable',  label: 'Usable',      defaultOn: false },
  { key: 'ips',     label: 'IPs',         defaultOn: true  },
  { key: 'hosts',   label: 'Hosts',       defaultOn: false },
  { key: 'join',    label: 'Split/Join',   defaultOn: true  },
];

// Key-to-definition lookup so renderers access label/defaultOn by column key without scanning the array.
export const COL_DEF_MAP = Object.fromEntries(COLUMN_DEFS.map(c => [c.key, c]));

// --- Utilities ---

// Format large numbers with locale-appropriate thousand separators.
// Handles BigInt (IPv6 host counts) which can exceed Number.MAX_SAFE_INTEGER.
function formatNumber(n) {
  if (typeof n === 'bigint') return n.toLocaleString();
  return Number(n).toLocaleString();
}

// Format a number in one of four styles: locale ("4,096"), si ("4K"), si1 ("4.1K"), raw ("4096").
// SI magnitude suffixes for compact number display ('4K' instead of '4,096').
const SI_SUFFIXES = ['', 'K', 'M', 'G', 'T', 'P', 'E'];

export function formatNumberStyled(n, style = 'locale') {
  const num = typeof n === 'bigint' ? Number(n) : Number(n);
  if (style === 'raw') return String(typeof n === 'bigint' ? n : num);
  if (style === 'locale') return formatNumber(n);

  // SI compact formats
  if (num === 0) return '0';
  let tier = Math.floor(Math.log10(Math.abs(num)) / 3);
  if (tier < 0) tier = 0;
  if (tier >= SI_SUFFIXES.length) tier = SI_SUFFIXES.length - 1;
  if (tier === 0) return String(num);
  const scaled = num / Math.pow(10, tier * 3);
  // Enormous IPv6 prefix counts (e.g. /7 = 2^121 addresses) exceed the 'E' (10^18)
  // suffix range. When scaled is still >= 1000 after applying the max SI tier,
  // the result would be a nonsensical string like "2658455991569832000E".
  // Fall back to locale-formatted number for clarity.
  if (scaled >= 1000) return formatNumber(n);
  const suffix = SI_SUFFIXES[tier];
  if (style === 'si') return Math.round(scaled) + suffix;
  // si1: one decimal, but drop trailing .0
  const fixed = scaled.toFixed(1);
  return (fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed) + suffix;
}

// Compute display text for columns that only depend on subnet data and
// format settings. Returns null for columns needing custom markup
// (subnet, name, desc, notes) so callers handle those independently.
export function formatCellValue(key, subnet, rangeDisplay, numberDisplay) {
  const rd = rangeDisplay || {};
  const nd = numberDisplay || {};
  const dflt = { style: 'short', sep: ' to ' };
  switch (key) {
    case 'netmask': return subnet.mask.toString();
    case 'wildcard': return subnet.wildcard.toString();
    case 'range': {
      const { style, sep } = rd.range || dflt;
      return formatRange(subnet.network.toString(), subnet.broadcast.toString(), style, sep);
    }
    case 'usable': {
      const { style, sep } = rd.usable || dflt;
      return formatRange(subnet.firstHost.toString(), subnet.lastHost.toString(), style, sep);
    }
    case 'ips': return formatNumberStyled(subnet.totalHosts, nd.ips || 'locale');
    case 'hosts': return formatNumberStyled(subnet.usableHosts, nd.hosts || 'locale');
    default: return null;
  }
}

// --- Name Rendering ---
// Builds the HTML for the Name column cell. In manual mode, only the
// leaf's own label is shown (flat, user-typed). In automatic mode, the
// full hierarchical path is rendered with clickable segments and separators.

function renderNameCell(leaf, nameDisplay) {
  const isManual = !nameDisplay || nameDisplay.mode !== 'automatic';

  if (isManual) {
    // Manual mode: show only the leaf's own label, no hierarchy.
    const label = leaf.label ?? '';
    if (!label) {
      return `<span class="name-segment name-placeholder" data-node-id="${leaf.id}">name</span>`;
    }
    return `<span class="name-segment" data-node-id="${leaf.id}">${escapeHtml(label)}</span>`;
  }

  // Automatic mode: full hierarchical path with separators.
  const path = getNamePath(leaf);
  const hasAnyLabel = path.some(p => p.label !== '');

  if (!hasAnyLabel) {
    return `<span class="name-segment name-placeholder" data-node-id="${leaf.id}">name</span>`;
  }

  const nonEmpty = path.filter(p => p.label !== '');
  return nonEmpty.map((p, i) => {
    const isLast = i === nonEmpty.length - 1;
    const cls = isLast ? 'name-segment name-leaf' : 'name-segment name-prefix';
    const escaped = escapeHtml(p.label);
    let sep = '';
    if (!isLast) {
      // The separator belongs to the NEXT segment (child), not the current one,
      // so clicking it edits the child's separator property.
      const rawSep = nonEmpty[i + 1].separator;
      const display = rawSep === ' ' ? '&nbsp;' : escapeHtml(rawSep);
      sep = `<span class="name-separator" data-node-id="${nonEmpty[i + 1].id}">${display}</span>`;
    }
    return `<span class="${cls}" data-node-id="${p.id}">${escaped}</span>${sep}`;
  }).join('');
}

// --- Cell Renderers ---
// Renders a single table cell's HTML for a given column key and leaf node.
// Inline style backgrounds are set per-row so sibling pairs share colors.

export function renderCellContent(key, leaf, rowBg, ds) {
  const { rangeDisplay, numberDisplay, notesDisplay, nameDisplay } = ds;
  const s = leaf.subnet;

  // Pure format columns share logic with tree header rendering via
  // formatCellValue — only custom markup columns need individual cases.
  const value = formatCellValue(key, s, rangeDisplay, numberDisplay);
  if (value !== null) return `<td style="background:${rowBg}">${value}</td>`;

  switch (key) {
    case 'subnet': {
      const rfcTip = ds.showTooltips ? ` title="${escapeHtml(subnetTooltip(s))}"` : '';
      return `<td style="background:${rowBg}"${rfcTip}>${s.toString()}</td>`;
    }
    case 'name':
      return `<td style="background:${rowBg}" class="name-cell">${renderNameCell(leaf, nameDisplay)}</td>`;
    case 'desc': {
      const descVal = escapeHtml(leaf.description ?? '');
      const descDisplay = descVal || '<span class="desc-placeholder">description</span>';
      return `<td style="background:${rowBg}" class="desc-cell"><span class="desc-text" data-node-id="${leaf.id}">${descDisplay}</span></td>`;
    }
    case 'notes': {
      const notesVal = leaf.notes ?? '';
      const escaped = escapeHtml(notesVal);
      const display = escaped || '<span class="notes-placeholder">notes</span>';
      const nc = notesDisplay || {};
      const lineCls = nc.lines === '2' ? ' notes-2line' : nc.lines === '3' ? ' notes-3line' : nc.lines === 'all' ? '' : ' notes-1line';
      const sizeCls = nc.fontSize === 'small' ? ' notes-size-small' : nc.fontSize === 'smallest' ? ' notes-size-smallest' : '';
      return `<td style="background:${rowBg}" class="notes-cell${sizeCls}"><span class="notes-preview${lineCls}" data-node-id="${leaf.id}">${display}</span></td>`;
    }
    case 'vlan': {
      const v = leaf._vlanComputed;
      if (!v || v.value == null) return `<td style="background:${rowBg}" class="cell-vlan"></td>`;
      if (!v.valid && !v.warning) {
        if (ds.showWarnings) {
          // Yellow warning badge with tooltip showing macro expansion and error detail.
          const detail = `${v.template} \u2192 ${v.value} \u2014 ${v.error}`;
          return `<td style="background:${rowBg}" class="cell-vlan vlan-err">${warningBadge(detail)} <span class="vlan-err-label">VLAN not valid</span></td>`;
        }
        // Warnings off: show the numeric value dimmed so the cell isn't empty.
        return `<td style="background:${rowBg}" class="cell-vlan vlan-err"><span class="vlan-err-label" style="opacity:0.4">${escapeHtml(String(v.value))}</span></td>`;
      }
      const cls = v.warning ? ' vlan-warn' : '';
      return `<td style="background:${rowBg}" class="cell-vlan${cls}" title="${escapeHtml(v.error || v.template || '')}">${escapeHtml(String(v.value))}</td>`;
    }
    default:
      return '';
  }
}

// --- Table Header ---

// Two-row <thead>: a hidden-columns row (collapsed until hover) and
// the column labels row with inline reorder/hide/settings controls.
// All controls appear via CSS thead:hover — no JS hover wiring needed.
// Columns that show a 'settings' label in their header for opening format/display menus.
const HAS_SETTINGS = new Set(['range', 'usable', 'ips', 'hosts', 'notes', 'name', 'vlan']);

// One-sentence tooltips so beginners can learn networking terms in context (F-10).
const COLUMN_TOOLTIPS = { subnet: 'CIDR block: network address and prefix length (e.g. 10.0.0.0/24)', name: 'Custom label for this subnet (click to edit)', desc: 'Short description for this subnet section', notes: 'Extended notes or documentation for this subnet', vlan: 'VLAN ID assigned to this subnet (supports macro templates)', netmask: 'Subnet mask in dotted-decimal (e.g. 255.255.255.0 = /24)', wildcard: 'Inverse of netmask, used in ACLs and OSPF (e.g. 0.0.0.255 = /24)', range: 'Full address range from network to broadcast', usable: 'Usable host range (excludes network and broadcast)', ips: 'Total IP addresses in this subnet', hosts: 'Usable host addresses (total minus network and broadcast)', join: 'Split a subnet into two halves, or join siblings back together' };

export function renderTableHeader(colOrder, visibleCols, globalMaxDepth, colorConfig, showTooltips = true) {
  const visibleNonJoin = colOrder.filter(k => visibleCols.has(k) && k !== 'join');
  const hiddenCols = colOrder.filter(k => !visibleCols.has(k) && k !== 'join');
  const totalColSpan = visibleNonJoin.length + (visibleCols.has('join') ? globalMaxDepth : 0);

  // Only add title attributes when tooltips are enabled.
  const tip = (key) => showTooltips ? ` title="${COLUMN_TOOLTIPS[key] || ''}"` : '';

  let html = '<thead>';

  // Row 1: hidden columns (collapsed by default, revealed on hover)
  html += '<tr class="col-hidden-row">';
  html += `<td colspan="${totalColSpan}" class="col-hidden-cell"><div class="col-hidden-items">`;
  for (const key of hiddenCols) {
    html += `<span class="col-hidden-item col-restore-btn" data-col="${key}" title="Show column">${COL_DEF_MAP[key].label}<br>\u25BC</span>`;
  }
  html += '<span class="col-hidden-item col-reset-btn" title="Reset to default layout">Reset<br><span class="col-reset-icon">\u21BA</span></span>';
  html += '</div></td></tr>';

  // Row 2: column labels with hover controls
  html += '<tr class="col-labels-row">';
  for (const key of colOrder) {
    if (!visibleCols.has(key)) continue;

    if (key === 'join') {
      html += `<th data-col="join" colspan="${globalMaxDepth}"${tip('join')}><span style="color:#16a34a">Split</span> / <span style="color:#ef4444">Join</span></th>`;
      continue;
    }

    const isFirst = key === visibleNonJoin[0];
    const isLast = key === visibleNonJoin[visibleNonJoin.length - 1];

    html += `<th data-col="${key}"${tip(key)}>`;
    html += `<span class="col-header-group">`;
    html += `<button class="col-hide-btn" data-col="${key}" title="Hide column" aria-label="Hide ${COL_DEF_MAP[key].label} column">\u25B2</button>`;
    if (!isFirst) html += `<button class="col-arrow col-arrow-left" data-col="${key}" aria-label="Move ${COL_DEF_MAP[key].label} left">\u25C0</button>`;
    html += `<span class="col-label-text">${COL_DEF_MAP[key].label}</span>`;
    if (!isLast) html += `<button class="col-arrow col-arrow-right" data-col="${key}" aria-label="Move ${COL_DEF_MAP[key].label} right">\u25B6</button>`;
    html += '</span>';
    if (HAS_SETTINGS.has(key)) {
      html += ' <span class="col-settings-label">settings</span>';
    }
    html += '</th>';
  }
  html += '</tr>';

  html += '</thead>';
  return html;
}

// --- Forest-specific renderers ---

// Render the always-present input row at the top of the table. Styled
// identically to tree header rows (dark gray background, white text)
// so it looks like a section header with an editable subnet field.
export function renderInputRow(colOrder, visibleCols, globalMaxDepth) {
  let html = '<tr class="forest-input-row">';

  for (const key of colOrder) {
    if (!visibleCols.has(key)) continue;

    if (key === 'join') {
      for (let d = 0; d < globalMaxDepth; d++) {
        html += '<td class="tree-header-cell"></td>';
      }
      continue;
    }

    if (key === 'subnet') {
      html += '<td class="tree-header-cell"><input type="text" class="forest-input" placeholder="Add subnet..."></td>';
    } else if (key === 'name') {
      html += '<td class="tree-header-cell">'
        + '<div class="forest-input-group">'
        + '<input type="text" class="forest-input-sid" inputmode="numeric" placeholder="#">'
        + '<input type="text" class="forest-input-name" placeholder="name">'
        + '</div></td>';
    } else {
      html += '<td class="tree-header-cell"></td>';
    }
  }

  html += '</tr>';
  return html;
}

// --- Empty State ---
// Shown when no subnets exist. Displays the logo with a subtle pulse
// animation and a tagline inviting the user to start.

export function renderEmptyState() {
  return `<div class="empty-hero">
    <img src="img/logo.png" alt="slash/what" class="empty-hero-logo">
    <div class="hero-terminal">
      <div class="hero-tagline-line">
        <span class="hero-prompt">$</span>
        <span class="hero-tagline" data-line="0"></span><span class="hero-tagline-cursor"></span>
      </div>
      <div class="hero-tagline-line hero-hidden">
        <span class="hero-prompt">$</span>
        <span class="hero-tagline" data-line="1"></span><span class="hero-tagline-cursor"></span>
      </div>
      <div class="hero-tagline-line hero-hidden">
        <span class="hero-prompt">$</span>
        <span class="hero-tagline" data-line="2"></span><span class="hero-tagline-cursor"></span>
      </div>
      <div class="hero-input-wrapper hero-hidden">
        <input type="text" class="hero-input" placeholder="Add subnet...">
        <span class="hero-cursor"></span>
      </div>
    </div>
  </div>`;
}
