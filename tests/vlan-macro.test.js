import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Subnet } from '../src/js/core/subnet.js';
import {
  parseVlanMacro, evaluateVlan, computeVlan,
  isValidVlan, VLAN_PRESETS,
} from '../src/js/core/vlan-macro.js';

// --- parseVlanMacro ---

describe('parseVlanMacro', () => {
  it('parses variable tokens', () => {
    const tokens = parseVlanMacro('{o1}');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, 'var');
    assert.equal(tokens[0].value, 'o1');
  });

  it('parses all variable types', () => {
    const tokens = parseVlanMacro('{o1}{o2}{o3}{o4}{mask}{id}');
    assert.equal(tokens.length, 6);
    assert.deepEqual(tokens.map(t => t.value), ['o1', 'o2', 'o3', 'o4', 'mask', 'id']);
  });

  it('parses generator tokens', () => {
    const tokens = parseVlanMacro('{seq 100:1}');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, 'gen');
    assert.equal(tokens[0].start, 100);
    assert.equal(tokens[0].step, 1);
  });

  it('parses multiply operator', () => {
    const tokens = parseVlanMacro('{o3}*100');
    assert.equal(tokens.length, 3);
    assert.equal(tokens[1].type, 'op');
    assert.equal(tokens[1].value, '*');
  });

  it('parses arithmetic operators', () => {
    const tokens = parseVlanMacro('{o3}+{mask}');
    assert.equal(tokens[1].value, '+');
    const tokens2 = parseVlanMacro('{o3}-{mask}');
    assert.equal(tokens2[1].value, '-');
  });

  it('parses literal integers', () => {
    const tokens = parseVlanMacro('{o3}+100');
    assert.equal(tokens.length, 3);
    assert.equal(tokens[2].type, 'lit');
    assert.equal(tokens[2].value, 100);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(parseVlanMacro(''), []);
    assert.deepEqual(parseVlanMacro(null), []);
    assert.deepEqual(parseVlanMacro(undefined), []);
  });

  it('flags gap for invalid tokens mixed with valid', () => {
    const tokens = parseVlanMacro('{invalid}{o3}');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, 'o3');
    assert.equal(tokens.hasGap, true);
  });

  it('flags gap when dot appears between tokens', () => {
    const tokens = parseVlanMacro('{o3}.{mask}');
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].value, 'o3');
    assert.equal(tokens[1].value, 'mask');
    assert.equal(tokens.hasGap, true);
  });

  it('flags gap for missing closing brace', () => {
    const tokens = parseVlanMacro('{o3');
    assert.equal(tokens.hasGap, true);
  });

  it('flags gap for missing opening brace', () => {
    const tokens = parseVlanMacro('o3}');
    assert.equal(tokens.hasGap, true);
  });

  it('no gap for whitespace between tokens', () => {
    const tokens = parseVlanMacro('{o3} + {mask}');
    assert.equal(tokens.length, 3);
    assert.ok(!tokens.hasGap);
  });

  it('no gap for valid templates', () => {
    assert.ok(!parseVlanMacro('{o3}').hasGap);
    assert.ok(!parseVlanMacro('{o3}+100').hasGap);
    assert.ok(!parseVlanMacro('{id}*100+{o3}').hasGap);
    assert.ok(!parseVlanMacro('{seq 100:1}').hasGap);
  });

  it('parses octet modifier with space', () => {
    const tokens = parseVlanMacro('{o3 r}');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, 'var');
    assert.equal(tokens[0].value, 'o3');
    assert.equal(tokens[0].modifier, 'r');
  });

  it('parses octet modifier without space', () => {
    const tokens = parseVlanMacro('{o3r}');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, 'o3');
    assert.equal(tokens[0].modifier, 'r');
  });

  it('parses all modifier variants', () => {
    assert.equal(parseVlanMacro('{o3 rr}')[0].modifier, 'rr');
    assert.equal(parseVlanMacro('{o3 l}')[0].modifier, 'l');
    assert.equal(parseVlanMacro('{o3 ll}')[0].modifier, 'll');
  });

  it('mask and id still parse correctly without modifier', () => {
    const tokens = parseVlanMacro('{mask}{id}');
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].value, 'mask');
    assert.equal(tokens[0].modifier, undefined);
    assert.equal(tokens[1].value, 'id');
  });

  it('flags gap for invalid modifier like rrr', () => {
    const tokens = parseVlanMacro('{o3 rrr}');
    assert.equal(tokens.hasGap, true);
  });

  it('octet without modifier has null modifier', () => {
    const tokens = parseVlanMacro('{o3}');
    assert.equal(tokens[0].modifier, null);
  });
});

