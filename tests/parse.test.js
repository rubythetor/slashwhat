import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maskToPrefix, parseSubnetInput, formatRange } from '../src/js/core/parse.js';

describe('maskToPrefix', () => {
  it('"255.255.255.0" → 24', () => {
    assert.equal(maskToPrefix('255.255.255.0'), 24);
  });
  it('"255.0.0.0" → 8', () => {
    assert.equal(maskToPrefix('255.0.0.0'), 8);
  });
  it('"0.0.0.0" → 0', () => {
    assert.equal(maskToPrefix('0.0.0.0'), 0);
  });
  it('"255.255.255.255" → 32', () => {
    assert.equal(maskToPrefix('255.255.255.255'), 32);
  });
  it('"255.255.0.0" → 16', () => {
    assert.equal(maskToPrefix('255.255.0.0'), 16);
  });
  it('"255.255.255.128" → 25', () => {
    assert.equal(maskToPrefix('255.255.255.128'), 25);
  });
  it('rejects non-contiguous "255.0.255.0"', () => {
    assert.throws(() => maskToPrefix('255.0.255.0'), /Invalid mask/);
  });
  it('rejects wrong octet count', () => {
    assert.throws(() => maskToPrefix('255.255.255'), /Invalid mask/);
  });
  it('rejects invalid octet > 255', () => {
    assert.throws(() => maskToPrefix('256.0.0.0'), /Invalid mask/);
  });
  it('rejects non-numeric octet', () => {
    assert.throws(() => maskToPrefix('abc.0.0.0'), /Invalid mask/);
  });
});

describe('parseSubnetInput', () => {
  it('parses CIDR: "192.168.0.0/24"', () => {
    const r = parseSubnetInput('192.168.0.0/24');
    assert.equal(r.addr, '192.168.0.0');
    assert.equal(r.prefix, 24);
  });
  it('parses CIDR: "10.0.0.0/8"', () => {
    const r = parseSubnetInput('10.0.0.0/8');
    assert.equal(r.addr, '10.0.0.0');
    assert.equal(r.prefix, 8);
  });
  it('parses mask after slash: "192.168.0.0/255.255.255.0"', () => {
    const r = parseSubnetInput('192.168.0.0/255.255.255.0');
    assert.equal(r.addr, '192.168.0.0');
    assert.equal(r.prefix, 24);
  });
  it('parses space-separated: "192.168.0.0 255.255.255.0"', () => {
    const r = parseSubnetInput('192.168.0.0 255.255.255.0');
    assert.equal(r.addr, '192.168.0.0');
    assert.equal(r.prefix, 24);
  });
  it('bare address defaults to /32', () => {
    const r = parseSubnetInput('10.0.0.1');
    assert.equal(r.addr, '10.0.0.1');
    assert.equal(r.prefix, 32);
  });
  it('trims whitespace', () => {
    const r = parseSubnetInput('  10.0.0.0/8  ');
    assert.equal(r.addr, '10.0.0.0');
    assert.equal(r.prefix, 8);
  });
  it('rejects empty string', () => {
    assert.throws(() => parseSubnetInput(''), /Enter a network/);
  });
  it('rejects whitespace-only', () => {
    assert.throws(() => parseSubnetInput('   '), /Enter a network/);
  });
  it('rejects invalid prefix', () => {
    assert.throws(() => parseSubnetInput('10.0.0.0/abc'), /Invalid prefix/);
  });
  it('rejects leading zero in prefix (/00)', () => {
    assert.throws(() => parseSubnetInput('0.0.0.0/00'), /Invalid prefix/);
  });
  it('rejects leading zero in prefix (/08)', () => {
    assert.throws(() => parseSubnetInput('192.168.0.0/08'), /Invalid prefix/);
  });

  // IPv6 input formats
  it('parses IPv6 CIDR: "2001:db8::/32"', () => {
    const r = parseSubnetInput('2001:db8::/32');
    assert.equal(r.addr, '2001:db8::');
    assert.equal(r.prefix, 32);
  });
  it('bare IPv6 defaults to /128', () => {
    const r = parseSubnetInput('::1');
    assert.equal(r.addr, '::1');
    assert.equal(r.prefix, 128);
  });
  it('IPv6 space-separated with numeric prefix', () => {
    const r = parseSubnetInput('2001:db8:: 48');
    assert.equal(r.addr, '2001:db8::');
    assert.equal(r.prefix, 48);
  });

  // TEST-008: IPv6 with invalid prefix after space
  it('rejects IPv6 with invalid prefix after space', () => {
    assert.throws(() => parseSubnetInput('2001:db8:: abc'), /Invalid prefix/);
  });
});

describe('formatRange', () => {
  const start = '192.168.0.0';
  const end = '192.168.0.255';

  it('style=short: replaces shared octets with x', () => {
    const r = formatRange(start, end, 'short');
    assert.match(r, /x\.x\.x\./);
  });
  it('style=full: shows complete addresses', () => {
    const r = formatRange(start, end, 'full');
    assert.equal(r, '192.168.0.0 to 192.168.0.255');
  });
  it('style=shorter: single x for all shared octets', () => {
    const r = formatRange(start, end, 'shorter');
    assert.match(r, /^x\./);
  });
  it('style=tail: only differing octets', () => {
    const r = formatRange('192.168.0.0', '192.168.15.255', 'tail');
    assert.equal(r, '0.0 to 15.255');
  });
  it('style=dots: dots replace shared octets', () => {
    const r = formatRange('192.168.0.0', '192.168.15.255', 'dots');
    assert.equal(r, '..0.0 to ..15.255');
  });

  it('custom separator', () => {
    const r = formatRange(start, end, 'full', ' - ');
    assert.equal(r, '192.168.0.0 - 192.168.0.255');
  });

  it('no common prefix: falls back to full', () => {
    const r = formatRange('10.0.0.0', '192.168.0.255', 'short');
    assert.equal(r, '10.0.0.0 to 192.168.0.255');
  });

  it('non-IPv4 (not 4 octets): falls back to full', () => {
    const r = formatRange('::1', '::ff', 'short');
    assert.equal(r, '::1 to ::ff');
  });

  it('non-IPv4 with tail style: falls back to full', () => {
    const r = formatRange('::1', '::ff', 'tail');
    assert.equal(r, '::1 to ::ff');
  });

  // TEST-009: shorter and dots fall back to full when common prefix is 0
  it('style=shorter falls back to full when no common octets', () => {
    const r = formatRange('10.0.0.0', '192.0.0.0', 'shorter', ' to ');
    assert.equal(r, '10.0.0.0 to 192.0.0.0');
  });
  it('style=dots falls back to full when no common octets', () => {
    const r = formatRange('10.0.0.0', '192.0.0.0', 'dots', ' to ');
    assert.equal(r, '10.0.0.0 to 192.0.0.0');
  });
});
