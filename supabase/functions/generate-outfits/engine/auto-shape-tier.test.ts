// Deno tests for the "auto shape-tier" feature (010-wardrobe-critic follow-up,
// 2026-08-13): ranking.ts's autoShapeTierDelta — the default-path counterpart
// to shape-goal.test.ts's shapeGoalDelta. shapeGoalDelta only ever fires for
// an EXPLICIT ctx.shapeGoal; autoShapeTierDelta fires exactly when shapeGoal
// is unset/'auto' (the default for nearly every user), applying a graded
// 4-tier preference over resultingBodySilhouette keyed by (ctx.profileGender,
// ctx.bodyMeasurements.body_shape). See ranking.ts's own block comment above
// autoShapeTierDelta for the full design rationale and tier tables.
// Run: deno test --allow-read supabase/functions/generate-outfits/engine/
//
// autoShapeTierDelta itself is not exported (private to ranking.ts, same as
// shapeGoalDelta) — every assertion here goes through the public
// rankCandidates entry point, exactly like shape-goal.test.ts does for its
// sibling delta.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { rankCandidates } from './ranking.ts';
import { isShapeGoalReachable } from './silhouette.ts';
import { FitItem, ItemCategory, EngineContext, OutfitCandidate, GarmentMeasurements } from './types.ts';

// ─── Fixtures (mirrors shape-goal.test.ts) ───────────────────────────────────

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

// A top+bottom+shoes outfit with a given (topFit, bottomFit) — no belt, no
// structured drape, so outfitWaistDefinition is always false here. Lets each
// test steer resultingBodySilhouette purely via VOLUME[fit].
function volumeOutfit(topFit: FitItem['fit'], bottomFit: FitItem['fit']): FitItem[] {
  return [
    fi('top',  'top',    { typeName: 'SHIRT',    primaryColor: 'white', fit: topFit }),
    fi('bot',  'bottom', { typeName: 'TROUSERS', primaryColor: 'navy',  fit: bottomFit }),
    fi('shoe', 'shoes',  { typeName: 'SNEAKERS', primaryColor: 'white' }),
  ];
}
const singleCandidate: OutfitCandidate[] = [
  { slots: { top: 'top', bottom: 'bot', shoes: 'shoe' }, formula: 'one_two_three' },
];

function scoreForVolumes(topFit: FitItem['fit'], bottomFit: FitItem['fit'], ctxOverrides: Partial<EngineContext>): number {
  const items = volumeOutfit(topFit, bottomFit);
  const itemMap = new Map(items.map(i => [i.id, i]));
  return rankCandidates(singleCandidate, itemMap, baseCtx(ctxOverrides))[0].totalScore;
}

// Belted outfit — belt (WAIST_DEFINING signal a) forces outfitWaistDefinition
// true, so resultingBodySilhouette reads 'hourglass' regardless of body_shape
// baseline or profileGender (see silhouette.ts's waistDefined branch, checked
// before the base.rounded/base.waist short-circuits).
const beltedItems = () => [
  fi('top',  'top',       { typeName: 'SHIRT',    primaryColor: 'white', fit: 'regular' }),
  fi('bot',  'bottom',    { typeName: 'TROUSERS', primaryColor: 'navy',  fit: 'regular' }),
  fi('shoe', 'shoes',     { typeName: 'SNEAKERS', primaryColor: 'white' }),
  fi('belt', 'accessory', { typeName: 'BELT',     primaryColor: 'black' }),
];
const beltedCandidates: OutfitCandidate[] = [
  { slots: { top: 'top', bottom: 'bot', shoes: 'shoe', accessory: 'belt' }, formula: 'one_two_three' },
];

function scoreBelted(ctxOverrides: Partial<EngineContext>): number {
  const itemMap = new Map(beltedItems().map(i => [i.id, i]));
  return rankCandidates(beltedCandidates, itemMap, baseCtx(ctxOverrides))[0].totalScore;
}

// ─── 1. ZERO REGRESSION: explicit shapeGoal disables autoShapeTierDelta ──────

Deno.test('ZERO REGRESSION: explicit shapeGoal=\'hourglass\' -> autoShapeTierDelta contributes 0 (profileGender no longer moves totalScore)', () => {
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const noGender = scoreBelted({ bodyMeasurements, shapeGoal: 'hourglass' });
  const woman    = scoreBelted({ bodyMeasurements, shapeGoal: 'hourglass', profileGender: 'WOMAN' });
  const man      = scoreBelted({ bodyMeasurements, shapeGoal: 'hourglass', profileGender: 'MAN' });
  // If autoShapeTierDelta were still active here, WOMAN (tier A for hourglass
  // on a rectangle body) and MAN (tier D) would diverge from each other and
  // from no-profileGender. With an explicit shapeGoal, only the OLD
  // shapeGoalDelta (which ignores profileGender entirely) may apply.
  assertEquals(noGender, woman, 'profileGender must not move totalScore once shapeGoal is explicit');
  assertEquals(noGender, man, 'profileGender must not move totalScore once shapeGoal is explicit');
});

// ─── 2. shapeGoal='natural' returns 0 ────────────────────────────────────────

