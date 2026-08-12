// Structural validation of the taste knowledge tables (taste-data.ts).
// Data-only guarantees: every key references a known garment type in its
// correct slot, values stay in sane ranges, no duplicate/conflicting entries.
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { CLASSIC_TRIPLES, CLASHING_PAIRS } from './taste-data.ts';
import { scoreTasteAdjustment } from './scoring.ts';
import { FitItem, ItemCategory } from './types.ts';

// Slot vocabularies — the closed type sets the composer can place in each slot.
const TOP_TYPES = new Set([
  'TEE', 'POLO', 'KNIT', 'SHIRT', 'BLOUSE', 'HENLEY', 'SWEATER', 'CARDIGAN',
  'VEST', 'CAMISOLE', 'CROP', 'BODYSUIT', 'TUNIC', 'CORSET',
]);
// Outerwear that can LEAD a triple (matched against the outwear slot).
const OUTER_LEAD_TYPES = new Set(['HOODIE', 'BLAZER', 'JACKET', 'COAT', 'PARKA', 'OVERCOAT']);
const BOTTOM_TYPES = new Set(['JEANS', 'TROUSERS', 'CHINOS', 'SHORTS', 'SKIRT', 'LEGGINGS']);
const SHOE_TYPES = new Set(['LOAFERS', 'SNEAKERS', 'BOOTS', 'HEELS', 'SANDALS', 'OXFORDS', 'MULES', 'FLATS', 'WEDGES', 'SLIDES']);
const ALL_TYPES = new Set([
  ...TOP_TYPES, ...BOTTOM_TYPES, ...SHOE_TYPES,
  'JACKET', 'BLAZER', 'COAT', 'HOODIE', 'PARKA', 'OVERCOAT', 'CAPE', 'KIMONO',
  'BAG', 'BELT', 'SCARF', 'WATCH', 'CAP', 'NECKLACE', 'SUNGLASSES', 'HAT',
  'EARRINGS', 'GLOVES', 'TIGHTS', 'TIE', 'DRESS',
]);

Deno.test('every classic triple is LEAD+BOTTOM+SHOES with known types in the right slots', () => {
  for (const key of Object.keys(CLASSIC_TRIPLES)) {
    const parts = key.split('+');
    assertEquals(parts.length, 3, `malformed key: ${key}`);
    const [lead, bottom, shoe] = parts;
    assert(TOP_TYPES.has(lead) || OUTER_LEAD_TYPES.has(lead), `${key}: '${lead}' is not a lead (top/outerwear) type`);
    assert(BOTTOM_TYPES.has(bottom), `${key}: '${bottom}' is not a bottom type`);
    assert(SHOE_TYPES.has(shoe), `${key}: '${shoe}' is not a shoe type`);
  }
});

Deno.test('classic-triple bonuses stay small and positive (0 < b <= 0.08)', () => {
  for (const [key, bonus] of Object.entries(CLASSIC_TRIPLES)) {
    assert(bonus > 0 && bonus <= 0.08, `${key}: bonus ${bonus} out of range`);
  }
});

Deno.test('clashing pairs reference known types, multipliers in (0, 1), no duplicates', () => {
  const seen = new Set<string>();
  for (const [a, b, mult] of CLASHING_PAIRS) {
    assert(ALL_TYPES.has(a), `unknown type in pair: ${a}`);
    assert(ALL_TYPES.has(b), `unknown type in pair: ${b}`);
    assert(mult > 0 && mult < 1, `${a}+${b}: multiplier ${mult} out of range`);
    const key = [a, b].sort().join('+');
    assert(!seen.has(key), `duplicate pair: ${key}`);
    seen.add(key);
  }
});

Deno.test('a triple never appears whose pair is also a strong clash (contradictory data)', () => {
  const clashMap = new Map<string, number>();
  for (const [a, b, mult] of CLASHING_PAIRS) clashMap.set([a, b].sort().join('+'), mult);
  for (const key of Object.keys(CLASSIC_TRIPLES)) {
    const [top, bottom, shoe] = key.split('+');
    for (const pair of [[top, bottom], [top, shoe], [bottom, shoe]]) {
      const mult = clashMap.get([...pair].sort().join('+'));
      assert(mult === undefined || mult >= 0.85,
        `${key} is a classic but ${pair.join('+')} is a strong clash (${mult})`);
    }
  }
});

// End-to-end sanity: a newly added triple actually fires through scoring.
function fi(id: string, category: ItemCategory, typeName: string): FitItem {
  return {
    id, category, typeName,
    colorProfile: { primaryColor: 'navy', colorLightness: 'dark', colorSaturation: 'muted', sat: 20, lum: 40, undertone: 'cool' },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    styleTags: [], fit: 'regular', formality: 3, statementStrength: 0.5,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

Deno.test('new triple (TEE+TROUSERS+LOAFERS) earns a classic bonus via scoreTasteAdjustment', () => {
  const items = [fi('a', 'top', 'TEE'), fi('b', 'bottom', 'TROUSERS'), fi('c', 'shoes', 'LOAFERS')];
  const { bonus } = scoreTasteAdjustment(items);
  assertEquals(bonus, 0.05);
});

Deno.test('outerwear-led triple fires from the outwear slot (HOODIE+JEANS+SNEAKERS was dead data before)', () => {
  const items = [
    fi('base', 'top', 'TEE'),          // TEE+JEANS+SNEAKERS = 0.06
    fi('lead', 'outwear', 'HOODIE'),   // HOODIE+JEANS+SNEAKERS = 0.05
    fi('b', 'bottom', 'JEANS'),
    fi('s', 'shoes', 'SNEAKERS'),
  ];
  const { bonus } = scoreTasteAdjustment(items);
  // Both keys resolve; the stronger one wins (max, not sum).
  assertEquals(bonus, 0.06);
});

Deno.test('outerwear-led triple fires when the top has no classic key of its own', () => {
  const items = [
    fi('base', 'top', 'CORSET'),       // CORSET+JEANS+SNEAKERS — no entry
    fi('lead', 'outwear', 'BLAZER'),   // BLAZER+JEANS+SNEAKERS = 0.04
    fi('b', 'bottom', 'JEANS'),
    fi('s', 'shoes', 'SNEAKERS'),
  ];
  const { bonus } = scoreTasteAdjustment(items);
  assertEquals(bonus, 0.04);
});
