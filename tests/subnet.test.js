import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Subnet } from '../src/js/core/subnet.js';

describe('Subnet constructor', () => {
  it('normalizes non-network address to network (IPv4)', () => {
    const s = new Subnet('192.168.1.55', 24);
    assert.equal(s.network.toString(), '192.168.1.0');
  });
  it('normalizes non-network address to network (IPv6)', () => {
    const s = new Subnet('2001:db8::ff', 32);
    assert.equal(s.network.toString(), '2001:db8::');
  });
  it('keeps network address unchanged', () => {
    const s = new Subnet('10.0.0.0', 8);
    assert.equal(s.network.toString(), '10.0.0.0');
  });
  it('throws RangeError for invalid IPv4 prefix', () => {
    assert.throws(() => new Subnet('10.0.0.0', 33), RangeError);
    assert.throws(() => new Subnet('10.0.0.0', -1), RangeError);
  });
  it('throws RangeError for invalid IPv6 prefix', () => {
    assert.throws(() => new Subnet('::1', 129), RangeError);
    assert.throws(() => new Subnet('::1', -1), RangeError);
  });
});

describe('Subnet.parse', () => {
  it('parses CIDR notation', () => {
    const s = Subnet.parse('192.168.1.0/24');
    assert.equal(s.toString(), '192.168.1.0/24');
  });
  it('bare IPv4 address defaults to /32', () => {
    const s = Subnet.parse('10.0.0.1');
    assert.equal(s.prefix, 32);
  });
  it('bare IPv6 address defaults to /128', () => {
    const s = Subnet.parse('::1');
    assert.equal(s.prefix, 128);
  });
  it('throws on invalid prefix', () => {
    assert.throws(() => Subnet.parse('10.0.0.0/abc'), SyntaxError);
  });
  it('trailing non-numeric chars in prefix are ignored by parseInt', () => {
    const s = Subnet.parse('10.0.0.0/24abc');
    assert.equal(s.prefix, 24);
    assert.equal(s.toString(), '10.0.0.0/24');
  });
  it('parses IPv6 CIDR', () => {
    const s = Subnet.parse('2001:db8::/32');
    assert.equal(s.prefix, 32);
    assert.equal(s.isIPv6, true);
  });
});

describe('Subnet.fromRange', () => {
  it('computes covering CIDR for IPv4 range', () => {
    const s = Subnet.fromRange('192.168.0.0', '192.168.0.255');
    assert.equal(s.toString(), '192.168.0.0/24');
  });
  it('computes covering CIDR for single address', () => {
    const s = Subnet.fromRange('10.0.0.1', '10.0.0.1');
    assert.equal(s.prefix, 32);
  });
  it('computes covering CIDR for IPv6 range', () => {
    const s = Subnet.fromRange('2001:db8::', '2001:db8::ffff');
    assert.equal(s.isIPv6, true);
    assert.equal(s.prefix, 112);
  });
  it('reversed IPv4 range still computes correct CIDR', () => {
    const s = Subnet.fromRange('192.168.0.255', '192.168.0.0');
    assert.equal(s.toString(), '192.168.0.0/24');
  });
});

describe('Subnet getters — IPv4 /24', () => {
  const s = Subnet.parse('192.168.1.0/24');

  it('network', () => assert.equal(s.network.toString(), '192.168.1.0'));
  it('broadcast', () => assert.equal(s.broadcast.toString(), '192.168.1.255'));
  it('firstHost', () => assert.equal(s.firstHost.toString(), '192.168.1.1'));
  it('lastHost', () => assert.equal(s.lastHost.toString(), '192.168.1.254'));
  it('mask', () => assert.equal(s.mask.toString(), '255.255.255.0'));
  it('wildcard', () => assert.equal(s.wildcard.toString(), '0.0.0.255'));
  it('prefix', () => assert.equal(s.prefix, 24));
  it('totalHosts', () => assert.equal(s.totalHosts, 256));
  it('usableHosts', () => assert.equal(s.usableHosts, 254));
  it('isIPv4', () => assert.equal(s.isIPv4, true));
  it('isIPv6', () => assert.equal(s.isIPv6, false));
});

