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
//     always, for every one of the three states.
//   - a specific shapeGoal that the outfit's resultingBodySilhouette MATCHES
//     raises totalScore relative to the same outfit with shapeGoal unset.
//   - a specific shapeGoal that the outfit's resultingBodySilhouette MISSES
//     lowers totalScore relative to the same outfit with shapeGoal unset.
//   - shapeGoalDelta never touches ctx.bodyMeasurements.body_shape itself.
//
// 2026-08-13 update (auto shape-tier, ranking.ts autoShapeTierDelta): unset
// and 'auto' are NO LONGER byte-for-byte identical to 'natural'. Unset/'auto'
// now additionally run through autoShapeTierDelta, a SEPARATE graded nudge
// that fires exactly when shapeGoalDelta is 0 for that reason (see its own
// block comment in ranking.ts). 'natural' still returns 0 from BOTH deltas —
// it is the one state that opts all the way out of any shape preference,
// which now makes it strictly LOWER than unset/'auto' whenever the outfit
// would have earned a tier bonus. Unset and 'auto' remain identical to EACH
// OTHER (both are autoShapeTierDelta's own "on" condition).

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

Deno.test("shapeGoal='natural' contributes 0 from shapeGoalDelta (the old shape-goal mechanism)", () => {
  // shapeGoalDelta itself is still an unconditional 0 for 'natural' — proven
  // indirectly: with a body_shape/profileGender combination where the auto
  // shape-tier delta ALSO reads tier C (neutral, 0) for this outfit's
  // resultingBodySilhouette, 'natural' and unset must be byte-for-byte equal,
  // same as before this feature. hourglass body_shape + this fixture's belted
  // outfit reads 'hourglass' via base.waist regardless of the belt, which is
  // tier C ("reads as the user's own shape") in every auto-shape table for an
  // hourglass body_shape — see AUTO_SHAPE_WOMAN/MAN/NEUTRAL_TABLE's hourglass
  // rows in ranking.ts (A: ['hourglass'] for WOMAN/NEUTRAL is actually tier A,
  // not C — use MAN's table instead, where hourglass body_shape's C-tier IS
  // 'hourglass').
  const items = outfitItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'hourglass' as const };
  const unset = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, profileGender: 'MAN' }));
  const natural = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, profileGender: 'MAN', shapeGoal: 'natural' }));
  assertEquals(unset[0].totalScore, natural[0].totalScore);
});

// 2026-08-13: 'natural' no longer matches unset/'auto' in the GENERAL case —
// see the auto-shape-tier.test.ts file for the dedicated coverage of
// autoShapeTierDelta. This test documents the new divergence for a fixture
// that DOES earn a tier bonus under unset/'auto' (rectangle body_shape, no
// profileGender -> NEUTRAL table, belted outfit reads 'hourglass' -> tier A).
Deno.test("shapeGoal='natural' now scores LOWER than unset/'auto' when the outfit would earn an auto shape-tier bonus (2026-08-13 divergence)", () => {
  const items = outfitItems(); // belt -> resultingBodySilhouette == 'hourglass' -> tier A for a rectangle body's NEUTRAL table
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const unset = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements }));
  const natural = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'natural' }));
  assert(natural[0].totalScore < unset[0].totalScore,
    `expected natural (${natural[0].totalScore}) < unset (${unset[0].totalScore}) — natural opts out of the auto tier-A bonus unset now earns`);
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

// ─── unreachable shapeGoal -> no-op, not a standing penalty (2026-08-11 fix) ──
// resultingBodySilhouette can never read 'rectangle' for an 'apple' baseline
// (base.rounded always wins the balanced-read branch — see
// isShapeGoalReachable's comment in silhouette.ts) or for an 'hourglass'
// baseline (base.waist wins it instead). Before this fix, those users took
// SHAPE_GOAL_MISS_PENALTY on every outfit forever, for a goal the engine
// itself made unreachable. shapeGoalDelta must now neutralise to exactly 0
// instead — same totalScore as shapeGoal unset — rather than chasing the
// silhouette semantics.

// No belt/structural piece -> resultingBodySilhouette('apple', these items) ==
// 'oval' (base.rounded), confirmed in silhouette.test.ts. 'rectangle' would
// previously have been a miss (-0.05) on every single card.
const plainItems = () => [
  fi('top', 'top',    { typeName: 'SHIRT',    primaryColor: 'white', fit: 'regular' }),
  fi('bot', 'bottom', { typeName: 'TROUSERS', primaryColor: 'navy',  fit: 'regular' }),
  fi('shoe', 'shoes', { typeName: 'SNEAKERS', primaryColor: 'white' }),
];
const plainCandidates: OutfitCandidate[] = [
  { slots: { top: 'top', bottom: 'bot', shoes: 'shoe' }, formula: 'one_two_three' },
];

// 2026-08-13: these two baselines switched from unset to shapeGoal='natural'.
// Unset now additionally runs through autoShapeTierDelta (a SEPARATE
// mechanism — see ranking.ts), so it's no longer a clean baseline for
// isolating shapeGoalDelta alone (plainItems on a 'hourglass' body_shape, for
// instance, earns a real +AUTO_SHAPE_FLATTER auto-tier bonus under unset).
// 'natural' returns 0 from BOTH deltas unconditionally, which is what makes it
// the correct "nothing at all should move" baseline for these two cases.

Deno.test("shapeGoal='rectangle' + body_shape='apple' (unreachable pair) -> delta is exactly 0, no permanent penalty", () => {
  const items = plainItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'apple' as const };
  const baseline = rankCandidates(plainCandidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'natural' }));
  const goalSet = rankCandidates(plainCandidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'rectangle' }));
  assertEquals(goalSet[0].totalScore, baseline[0].totalScore,
    'unreachable shapeGoal must not move totalScore at all (neither bonus nor penalty)');
});

Deno.test("shapeGoal='rectangle' + body_shape='hourglass' (unreachable pair) -> delta is exactly 0, no permanent penalty", () => {
  const items = plainItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'hourglass' as const };
  const baseline = rankCandidates(plainCandidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'natural' }));
  const goalSet = rankCandidates(plainCandidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'rectangle' }));
  assertEquals(goalSet[0].totalScore, baseline[0].totalScore,
    'unreachable shapeGoal must not move totalScore at all (neither bonus nor penalty)');
});

// ─── reachable shapeGoal on the SAME 'apple' baseline still bites (mechanism not disabled) ──
// Proves the unreachable-guard above is scoped to the specific unreachable
// pair, not a blanket bypass: 'apple' can still earn a bonus (goal='hourglass',
// via a belt) and still take a penalty (goal='triangle', missed) exactly as
// before the fix.

Deno.test("shapeGoal='hourglass' + body_shape='apple' (reachable, matched via belt) still raises totalScore", () => {
  const items = outfitItems(); // includes a belt -> resultingBodySilhouette == 'hourglass'
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'apple' as const };
  const off = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements }));
  const matched = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'hourglass' }));
  assert(matched[0].totalScore > off[0].totalScore,
    `expected matched (${matched[0].totalScore}) > unset (${off[0].totalScore})`);
});

Deno.test("shapeGoal='triangle' + body_shape='apple' (reachable, missed) still lowers totalScore", () => {
  const items = outfitItems(); // belt -> resultingBodySilhouette == 'hourglass', a deliberate miss for 'triangle'
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_shape: 'apple' as const };
  const off = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements }));
  const missed = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, shapeGoal: 'triangle' }));
  assert(missed[0].totalScore < off[0].totalScore,
    `expected missed (${missed[0].totalScore}) < unset (${off[0].totalScore})`);
});