// --- evaluateVlan ---

describe('evaluateVlan', () => {
  const ctx = { o1: 10, o2: 1, o3: 50, o4: 0, mask: 24, id: 5, leafIndex: 0 };

  it('resolves single variable', () => {
    const tokens = parseVlanMacro('{o3}');
    const result = evaluateVlan(tokens, ctx);
    assert.equal(result.value, 50);
    assert.equal(result.valid, true);
  });

  it('resolves mask variable', () => {
    const tokens = parseVlanMacro('{mask}');
    const result = evaluateVlan(tokens, ctx);
    assert.equal(result.value, 24);
    assert.equal(result.valid, true);
  });

  it('resolves id variable', () => {
    const tokens = parseVlanMacro('{id}');
    const result = evaluateVlan(tokens, ctx);
    assert.equal(result.value, 5);
    assert.equal(result.valid, true);
  });

  it('multiplies with star operator', () => {
    const tokens = parseVlanMacro('{id}*100');
    const result = evaluateVlan(tokens, ctx);
    // 5 * 100 → 500
    assert.equal(result.value, 500);
    assert.equal(result.valid, true);
  });

  it('multiplies and adds for structured VLANs', () => {
    const tokens = parseVlanMacro('{id}*100+{o3}');
    const result = evaluateVlan(tokens, ctx);
    // (5 * 100) + 50 → 550 (left-to-right)
    assert.equal(result.value, 550);
    assert.equal(result.valid, true);
  });

  it('adds with plus operator', () => {
    const tokens = parseVlanMacro('{o3}+{mask}');
    const result = evaluateVlan(tokens, ctx);
    assert.equal(result.value, 74);
    assert.equal(result.valid, true);
  });

  it('subtracts with minus operator', () => {
    const tokens = parseVlanMacro('{o3}-{mask}');
    const result = evaluateVlan(tokens, ctx);
    assert.equal(result.value, 26);
    assert.equal(result.valid, true);
  });

  it('evaluates sequential generator', () => {
    const tokens = parseVlanMacro('{seq 100:1}');
    assert.equal(evaluateVlan(tokens, { ...ctx, leafIndex: 0 }).value, 100);
    assert.equal(evaluateVlan(tokens, { ...ctx, leafIndex: 5 }).value, 105);
  });

  it('evaluates sequential with step > 1', () => {
    const tokens = parseVlanMacro('{seq 200:10}');
    assert.equal(evaluateVlan(tokens, { ...ctx, leafIndex: 3 }).value, 230);
  });

  it('evaluates literal integers', () => {
    const tokens = parseVlanMacro('{o3}+100');
    const result = evaluateVlan(tokens, ctx);
    assert.equal(result.value, 150);
    assert.equal(result.valid, true);
  });

  it('returns error for empty tokens', () => {
    const result = evaluateVlan([], ctx);
    assert.equal(result.valid, false);
    assert.ok(result.error);
  });

  it('handles NaN id gracefully', () => {
    const tokens = parseVlanMacro('{id}');
    const noIdCtx = { ...ctx, id: NaN };
    const result = evaluateVlan(tokens, noIdCtx);
    assert.equal(result.valid, false);
  });

  it('evaluates left-to-right without precedence', () => {
    // {o3}+{id}*100 = (50 + 5) * 100 = 5500 (out of range)
    const tokens = parseVlanMacro('{o3}+{id}*100');
    const result = evaluateVlan(tokens, ctx);
    assert.equal(result.value, 5500);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('out of range'));
  });

  it('rejects out-of-range multiplication result', () => {
    const tokens = parseVlanMacro('{o3}*100');
    const result = evaluateVlan(tokens, ctx);
    // 50 * 100 → 5000, out of range
    assert.equal(result.value, 5000);
    assert.equal(result.valid, false);
  });

  it('concatenates adjacent tokens with no operator', () => {
    const tokens = parseVlanMacro('{o3}{mask}');
    const result = evaluateVlan(tokens, ctx);
    // "50" + "24" → "5024" → 5024 (out of range)
    assert.equal(result.value, 5024);
    assert.equal(result.valid, false);
  });

  it('concatenates variable and literal with no operator', () => {
    const tokens = parseVlanMacro('{o3}1');
    const result = evaluateVlan(tokens, ctx);
    // "50" + "1" → "501" → 501
    assert.equal(result.value, 501);
    assert.equal(result.valid, true);
  });

  it('applies digit-slice r modifier', () => {
    const tokens = parseVlanMacro('{o3 r}');
    const result = evaluateVlan(tokens, { ...ctx, o3: 192 });
    assert.equal(result.value, 2);
  });

  it('applies digit-slice rr modifier', () => {
    const tokens = parseVlanMacro('{o3 rr}');
    const result = evaluateVlan(tokens, { ...ctx, o3: 192 });
    assert.equal(result.value, 92);
  });

  it('applies digit-slice l modifier', () => {
    const tokens = parseVlanMacro('{o3 l}');
    const result = evaluateVlan(tokens, { ...ctx, o3: 192 });
    assert.equal(result.value, 1);
  });

  it('applies digit-slice ll modifier', () => {
    const tokens = parseVlanMacro('{o3 ll}');
    const result = evaluateVlan(tokens, { ...ctx, o3: 192 });
    assert.equal(result.value, 19);
  });

  it('digit-slice on single-digit value returns same digit', () => {
    const singleCtx = { ...ctx, o3: 5 };
    assert.equal(evaluateVlan(parseVlanMacro('{o3 r}'), singleCtx).value, 5);
    assert.equal(evaluateVlan(parseVlanMacro('{o3 rr}'), singleCtx).value, 5);
    assert.equal(evaluateVlan(parseVlanMacro('{o3 l}'), singleCtx).value, 5);
    assert.equal(evaluateVlan(parseVlanMacro('{o3 ll}'), singleCtx).value, 5);
  });

  it('preserves leading zeros in literal during concat', () => {
    const tokens = parseVlanMacro('{o3}002');
    // o3=50: "50" + "002" → "50002" → 50002 (out of range)
    const result = evaluateVlan(tokens, { ...ctx, o3: 5 });
    // o3=5: "5" + "002" → "5002" → 5002 (out of range)
    assert.equal(result.value, 5002);
    assert.equal(result.valid, false);
  });
});

