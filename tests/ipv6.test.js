import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IPv6Address } from '../src/js/core/ipv6.js';

const MAX_IPV6 = (1n << 128n) - 1n;

describe('IPv6Address constructor — string', () => {
  it('parses full form', () => {
    const a = new IPv6Address('2001:0db8:0000:0000:0000:0000:0000:0001');
    assert.equal(a.toBigInt(), 0x20010db8000000000000000000000001n);
  });
  it('parses compressed ::1', () => {
    const a = new IPv6Address('::1');
    assert.equal(a.toBigInt(), 1n);
  });
  it('parses :: (all zeros)', () => {
    const a = new IPv6Address('::');
    assert.equal(a.toBigInt(), 0n);
  });
  it('parses fe80::1', () => {
    const a = new IPv6Address('fe80::1');
    assert.equal(a.toFullString(), 'fe80:0000:0000:0000:0000:0000:0000:0001');
  });
  it('trims whitespace', () => {
    assert.equal(new IPv6Address('  ::1  ').toBigInt(), 1n);
  });
});

describe('IPv6Address constructor — BigInt', () => {
  it('accepts 0n', () => {
    assert.equal(new IPv6Address(0n).toBigInt(), 0n);
  });
  it('accepts MAX_IPV6', () => {
    assert.equal(new IPv6Address(MAX_IPV6).toBigInt(), MAX_IPV6);
  });
  it('rejects negative BigInt', () => {
    assert.throws(() => new IPv6Address(-1n), RangeError);
  });
  it('rejects BigInt > MAX', () => {
    assert.throws(() => new IPv6Address(MAX_IPV6 + 1n), RangeError);
  });
});

describe('IPv6Address constructor — errors', () => {
  it('rejects wrong type (number)', () => {
    assert.throws(() => new IPv6Address(42), TypeError);
  });
  it('rejects wrong type (null)', () => {
    assert.throws(() => new IPv6Address(null), TypeError);
  });
});

describe('IPv6Address — mixed notation', () => {
  it('parses ::ffff:192.168.1.1', () => {
    const a = new IPv6Address('::ffff:192.168.1.1');
    assert.ok(a.isV4Mapped());
    assert.equal(a.toV4(), '192.168.1.1');
  });
  it('parses ::ffff:10.0.0.1', () => {
    const a = new IPv6Address('::ffff:10.0.0.1');
    assert.equal(a.toV4(), '10.0.0.1');
  });
  it('rejects invalid mixed notation', () => {
    assert.throws(() => new IPv6Address('::ffff:999.0.0.1'), SyntaxError);
  });
});

describe('IPv6Address — :: expansion errors', () => {
  it('rejects multiple ::', () => {
    assert.throws(() => new IPv6Address('::1::2'), SyntaxError);
  });
  it('rejects wrong group count', () => {
    assert.throws(() => new IPv6Address('1:2:3:4:5:6:7'), SyntaxError);
  });
  it('rejects too many groups with ::', () => {
    assert.throws(() => new IPv6Address('1:2:3:4:5:6:7:8::9'), SyntaxError);
  });
});

describe('IPv6Address — group validation', () => {
  it('rejects invalid hex group', () => {
    assert.throws(() => new IPv6Address('gggg::1'), SyntaxError);
  });
  it('rejects group > 4 hex chars', () => {
    assert.throws(() => new IPv6Address('12345::1'), SyntaxError);
  });
  it('rejects empty group in full form', () => {
    assert.throws(() => new IPv6Address('1:2:3:4:5:6:7:'), SyntaxError);
  });
});

describe('IPv6Address.parse / isValid', () => {
  it('parse returns IPv6Address', () => {
    const a = IPv6Address.parse('::1');
    assert.ok(a instanceof IPv6Address);
  });
  it('isValid returns true for valid', () => {
    assert.equal(IPv6Address.isValid('::1'), true);
    assert.equal(IPv6Address.isValid('2001:db8::1'), true);
  });
  it('isValid returns false for invalid', () => {
    assert.equal(IPv6Address.isValid('not-an-address'), false);
    assert.equal(IPv6Address.isValid(''), false);
  });
});

describe('IPv6Address.expand / compress', () => {
  it('expand returns full zero-padded form', () => {
    assert.equal(IPv6Address.expand('::1'), '0000:0000:0000:0000:0000:0000:0000:0001');
  });
  it('compress returns shortest form', () => {
    assert.equal(IPv6Address.compress('0000:0000:0000:0000:0000:0000:0000:0001'), '::1');
  });
  it('compress of :: stays ::', () => {
    assert.equal(IPv6Address.compress('::'), '::');
  });
});

