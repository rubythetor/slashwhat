/*\! © 2026 slashwhat. MIT License. */
// table-render-constants.js — Shared table metadata for rendering.
// Keeps structural column definitions and tooltip copy separate from
// HTML-building logic so render functions stay focused and smaller.

// Defines all available table columns. Users can toggle visibility and
// reorder columns via the toggle bar. 'defaultOn' controls initial state.
export const COLUMN_DEFS = [
  { key: 'subnet', label: 'Subnet', defaultOn: true },
  { key: 'name', label: 'Name', defaultOn: true },
  { key: 'desc', label: 'Description', defaultOn: false },
  { key: 'notes', label: 'Notes', defaultOn: false },
  { key: 'vlan', label: 'VLAN', defaultOn: false },
  { key: 'netmask', label: 'Mask', defaultOn: false },
  { key: 'wildcard', label: 'Wildcard', defaultOn: false },
  { key: 'range', label: 'Range', defaultOn: true },
  { key: 'usable', label: 'Usable', defaultOn: false },
  { key: 'ips', label: 'IPs', defaultOn: true },
  { key: 'hosts', label: 'Hosts', defaultOn: false },
  { key: 'join', label: 'Split/Join', defaultOn: true },
];

// Key-to-definition lookup so renderers can resolve labels in O(1).
export const COL_DEF_MAP = Object.fromEntries(COLUMN_DEFS.map(c => [c.key, c]));

// Columns that expose popup settings menus in the header row.
export const HAS_SETTINGS = new Set(['range', 'usable', 'ips', 'hosts', 'notes', 'name', 'vlan']);

// One-sentence tooltips so networking terms are learnable in context.
export const COLUMN_TOOLTIPS = {
  subnet: 'CIDR block: network address and prefix length (e.g. 10.0.0.0/24)',
  name: 'Custom label for this subnet (click to edit)',
  desc: 'Short description for this subnet section',
  notes: 'Extended notes or documentation for this subnet',
  vlan: 'VLAN ID assigned to this subnet (supports macro templates)',
  netmask: 'Subnet mask in dotted-decimal (e.g. 255.255.255.0 = /24)',
  wildcard: 'Inverse of netmask, used in ACLs and OSPF (e.g. 0.0.0.255 = /24)',
  range: 'Full address range from network to broadcast',
  usable: 'Usable host range (excludes network and broadcast)',
  ips: 'Total IP addresses in this subnet',
  hosts: 'Usable host addresses (total minus network and broadcast)',
  join: 'Split a subnet into two halves, or join siblings back together',
};