describe('Subnet getters — edge cases /31 and /32', () => {
  it('/31 has 2 usable hosts (point-to-point)', () => {
    const s = Subnet.parse('10.0.0.0/31');
    assert.equal(s.usableHosts, 2);
    assert.equal(s.totalHosts, 2);
    assert.equal(s.firstHost.toString(), '10.0.0.0');
    assert.equal(s.lastHost.toString(), '10.0.0.1');
  });
  it('/32 has 1 usable host', () => {
    const s = Subnet.parse('10.0.0.1/32');
    assert.equal(s.usableHosts, 1);
    assert.equal(s.totalHosts, 1);
    assert.equal(s.firstHost.toString(), '10.0.0.1');
    assert.equal(s.lastHost.toString(), '10.0.0.1');
  });
});

describe('Subnet getters — IPv6', () => {
  const s = Subnet.parse('2001:db8::/64');

  it('network', () => assert.equal(s.network.toString(), '2001:db8::'));
  it('prefix', () => assert.equal(s.prefix, 64));
  it('isIPv6', () => assert.equal(s.isIPv6, true));
  it('totalHosts is BigInt', () => assert.equal(typeof s.totalHosts, 'bigint'));
  it('totalHosts = 2^64', () => assert.equal(s.totalHosts, 2n ** 64n));
  it('/128 firstHost equals network', () => {
    const h = Subnet.parse('::1/128');
    assert.equal(h.firstHost.toString(), '::1');
    assert.equal(h.lastHost.toString(), '::1');
  });

  // TEST-007: IPv6 usableHosts and firstHost
  it('firstHost is network + 1 for prefix < 128', () => {
    assert.equal(s.firstHost.toString(), '2001:db8::1');
  });
  it('usableHosts equals totalHosts for IPv6', () => {
    assert.equal(s.usableHosts, 2n ** 64n);
  });

  // TEST-005: IPv6 lastHost for prefix < 128
  it('lastHost equals broadcast for prefix < 128', () => {
    assert.equal(s.lastHost.toString(), s.broadcast.toString());
  });
});

describe('Subnet getters — /0 boundary', () => {
  it('0.0.0.0/0 covers entire IPv4 space', () => {
    const s = Subnet.parse('0.0.0.0/0');
    assert.equal(s.network.toString(), '0.0.0.0');
    assert.equal(s.broadcast.toString(), '255.255.255.255');
    assert.equal(s.totalHosts, 4294967296);
  });
  it('::/0 covers entire IPv6 space', () => {
    const s = Subnet.parse('::/0');
    assert.equal(s.network.toString(), '::');
    assert.equal(s.prefix, 0);
    assert.equal(s.totalHosts, 2n ** 128n);
  });
});

describe('Subnet.contains', () => {
  const s = Subnet.parse('192.168.1.0/24');

  it('contains address inside subnet', () => {
    assert.equal(s.contains('192.168.1.100'), true);
  });
  it('contains network address', () => {
    assert.equal(s.contains('192.168.1.0'), true);
  });
  it('contains broadcast address', () => {
    assert.equal(s.contains('192.168.1.255'), true);
  });
  it('rejects address outside subnet', () => {
    assert.equal(s.contains('192.168.2.1'), false);
  });
  it('rejects address in different /8', () => {
    assert.equal(s.contains('10.0.0.1'), false);
  });

  // TEST-002: IPv6 contains
  it('contains IPv6 address inside subnet', () => {
    assert.equal(Subnet.parse('2001:db8::/32').contains('2001:db8::1'), true);
  });
  it('rejects IPv6 address outside subnet', () => {
    assert.equal(Subnet.parse('2001:db8::/32').contains('2001:db9::1'), false);
  });
});

