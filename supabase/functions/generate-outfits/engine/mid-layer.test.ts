// Deno tests for the mid-layer slot (2026-08-10):
//   - OutfitSlots.mid, resolved by fabric.layerRole (not CATEGORY_MAP) —
//     lets a TRUE outer (blazer/jacket/coat…) and a mid piece (hoodie/
//     sweater/cardigan/knit/vest/kimono) coexist instead of fighting for the
//     single `outwear` slot (the root bug: enrichment.ts's CATEGORY_MAP files
//     BOTH HOODIE and BLAZER under ItemCategory 'outwear').
//   - physical rule: a HEAVY mid never sits under a true outer.
//   - dual-role: a mid piece still occupies `outwear` ALONE when no true
//     outer is present — the pre-existing "hoodie over a tee" outfit.
//   - zero regression: a wardrobe with no true-outer+mid combination never
//     sets `mid`, and results stay deterministic.
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { generateCandidates } from './generation.ts';
import { FitItem, ItemCategory, FabricWeight } from './types.ts';

function fi(
  id: string,
  category: ItemCategory,
  typeName: string,
  opts: {
    layerRole?: 'base' | 'mid' | 'outer';
    fabricWeight?: FabricWeight;
    fit?: FitItem['fit'];
    statement?: number;
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName,
    colorProfile: { primaryColor: 'navy', colorLightness: 'dark', colorSaturation: 'muted', sat: 20, lum: 40, undertone: 'neutral' },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: {
      pattern: 'solid',
      fabricWeight: opts.fabricWeight ?? 'medium',
      breathability: 'medium',
      season: 'allSeason',
      layerRole: opts.layerRole ?? 'base',
    },
    styleTags: [],
    fit: opts.fit ?? 'regular',
    warmth: 2,
    formality: 2.5,
    statementStrength: opts.statement ?? 0.5,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

const LAYERING_STACK = ['layering_stack'] as Parameters<typeof generateCandidates>[1];

function blazerHoodieWardrobe(hoodieWeight: FabricWeight = 'light'): FitItem[] {
  return [
    fi('tee', 'top', 'TEE', { layerRole: 'base', fabricWeight: 'light' }),
    fi('hoodie', 'outwear', 'HOODIE', { layerRole: 'mid', fabricWeight: hoodieWeight }),
    fi('blazer', 'outwear', 'BLAZER', { layerRole: 'outer', fabricWeight: 'medium' }),
    fi('jeans', 'bottom', 'JEANS', {}),
    fi('sneakers', 'shoes', 'SNEAKERS', {}),
  ];
}

// ─── (1) blazer + thin hoodie + jeans + sneakers can be generated ───────────

Deno.test('mid layer: blazer over a thin hoodie over a tee is generated', () => {
  const candidates = generateCandidates(blazerHoodieWardrobe('light'), LAYERING_STACK, 'seed-mid');
  const layered = candidates.find(c =>
    c.slots.top === 'tee' && c.slots.outwear === 'blazer' && c.slots.mid === 'hoodie' &&
    c.slots.bottom === 'jeans' && c.slots.shoes === 'sneakers');
  assert(layered !== undefined, 'expected a blazer/hoodie/tee/jeans/sneakers candidate with mid=hoodie');
});

// ─── (2) a HEAVY mid never sits under a true outer ───────────────────────────

Deno.test('mid layer: a HEAVY hoodie is never placed under the blazer', () => {
  const candidates = generateCandidates(blazerHoodieWardrobe('heavy'), LAYERING_STACK, 'seed-mid');
  assert(candidates.every(c => !(c.slots.mid === 'hoodie' && c.slots.outwear !== undefined)),
    'a heavy mid must never coexist with any outwear slot');
  assert(candidates.every(c => c.slots.mid !== 'hoodie'),
    'a heavy hoodie must never be assigned to the mid slot at all');
});

Deno.test('mid layer: a MEDIUM-weight mid is still allowed under the blazer (only heavy is banned)', () => {
  const candidates = generateCandidates(blazerHoodieWardrobe('medium'), LAYERING_STACK, 'seed-mid');
  const layered = candidates.some(c => c.slots.outwear === 'blazer' && c.slots.mid === 'hoodie');
  assert(layered, 'a medium-weight mid should still be able to sit under the true outer');
});

// ─── (3) dual-role: the mid piece still occupies `outwear` ALONE ────────────

Deno.test('mid layer: hoodie still occupies the outwear slot alone when styled without the blazer (dual-role preserved)', () => {
  const candidates = generateCandidates(blazerHoodieWardrobe('light'), LAYERING_STACK, 'seed-mid');
  const hoodieAlone = candidates.some(c => c.slots.outwear === 'hoodie' && c.slots.mid === undefined);
  assert(hoodieAlone, 'expected hoodie to still be able to anchor the outwear slot by itself (no blazer, no mid)');
});

Deno.test('mid layer: the mid item is never identical to the base top or the true outer it sits under', () => {
  const candidates = generateCandidates(blazerHoodieWardrobe('light'), LAYERING_STACK, 'seed-mid');
  assert(candidates.every(c => c.slots.mid === undefined || (c.slots.mid !== c.slots.top && c.slots.mid !== c.slots.outwear)));
});

// ─── (4) zero regression: no mid-eligible combo → `mid` never appears ───────

function noMidWardrobe(): FitItem[] {
  return [
    fi('tee', 'top', 'TEE', { layerRole: 'base', fabricWeight: 'light' }),
    fi('jacket', 'outwear', 'JACKET', { layerRole: 'outer', fabricWeight: 'medium' }),
    fi('jeans', 'bottom', 'JEANS', {}),
    fi('sneakers', 'shoes', 'SNEAKERS', {}),
  ];
}

Deno.test('zero regression: a wardrobe with no mid-layerRole item never sets slots.mid', () => {
  const candidates = generateCandidates(noMidWardrobe(), LAYERING_STACK, 'seed-mid');
  assert(candidates.length > 0, 'sanity: candidates should still be generated');
  assert(candidates.every(c => c.slots.mid === undefined));
});

Deno.test('zero regression: outfits without mid stay deterministic under the same seed', () => {
  const a = generateCandidates(noMidWardrobe(), LAYERING_STACK, 'seed-mid');
  const b = generateCandidates(noMidWardrobe(), LAYERING_STACK, 'seed-mid');
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test('deterministic with mid layering in play', () => {
  const a = generateCandidates(blazerHoodieWardrobe('light'), LAYERING_STACK, 'seed-mid');
  const b = generateCandidates(blazerHoodieWardrobe('light'), LAYERING_STACK, 'seed-mid');
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});
