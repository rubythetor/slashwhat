/*\! © 2026 slashwhat. MIT License. */
// constants.js — Network reference data: RFC ranges, private ranges, well-known prefixes.
// This is pure static data with no logic. Consumed by Subnet.getRFCInfo() and
// Subnet.getClassInfo() to annotate subnets with standards compliance info.

// IANA special-use address registries. Each entry identifies an RFC and
// the CIDR block it reserves. Used to tell users "this is a private range"
// or "this is documentation space" etc.
export const RFC_RANGES = [
  { name: 'RFC1918', cidr: '10.0.0.0/8', description: 'Private-Use (Class A)' },
  { name: 'RFC1918', cidr: '172.16.0.0/12', description: 'Private-Use (Class B)' },
  { name: 'RFC1918', cidr: '192.168.0.0/16', description: 'Private-Use (Class C)' },
  { name: 'RFC6598', cidr: '100.64.0.0/10', description: 'Shared Address Space (CGN/CGNAT)' },
  { name: 'RFC5737', cidr: '192.0.2.0/24', description: 'Documentation (TEST-NET-1)' },
  { name: 'RFC5737', cidr: '198.51.100.0/24', description: 'Documentation (TEST-NET-2)' },
  { name: 'RFC5737', cidr: '203.0.113.0/24', description: 'Documentation (TEST-NET-3)' },
  { name: 'RFC1122', cidr: '127.0.0.0/8', description: 'Loopback' },
  { name: 'RFC3927', cidr: '169.254.0.0/16', description: 'Link-Local' },
  { name: 'RFC5771', cidr: '224.0.0.0/4', description: 'Multicast' },
  { name: 'RFC919', cidr: '255.255.255.255/32', description: 'Limited Broadcast' },
  { name: 'RFC1122', cidr: '0.0.0.0/8', description: 'This Host on This Network' },
  { name: 'RFC6890', cidr: '192.0.0.0/24', description: 'IETF Protocol Assignments' },
  { name: 'RFC2544', cidr: '198.18.0.0/15', description: 'Benchmarking' },
  { name: 'RFC6676', cidr: '192.88.99.0/24', description: '6to4 Relay Anycast (Deprecated)' },
  // IPv6
  { name: 'RFC4193', cidr: 'fc00::/7', description: 'Unique Local Address (ULA)' },
  { name: 'RFC4291', cidr: 'fe80::/10', description: 'Link-Local Unicast' },
  { name: 'RFC4291', cidr: '::1/128', description: 'Loopback' },
  { name: 'RFC4291', cidr: '::/128', description: 'Unspecified Address' },
  { name: 'RFC4291', cidr: 'ff00::/8', description: 'Multicast' },
  { name: 'RFC3849', cidr: '2001:db8::/32', description: 'Documentation' },
  { name: 'RFC4380', cidr: '2001::/32', description: 'Teredo Tunneling' },
  { name: 'RFC6052', cidr: '64:ff9b::/96', description: 'NAT64 Well-Known Prefix' },
  { name: 'RFC6145', cidr: '::ffff:0:0/96', description: 'IPv4-Mapped IPv6' },
  { name: 'RFC2002', cidr: '2002::/16', description: '6to4 Addressing' },
];

// Quick-lookup ranges for private address detection.
// Start/end stored as raw 32-bit integers for fast numeric comparison.
export const PRIVATE_RANGES_V4 = [
  { cidr: '10.0.0.0/8', start: 0x0A000000, end: 0x0AFFFFFF },
  { cidr: '172.16.0.0/12', start: 0xAC100000, end: 0xAC1FFFFF },
  { cidr: '192.168.0.0/16', start: 0xC0A80000, end: 0xC0A8FFFF },
];

export const PRIVATE_RANGES_V6 = [
  { cidr: 'fc00::/7', description: 'Unique Local Address' },
  { cidr: 'fe80::/10', description: 'Link-Local' },
  { cidr: '::1/128', description: 'Loopback' },
];

// Legacy classful prefix reference. Used by the subnet cheatsheet and
// host-count displays. v4Hosts is usable hosts (total - 2) except for
// /31 (point-to-point) and /32 (host route).
export const WELL_KNOWN_PREFIXES = [
  { prefix: 8, name: '/8 (Class A)', v4Hosts: 16777214 },
  { prefix: 9, name: '/9', v4Hosts: 8388606 },
  { prefix: 10, name: '/10', v4Hosts: 4194302 },
  { prefix: 11, name: '/11', v4Hosts: 2097150 },
  { prefix: 12, name: '/12', v4Hosts: 1048574 },
  { prefix: 16, name: '/16 (Class B)', v4Hosts: 65534 },
  { prefix: 17, name: '/17', v4Hosts: 32766 },
  { prefix: 18, name: '/18', v4Hosts: 16382 },
  { prefix: 19, name: '/19', v4Hosts: 8190 },
  { prefix: 20, name: '/20', v4Hosts: 4094 },
  { prefix: 21, name: '/21', v4Hosts: 2046 },
  { prefix: 22, name: '/22', v4Hosts: 1022 },
  { prefix: 23, name: '/23', v4Hosts: 510 },
  { prefix: 24, name: '/24 (Class C)', v4Hosts: 254 },
  { prefix: 25, name: '/25', v4Hosts: 126 },
  { prefix: 26, name: '/26', v4Hosts: 62 },
  { prefix: 27, name: '/27', v4Hosts: 30 },
  { prefix: 28, name: '/28', v4Hosts: 14 },
  { prefix: 29, name: '/29', v4Hosts: 6 },
  { prefix: 30, name: '/30', v4Hosts: 2 },
  { prefix: 31, name: '/31 (Point-to-Point)', v4Hosts: 2 },
  { prefix: 32, name: '/32 (Host)', v4Hosts: 1 },
];

// IPv4 classful ranges. Leading bits determine the class:
// Class A: 0xxx (0–127), Class B: 10xx (128–191), etc.
// Start/end as raw 32-bit integers for fast range checks.
export const CLASS_RANGES = [
  { class: 'A', range: '0.0.0.0 - 127.255.255.255', leading: '0', defaultPrefix: 8, start: 0x00000000, end: 0x7FFFFFFF },
  { class: 'B', range: '128.0.0.0 - 191.255.255.255', leading: '10', defaultPrefix: 16, start: 0x80000000, end: 0xBFFFFFFF },
  { class: 'C', range: '192.0.0.0 - 223.255.255.255', leading: '110', defaultPrefix: 24, start: 0xC0000000, end: 0xDFFFFFFF },
  { class: 'D', range: '224.0.0.0 - 239.255.255.255', leading: '1110', defaultPrefix: null, start: 0xE0000000, end: 0xEFFFFFFF },
  { class: 'E', range: '240.0.0.0 - 255.255.255.255', leading: '1111', defaultPrefix: null, start: 0xF0000000, end: 0xFFFFFFFF },
];