Deno.test("shapeGoal='natural' -> autoShapeTierDelta contributes 0 (profileGender no longer moves totalScore)", () => {
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const noGender = scoreBelted({ bodyMeasurements, shapeGoal: 'natural' });
  const woman    = scoreBelted({ bodyMeasurements, shapeGoal: 'natural', profileGender: 'WOMAN' });
  const man      = scoreBelted({ bodyMeasurements, shapeGoal: 'natural', profileGender: 'MAN' });
  assertEquals(noGender, woman, "'natural' must opt out of the tier table entirely, for every profileGender");
  assertEquals(noGender, man, "'natural' must opt out of the tier table entirely, for every profileGender");
});

// ─── 3. MAN + rectangle body: inverted-triangle > rectangle > oval ──────────

Deno.test('MAN + rectangle body: inverted-triangle read (tier A) > rectangle read (tier B) > oval read (tier D)', () => {
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  // oversized top + slim bottom -> eTop=6, eBottom=2, diff=4 -> 'inverted-triangle'.
  const invertedTriangle = scoreForVolumes('oversized', 'slim', { bodyMeasurements, profileGender: 'MAN' });
  // regular + regular -> diff=0, avg=3, no waist -> 'rectangle'.
  const rectangle = scoreForVolumes('regular', 'regular', { bodyMeasurements, profileGender: 'MAN' });
  // wide + wide -> diff=0, avg=5 -> 'oval' (avg>=5 branch, checked before waist).
  const oval = scoreForVolumes('wide', 'wide', { bodyMeasurements, profileGender: 'MAN' });
  assert(invertedTriangle > rectangle, `expected inverted-triangle (${invertedTriangle}) > rectangle (${rectangle})`);
  assert(rectangle > oval, `expected rectangle (${rectangle}) > oval (${oval})`);
});

// ─── 4. WOMAN + rectangle body: hourglass > rectangle ────────────────────────

Deno.test('WOMAN + rectangle body: hourglass read (tier A, via belt) > plain rectangle read (tier B)', () => {
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const hourglass = scoreBelted({ bodyMeasurements, profileGender: 'WOMAN' });
  const rectangle = scoreForVolumes('regular', 'regular', { bodyMeasurements, profileGender: 'WOMAN' });
  assert(hourglass > rectangle, `expected hourglass (${hourglass}) > rectangle (${rectangle})`);
});

// ─── 5. MAN vs WOMAN divergence on the SAME outfit ───────────────────────────

Deno.test('MAN vs WOMAN divergence: the identical hourglass-reading outfit is tier A for WOMAN but tier D for MAN (rectangle body)', () => {
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const woman = scoreBelted({ bodyMeasurements, profileGender: 'WOMAN' });
  const man   = scoreBelted({ bodyMeasurements, profileGender: 'MAN' });
  assert(woman > man, `expected WOMAN (${woman}) > MAN (${man}) for the exact same outfit/body_shape`);
});

// ─── 6. undefined profileGender falls back to the NEUTRAL table ─────────────

Deno.test('undefined profileGender falls back to the NEUTRAL table — hourglass read is tier A for a rectangle body', () => {
  const bodyMeasurements = { body_shape: 'rectangle' as const };
  const auto = scoreBelted({ bodyMeasurements }); // no profileGender at all
  const naturalBaseline = scoreBelted({ bodyMeasurements, shapeGoal: 'natural' }); // 0 contribution, always
  assert(auto > naturalBaseline,
    `expected auto (${auto}) > natural baseline (${naturalBaseline}) — hourglass must be tier A (+bonus) in the neutral table`);
});

// ─── 7. Unreachable guard ─────────────────────────────────────────────────────
// Design note: 'rectangle' is unreachable for an 'apple' body_shape (and for
// 'hourglass') per isShapeGoalReachable — base.rounded/base.waist always win
// the balanced-read branch before 'rectangle' can be returned (see
// silhouette.ts). Checked here directly against isShapeGoalReachable rather
// than assumed. But EVERY table row in ranking.ts pairs its tier-B 'rectangle'
// entry with an ALWAYS-reachable tier-A shape (hourglass/inverted-triangle/
// triangle can always be produced, for any body_shape — only 'rectangle' is
// ever structurally unreachable). So for every current (gender, body_shape)
// row, at least one of tier A/B is reachable, and the guard never actually
// zeroes anything out. This test proves that for the MAN + apple row
// specifically (tier A = inverted-triangle, tier B = rectangle): rectangle is
// confirmed unreachable, but the tier-A bonus still applies in full — the
// guard is a no-op here, not a blocker.
Deno.test('unreachable-goal guard is a NO-OP for MAN + apple body: tier-B rectangle is unreachable, but tier-A inverted-triangle still earns its bonus', () => {
  assertEquals(isShapeGoalReachable('apple', 'rectangle'), false,
    'precondition: rectangle must be unreachable for an apple body baseline');
  assert(isShapeGoalReachable('apple', 'inverted-triangle'),
    'precondition: inverted-triangle must be reachable for an apple body baseline');

  const bodyMeasurements = { body_shape: 'apple' as const };
  // oversized top + slim bottom -> reads 'inverted-triangle' regardless of the
  // apple baseline's own rounded/waist flags (diff>=2 branch short-circuits
  // before those are ever consulted).
  const auto = scoreForVolumes('oversized', 'slim', { bodyMeasurements, profileGender: 'MAN' });
  const naturalBaseline = scoreForVolumes('oversized', 'slim', { bodyMeasurements, profileGender: 'MAN', shapeGoal: 'natural' });
  assert(auto > naturalBaseline,
    `expected auto (${auto}) > natural baseline (${naturalBaseline}) — the guard must not zero the tier-A bonus just because tier B (rectangle) is unreachable for this body_shape`);
});