// --- isValidVlan ---

describe('isValidVlan', () => {
  it('accepts valid VLAN IDs', () => {
    assert.equal(isValidVlan(1), true);
    assert.equal(isValidVlan(100), true);
    assert.equal(isValidVlan(4094), true);
  });

  it('rejects out-of-range values', () => {
    assert.equal(isValidVlan(0), false);
    assert.equal(isValidVlan(4095), false);
    assert.equal(isValidVlan(-1), false);
  });

  it('rejects reserved VLAN IDs', () => {
    assert.equal(isValidVlan(1002), false);
    assert.equal(isValidVlan(1003), false);
    assert.equal(isValidVlan(1004), false);
    assert.equal(isValidVlan(1005), false);
  });

  it('rejects non-integers', () => {
    assert.equal(isValidVlan(1.5), false);
    assert.equal(isValidVlan(NaN), false);
    assert.equal(isValidVlan(Infinity), false);
  });
});

// --- computeVlan ---

describe('computeVlan', () => {
  it('computes VLAN from IPv4 subnet', () => {
    const s = Subnet.parse('10.1.50.0/24');
    const result = computeVlan('{o3}', s, '', 0);
    assert.equal(result.value, 50);
    assert.equal(result.valid, true);
  });

  it('computes structured VLAN with multiply', () => {
    const s = Subnet.parse('10.1.50.0/24');
    const result = computeVlan('{id}*100+{o3}', s, '5', 0);
    // 5*100 + 50 = 550
    assert.equal(result.value, 550);
    assert.equal(result.valid, true);
  });

  it('computes VLAN with section ID addition', () => {
    const s = Subnet.parse('10.1.50.0/24');
    const result = computeVlan('{id}+{o3}', s, '100', 0);
    assert.equal(result.value, 150);
    assert.equal(result.valid, true);
  });

  it('computes sequential VLAN', () => {
    const s = Subnet.parse('10.0.0.0/24');
    assert.equal(computeVlan('{seq 100:1}', s, '', 0).value, 100);
    assert.equal(computeVlan('{seq 100:1}', s, '', 3).value, 103);
  });

  it('handles IPv6 subnet gracefully', () => {
    const s = Subnet.parse('2001:db8::/32');
    // {mask} still works for IPv6
    const result = computeVlan('{mask}', s, '', 0);
    assert.equal(result.value, 32);
    assert.equal(result.valid, true);

    // Octet variables produce NaN on IPv6
    const result2 = computeVlan('{o3}', s, '', 0);
    assert.equal(result2.valid, false);
  });

  it('returns error for empty template', () => {
    const s = Subnet.parse('10.0.0.0/24');
    const result = computeVlan('', s, '', 0);
    assert.equal(result.valid, false);
  });

  it('rejects malformed template with gap', () => {
    const s = Subnet.parse('10.1.50.0/24');
    const r1 = computeVlan('{o3', s, '', 0);
    assert.equal(r1.valid, false);
    assert.equal(r1.error, 'Invalid syntax');

    const r2 = computeVlan('o3}', s, '', 0);
    assert.equal(r2.valid, false);
    assert.equal(r2.error, 'Invalid syntax');

    const r3 = computeVlan('{o3}.{mask}', s, '', 0);
    assert.equal(r3.valid, false);
    assert.equal(r3.error, 'Invalid syntax');
  });

  it('includes template in result', () => {
    const s = Subnet.parse('10.0.0.0/24');
    const result = computeVlan('{o3}', s, '', 0);
    assert.equal(result.template, '{o3}');
  });

  it('handles missing sectionId', () => {
    const s = Subnet.parse('10.1.50.0/24');
    const result = computeVlan('{id}', s, '', 0);
    assert.equal(result.valid, false);
  });

  it('handles non-numeric sectionId', () => {
    const s = Subnet.parse('10.1.50.0/24');
    const result = computeVlan('{id}', s, 'abc', 0);
    assert.equal(result.valid, false);
  });

  it('detects reserved VLANs as warnings', () => {
    const s = Subnet.parse('10.0.0.0/24');
    const result = computeVlan('{seq 1002:1}', s, '', 0);
    assert.equal(result.value, 1002);
    assert.equal(result.valid, true);
    assert.equal(result.warning, true);
  });

  it('rejects VLAN 0', () => {
    const s = Subnet.parse('10.0.0.0/24');
    const result = computeVlan('{o4}', s, '', 0);
    assert.equal(result.value, 0);
    assert.equal(result.valid, false);
  });

  it('rejects VLAN above 4094', () => {
    const s = Subnet.parse('10.0.0.0/24');
    const result = computeVlan('{seq 4095:1}', s, '', 0);
    assert.equal(result.valid, false);
  });

  it('computes digit-sliced VLAN with arithmetic', () => {
    const s = Subnet.parse('10.1.50.0/24');
    // {o3 r} = 0, +100 = 100
    const result = computeVlan('{o3 r}+100', s, '', 0);
    assert.equal(result.value, 100);
    assert.equal(result.valid, true);
  });

  it('computes leftmost digit of third octet', () => {
    const s = Subnet.parse('10.1.50.0/24');
    const result = computeVlan('{o3 l}', s, '', 0);
    assert.equal(result.value, 5);
    assert.equal(result.valid, true);
  });

  it('multiply produces predictable structured VLANs', () => {
    // Verify multiply gives consistent results regardless of digit width
    const s = Subnet.parse('10.0.5.0/24');
    assert.equal(computeVlan('{id}*100+{o3}', s, '1', 0).value, 105);  // 1*100+5
    assert.equal(computeVlan('{id}*100+{o3}', s, '10', 0).value, 1005); // 10*100+5

    const s2 = Subnet.parse('10.0.50.0/24');
    assert.equal(computeVlan('{id}*100+{o3}', s2, '1', 0).value, 150);  // 1*100+50
    assert.equal(computeVlan('{id}*100+{o3}', s2, '10', 0).value, 1050); // 10*100+50
  });
});

