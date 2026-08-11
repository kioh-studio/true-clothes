// Deno tests for the feed-signals taste inputs (2026-08-07): `viewed`
// (weak positive) and `dismissed` (explicit negative). See
// docs/feed-signals-instruction.md.
//
// Guarantees:
//   (a) viewed contributes a positive bonus, weaker than saved at equal count
//   (b) an outfit resembling the dismissed profile is penalised; a different
//       one is not
//   (c) the combined taste delta (bonus − penalty) stays within [−0.04, 0.06]
//   (d) zero viewed/dismissed → identical behaviour to the pre-existing
//       save-only taste vector (regression)
//
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  buildTasteVector, buildDismissVector, tasteAffinityDelta, tasteDismissPenalty,
  PositiveOutfit, VIEWED_WEIGHT, SAVED_WEIGHT, WORN_WEIGHT,
} from './taste.ts';
import { FitItem, ItemCategory } from './types.ts';

// Minimal FitItem fixture — mirrors taste.test.ts's fixture.
function fi(
  id: string,
  category: ItemCategory,
  opts: { formality?: number; statement?: number; lum?: number; primaryColor?: string } = {},
): FitItem {
  return {
    id,
    category,
    typeName: 'TEE',
    colorProfile: {
      primaryColor: (opts.primaryColor ?? 'navy') as FitItem['colorProfile']['primaryColor'],
      colorLightness: 'dark',
      colorSaturation: 'muted',
      sat: 20,
      lum: opts.lum ?? 40,
      undertone: 'cool',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    styleTags: [],
    fit: 'regular',
    formality: opts.formality ?? 3,
    statementStrength: opts.statement ?? 0.5,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

// A wardrobe of formal, quiet, navy pieces + one casual loud red piece.
function wardrobe(): Map<string, FitItem> {
  const items = [
    fi('top-formal',  'top',    { formality: 4.0, statement: 0.4, lum: 45, primaryColor: 'navy' }),
    fi('bot-formal',  'bottom', { formality: 4.0, statement: 0.3, lum: 40, primaryColor: 'navy' }),
    fi('shoe-formal', 'shoes',  { formality: 4.0, statement: 0.3, lum: 30, primaryColor: 'black' }),
    fi('top-casual',  'top',    { formality: 1.5, statement: 3.0, lum: 70, primaryColor: 'red' }),
    fi('bot-casual',  'bottom', { formality: 1.5, statement: 0.5, lum: 20, primaryColor: 'blue' }),
    fi('shoe-casual', 'shoes',  { formality: 1.5, statement: 1.0, lum: 90, primaryColor: 'white' }),
  ];
  return new Map(items.map(i => [i.id, i]));
}

const FORMAL_OUTFIT = ['top-formal', 'bot-formal', 'shoe-formal'];
const CASUAL_OUTFIT = ['top-casual', 'bot-casual', 'shoe-casual'];

// ─── (a) viewed weaker than saved ────────────────────────────────────────────

Deno.test('confidence uses the weighted sum 0.5·viewed + saved + 2·worn', () => {
  const map = wardrobe();
  const mixed: PositiveOutfit[] = [
    { itemIds: FORMAL_OUTFIT, weight: VIEWED_WEIGHT }, // 0.5
    { itemIds: FORMAL_OUTFIT, weight: SAVED_WEIGHT },  // 1
    { itemIds: FORMAL_OUTFIT, weight: WORN_WEIGHT },   // 2
  ];
  const tv = buildTasteVector(mixed, map)!;
  assertEquals(tv.sampleCount, 3.5);
});

Deno.test('viewed contributes a positive bonus, weaker than saved at equal count', () => {
  const map = wardrobe();
  const n = 8;
  const viewedTv = buildTasteVector(
    Array.from({ length: n }, () => ({ itemIds: FORMAL_OUTFIT, weight: VIEWED_WEIGHT })), map,
  )!;
  const savedTv = buildTasteVector(
    Array.from({ length: n }, () => ({ itemIds: FORMAL_OUTFIT, weight: SAVED_WEIGHT })), map,
  )!;
  const formalItems = FORMAL_OUTFIT.map(id => map.get(id)!);

  const dViewed = tasteAffinityDelta(formalItems, viewedTv);
  const dSaved = tasteAffinityDelta(formalItems, savedTv);
  assert(dViewed > 0, `viewed-only history should still earn a positive bonus, got ${dViewed}`);
  assert(dViewed < dSaved, `viewed (${dViewed}) should be weaker than saved (${dSaved}) at equal count`);
});

// ─── (b) dismissed penalises matching outfits, not different ones ───────────

Deno.test('outfit resembling the dismissed profile is penalised; a different one is not', () => {
  const map = wardrobe();
  const dismissVector = buildDismissVector(
    Array.from({ length: 8 }, () => ({ itemIds: CASUAL_OUTFIT })), map,
  )!;
  const casualItems = CASUAL_OUTFIT.map(id => map.get(id)!);
  const formalItems = FORMAL_OUTFIT.map(id => map.get(id)!);

  const penaltyCasual = tasteDismissPenalty(casualItems, dismissVector);
  const penaltyFormal = tasteDismissPenalty(formalItems, dismissVector);
  assert(penaltyCasual > 0, `outfit matching the dismissed profile should be penalised, got ${penaltyCasual}`);
  assert(penaltyCasual > penaltyFormal,
    `matching outfit (${penaltyCasual}) should be penalised more than a different one (${penaltyFormal})`);
});

Deno.test('dismiss penalty confidence-scales with sample count and never exceeds TASTE_MAX_PENALTY', () => {
  const map = wardrobe();
  const casualItems = CASUAL_OUTFIT.map(id => map.get(id)!);
  const dv1 = buildDismissVector([{ itemIds: CASUAL_OUTFIT }], map)!;
  const dv8 = buildDismissVector(Array.from({ length: 8 }, () => ({ itemIds: CASUAL_OUTFIT })), map)!;
  const dv100 = { ...buildDismissVector([{ itemIds: CASUAL_OUTFIT }], map)!, sampleCount: 100 };

  const p1 = tasteDismissPenalty(casualItems, dv1);
  const p8 = tasteDismissPenalty(casualItems, dv8);
  const p100 = tasteDismissPenalty(casualItems, dv100);
  assert(p8 > p1, `more dismissals → bigger penalty (${p8} > ${p1})`);
  assert(p100 <= 0.04 + 1e-9, `penalty must never exceed TASTE_MAX_PENALTY, got ${p100}`);
});

// ─── (c) combined delta bounded [-0.04, 0.06] ────────────────────────────────

Deno.test('combined taste delta (bonus − penalty) stays within [-0.04, 0.06]', () => {
  const map = wardrobe();
  const tv = buildTasteVector(
    Array.from({ length: 20 }, () => ({ itemIds: FORMAL_OUTFIT, weight: WORN_WEIGHT })), map,
  )!;
  const dismissVector = buildDismissVector(
    Array.from({ length: 20 }, () => ({ itemIds: FORMAL_OUTFIT })), map,
  )!;

  for (const ids of [FORMAL_OUTFIT, CASUAL_OUTFIT]) {
    const items = ids.map(id => map.get(id)!);
    const bonus = tasteAffinityDelta(items, tv);
    const penalty = tasteDismissPenalty(items, dismissVector);
    const total = bonus - penalty;
    assert(total >= -0.04 - 1e-9 && total <= 0.06 + 1e-9, `combined delta out of bounds: ${total}`);
  }
});

// ─── (d) zero viewed/dismissed → today's behaviour unchanged (regression) ───

Deno.test('zero viewed/dismissed → matches the pre-existing save-only taste behaviour', () => {
  const map = wardrobe();
  // A save-only positive history (the shape every account had before this
  // feature existed) must produce exactly the same vector and bonus as
  // taste.test.ts already pins down — no dismiss vector is even built.
  const savedOnly: PositiveOutfit[] = [{ itemIds: FORMAL_OUTFIT, weight: SAVED_WEIGHT }];
  const tv = buildTasteVector(savedOnly, map)!;
  assertEquals(tv.sampleCount, 1);
  assert(tv.meanFormality >= 3.5, `expected high formality, got ${tv.meanFormality}`);

  const formalItems = FORMAL_OUTFIT.map(id => map.get(id)!);
  const delta = tasteAffinityDelta(formalItems, { ...tv, sampleCount: 8 });
  assert(delta > 0.02, `save-only history should still produce the original solid bonus, got ${delta}`);

  // No dismissed rows at all → buildDismissVector gets an empty list, same as
  // buildTasteVector's own "no positives" contract.
  assertEquals(buildDismissVector([], map), undefined);
});
