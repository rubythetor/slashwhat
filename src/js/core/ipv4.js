/*\! © 2026 slashwhat. MIT License. */
// ipv4.js — IPv4 address representation.
// Stores the address as a single 32-bit unsigned integer internally for
// fast bitwise operations (masking, comparison, arithmetic). Parsing and
// formatting convert between this internal form and the dotted-decimal
// string that humans read.

export class IPv4Address {
  #value;

  // Accepts either a dotted-decimal string ("192.168.1.0") or a raw 32-bit
  // unsigned integer. The integer path is used internally by Subnet when
  // constructing network/broadcast addresses from arithmetic results.
  constructor(input) {
    if (typeof input === 'number') {
      if (input < 0 || input > 0xFFFFFFFF || !Number.isInteger(input)) {
        throw new RangeError(`Invalid IPv4 numeric value: ${input}`);
      }
      this.#value = input >>> 0;
    } else if (typeof input === 'string') {
      this.#value = IPv4Address.#parseStr(input);
    } else {
      throw new TypeError('IPv4Address requires a string or number');
    }
  }

  // Strict parser: rejects leading zeros (which could be confused with octal)
  // and enforces exactly 4 decimal octets in range 0–255.
  static #parseStr(str) {
    const trimmed = str.trim();
    const parts = trimmed.split('.');
    if (parts.length !== 4) throw new SyntaxError(`Invalid IPv4 address: ${str}`);

    let result = 0;
    for (let i = 0; i < 4; i++) {
      const part = parts[i];
      if (part === '' || !/^\d{1,3}$/.test(part)) {
        throw new SyntaxError(`Invalid IPv4 octet: "${part}"`);
      }
      // Reject leading zeros to avoid ambiguity with octal notation
      if (part.length > 1 && part[0] === '0') {
        throw new SyntaxError(`Leading zeros not allowed in octet: "${part}"`);
      }
      const num = Number(part);
      if (num < 0 || num > 255) {
        throw new RangeError(`Octet out of range (0-255): ${num}`);
      }
      result = ((result << 8) | num) >>> 0;
    }
    return result;
  }

  // Static factory for callers who want a clearer API than the constructor.
  static parse(str) {
    return new IPv4Address(str);
  }

  // Non-throwing validation for input parsing where invalid addresses are expected.
  static isValid(str) {
    try {
      IPv4Address.#parseStr(str);
      return true;
    } catch {
      return false;
    }
  }

  // Raw 32-bit unsigned integer — used by bitmask operations.
  toNumber() {
    return this.#value;
  }

  // Array of four octets — useful for formatting and iteration.
  toArray() {
    return [
      (this.#value >>> 24) & 0xFF,
      (this.#value >>> 16) & 0xFF,
      (this.#value >>> 8) & 0xFF,
      this.#value & 0xFF,
    ];
  }

  // Standard dotted-decimal display format.
  toString() {
    const o = this.toArray();
    return `${o[0]}.${o[1]}.${o[2]}.${o[3]}`;
  }

  // Full binary with dot separators between octets — used for binary
  // visualization features.
  toBinary() {
    return this.toArray()
      .map(o => o.toString(2).padStart(8, '0'))
      .join('.');
  }

  // Value equality (same 32-bit address) rather than reference equality.
  equals(other) {
    if (!(other instanceof IPv4Address)) return false;
    return this.#value === other.#value;
  }

  // Numeric ordering for sorting subnets by address.
  compareTo(other) {
    if (!(other instanceof IPv4Address)) throw new TypeError('Cannot compare to non-IPv4Address');
    if (this.#value < other.#value) return -1;
    if (this.#value > other.#value) return 1;
    return 0;
  }
}
