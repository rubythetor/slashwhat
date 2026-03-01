/*\! © 2026 slashwhat. MIT License. */
// warning-badges.js — Shared HTML generators for warning indicators.
// Pure string builders — no state, no DOM manipulation. Used by tree-rows.js
// and table-render.js to render yellow warning triangles with descriptive
// tooltips for overlaps, VLAN errors, and RFC classification.

import { checkOverlap } from '../core/forest.js';

// Local escape to avoid circular import with table-render.js.
function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Yellow warning triangle SVG with optional tooltip. Same icon used for
// overlap indicators and VLAN out-of-range warnings so the visual
// language is consistent across all warning types.
export function warningBadge(tooltip) {
  const title = tooltip ? ` title="${esc(tooltip)}"` : '';
  return `<span class="warning-badge"${title}>`
    + '<svg viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M12 1L1 21h22L12 1z" fill="#FACC15" stroke="#EF4444" stroke-width="2" stroke-linejoin="round"/>'
    + '<text x="12" y="18" text-anchor="middle" font-size="14" font-weight="900" fill="#111">!</text>'
    + '</svg></span>';
}

// Build descriptive overlap tooltip for a tree entry by comparing it
// against all other entries. Describes each relationship so users know
// exactly which subnets conflict and how.
export function overlapTooltip(entry, entries) {
  const subnet = entry.tree.subnet;
  const others = entries.filter(e => e.id !== entry.id);
  const { conflicts } = checkOverlap(subnet, others);
  if (conflicts.length === 0) return 'Overlapping address space';
  return conflicts.map(({ entry: e, relationship }) => {
    const other = e.tree.subnet.toString();
    if (relationship === 'contains') return `Contains ${other}`;
    if (relationship === 'contained-by') return `Contained by ${other}`;
    return `Overlaps ${other}`;
  }).join('\n');
}

// Build RFC classification tooltip for a subnet. Shows the IANA
// special-use designation (e.g. "Private-Use (Class A) — RFC1918")
// or "Public" when no RFC range matches.
export function subnetTooltip(subnet) {
  const rfcs = subnet.getRFCInfo();
  if (rfcs.length === 0) {
    const cls = subnet.getClassInfo();
    return cls ? `Public (Class ${cls.class})` : 'Public';
  }
  return rfcs.map(r => `${r.description} \u2014 ${r.name}`).join('\n');
}
