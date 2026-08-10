// Unit tests for the Phase C beauty data module — pure, no analyzePhoto/hook
// imports. Also loads the locale JSONs directly to verify hairKey/glassesKey
// resolve to real i18n entries in both languages.
import { hexToRgb } from '../colorMath';
import { TONE12_BOARDS, TONE12_PARENT, type ColorTone12 } from '../tone12';
import { TONE12_BEAUTY } from '../tone12Beauty';
import en from '../../../i18n/locales/en.json';
import vi from '../../../i18n/locales/vi.json';

const ALL_TONES = Object.keys(TONE12_PARENT) as ColorTone12[];

describe('TONE12_BEAUTY', () => {
  test('has all 12 tone keys, no more no less', () => {
    expect(Object.keys(TONE12_BEAUTY).sort()).toEqual([...ALL_TONES].sort());
  });

  test.each(ALL_TONES)('%s: wow is exactly 4 hexes, all drawn from that tone\'s accents', (tone) => {
    const beauty = TONE12_BEAUTY[tone];
    expect(beauty.wow).toHaveLength(4);
    // No duplicates.
    expect(new Set(beauty.wow).size).toBe(4);
    for (const hex of beauty.wow) {
      expect(TONE12_BOARDS[tone].accents).toContain(hex);
    }
  });

  test.each(ALL_TONES)('%s: every hex (wow + makeup) parses via hexToRgb', (tone) => {
    const beauty = TONE12_BEAUTY[tone];
    const allHexes = [
      ...beauty.wow,
      ...beauty.makeup.lips,
      ...beauty.makeup.cheeks,
      ...beauty.makeup.eyes,
    ];
    for (const hex of allHexes) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      const rgb = hexToRgb(hex);
      expect(rgb.r).toBeGreaterThanOrEqual(0);
      expect(rgb.r).toBeLessThanOrEqual(255);
      expect(rgb.g).toBeGreaterThanOrEqual(0);
      expect(rgb.g).toBeLessThanOrEqual(255);
      expect(rgb.b).toBeGreaterThanOrEqual(0);
      expect(rgb.b).toBeLessThanOrEqual(255);
    }
  });

  test.each(ALL_TONES)('%s: makeup families have 2-3 hexes each', (tone) => {
    const { lips, cheeks, eyes } = TONE12_BEAUTY[tone].makeup;
    for (const family of [lips, cheeks, eyes]) {
      expect(family.length).toBeGreaterThanOrEqual(2);
      expect(family.length).toBeLessThanOrEqual(3);
    }
  });

  test('metal rule: springs/autumns -> gold, summers/winters -> silver, except soft_summer/soft_autumn -> both', () => {
    for (const tone of ALL_TONES) {
      const family = TONE12_PARENT[tone];
      const metal = TONE12_BEAUTY[tone].metal;
      if (tone === 'soft_summer' || tone === 'soft_autumn') {
        expect(metal).toBe('both');
      } else if (family === 'spring' || family === 'autumn') {
        expect(metal).toBe('gold');
      } else {
        expect(metal).toBe('silver');
      }
    }
  });

  test.each(ALL_TONES)('%s: hairKey resolves to an entry in both locale files', (tone) => {
    const key = `personalColor_hair_${TONE12_BEAUTY[tone].hairKey}`;
    expect(en).toHaveProperty(key);
    expect(vi).toHaveProperty(key);
    expect(typeof (en as Record<string, string>)[key]).toBe('string');
    expect(typeof (vi as Record<string, string>)[key]).toBe('string');
  });

  test.each(ALL_TONES)('%s: glassesKey resolves to an entry in both locale files', (tone) => {
    const key = `personalColor_glasses_${TONE12_BEAUTY[tone].glassesKey}`;
    expect(en).toHaveProperty(key);
    expect(vi).toHaveProperty(key);
    expect(typeof (en as Record<string, string>)[key]).toBe('string');
    expect(typeof (vi as Record<string, string>)[key]).toBe('string');
  });
});
