/*\! © 2026 slashwhat. MIT License. */
// parse.js — Network input parsing and display formatting utilities.
// Handles the various formats users might type into the subnet input field
// and provides display helpers for the table.

// Convert a dotted-decimal subnet mask to a CIDR prefix length.
// e.g. "255.255.255.0" → 24.
// Validates that the mask is contiguous (all 1s followed by all 0s) —
// rejects non-contiguous masks like "255.0.255.0" which aren't valid CIDR.
export function maskToPrefix(mask) {
  const parts = mask.split('.');
  if (parts.length !== 4) throw new Error(`Invalid mask: ${mask}`);
  let bits = 0;
  let seenZero = false;
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (isNaN(n) || n < 0 || n > 255) throw new Error(`Invalid mask octet: ${p}`);
    for (let i = 7; i >= 0; i--) {
      if ((n >> i) & 1) {
        if (seenZero) throw new Error(`Invalid mask: ${mask}`);
        bits++;
      } else {
        seenZero = true;
      }
    }
  }
  return bits;
}

// Parse flexible user input into { addr, prefix }.
// Accepts multiple formats so users don't need to remember exact syntax:
//   - CIDR:  "192.168.0.0/24"
//   - Mask after slash: "192.168.0.0/255.255.255.0"
//   - Space-separated: "192.168.0.0 255.255.255.0"
//   - Bare address: "192.168.0.0" (defaults to /32 host route)
export function parseSubnetInput(raw) {
  const s = raw.trim();
  if (!s) throw new Error('Enter a network address');

  if (s.includes('/')) {
    const [addr, rest] = s.split('/', 2);
    // Detect dotted-decimal mask after the slash (e.g. /255.255.255.0)
    if (rest.includes('.')) {
      return { addr: addr.trim(), prefix: maskToPrefix(rest.trim()) };
    }
    const prefix = parseInt(rest, 10);
    if (isNaN(prefix)) throw new Error(`Invalid prefix: ${rest}`);
    // Reject leading zeros (e.g. /00, /08) — they are malformed CIDR notation.
    if (rest.length > 1 && rest[0] === '0') throw new Error(`Invalid prefix: ${rest}`);
    return { addr: addr.trim(), prefix };
  }

  // Space-separated format: "10.0.0.0 255.0.0.0"
  // Only applies to IPv4 — dotted-decimal masks don't exist for IPv6.
  const spaceIdx = s.indexOf(' ');
  if (spaceIdx !== -1) {
    const addr = s.substring(0, spaceIdx).trim();
    const rest = s.substring(spaceIdx).trim();
    // IPv6 addresses contain colons; treat the rest as a plain prefix number.
    if (addr.includes(':')) {
      const prefix = parseInt(rest, 10);
      if (isNaN(prefix)) throw new Error(`Invalid prefix: ${rest}`);
      return { addr, prefix };
    }
    return { addr, prefix: maskToPrefix(rest) };
  }

  // Bare address without prefix — default to host route (/128 for IPv6, /32 for IPv4).
  if (s.includes(':')) return { addr: s, prefix: 128 };
  return { addr: s, prefix: 32 };
}

// Shorten an address range for compact display by replacing shared leading
// octets with "x". e.g. "192.168.0.0 to 192.168.0.255" → "x.x.0 to x.x.255".
// Only applies to IPv4 (4 octets); falls back to full display for IPv6.
// The sep parameter controls the delimiter between start and end addresses.
function shortenRange(startStr, endStr, sep = ' to ') {
  const a = startStr.split('.');
  const b = endStr.split('.');
  if (a.length !== 4 || b.length !== 4) return `${startStr}${sep}${endStr}`;
  // Count shared leading octets (up to 3 — always show at least the last octet)
  let common = 0;
  while (common < 3 && a[common] === b[common]) common++;
  if (common === 0) return `${startStr}${sep}${endStr}`;
  const prefix = Array(common).fill('x').join('.');
  const aTail = a.slice(common).join('.');
  const bTail = b.slice(common).join('.');
  return `${prefix}.${aTail}${sep}${prefix}.${bTail}`;
}

// Format an address range in one of five display styles with a configurable
// separator between start and end addresses.
// Styles control which octets are shown:
//   short:   "x.x.0.0 to x.x.15.255"   — each shared octet = x (default)
//   shorter: "x.0.0 to x.15.255"        — all shared octets collapsed to one x
//   full:    "192.168.0.0 to 192.168.15.255" — complete addresses
//   tail:    "0.0 to 15.255"            — only the differing octets
//   dots:    "..0.0 to ..15.255"        — dots replace shared octets
export function formatRange(startStr, endStr, style = 'short', sep = ' to ') {
  if (style === 'full') return `${startStr}${sep}${endStr}`;
  if (style === 'short') return shortenRange(startStr, endStr, sep);

  const a = startStr.split('.');
  const b = endStr.split('.');
  if (a.length !== 4 || b.length !== 4) return `${startStr}${sep}${endStr}`;

  let common = 0;
  while (common < 3 && a[common] === b[common]) common++;
  if (common === 0) return `${startStr}${sep}${endStr}`;

  const aTail = a.slice(common).join('.');
  const bTail = b.slice(common).join('.');

  if (style === 'tail') return `${aTail}${sep}${bTail}`;
  if (style === 'dots') return `..${aTail}${sep}..${bTail}`;
  // shorter: single x replaces all shared leading octets
  return `x.${aTail}${sep}x.${bTail}`;
}