// --- VLAN_PRESETS ---

describe('VLAN_PRESETS', () => {
  it('has expected number of presets', () => {
    assert.equal(VLAN_PRESETS.length, 6);
  });

  it('each preset has name, template, and description', () => {
    for (const p of VLAN_PRESETS) {
      assert.ok(p.name, 'preset must have name');
      assert.ok(p.template, 'preset must have template');
      assert.ok(p.description, 'preset must have description');
    }
  });

  it('Third Octet preset produces expected value', () => {
    const s = Subnet.parse('10.1.50.0/24');
    const result = computeVlan(VLAN_PRESETS[0].template, s, '', 0);
    assert.equal(result.value, 50);
    assert.equal(result.valid, true);
  });

  it('Sequential preset auto-increments', () => {
    const s = Subnet.parse('10.0.0.0/24');
    const preset = VLAN_PRESETS.find(p => p.name === 'Sequential');
    assert.equal(computeVlan(preset.template, s, '', 0).value, 100);
    assert.equal(computeVlan(preset.template, s, '', 1).value, 101);
  });

  it('Site + Octet preset uses multiply for structured VLANs', () => {
    const s = Subnet.parse('10.1.50.0/24');
    const preset = VLAN_PRESETS.find(p => p.name === 'Site + Octet');
    const result = computeVlan(preset.template, s, '5', 0);
    // 5*100+50 = 550
    assert.equal(result.value, 550);
    assert.equal(result.valid, true);
  });
});
