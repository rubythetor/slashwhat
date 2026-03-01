import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RFC_RANGES, PRIVATE_RANGES_V4, PRIVATE_RANGES_V6,
  WELL_KNOWN_PREFIXES, CLASS_RANGES,
} from '../src/js/core/constants.js';

describe('RFC_RANGES', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(RFC_RANGES));
    assert.ok(RFC_RANGES.length > 0);
  });

  it('each entry has name, cidr, description strings', () => {
    for (const r of RFC_RANGES) {
      assert.equal(typeof r.name, 'string');
      assert.equal(typeof r.cidr, 'string');
      assert.equal(typeof r.description, 'string');
    }
  });

  it('contains RFC1918 10.0.0.0/8', () => {
    const found = RFC_RANGES.find(r => r.cidr === '10.0.0.0/8');
    assert.ok(found);
    assert.equal(found.name, 'RFC1918');
    assert.match(found.description, /Private/);
  });

  it('contains loopback 127.0.0.0/8', () => {
    const found = RFC_RANGES.find(r => r.cidr === '127.0.0.0/8');
    assert.ok(found);
  });

  it('contains IPv6 entries', () => {
    const v6 = RFC_RANGES.filter(r => r.cidr.includes(':'));
    assert.ok(v6.length > 0);
  });
});

describe('PRIVATE_RANGES_V4', () => {
  it('has 3 entries', () => assert.equal(PRIVATE_RANGES_V4.length, 3));

  it('each entry has cidr, start, end', () => {
    for (const r of PRIVATE_RANGES_V4) {
      assert.equal(typeof r.cidr, 'string');
      assert.equal(typeof r.start, 'number');
      assert.equal(typeof r.end, 'number');
      assert.ok(r.end >= r.start);
    }
  });

  it('10.0.0.0/8 has correct range', () => {
    const r = PRIVATE_RANGES_V4.find(r => r.cidr === '10.0.0.0/8');
    assert.equal(r.start, 0x0A000000);
    assert.equal(r.end, 0x0AFFFFFF);
  });

  it('192.168.0.0/16 has correct range', () => {
    const r = PRIVATE_RANGES_V4.find(r => r.cidr === '192.168.0.0/16');
    assert.equal(r.start, 0xC0A80000);
    assert.equal(r.end, 0xC0A8FFFF);
  });
});

describe('PRIVATE_RANGES_V6', () => {
  it('has 3 entries', () => assert.equal(PRIVATE_RANGES_V6.length, 3));

  it('each entry has cidr and description', () => {
    for (const r of PRIVATE_RANGES_V6) {
      assert.equal(typeof r.cidr, 'string');
      assert.equal(typeof r.description, 'string');
    }
  });
});

describe('WELL_KNOWN_PREFIXES', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(WELL_KNOWN_PREFIXES));
    assert.ok(WELL_KNOWN_PREFIXES.length > 0);
  });

  it('/24 has 254 usable hosts', () => {
    const p24 = WELL_KNOWN_PREFIXES.find(p => p.prefix === 24);
    assert.ok(p24);
    assert.equal(p24.v4Hosts, 254);
  });

  it('/32 has 1 host', () => {
    const p32 = WELL_KNOWN_PREFIXES.find(p => p.prefix === 32);
    assert.ok(p32);
    assert.equal(p32.v4Hosts, 1);
  });

  it('/8 has 16777214 hosts', () => {
    const p8 = WELL_KNOWN_PREFIXES.find(p => p.prefix === 8);
    assert.ok(p8);
    assert.equal(p8.v4Hosts, 16777214);
  });

  it('each entry has prefix, name, v4Hosts', () => {
    for (const p of WELL_KNOWN_PREFIXES) {
      assert.equal(typeof p.prefix, 'number');
      assert.equal(typeof p.name, 'string');
      assert.equal(typeof p.v4Hosts, 'number');
    }
  });
});

describe('CLASS_RANGES', () => {
  it('has 5 entries (A through E)', () => assert.equal(CLASS_RANGES.length, 5));

  it('Class A starts at 0', () => {
    const a = CLASS_RANGES.find(c => c.class === 'A');
    assert.ok(a);
    assert.equal(a.start, 0);
  });

  it('Class E ends at 0xFFFFFFFF', () => {
    const e = CLASS_RANGES.find(c => c.class === 'E');
    assert.ok(e);
    assert.equal(e.end, 0xFFFFFFFF);
  });

  it('each entry has class, range, leading, defaultPrefix, start, end', () => {
    for (const c of CLASS_RANGES) {
      assert.equal(typeof c.class, 'string');
      assert.equal(typeof c.range, 'string');
      assert.equal(typeof c.leading, 'string');
      assert.equal(typeof c.start, 'number');
      assert.equal(typeof c.end, 'number');
    }
  });

  it('classes D and E have null defaultPrefix', () => {
    const d = CLASS_RANGES.find(c => c.class === 'D');
    const e = CLASS_RANGES.find(c => c.class === 'E');
    assert.equal(d.defaultPrefix, null);
    assert.equal(e.defaultPrefix, null);
  });
});