describe('IPv6Address.toGroups', () => {
  it('returns 8-element array', () => {
    const groups = new IPv6Address('::1').toGroups();
    assert.equal(groups.length, 8);
    assert.equal(groups[7], 1);
    assert.equal(groups[0], 0);
  });
  it('parses full address correctly', () => {
    const groups = new IPv6Address('2001:db8:0:0:0:0:0:1').toGroups();
    assert.equal(groups[0], 0x2001);
    assert.equal(groups[1], 0x0db8);
    assert.equal(groups[7], 1);
  });
});

describe('IPv6Address.toString — RFC 5952 compression', () => {
  it('compresses longest zero run', () => {
    assert.equal(new IPv6Address('2001:db8:0:0:0:0:0:1').toString(), '2001:db8::1');
  });
  it('picks leftmost run on tie', () => {
    // 2001:0:0:1:0:0:0:1 — right run (3 zeros) is longer
    const a = new IPv6Address('2001:0:0:1:0:0:0:1');
    assert.equal(a.toString(), '2001:0:0:1::1');
  });
  it('does not compress single zero group', () => {
    const a = new IPv6Address('2001:db8:0:1:0:1:0:1');
    assert.equal(a.toString(), '2001:db8:0:1:0:1:0:1');
  });
  it('all zeros compresses to ::', () => {
    assert.equal(new IPv6Address('::').toString(), '::');
  });
});

describe('IPv6Address.toFullString', () => {
  it('returns zero-padded 8 groups', () => {
    assert.equal(
      new IPv6Address('::1').toFullString(),
      '0000:0000:0000:0000:0000:0000:0000:0001',
    );
  });
});

describe('IPv6Address.toBinary', () => {
  it('returns 128-char binary string', () => {
    const bin = new IPv6Address('::1').toBinary();
    assert.equal(bin.length, 128);
    assert.equal(bin[127], '1');
    assert.ok(bin.startsWith('0'.repeat(127)));
  });
});

describe('IPv6Address.equals', () => {
  it('returns true for same address', () => {
    assert.equal(new IPv6Address('::1').equals(new IPv6Address('::1')), true);
  });
  it('returns false for different address', () => {
    assert.equal(new IPv6Address('::1').equals(new IPv6Address('::2')), false);
  });
  it('returns false for non-IPv6', () => {
    assert.equal(new IPv6Address('::1').equals('::1'), false);
  });
});

describe('IPv6Address.compareTo', () => {
  it('returns -1 for less', () => {
    assert.equal(new IPv6Address('::1').compareTo(new IPv6Address('::2')), -1);
  });
  it('returns 1 for greater', () => {
    assert.equal(new IPv6Address('::2').compareTo(new IPv6Address('::1')), 1);
  });
  it('returns 0 for equal', () => {
    assert.equal(new IPv6Address('::1').compareTo(new IPv6Address('::1')), 0);
  });
  it('throws TypeError for non-IPv6', () => {
    assert.throws(() => new IPv6Address('::1').compareTo('::1'), TypeError);
  });
});

describe('IPv6Address.isV4Mapped', () => {
  it('true for ::ffff:x.x.x.x', () => {
    assert.equal(new IPv6Address('::ffff:192.168.1.1').isV4Mapped(), true);
  });
  it('true for ::ffff:a00:1 (hex equivalent)', () => {
    assert.equal(new IPv6Address('::ffff:a00:1').isV4Mapped(), true);
  });
  it('false for ::1', () => {
    assert.equal(new IPv6Address('::1').isV4Mapped(), false);
  });
  it('false for 2001:db8::1', () => {
    assert.equal(new IPv6Address('2001:db8::1').isV4Mapped(), false);
  });
});

describe('IPv6Address.toV4', () => {
  it('extracts IPv4 from v4-mapped', () => {
    assert.equal(new IPv6Address('::ffff:192.168.1.1').toV4(), '192.168.1.1');
  });
  it('extracts 10.0.0.1 from hex form', () => {
    assert.equal(new IPv6Address('::ffff:a00:1').toV4(), '10.0.0.1');
  });
  it('returns null for non-mapped', () => {
    assert.equal(new IPv6Address('::1').toV4(), null);
  });
  it('returns null for 2001:db8::1', () => {
    assert.equal(new IPv6Address('2001:db8::1').toV4(), null);
  });
});
