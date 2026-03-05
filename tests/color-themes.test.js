import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES, THEME_MAP, COLOR_MODES, ZEBRA_COLORS,
  DEFAULT_COLOR_CONFIG, getThemeColors,
} from '../src/js/core/color-themes.js';

describe('THEMES', () => {
  it('has 17 built-in themes', () => {
    assert.equal(THEMES.length, 17);
  });

  it('each theme has a name and exactly 8 colors', () => {
    for (const t of THEMES) {
      assert.equal(typeof t.name, 'string');
      assert.equal(t.colors.length, 8, `${t.name} should have 8 colors`);
    }
  });

  it('all colors are valid hex strings', () => {
    const hexRe = /^#[0-9A-Fa-f]{6}$/;
    for (const t of THEMES) {
      for (const c of t.colors) {
        assert.ok(hexRe.test(c), `${t.name}: ${c} is not valid hex`);
      }
    }
  });

  it('each theme name is unique', () => {
    const names = THEMES.map(t => t.name);
    assert.equal(new Set(names).size, names.length);
  });
});

describe('THEME_MAP', () => {
  it('maps every theme name to its theme object', () => {
    for (const t of THEMES) {
      assert.strictEqual(THEME_MAP[t.name], t);
    }
  });
});

describe('COLOR_MODES', () => {
  it('has exactly 7 modes', () => {
    assert.equal(COLOR_MODES.length, 7);
  });

  it('includes all expected modes', () => {
    const expected = ['sibling', 'cousins', 'cycle', 'alternating', 'zebra', 'manual', 'none'];
    assert.deepEqual(COLOR_MODES, expected);
  });
});

describe('ZEBRA_COLORS', () => {
  it('has dark and light variants with 2 colors each', () => {
    assert.equal(ZEBRA_COLORS.dark.length, 2);
    assert.equal(ZEBRA_COLORS.light.length, 2);
  });

  it('all zebra colors are valid hex', () => {
    const hexRe = /^#[0-9A-Fa-f]{6}$/;
    for (const c of [...ZEBRA_COLORS.dark, ...ZEBRA_COLORS.light]) {
      assert.ok(hexRe.test(c), `${c} is not valid hex`);
    }
  });
});

describe('DEFAULT_COLOR_CONFIG', () => {
  it('defaults to sibling mode with Neon theme', () => {
    assert.equal(DEFAULT_COLOR_CONFIG.mode, 'sibling');
    assert.equal(DEFAULT_COLOR_CONFIG.theme, 'Neon');
  });

  it('has two altColors', () => {
    assert.equal(DEFAULT_COLOR_CONFIG.altColors.length, 2);
  });
});

describe('getThemeColors', () => {
  it('returns colors for a known theme', () => {
    const colors = getThemeColors('Neon');
    assert.equal(colors.length, 8);
    assert.equal(colors[0], '#22D3EE');
  });

  it('falls back to Pastel for unknown theme names', () => {
    const colors = getThemeColors('DoesNotExist');
    assert.deepEqual(colors, THEMES[0].colors);
  });

  it('returns the Pastel theme colors for "Pastel"', () => {
    assert.deepEqual(getThemeColors('Pastel'), THEMES[0].colors);
  });
});
