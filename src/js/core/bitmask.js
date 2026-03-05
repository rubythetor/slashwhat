/*\! © 2026 slashwhat. MIT License. */
// bitmask.js — Shared bit-level operations for IPv4 (32-bit number) and IPv6 (128-bit BigInt).
// Centralized here so that subnet.js, ipv4.js, and ipv6.js all share one
// implementation of mask math. Every function handles both number and BigInt
// to support dual-stack (v4/v6) without branching at the call site.

export const BIGINT_128 = 128n;
export const BIGINT_32 = 32n;
export const MAX_IPV6 = (1n << 128n) - 1n;
export const MAX_IPV4 = 0xFFFFFFFF;

// Count set bits to validate subnet masks (contiguous 1s) and compute host counts.
export function onesCount(n) {
  if (typeof n === 'bigint') {
    let count = 0n;
    let val = n;
    while (val > 0n) {
      val &= val - 1n;
      count++;
    }
    return Number(count);
  }
  n = n >>> 0;
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
}

// Build the bitmask used to extract the network address from an IP.
export function prefixToMask4(prefix) {
  if (prefix < 0 || prefix > 32) throw new RangeError(`Invalid IPv4 prefix: ${prefix}`);
  if (prefix === 0) return 0;
  return (~0 << (32 - prefix)) >>> 0;
}

// Separate IPv6 version because BigInt arithmetic requires different operators than 32-bit numbers.
export function prefixToMask6(prefix) {
  if (prefix < 0 || prefix > 128) throw new RangeError(`Invalid IPv6 prefix: ${prefix}`);
  if (prefix === 0) return 0n;
  return MAX_IPV6 << (128n - BigInt(prefix)) & MAX_IPV6;
}

// Recover the CIDR prefix from a dotted-decimal mask so users can enter masks in either notation.
export function maskToPrefix(mask) {
  if (typeof mask === 'bigint') {
    if (mask === 0n) return 0;
    let count = 0;
    let val = mask;
    for (let i = 127; i >= 0; i--) {
      if ((val >> BigInt(i)) & 1n) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }
  mask = mask >>> 0;
  if (mask === 0) return 0;
  let count = 0;
  let bit = 0x80000000;
  while (bit > 0 && (mask & bit) !== 0) {
    count++;
    bit >>>= 1;
  }
  return count;
}

// Zero out host bits, yielding the network address for subnet containment checks and display.
export function applyMask(addr, mask) {
  if (typeof addr === 'bigint') return addr & mask;
  return (addr & mask) >>> 0;
}

// Bitwise NOT — computes the wildcard (inverse) mask.
// Used to derive broadcast address: network | wildcard.
export function invertMask(mask) {
  if (typeof mask === 'bigint') return (~mask) & MAX_IPV6;
  return (~mask) >>> 0;
}

// Validate that a mask is contiguous (all 1s on the left, all 0s on the right).
// Non-contiguous masks (e.g. 255.0.255.0) are invalid for CIDR notation.
// Uses the trick: if inverted mask +1 is a power of two, the mask is contiguous.
export function isContiguous(mask) {
  if (typeof mask === 'bigint') {
    if (mask === 0n) return true;
    if (mask === MAX_IPV6) return true;
    const inverted = (~mask) & MAX_IPV6;
    return (inverted & (inverted + 1n)) === 0n;
  }
  mask = mask >>> 0;
  if (mask === 0) return true;
  if (mask === MAX_IPV4) return true;
  const inverted = (~mask) >>> 0;
  return (inverted & (inverted + 1)) === 0;
}
