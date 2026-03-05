/*\! © 2026 slashwhat. MIT License. */
// ipv6.js — IPv6 address representation.
// Stores the address as a 128-bit BigInt internally. BigInt is the only
// native JS type that can hold a full IPv6 address without precision loss.
// Handles parsing of all standard notations: full, compressed (::), and
// mixed IPv4-mapped (::ffff:1.2.3.4).

import { MAX_IPV6 } from './bitmask.js';

export class IPv6Address {
  #value;

  // Accepts either an IPv6 string or a raw 128-bit BigInt.
  // The BigInt path is used internally by Subnet for arithmetic results.
  constructor(input) {
    if (typeof input === 'bigint') {
      if (input < 0n || input > MAX_IPV6) {
        throw new RangeError('IPv6 value out of range');
      }
      this.#value = input;
    } else if (typeof input === 'string') {
      this.#value = IPv6Address.#parseStr(input);
    } else {
      throw new TypeError('IPv6Address requires a string or BigInt');
    }
  }

  // Handles all standard IPv6 notations: mixed v4-mapped, :: shorthand, and full 8-group. Multi-step avoids a single complex regex.
  static #parseStr(str) {
    const trimmed = str.trim();

    // Handle mixed IPv4-mapped notation by converting the trailing dotted
    // decimal into two hex groups, then recursing to parse the pure hex form.
    const mixedMatch = trimmed.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mixedMatch) {
      const v4Part = mixedMatch[2];
      const octets = v4Part.split('.').map(Number);
      if (octets.length !== 4 || octets.some(o => o < 0 || o > 255 || isNaN(o))) {
        throw new SyntaxError(`Invalid mixed IPv6 address: ${str}`);
      }
      const hex1 = ((octets[0] << 8) | octets[1]).toString(16);
      const hex2 = ((octets[2] << 8) | octets[3]).toString(16);
      const prefix = mixedMatch[1];
      return IPv6Address.#parseStr(`${prefix}${hex1}:${hex2}`);
    }

    // Expand :: by splitting on it and filling in the missing zero groups
    // to bring the total to exactly 8 groups.
    let fullStr = trimmed;
    if (fullStr.includes('::')) {
      const parts = fullStr.split('::');
      if (parts.length > 2) throw new SyntaxError(`Invalid IPv6: multiple :: in ${str}`);
      const left = parts[0] ? parts[0].split(':') : [];
      const right = parts[1] ? parts[1].split(':') : [];
      const missing = 8 - left.length - right.length;
      if (missing < 0) throw new SyntaxError(`Invalid IPv6 address: ${str}`);
      const middle = Array(missing).fill('0');
      fullStr = [...left, ...middle, ...right].join(':');
    }

    const groups = fullStr.split(':');
    if (groups.length !== 8) {
      throw new SyntaxError(`Invalid IPv6 address (expected 8 groups): ${str}`);
    }

    let result = 0n;
    for (let i = 0; i < 8; i++) {
      const g = groups[i];
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) {
        throw new SyntaxError(`Invalid IPv6 group: "${g}"`);
      }
      result = (result << 16n) | BigInt(parseInt(g, 16));
    }
    return result;
  }

  // Static factory matching IPv4Address.parse() for consistent API.
  static parse(str) {
    return new IPv6Address(str);
  }

  // Non-throwing validation for input parsing where invalid addresses are expected.
  static isValid(str) {
    try {
      IPv6Address.#parseStr(str);
      return true;
    } catch {
      return false;
    }
  }

  // Convenience: parse a string and return the fully expanded form.
  static expand(str) {
    const addr = new IPv6Address(str);
    return addr.toFullString();
  }

  // Convenience: parse a string and return the shortest compressed form.
  static compress(str) {
    const addr = new IPv6Address(str);
    return addr.toString();
  }

  // Raw 128-bit value for bitmask operations, analogous to IPv4Address.toNumber().
  toBigInt() {
    return this.#value;
  }

  // Array of 8 group values (0–65535) — used by toString for formatting.
  toGroups() {
    const groups = [];
    let val = this.#value;
    for (let i = 7; i >= 0; i--) {
      groups[i] = Number(val & 0xFFFFn);
      val >>= 16n;
    }
    return groups;
  }

  // RFC 5952 compressed form: find the longest run of consecutive all-zero
  // groups and replace it with ::. Only collapses if the run is 2+ groups.
  toString() {
    const groups = this.toGroups().map(g => g.toString(16));

    let bestStart = -1;
    let bestLen = 0;
    let curStart = -1;
    let curLen = 0;

    for (let i = 0; i < 8; i++) {
      if (groups[i] === '0') {
        if (curStart === -1) curStart = i;
        curLen++;
        if (curLen > bestLen) {
          bestStart = curStart;
          bestLen = curLen;
        }
      } else {
        curStart = -1;
        curLen = 0;
      }
    }

    if (bestLen < 2) return groups.join(':');

    const left = groups.slice(0, bestStart).join(':');
    const right = groups.slice(bestStart + bestLen).join(':');
    return `${left}::${right}`;
  }

  // Fully expanded zero-padded form — useful for alignment and display.
  toFullString() {
    return this.toGroups()
      .map(g => g.toString(16).padStart(4, '0'))
      .join(':');
  }

  // 128-bit binary string — used for binary visualization.
  toBinary() {
    return this.#value.toString(2).padStart(128, '0');
  }

  // Value equality (same 128-bit address) for subnet containment checks.
  equals(other) {
    if (!(other instanceof IPv6Address)) return false;
    return this.#value === other.#value;
  }

  // Numeric ordering for sorting. Returns -1/0/1 following Java Comparable convention.
  compareTo(other) {
    if (!(other instanceof IPv6Address)) throw new TypeError('Cannot compare to non-IPv6Address');
    if (this.#value < other.#value) return -1;
    if (this.#value > other.#value) return 1;
    return 0;
  }

  // Detect IPv4-mapped addresses (::ffff:x.x.x.x). The top 80 bits are
  // all zero, and bits 80–95 are all ones (0xFFFF).
  isV4Mapped() {
    return (this.#value >> 32n) === 0xFFFFn;
  }

  // Extract the IPv4 portion from a v4-mapped address as a dotted-decimal
  // string. Returns null if this isn't a v4-mapped address. Avoids importing
  // IPv4Address to prevent circular dependencies.
  toV4() {
    if (!this.isV4Mapped()) return null;
    const v4Num = Number(this.#value & 0xFFFFFFFFn);
    const o1 = (v4Num >>> 24) & 0xFF;
    const o2 = (v4Num >>> 16) & 0xFF;
    const o3 = (v4Num >>> 8) & 0xFF;
    const o4 = v4Num & 0xFF;
    return `${o1}.${o2}.${o3}.${o4}`;
  }
}
