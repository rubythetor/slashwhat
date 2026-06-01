import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IPv4Address } from '../src/js/core/ipv4.js';

describe('IPv4Address constructor — string', () => {
  it('parses 192.168.1.0', () => {
    assert.equal(new IPv4Address('192.168.1.0').toString(), '192.168.1.0');
  });
  it('parses 0.0.0.0', () => {
    assert.equal(new IPv4Address('0.0.0.0').toString(), '0.0.0.0');
  });
  it('parses 255.255.255.255', () => {
    assert.equal(new IPv4Address('255.255.255.255').toString(), '255.255.255.255');
  });
  it('trims whitespace', () => {
    assert.equal(new IPv4Address('  10.0.0.1  ').toString(), '10.0.0.1');
  });
});

describe('IPv4Address constructor — number', () => {
  it('accepts 0', () => {
    assert.equal(new IPv4Address(0).toString(), '0.0.0.0');
  });
  it('accepts 0xFFFFFFFF', () => {
    assert.equal(new IPv4Address(0xFFFFFFFF).toString(), '255.255.255.255');
  });
  it('accepts 0xC0A80100 (192.168.1.0)', () => {
    assert.equal(new IPv4Address(0xC0A80100).toString(), '192.168.1.0');
  });
});

describe('IPv4Address constructor — errors', () => {
  it('rejects float', () => {
    assert.throws(() => new IPv4Address(1.5), RangeError);
  });
  it('rejects negative', () => {
    assert.throws(() => new IPv4Address(-1), RangeError);
  });
  it('rejects > 0xFFFFFFFF', () => {
    assert.throws(() => new IPv4Address(0x100000000), RangeError);
  });
  it('rejects wrong type (boolean)', () => {
    assert.throws(() => new IPv4Address(true), TypeError);
  });
  it('rejects wrong type (null)', () => {
    assert.throws(() => new IPv4Address(null), TypeError);
  });
});

describe('IPv4Address parse errors', () => {
  it('rejects 3 octets', () => {
    assert.throws(() => new IPv4Address('1.2.3'), SyntaxError);
  });
  it('rejects 5 octets', () => {
    assert.throws(() => new IPv4Address('1.2.3.4.5'), SyntaxError);
  });
  it('rejects leading zeros', () => {
    assert.throws(() => new IPv4Address('192.168.01.0'), SyntaxError);
  });
  it('rejects octet > 255', () => {
    assert.throws(() => new IPv4Address('192.168.1.256'));
  });
  it('rejects non-numeric octet', () => {
    assert.throws(() => new IPv4Address('a.b.c.d'), SyntaxError);
  });
  it('rejects empty octet', () => {
    assert.throws(() => new IPv4Address('1..2.3'), SyntaxError);
  });
  it('rejects empty string', () => {
    assert.throws(() => new IPv4Address(''));
  });
});

describe('IPv4Address.parse / isValid', () => {
  it('parse returns an IPv4Address', () => {
    const a = IPv4Address.parse('10.0.0.1');
    assert.ok(a instanceof IPv4Address);
    assert.equal(a.toString(), '10.0.0.1');
  });
  it('isValid returns true for valid', () => {
    assert.equal(IPv4Address.isValid('10.0.0.1'), true);
  });
  it('isValid returns false for invalid', () => {
    assert.equal(IPv4Address.isValid('999.0.0.1'), false);
  });
  it('isValid returns false for empty', () => {
    assert.equal(IPv4Address.isValid(''), false);
  });
});

describe('IPv4Address.toNumber', () => {
  it('roundtrips from string', () => {
    const a = new IPv4Address('192.168.1.0');
    assert.equal(new IPv4Address(a.toNumber()).toString(), '192.168.1.0');
  });
  it('0.0.0.0 → 0', () => {
    assert.equal(new IPv4Address('0.0.0.0').toNumber(), 0);
  });
  it('255.255.255.255 → 0xFFFFFFFF', () => {
    assert.equal(new IPv4Address('255.255.255.255').toNumber(), 0xFFFFFFFF);
  });
});

describe('IPv4Address.toArray', () => {
  it('returns [192, 168, 1, 0]', () => {
    assert.deepEqual(new IPv4Address('192.168.1.0').toArray(), [192, 168, 1, 0]);
  });
  it('returns [0, 0, 0, 0] for 0.0.0.0', () => {
    assert.deepEqual(new IPv4Address('0.0.0.0').toArray(), [0, 0, 0, 0]);
  });
});

describe('IPv4Address.toString', () => {
  it('roundtrips from number', () => {
    assert.equal(new IPv4Address(0x0A000001).toString(), '10.0.0.1');
  });
});

describe('IPv4Address.toBinary', () => {
  it('returns dotted binary format', () => {
    const bin = new IPv4Address('192.168.1.0').toBinary();
    assert.equal(bin, '11000000.10101000.00000001.00000000');
  });
  it('0.0.0.0 is all zeros', () => {
    assert.equal(new IPv4Address('0.0.0.0').toBinary(), '00000000.00000000.00000000.00000000');
  });
});

describe('IPv4Address.equals', () => {
  it('returns true for same address', () => {
    assert.equal(new IPv4Address('10.0.0.1').equals(new IPv4Address('10.0.0.1')), true);
  });
  it('returns false for different address', () => {
    assert.equal(new IPv4Address('10.0.0.1').equals(new IPv4Address('10.0.0.2')), false);
  });
  it('returns false for non-IPv4', () => {
    assert.equal(new IPv4Address('10.0.0.1').equals('10.0.0.1'), false);
  });
  it('returns false for null', () => {
    assert.equal(new IPv4Address('10.0.0.1').equals(null), false);
  });
});

describe('IPv4Address.compareTo', () => {
  it('returns -1 for less', () => {
    assert.equal(new IPv4Address('10.0.0.1').compareTo(new IPv4Address('10.0.0.2')), -1);
  });
  it('returns 1 for greater', () => {
    assert.equal(new IPv4Address('10.0.0.2').compareTo(new IPv4Address('10.0.0.1')), 1);
  });
  it('returns 0 for equal', () => {
    assert.equal(new IPv4Address('10.0.0.1').compareTo(new IPv4Address('10.0.0.1')), 0);
  });
  it('throws TypeError for non-IPv4', () => {
    assert.throws(() => new IPv4Address('10.0.0.1').compareTo('x'), TypeError);
  });
});
