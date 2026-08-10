// Deno tests for the "shape goal" feature (010-wardrobe-critic follow-up,
// 2026-08-10): style_profiles.shape_goal, threaded onto ctx.shapeGoal and
// consumed by (a) engine/silhouette.ts's resolveTargetSilhouette cascade
// (covered in silhouette.test.ts) and (b) ranking.ts's shapeGoalDelta
// (covered here — this is the ranking-time nudge that rewards outfits whose
// resultingBodySilhouette actually matches the goal).
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees:
//   - shapeGoal undefined/'auto'/'natural' -> shapeGoalDelta contributes 0,
//     totalScore is byte-for-byte identical to a run with no shapeGoal at all.
//   - a specific shapeGoal that the outfit's resultingBodySilhouette MATCHES
//     raises totalScore relative to the same outfit with shapeGoal unset.
//   - a specific shapeGoal that the outfit's resultingBodySilhouette MISSES
//     lowers totalScore relative to the same outfit with shapeGoal unset.
//   - shapeGoalDelta never touches ctx.bodyMeasurements.body_shape itself.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { rankCandidates } from './ranking.ts';
import { FitItem, ItemCategory, EngineContext, OutfitCandidate, GarmentMeasurements } from './types.ts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    typeName?: string; fit?: FitItem['fit']; primaryColor?: string;
    garmentMeasurements?: GarmentMeasurements; provenanceFit?: boolean;
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName: opts.typeName ?? 'TEE',
    colorProfile: {
      primaryColor: (opts.primaryColor ?? 'navy') as FitItem['colorProfile']['primaryColor'],
      colorLightness: 'dark', colorSaturation: 'muted', sat: 20, lum: 40, undertone: 'cool',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    garmentMeasurements: opts.garmentMeasurements,
    styleTags: [],
    fit: opts.fit ?? 'regular',
    warmth: 2,
    formality: 2.5,
    statementStrength: 0.5,
    provenance: { fit: opts.provenanceFit ?? false, material: false, pattern: false, warmthSeason: false },
  };
}

function baseCtx(overrides: Partial<EngineContext> = {}): EngineContext {
  return { bodyMeasurements: {}, styleProfile: { selectedStyles: [] }, colorPreferences: [], ...overrides };
}

// Rectangle body + a belt -> resultingBodySilhouette == 'hourglass' (see
// silhouette.test.ts's equivalent fixture/assertion).
const outfitItems = () => [
  fi('top',  'top',       { typeName: 'SHIRT',    primaryColor: 'white', fit: 'regular' }),
  fi('bot',  'bottom',    { typeName: 'TROUSERS', primaryColor: 'navy',  fit: 'regular' }),
  fi('shoe', 'shoes',     { typeName: 'SNEAKERS', primaryColor: 'white' }),
  fi('belt', 'accessory', { typeName: 'BELT',     primaryColor: 'black' }),
];
const candidates: OutfitCandidate[] = [
  { slots: { top: 'top', bottom: 'bot', shoes: 'shoe', accessory: 'belt' }, formula: 'one_two_three' },
];

// ─── zero-regression: auto/natural/undefined are no-ops ─────────────────────

Deno.test('shapeGoal undefined -> totalScore identical to a run with shapeGoal explicitly omitted', () => {
  const items = outfitItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const a = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements }));
  const b = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: undefined }));
  assertEquals(a[0].totalScore, b[0].totalScore);
});

Deno.test("shapeGoal='auto' contributes 0 — totalScore identical to shapeGoal unset", () => {
  const items = outfitItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const unset = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements }));
  const auto = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'auto' }));
  assertEquals(unset[0].totalScore, auto[0].totalScore);
});

Deno.test("shapeGoal='natural' contributes 0 — totalScore identical to shapeGoal unset", () => {
  const items = outfitItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const unset = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements }));
  const natural = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'natural' }));
  assertEquals(unset[0].totalScore, natural[0].totalScore);
});

// ─── shapeGoal match/miss deltas ──────────────────────────────────────────────

Deno.test('shapeGoal matching the outfit\'s resultingBodySilhouette raises totalScore', () => {
  // Fixture's belt -> resultingBodySilhouette == 'hourglass' for a rectangle body.
  const items = outfitItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const off = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements }));
  const matched = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'hourglass' }));
  assert(matched[0].totalScore > off[0].totalScore,
    `expected matched (${matched[0].totalScore}) > unset (${off[0].totalScore})`);
});

Deno.test('shapeGoal missing the outfit\'s resultingBodySilhouette lowers totalScore', () => {
  const items = outfitItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const off = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements }));
  // The fixture resolves to 'hourglass' — 'triangle' is a deliberate miss.
  const missed = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'triangle' }));
  assert(missed[0].totalScore < off[0].totalScore,
    `expected missed (${missed[0].totalScore}) < unset (${off[0].totalScore})`);
});

// ─── shapeGoal must NOT touch body_shape itself ──────────────────────────────

Deno.test('shapeGoal leaves ctx.bodyMeasurements.body_shape untouched', () => {
  const items = outfitItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'rectangle' as const }, shapeGoal: 'hourglass' });
  rankCandidates(candidates, itemMap, ctx);
  assertEquals(ctx.bodyMeasurements.body_shape, 'rectangle');
});
