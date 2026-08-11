// Deno tests for one-piece (dress/jumpsuit) candidate generation.
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees:
//   - slots.top === slots.bottom === the one-piece id on every candidate
//     (the deliberate Q29 convention — see generation.ts:622-624)
//   - a wardrobe whose bare onepiece × shoes combinations EXCEED
//     ONEPIECE_CAP on their own still yields outerwear-bearing candidates
//     (the starvation bug: pre-fix, the bare loop alone hit the cap and
//     `return`ed before the outerwear loop ever ran)
//   - generation is deterministic for a fixed seed

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { generateCandidates } from './generation.ts';
import { FitItem, ItemCategory } from './types.ts';

function fi(id: string, category: ItemCategory, opts: { formality?: number; statement?: number } = {}): FitItem {
  return {
    id,
    category,
    typeName: category === 'onepiece' ? 'DRESS' : category.toUpperCase(),
    colorProfile: {
      primaryColor: 'navy',
      colorLightness: 'medium',
      colorSaturation: 'muted',
      sat: 20,
      lum: 40,
      undertone: 'neutral',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: category === 'outwear' ? 'outer' : 'base' },
    styleTags: [],
    fit: 'regular',
    formality: opts.formality ?? 2.5,
    statementStrength: opts.statement ?? 0.3,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

// A wardrobe whose bare (onepiece × shoes) cross product alone EXCEEDS
// ONEPIECE_CAP (60): 10 dresses × 8 shoes = 80. Plus outerwear + an
// accessory so those variant classes are reachable at all. No tops/bottoms,
// so generateCandidates' formula pools are all empty and its fallback path
// is empty too (both require tops AND bottoms) — the returned candidates
// are exactly generateOnepieceCandidates' output, letting this test exercise
// it through the public API without exporting an internal function.
function starvedWardrobe(): FitItem[] {
  const onepieces = Array.from({ length: 10 }, (_, i) => fi(`dress-${i}`, 'onepiece'));
  const shoes = Array.from({ length: 8 }, (_, i) => fi(`shoe-${i}`, 'shoes'));
  const outwear = Array.from({ length: 3 }, (_, i) => fi(`coat-${i}`, 'outwear'));
  const accessory = [fi('bag-0', 'accessory')];
  return [...onepieces, ...shoes, ...outwear, ...accessory];
}

Deno.test('onepiece: top === bottom === the one-piece id on every candidate', () => {
  const candidates = generateCandidates(starvedWardrobe(), undefined, 'seed-1');
  assert(candidates.length > 0);
  for (const c of candidates) {
    assertEquals(c.slots.top, c.slots.bottom);
    assert(c.slots.top.startsWith('dress-'), `expected a dress id, got ${c.slots.top}`);
  }
});

Deno.test('onepiece: a wardrobe whose bare combinations exceed ONEPIECE_CAP still yields outerwear-bearing candidates', () => {
  const candidates = generateCandidates(starvedWardrobe(), undefined, 'seed-1');
  // Precondition check: bare onepiece × shoes alone (10 × 8 = 80) exceeds
  // ONEPIECE_CAP (60) — this is what triggered the pre-fix starvation, where
  // the bare loop ran to completion and returned before the outerwear loop
  // ever started, so NO candidate ever carried outwear.
  const withOuterwear = candidates.filter(c => c.slots.outwear !== undefined);
  assert(withOuterwear.length > 0, 'expected at least one outerwear-bearing candidate; got none — starvation regression');
});

Deno.test('onepiece: candidates carrying outwear are tagged layering_stack; bare/accessory-only stay one_two_three', () => {
  const candidates = generateCandidates(starvedWardrobe(), undefined, 'seed-1');
  for (const c of candidates) {
    if (c.slots.outwear !== undefined) {
      assertEquals(c.formula, 'layering_stack');
    } else {
      assertEquals(c.formula, 'one_two_three');
    }
  }
});

Deno.test('onepiece: generation is deterministic for a fixed seed', () => {
  const a = generateCandidates(starvedWardrobe(), undefined, 'seed-1');
  const b = generateCandidates(starvedWardrobe(), undefined, 'seed-1');
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

// A small wardrobe (well under ONEPIECE_CAP) with no outerwear at all — the
// bare-only path must be completely unaffected by the restructuring.
Deno.test('onepiece: no outerwear in the wardrobe → every candidate is bare (no outwear key)', () => {
  const onepieces = [fi('dress-a', 'onepiece'), fi('dress-b', 'onepiece')];
  const shoes = [fi('shoe-a', 'shoes'), fi('shoe-b', 'shoes')];
  const wardrobe = [...onepieces, ...shoes];
  const candidates = generateCandidates(wardrobe, undefined, 'seed-1');
  assert(candidates.length > 0);
  for (const c of candidates) {
    assertEquals(c.slots.outwear, undefined);
    assertEquals(c.slots.accessory, undefined);
    assertEquals(c.formula, 'one_two_three');
  }
});