describe('Subnet.containsSubnet', () => {
  it('larger subnet contains smaller', () => {
    const big = Subnet.parse('10.0.0.0/8');
    const small = Subnet.parse('10.1.0.0/16');
    assert.equal(big.containsSubnet(small), true);
  });
  it('smaller does not contain larger', () => {
    const big = Subnet.parse('10.0.0.0/8');
    const small = Subnet.parse('10.1.0.0/16');
    assert.equal(small.containsSubnet(big), false);
  });
  it('v4/v6 mismatch returns false', () => {
    const v4 = Subnet.parse('10.0.0.0/8');
    const v6 = Subnet.parse('2001:db8::/32');
    assert.equal(v4.containsSubnet(v6), false);
  });
  it('identical subnets contain each other', () => {
    const a = Subnet.parse('192.168.1.0/24');
    const b = Subnet.parse('192.168.1.0/24');
    assert.equal(a.containsSubnet(b), true);
  });

  // TEST-003: IPv6 containsSubnet
  it('IPv6 larger subnet contains smaller', () => {
    assert.equal(
      Subnet.parse('2001:db8::/32').containsSubnet(Subnet.parse('2001:db8:1::/48')),
      true,
    );
  });
  it('IPv6 rejects non-contained subnet', () => {
    assert.equal(
      Subnet.parse('2001:db8::/32').containsSubnet(Subnet.parse('2001:db9::/48')),
      false,
    );
  });
});

describe('Subnet.overlaps', () => {
  it('overlapping subnets', () => {
    const a = Subnet.parse('10.0.0.0/8');
    const b = Subnet.parse('10.1.0.0/16');
    assert.equal(a.overlaps(b), true);
  });
  it('non-overlapping subnets', () => {
    const a = Subnet.parse('192.168.1.0/24');
    const b = Subnet.parse('10.0.0.0/8');
    assert.equal(a.overlaps(b), false);
  });
  it('identical subnets overlap', () => {
    const a = Subnet.parse('192.168.1.0/24');
    const b = Subnet.parse('192.168.1.0/24');
    assert.equal(a.overlaps(b), true);
  });
  it('v4/v6 mismatch returns false', () => {
    const v4 = Subnet.parse('10.0.0.0/8');
    const v6 = Subnet.parse('2001:db8::/32');
    assert.equal(v4.overlaps(v6), false);
  });

  // TEST-004: IPv6 overlaps
  it('IPv6 overlapping subnets', () => {
    assert.equal(
      Subnet.parse('2001:db8::/32').overlaps(Subnet.parse('2001:db8:1::/48')),
      true,
    );
  });
  it('IPv6 non-overlapping subnets', () => {
    assert.equal(
      Subnet.parse('2001:db8::/32').overlaps(Subnet.parse('2001:db9::/32')),
      false,
    );
  });
});

describe('Subnet.split', () => {
  it('/24 → /25 produces 2 subnets', () => {
    const s = Subnet.parse('192.168.1.0/24');
    const halves = s.split(25);
    assert.equal(halves.length, 2);
    assert.equal(halves[0].toString(), '192.168.1.0/25');
    assert.equal(halves[1].toString(), '192.168.1.128/25');
  });
  it('/24 → /26 produces 4 subnets', () => {
    const s = Subnet.parse('192.168.0.0/24');
    const parts = s.split(26);
    assert.equal(parts.length, 4);
  });
  it('throws RangeError when newPrefix <= current', () => {
    const s = Subnet.parse('192.168.1.0/24');
    assert.throws(() => s.split(24), RangeError);
    assert.throws(() => s.split(20), RangeError);
  });
  it('throws RangeError for /32 split', () => {
    const s = Subnet.parse('10.0.0.1/32');
    assert.throws(() => s.split(33), RangeError);
  });
  it('splits IPv6 subnet', () => {
    const s = Subnet.parse('2001:db8::/32');
    const halves = s.split(33);
    assert.equal(halves.length, 2);
    assert.equal(halves[0].prefix, 33);
  });
});

