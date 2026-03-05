/*\! © 2026 slashwhat. MIT License. */
// subnet.js — Central Subnet class for IPv4 and IPv6 CIDR calculations.
// This is the primary domain object: it takes a network address + prefix and
// provides all derived properties (broadcast, host range, mask, host counts).
// Dual-stack: the same class handles both IPv4 (32-bit numbers) and IPv6
// (128-bit BigInts), branching on the #isV4 flag.

import { IPv4Address } from './ipv4.js';
import { IPv6Address } from './ipv6.js';
import {
  prefixToMask4, prefixToMask6, applyMask, invertMask,
  MAX_IPV4, MAX_IPV6,
} from './bitmask.js';
import { RFC_RANGES, CLASS_RANGES } from './constants.js';

export class Subnet {
  #address;    // IPv4Address or IPv6Address (always the network address)
  #prefix;     // CIDR prefix length (0–32 for v4, 0–128 for v6)
  #isV4;       // true for IPv4, false for IPv6

  // Constructor always normalizes the input address to the network address
  // by applying the mask. This means Subnet("192.168.1.55", 24) stores
  // 192.168.1.0 — the caller doesn't need to pre-compute the network.
  constructor(addressStr, prefixLen) {
    this.#prefix = Number(prefixLen);
    const trimmed = typeof addressStr === 'string' ? addressStr.trim() : addressStr;

    // Detect IPv6 by the presence of a colon — IPv4 never contains colons.
    if (typeof trimmed === 'string' && trimmed.includes(':')) {
      this.#isV4 = false;
      if (this.#prefix < 0 || this.#prefix > 128) throw new RangeError(`Invalid IPv6 prefix: ${this.#prefix}`);
      const addr = new IPv6Address(trimmed);
      const mask = prefixToMask6(this.#prefix);
      const networkVal = applyMask(addr.toBigInt(), mask);
      this.#address = new IPv6Address(networkVal);
    } else {
      this.#isV4 = true;
      if (this.#prefix < 0 || this.#prefix > 32) throw new RangeError(`Invalid IPv4 prefix: ${this.#prefix}`);
      const addr = new IPv4Address(trimmed);
      const mask = prefixToMask4(this.#prefix);
      const networkVal = applyMask(addr.toNumber(), mask);
      this.#address = new IPv4Address(networkVal);
    }
  }

  // Parse CIDR notation string: "192.168.1.0/24" or "2001:db8::/32".
  // Bare addresses without a slash default to host prefix (/32 or /128).
  static parse(cidr) {
    const str = cidr.trim();
    const slashIdx = str.lastIndexOf('/');
    if (slashIdx === -1) {
      if (str.includes(':')) return new Subnet(str, 128);
      return new Subnet(str, 32);
    }
    const addrPart = str.substring(0, slashIdx);
    const prefixPart = str.substring(slashIdx + 1);
    const prefix = parseInt(prefixPart, 10);
    if (isNaN(prefix)) throw new SyntaxError(`Invalid prefix: ${prefixPart}`);
    return new Subnet(addrPart, prefix);
  }

  // Compute the minimal covering CIDR from a first and last address.
  // XOR reveals the differing bits; the prefix is everything before them.
  static fromRange(firstStr, lastStr) {
    const isV6 = firstStr.includes(':');
    if (isV6) {
      const first = new IPv6Address(firstStr).toBigInt();
      const last = new IPv6Address(lastStr).toBigInt();
      const xor = first ^ last;
      let prefix = 128;
      let bit = 1n;
      for (let i = 0; i < 128; i++) {
        if (xor & bit) prefix = 127 - i;
        bit <<= 1n;
      }
      return new Subnet(new IPv6Address(first & prefixToMask6(prefix)).toString(), prefix);
    }
    const first = new IPv4Address(firstStr).toNumber();
    const last = new IPv4Address(lastStr).toNumber();
    const xor = (first ^ last) >>> 0;
    let prefix = 32;
    if (xor > 0) {
      prefix = 32 - Math.floor(Math.log2(xor)) - 1;
    }
    const mask = prefixToMask4(prefix);
    return new Subnet(new IPv4Address(applyMask(first, mask)).toString(), prefix);
  }

  // --- Getters ---
  // Each getter computes its value on demand from the stored address and prefix.
  // This avoids stale cached values and keeps the object immutable.

  // Expose the stored network address (getter because backing store is private).
  get network() {
    return this.#address;
  }

  // Broadcast = network OR wildcard. For IPv4, this is the last address
  // in the range; for IPv6, it's the all-nodes address equivalent.
  get broadcast() {
    if (this.#isV4) {
      const wild = invertMask(prefixToMask4(this.#prefix));
      return new IPv4Address((this.#address.toNumber() | wild) >>> 0);
    }
    const wild = invertMask(prefixToMask6(this.#prefix));
    return new IPv6Address(this.#address.toBigInt() | wild);
  }

  // First usable host: network + 1, except /31 and /32 point-to-point
  // links where every address is usable (RFC 3021).
  get firstHost() {
    if (this.#isV4) {
      if (this.#prefix >= 31) return this.#address;
      return new IPv4Address((this.#address.toNumber() + 1) >>> 0);
    }
    if (this.#prefix === 128) return this.#address;
    return new IPv6Address(this.#address.toBigInt() + 1n);
  }

  // Last usable host: broadcast - 1, with the same /31 and /32 exceptions.
  get lastHost() {
    if (this.#isV4) {
      if (this.#prefix === 32) return this.#address;
      if (this.#prefix === 31) return this.broadcast;
      return new IPv4Address((this.broadcast.toNumber() - 1) >>> 0);
    }
    if (this.#prefix === 128) return this.#address;
    return this.broadcast;
  }

  // Subnet mask for display and ACL configuration.
  get mask() {
    if (this.#isV4) return new IPv4Address(prefixToMask4(this.#prefix));
    return new IPv6Address(prefixToMask6(this.#prefix));
  }

  // Inverse mask (wildcard) — used in Cisco ACL notation and broadcast derivation.
  get wildcard() {
    if (this.#isV4) return new IPv4Address(invertMask(prefixToMask4(this.#prefix)));
    return new IPv6Address(invertMask(prefixToMask6(this.#prefix)));
  }

  // Read-only accessor for the CIDR prefix length.
  get prefix() {
    return this.#prefix;
  }

  // Total addresses in the range (including network and broadcast).
  // IPv6 uses BigInt because 2^128 overflows Number.
  get totalHosts() {
    if (this.#isV4) return Math.pow(2, 32 - this.#prefix);
    return 2n ** BigInt(128 - this.#prefix);
  }

  // Usable hosts: total minus network and broadcast addresses.
  // /32 = 1 host, /31 = 2 hosts (point-to-point, no broadcast overhead).
  get usableHosts() {
    if (this.#isV4) {
      const total = this.totalHosts;
      if (this.#prefix === 32) return 1;
      if (this.#prefix === 31) return 2;
      return total - 2;
    }
    return this.totalHosts;
  }

  // Protocol family flags so callers can branch without inspecting the address type.
  get isIPv4() { return this.#isV4; }
  get isIPv6() { return !this.#isV4; }

  // --- Methods ---

  // Check if a single address falls within this subnet.
  contains(address) {
    if (this.#isV4) {
      const addr = (address instanceof IPv4Address) ? address : new IPv4Address(address);
      const mask = prefixToMask4(this.#prefix);
      return applyMask(addr.toNumber(), mask) === this.#address.toNumber();
    }
    const addr = (address instanceof IPv6Address) ? address : new IPv6Address(address);
    const mask = prefixToMask6(this.#prefix);
    return applyMask(addr.toBigInt(), mask) === this.#address.toBigInt();
  }

  // Check if another subnet is entirely contained within this one.
  containsSubnet(other) {
    if (this.#isV4 !== other.isIPv4) return false;
    if (other.prefix < this.#prefix) return false;
    if (this.#isV4) {
      return this.contains(other.network) && this.contains(other.broadcast);
    }
    return this.contains(other.network) && this.contains(other.broadcast);
  }

  // Check if two subnets share any addresses.
  overlaps(other) {
    if (this.#isV4 !== other.isIPv4) return false;
    return this.contains(other.network) || this.contains(other.broadcast) ||
           other.contains(this.network) || other.contains(this.broadcast);
  }

  // Split this subnet into 2^(newPrefix - prefix) equal subnets at newPrefix.
  // Used by the splitter tree to divide a node into two halves (prefix + 1).
  split(newPrefix) {
    if (newPrefix <= this.#prefix) {
      throw new RangeError('New prefix must be larger than current prefix');
    }
    const maxPrefix = this.#isV4 ? 32 : 128;
    if (newPrefix > maxPrefix) throw new RangeError(`Prefix cannot exceed ${maxPrefix}`);

    const results = [];
    const count = Math.pow(2, newPrefix - this.#prefix);

    if (this.#isV4) {
      const step = Math.pow(2, 32 - newPrefix);
      let current = this.#address.toNumber();
      for (let i = 0; i < count; i++) {
        results.push(new Subnet(new IPv4Address(current).toString(), newPrefix));
        current = (current + step) >>> 0;
      }
    } else {
      const step = 1n << BigInt(128 - newPrefix);
      let current = this.#address.toBigInt();
      for (let i = 0; i < count; i++) {
        results.push(new Subnet(new IPv6Address(current).toString(), newPrefix));
        current += step;
      }
    }
    return results;
  }

  // CIDR notation for display and serialization.
  toString() {
    return `${this.#address.toString()}/${this.#prefix}`;
  }

  // Full subnet details for config serialization and JSON export.
  toJSON() {
    return {
      cidr: this.toString(),
      network: this.network.toString(),
      broadcast: this.broadcast.toString(),
      firstHost: this.firstHost.toString(),
      lastHost: this.lastHost.toString(),
      mask: this.mask.toString(),
      wildcard: this.wildcard.toString(),
      prefix: this.#prefix,
      totalHosts: this.#isV4 ? this.totalHosts : this.totalHosts.toString(),
      usableHosts: this.#isV4 ? this.usableHosts : this.usableHosts.toString(),
      isIPv4: this.#isV4,
      isIPv6: !this.#isV4,
    };
  }

  // Match this subnet against known RFC special-use ranges (RFC 1918,
  // RFC 5737, etc.) to help users identify private, documentation, and
  // reserved address space.
  getRFCInfo() {
    const matches = [];
    for (const rfc of RFC_RANGES) {
      try {
        const rfcSubnet = Subnet.parse(rfc.cidr);
        if (rfcSubnet.isIPv4 === this.#isV4 && rfcSubnet.containsSubnet(this)) {
          matches.push(rfc);
        }
      } catch { /* skip unparseable entries */ }
    }
    return matches;
  }

  // Identify the legacy classful network class (A/B/C/D/E) for IPv4.
  // Returns null for IPv6 since classful addressing is IPv4-only.
  getClassInfo() {
    if (!this.#isV4) return null;
    const num = this.#address.toNumber();
    for (const cls of CLASS_RANGES) {
      if (num >= cls.start && num <= cls.end) {
        return {
          class: cls.class,
          range: cls.range,
          defaultPrefix: cls.defaultPrefix,
          isClassful: this.#prefix === cls.defaultPrefix,
        };
      }
    }
    return null;
  }

  // Generate binary visualization data: split the binary representation
  // into network bits and host bits at the prefix boundary.
  getBinaryVisualization() {
    const binaryStr = this.#address.toBinary();
    // IPv4 binary has dots between octets — strip them for bit splitting.
    const bin = this.#isV4 ? binaryStr.replace(/\./g, '') : binaryStr;
    return {
      networkBits: bin.substring(0, this.#prefix),
      hostBits: bin.substring(this.#prefix),
      binaryStr,
      prefix: this.#prefix,
    };
  }
}
