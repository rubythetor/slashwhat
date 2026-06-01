import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIGINT_128, BIGINT_32, MAX_IPV6, MAX_IPV4,
  onesCount, prefixToMask4, prefixToMask6, maskToPrefix,
  applyMask, invertMask, isContiguous,
} from '../src/js/core/bitmask.js';

describe('bitmask constants', () => {
  it('BIGINT_128 equals 128n', () => assert.equal(BIGINT_128, 128n));
  it('BIGINT_32 equals 32n', () => assert.equal(BIGINT_32, 32n));
  it('MAX_IPV6 equals 2^128 - 1', () => assert.equal(MAX_IPV6, (1n << 128n) - 1n));
  it('MAX_IPV4 equals 0xFFFFFFFF', () => assert.equal(MAX_IPV4, 0xFFFFFFFF));
});

describe('onesCount', () => {
  it('returns 0 for 0', () => assert.equal(onesCount(0), 0));
  it('returns 32 for MAX_IPV4', () => assert.equal(onesCount(MAX_IPV4), 32));
  it('returns 16 for 0xFFFF', () => assert.equal(onesCount(0xFFFF), 16));
  it('returns 1 for single bit', () => assert.equal(onesCount(1), 1));
  it('returns 8 for 0xFF', () => assert.equal(onesCount(0xFF), 8));
  it('BigInt: returns 0 for 0n', () => assert.equal(onesCount(0n), 0));
  it('BigInt: returns 128 for MAX_IPV6', () => assert.equal(onesCount(MAX_IPV6), 128));
  it('BigInt: returns 1 for 1n', () => assert.equal(onesCount(1n), 1));
  it('BigInt: returns 64 for lower 64 bits set', () => {
    assert.equal(onesCount((1n << 64n) - 1n), 64);
  });
});

describe('prefixToMask4', () => {
  it('/0 → 0', () => assert.equal(prefixToMask4(0), 0));
  it('/8 → 0xFF000000', () => assert.equal(prefixToMask4(8), 0xFF000000));
  it('/16 → 0xFFFF0000', () => assert.equal(prefixToMask4(16), 0xFFFF0000));
  it('/24 → 0xFFFFFF00', () => assert.equal(prefixToMask4(24), 0xFFFFFF00));
  it('/32 → 0xFFFFFFFF', () => assert.equal(prefixToMask4(32), 0xFFFFFFFF));
  it('throws RangeError for -1', () => {
    assert.throws(() => prefixToMask4(-1), RangeError);
  });
  it('throws RangeError for 33', () => {
    assert.throws(() => prefixToMask4(33), RangeError);
  });
});

describe('prefixToMask6', () => {
  it('/0 → 0n', () => assert.equal(prefixToMask6(0), 0n));
  it('/128 → MAX_IPV6', () => assert.equal(prefixToMask6(128), MAX_IPV6));
  it('/64 has upper 64 bits set', () => {
    const mask = prefixToMask6(64);
    const expected = MAX_IPV6 << 64n & MAX_IPV6;
    assert.equal(mask, expected);
  });
  it('throws RangeError for -1', () => {
    assert.throws(() => prefixToMask6(-1), RangeError);
  });
  it('throws RangeError for 129', () => {
    assert.throws(() => prefixToMask6(129), RangeError);
  });
});

describe('maskToPrefix', () => {
  it('Number: 0 → 0', () => assert.equal(maskToPrefix(0), 0));
  it('Number: 0xFFFFFF00 → 24', () => assert.equal(maskToPrefix(0xFFFFFF00), 24));
  it('Number: 0xFF000000 → 8', () => assert.equal(maskToPrefix(0xFF000000), 8));
  it('Number: MAX_IPV4 → 32', () => assert.equal(maskToPrefix(MAX_IPV4), 32));
  it('BigInt: 0n → 0', () => assert.equal(maskToPrefix(0n), 0));
  it('BigInt: MAX_IPV6 → 128', () => assert.equal(maskToPrefix(MAX_IPV6), 128));
  it('BigInt: roundtrips with prefixToMask6', () => {
    assert.equal(maskToPrefix(prefixToMask6(64)), 64);
    assert.equal(maskToPrefix(prefixToMask6(96)), 96);
  });
});

describe('applyMask', () => {
  it('Number: masks off host bits', () => {
    assert.equal(applyMask(0xC0A801FF, 0xFFFFFF00), 0xC0A80100);
  });
  it('Number: mask 0 returns 0', () => {
    assert.equal(applyMask(0xC0A801FF, 0), 0);
  });
  it('Number: mask MAX returns original', () => {
    assert.equal(applyMask(0xC0A801FF, MAX_IPV4), 0xC0A801FF);
  });
  it('BigInt: masks off host bits', () => {
    const addr = MAX_IPV6; // all 128 bits set
    const mask = prefixToMask6(64);
    assert.equal(applyMask(addr, mask), mask);
  });
});

describe('invertMask', () => {
  it('Number: inverts /24 mask', () => {
    assert.equal(invertMask(0xFFFFFF00), 0x000000FF);
  });
  it('Number: inverts 0 to MAX', () => {
    assert.equal(invertMask(0), MAX_IPV4);
  });
  it('Number: inverts MAX to 0', () => {
    assert.equal(invertMask(MAX_IPV4), 0);
  });
  it('BigInt: inverts /64 mask to lower 64 wildcard', () => {
    const mask = prefixToMask6(64);
    const wild = invertMask(mask);
    assert.equal(wild, (1n << 64n) - 1n);
  });
  it('BigInt: inverts 0n to MAX_IPV6', () => {
    assert.equal(invertMask(0n), MAX_IPV6);
  });
  it('BigInt: does not overflow 128 bits', () => {
    const wild = invertMask(0n);
    assert.ok(wild <= MAX_IPV6);
  });
});

describe('isContiguous', () => {
  it('Number: 0 is contiguous', () => assert.equal(isContiguous(0), true));
  it('Number: MAX_IPV4 is contiguous', () => assert.equal(isContiguous(MAX_IPV4), true));
  it('Number: /24 mask is contiguous', () => assert.equal(isContiguous(0xFFFFFF00), true));
  it('Number: /16 mask is contiguous', () => assert.equal(isContiguous(0xFFFF0000), true));
  it('Number: non-contiguous 0xFF00FF00 fails', () => {
    assert.equal(isContiguous(0xFF00FF00), false);
  });
  it('Number: non-contiguous 0x0F0F0F0F fails', () => {
    assert.equal(isContiguous(0x0F0F0F0F), false);
  });
  it('BigInt: 0n is contiguous', () => assert.equal(isContiguous(0n), true));
  it('BigInt: MAX_IPV6 is contiguous', () => assert.equal(isContiguous(MAX_IPV6), true));
  it('BigInt: /64 mask is contiguous', () => {
    assert.equal(isContiguous(prefixToMask6(64)), true);
  });
});