describe('Subnet.toString / toJSON', () => {
  it('toString returns CIDR notation', () => {
    assert.equal(Subnet.parse('10.0.0.0/8').toString(), '10.0.0.0/8');
  });
  it('toJSON includes all properties', () => {
    const j = Subnet.parse('192.168.1.0/24').toJSON();
    assert.equal(j.cidr, '192.168.1.0/24');
    assert.equal(j.network, '192.168.1.0');
    assert.equal(j.broadcast, '192.168.1.255');
    assert.equal(j.prefix, 24);
    assert.equal(j.totalHosts, 256);
    assert.equal(j.usableHosts, 254);
    assert.equal(j.isIPv4, true);
    assert.equal(j.isIPv6, false);
    assert.equal(j.mask, '255.255.255.0');
    assert.equal(j.wildcard, '0.0.0.255');
    assert.equal(j.firstHost, '192.168.1.1');
    assert.equal(j.lastHost, '192.168.1.254');
  });
  it('toJSON for IPv6 converts BigInt to string', () => {
    const j = Subnet.parse('2001:db8::/64').toJSON();
    assert.equal(typeof j.totalHosts, 'string');
  });
});

describe('Subnet.getRFCInfo', () => {
  it('10.0.0.0/8 matches RFC1918', () => {
    const info = Subnet.parse('10.0.0.0/8').getRFCInfo();
    assert.ok(info.length > 0);
    assert.ok(info.some(r => r.name === 'RFC1918'));
  });
  it('10.1.0.0/16 matches RFC1918 (contained in 10.0.0.0/8)', () => {
    const info = Subnet.parse('10.1.0.0/16').getRFCInfo();
    assert.ok(info.some(r => r.name === 'RFC1918'));
  });
  it('8.8.8.8/32 returns no special info', () => {
    const info = Subnet.parse('8.8.8.8/32').getRFCInfo();
    assert.equal(info.length, 0);
  });
});

describe('Subnet.getClassInfo', () => {
  it('10.0.0.0/8 is Class A', () => {
    const ci = Subnet.parse('10.0.0.0/8').getClassInfo();
    assert.equal(ci.class, 'A');
    assert.equal(ci.defaultPrefix, 8);
    assert.equal(ci.isClassful, true);
  });
  it('172.16.0.0/12 is Class B', () => {
    const ci = Subnet.parse('172.16.0.0/12').getClassInfo();
    assert.equal(ci.class, 'B');
  });
  it('192.168.1.0/24 is Class C', () => {
    const ci = Subnet.parse('192.168.1.0/24').getClassInfo();
    assert.equal(ci.class, 'C');
    assert.equal(ci.isClassful, true);
  });
  it('224.0.0.0/4 is Class D', () => {
    const ci = Subnet.parse('224.0.0.0/4').getClassInfo();
    assert.equal(ci.class, 'D');
  });
  it('240.0.0.0/4 is Class E', () => {
    const ci = Subnet.parse('240.0.0.0/4').getClassInfo();
    assert.equal(ci.class, 'E');
  });
  it('IPv6 returns null', () => {
    assert.equal(Subnet.parse('2001:db8::/32').getClassInfo(), null);
  });
});

describe('Subnet.getBinaryVisualization', () => {
  it('IPv4: splits at prefix boundary', () => {
    const viz = Subnet.parse('192.168.1.0/24').getBinaryVisualization();
    assert.equal(viz.prefix, 24);
    assert.equal(viz.networkBits.length, 24);
    assert.equal(viz.hostBits.length, 8);
    assert.ok(viz.binaryStr.includes('.'));
  });
  it('IPv6: splits at prefix boundary', () => {
    const viz = Subnet.parse('2001:db8::/32').getBinaryVisualization();
    assert.equal(viz.prefix, 32);
    assert.equal(viz.networkBits.length, 32);
    assert.equal(viz.hostBits.length, 96);
    assert.equal(viz.binaryStr.length, 128);
  });
});
