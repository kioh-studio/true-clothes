// Deno test suite for weather-season derivation + seasonal colour bias.
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees:
//   - seasonForMonth maps calendar months to meteorological seasons per hemisphere
//   - scoreColorHarmony nudges LIGHT/BRIGHT colours up in summer, DARK colours up
//     in winter (small effect), and leaves neutral-undertone staples unchanged
//   - Bug-fix tests: easeScore girth vs length, bodyShapeMultiplier delta, fall/autumn alias
//   - Bug 1: numericSim clamped to [0,1]
//   - Bug 3 (div): scoreOutfitFit averages only measured items
//   - Bug 4: diversification greedy order is deterministic (no re-sort)

import { assert, assertEquals, assertAlmostEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  scoreColorHarmony, seasonForMonth, hemisphereForCountry, resolveHemisphere,
  scoreOutfitFit, bodyShapeMultiplier, bodyShapeAdjustment, attributeSimilarity, scoreItemFit,
  tone12QualityBonus, TONE12_AVOID, preferredFitDelta, softKnee,
} from './scoring.ts';
import { toFitItem } from './enrichment.ts';
import { ClothingItemRow, FitItem, BodyMeasurements, GarmentMeasurements, StyleAttributes, PreferredFit } from './types.ts';

function tee(color: string): FitItem {
  const row: ClothingItemRow = { id: color, type: 'TEE', name: color, color, material: 'Cotton' };
  return toFitItem(row);
}

// ─── seasonForMonth ──────────────────────────────────────────────────────────

Deno.test('seasonForMonth — northern hemisphere', () => {
  assertEquals(seasonForMonth(0, 'north'), 'winter');  // Jan
  assertEquals(seasonForMonth(3, 'north'), 'spring');  // Apr
  assertEquals(seasonForMonth(6, 'north'), 'summer');  // Jul
  assertEquals(seasonForMonth(9, 'north'), 'fall');    // Oct
  assertEquals(seasonForMonth(11, 'north'), 'winter'); // Dec
});

Deno.test('seasonForMonth — southern hemisphere is the opposite season', () => {
  assertEquals(seasonForMonth(0, 'south'), 'summer'); // Jan
  assertEquals(seasonForMonth(6, 'south'), 'winter'); // Jul
  assertEquals(seasonForMonth(3, 'south'), 'fall');   // Apr
});

Deno.test('hemisphereForCountry — Northern default + Southern set', () => {
  assertEquals(hemisphereForCountry('Vietnam'), 'north');
  assertEquals(hemisphereForCountry(undefined), 'north');
  assertEquals(hemisphereForCountry(''), 'north');
  assertEquals(hemisphereForCountry('United States'), 'north');
  assertEquals(hemisphereForCountry('Australia'), 'south');
  assertEquals(hemisphereForCountry('Republic of South Africa'), 'south');
  assertEquals(hemisphereForCountry('new zealand'), 'south');
  assertEquals(hemisphereForCountry('Brazil'), 'south');
});

Deno.test('resolveHemisphere — ISO code wins, locale-proof; name is fallback', () => {
  // ISO code is authoritative even when the name is localised/missing.
  assertEquals(resolveHemisphere('BR', 'Brasil'), 'south');   // Portuguese name would miss the map
  assertEquals(resolveHemisphere('br', undefined), 'south');  // case-insensitive
  assertEquals(resolveHemisphere('VN', 'Việt Nam'), 'north');
  assertEquals(resolveHemisphere('AU', null), 'south');
  // No code → fall back to the country-name map.
  assertEquals(resolveHemisphere(null, 'Australia'), 'south');
  assertEquals(resolveHemisphere('', 'Vietnam'), 'north');
  assertEquals(resolveHemisphere(undefined, undefined), 'north');
});

// ─── Seasonal colour bias (same item, compare across seasons) ────────────────

Deno.test('summer favours a light + bright colour over winter', () => {
  const items = [tee('Yellow')]; // light, vivid, warm
  const summer = scoreColorHarmony(items, [], undefined, 'summer');
  const winter = scoreColorHarmony(items, [], undefined, 'winter');
  assert(summer > winter, `expected summer(${summer}) > winter(${winter}) for Yellow`);
});

Deno.test('winter favours a dark colour over summer', () => {
  const items = [tee('Forest')]; // dark, muted, cool
  const winter = scoreColorHarmony(items, [], undefined, 'winter');
  const summer = scoreColorHarmony(items, [], undefined, 'summer');
  assert(winter > summer, `expected winter(${winter}) > summer(${summer}) for Forest`);
});

Deno.test('neutral-undertone staples are season-agnostic (Black unchanged)', () => {
  const items = [tee('Black')]; // neutral undertone → exempt
  const summer = scoreColorHarmony(items, [], undefined, 'summer');
  const winter = scoreColorHarmony(items, [], undefined, 'winter');
  assertEquals(summer, winter);
});

Deno.test('no weatherSeason → base score unchanged', () => {
  const items = [tee('Yellow')];
  const withSeason = scoreColorHarmony(items, [], undefined, 'summer');
  const without = scoreColorHarmony(items, [], undefined);
  assert(withSeason !== without, 'summer bias should differ from no-season base');
});

// ─── 12-tone quality bonus (tone12QualityBonus / scoreColorHarmony colorTone12) ──

Deno.test('bright_winter scores a saturated/clear item higher than soft_summer (same items)', () => {
  const items = [tee('Red')]; // vivid, sat=85 — a clear/saturated colour
  const bright = scoreColorHarmony(items, [], undefined, undefined, undefined, 'bright_winter');
  const soft = scoreColorHarmony(items, [], undefined, undefined, undefined, 'soft_summer');
  assert(bright > soft, `expected bright_winter(${bright}) > soft_summer(${soft}) on a saturated item`);
});

Deno.test('light_spring beats deep_autumn on a light-coloured item set, and reverses on a deep set', () => {
  const lightItems = [tee('Ivory')]; // lum=95 — light
  const deepItems = [tee('Charcoal')]; // lum=28 — deep

  const lightSpringOnLight = scoreColorHarmony(lightItems, [], undefined, undefined, undefined, 'light_spring');
  const deepAutumnOnLight = scoreColorHarmony(lightItems, [], undefined, undefined, undefined, 'deep_autumn');
  assert(lightSpringOnLight > deepAutumnOnLight,
    `on a light item, expected light_spring(${lightSpringOnLight}) > deep_autumn(${deepAutumnOnLight})`);

  const lightSpringOnDeep = scoreColorHarmony(deepItems, [], undefined, undefined, undefined, 'light_spring');
  const deepAutumnOnDeep = scoreColorHarmony(deepItems, [], undefined, undefined, undefined, 'deep_autumn');
  assert(deepAutumnOnDeep > lightSpringOnDeep,
    `on a deep item, expected deep_autumn(${deepAutumnOnDeep}) > light_spring(${lightSpringOnDeep})`);
});

Deno.test("true_* colorTone12 is a no-op — returns exactly the no-tone12 score", () => {
  const items = [tee('Blue')];
  const withTrue = scoreColorHarmony(items, [], undefined, undefined, undefined, 'true_summer');
  const without = scoreColorHarmony(items, [], undefined, undefined, undefined, undefined);
  assertAlmostEquals(withTrue, without, 1e-10, `true_summer should not change the score: ${withTrue} vs ${without}`);
  assertEquals(tone12QualityBonus(items.map(i => i.colorProfile), 'true_winter'), 0);
});

Deno.test('unknown/malformed colorTone12 string → no change', () => {
  const items = [tee('Blue')];
  const withUnknown = scoreColorHarmony(items, [], undefined, undefined, undefined, 'not_a_real_tone');
  const without = scoreColorHarmony(items, [], undefined, undefined, undefined, undefined);
  assertAlmostEquals(withUnknown, without, 1e-10, `unknown tone should not change the score: ${withUnknown} vs ${without}`);
  assertEquals(tone12QualityBonus(items.map(i => i.colorProfile), 'garbage'), 0);
  assertEquals(tone12QualityBonus(items.map(i => i.colorProfile), ''), 0);
});

Deno.test('tone12QualityBonus — magnitude stays within the same band as the other colour bonuses (±0.08)', () => {
  const extremeLight = [tee('White')].map(i => i.colorProfile);   // lum=100
  const extremeDeep = [tee('Black')].map(i => i.colorProfile);    // lum=5
  for (const [quality, profiles] of [
    ['light', extremeLight], ['deep', extremeDeep],
    ['bright', extremeLight], ['soft', extremeDeep],
  ] as const) {
    const bonus = tone12QualityBonus(profiles, `${quality}_spring`);
    assert(Math.abs(bonus) <= 0.08 + 1e-9, `${quality} bonus ${bonus} exceeded ±0.08`);
  }
});

// ─── TONE12_AVOID penalty (dedupe vs parent-season SEASON_FLATTERING.avoid) ──

Deno.test('deep_winter + camel item scores lower with tone12 than without', () => {
  // 'camel' is on deep_winter's skip-list AND already on winter's parent
  // SEASON_FLATTERING.avoid list — the new avoid penalty is deduped away, so
  // any delta must come from tone12QualityBonus alone ('deep' rewards low lum;
  // camel's lum=60 is mildly light, so the bonus is slightly negative here).
  const items = [tee('Camel')];
  const withTone12 = scoreColorHarmony(items, [], undefined, undefined, undefined, 'deep_winter');
  const without = scoreColorHarmony(items, [], undefined, undefined, undefined, undefined);
  assert(withTone12 < without, `expected deep_winter(${withTone12}) < no-tone12(${without}) for a camel item`);
});

Deno.test('a colour in BOTH parent avoid and tone12 avoid is penalised once, not twice (delta == qualityBonus only)', () => {
  assert(TONE12_AVOID.deep_winter.includes('camel'), 'fixture assumption: camel is on deep_winter\'s skip-list');
  const items = [tee('Camel')];
  const withTone12 = scoreColorHarmony(items, [], undefined, undefined, undefined, 'deep_winter');
  const without = scoreColorHarmony(items, [], undefined, undefined, undefined, undefined);
  const qualityBonusOnly = tone12QualityBonus(items.map(i => i.colorProfile), 'deep_winter');
  assertAlmostEquals(withTone12 - without, qualityBonusOnly, 1e-9,
    `expected the only delta to be tone12QualityBonus(${qualityBonusOnly}), got ${withTone12 - without}`);
});

Deno.test('a colour on the tone12 skip-list but NOT on the parent-season avoid list gets the extra penalty', () => {
  // 'olive' is on bright_winter's skip-list but NOT on winter's parent
  // SEASON_FLATTERING.avoid (['orange','brown','beige','camel']) — so it must
  // clear the dedupe and receive the additional TONE12_AVOID penalty on top
  // of whatever tone12QualityBonus contributes.
  assert(TONE12_AVOID.bright_winter.includes('olive'));
  const items = [tee('Olive')];
  const withTone12 = scoreColorHarmony(items, [], undefined, undefined, undefined, 'bright_winter');
  const without = scoreColorHarmony(items, [], undefined, undefined, undefined, undefined);
  const qualityBonusOnly = tone12QualityBonus(items.map(i => i.colorProfile), 'bright_winter');
  assert(withTone12 - without < qualityBonusOnly - 1e-9,
    `expected an extra avoid penalty beyond qualityBonus(${qualityBonusOnly}), got delta=${withTone12 - without}`);
});

Deno.test('non-avoid item (Blue) is unchanged by the new avoid penalty', () => {
  // 'blue' is not on true_summer's skip-list at all, and true_* has no
  // qualityBonus (undertone-only) — so tone12 must be a complete no-op here.
  assert(!TONE12_AVOID.true_summer.includes('blue'));
  const items = [tee('Blue')];
  const withTone12 = scoreColorHarmony(items, [], undefined, undefined, undefined, 'true_summer');
  const without = scoreColorHarmony(items, [], undefined, undefined, undefined, undefined);
  assertAlmostEquals(withTone12, without, 1e-10, `expected no change for a non-avoid item under true_*, got ${withTone12} vs ${without}`);
});

// ─── Bug 1: bodyShapeMultiplier is now an additive delta ─────────────────────

function makeFitItem(id: string, category: FitItem['category'], fit: FitItem['fit'], garmentMeasurements?: GarmentMeasurements): FitItem {
  const row: ClothingItemRow = { id, type: category === 'bottom' ? 'JEANS' : category === 'outwear' ? 'JACKET' : 'TEE', name: id, color: 'Black', material: 'Cotton' };
  const base = toFitItem(row);
  return { ...base, category, fit, garmentMeasurements };
}

Deno.test('bodyShapeMultiplier — delta is in [-0.10, +0.10]', () => {
  const shapes: Array<FitItem['fit']> = ['slim', 'regular', 'relaxed', 'wide', 'oversized'];
  const bodyShapes = ['triangle', 'inverted_triangle', 'hourglass', 'apple', 'rectangle'] as const;
  for (const bodyShape of bodyShapes) {
    for (const fit of shapes) {
      const items = [makeFitItem('top1', 'top', fit), makeFitItem('bot1', 'bottom', fit)];
      const delta = bodyShapeMultiplier(items, bodyShape);
      assert(delta >= -0.10 && delta <= 0.10, `delta ${delta} out of range for shape=${bodyShape} fit=${fit}`);
    }
  }
});

Deno.test('bodyShapeMultiplier — apple shape: loose top scores higher delta than slim top', () => {
  const looseTop = [makeFitItem('top', 'top', 'relaxed'), makeFitItem('bot', 'bottom', 'regular')];
  const slimTop  = [makeFitItem('top', 'top', 'slim'),    makeFitItem('bot', 'bottom', 'regular')];
  const deltaLoose = bodyShapeMultiplier(looseTop, 'apple');
  const deltaSlim  = bodyShapeMultiplier(slimTop, 'apple');
  assert(deltaLoose > deltaSlim, `expected loose(${deltaLoose}) > slim(${deltaSlim}) for apple shape`);
});

// ─── bodyShapeAdjustment: specificity-conditioned, amplified delta (2026-07-06) ──

Deno.test('bodyShapeAdjustment — clamped to ±0.32 across all shape/fit combos', () => {
  const fits: Array<FitItem['fit']> = ['slim', 'regular', 'relaxed', 'wide', 'oversized'];
  const bodyShapes = ['triangle', 'inverted_triangle', 'hourglass', 'apple', 'rectangle'] as const;
  for (const bodyShape of bodyShapes) {
    for (const fit of fits) {
      const items = [makeFitItem('top1', 'top', fit), makeFitItem('bot1', 'bottom', fit)];
      const adj = bodyShapeAdjustment(items, bodyShape);
      assert(adj >= -0.32 && adj <= 0.32, `adj ${adj} out of range for shape=${bodyShape} fit=${fit}`);
    }
  }
});

Deno.test('bodyShapeAdjustment — fitted mismatch is penalised harder than a loose one (ViBE conditioning)', () => {
  // 2026-08-03: bodyShapeMultiplier is now volume-distance based against
  // SHAPE_VOLUME_TARGETS (scoring.ts), not string-matched fit rules — the old
  // apple+slim/slim fixture no longer lands on a mismatch (dist lands exactly
  // on the neutral distance 3, delta 0) under the new math, so the fixture is
  // swapped for a combo that IS a genuine volume mismatch for its shape while
  // preserving the property under test: a highly body-specific (slim/slim)
  // mismatch should be penalised harder than a low-specificity (oversized/
  // oversized) one, once amplified by bodyShapeAdjustment's specificity gain.
  //
  // triangle + slim top + slim bottom: triangle wants a wide bottom (targets
  // bottomVol 4/5) — slim/slim (vol 1/1) is the farthest possible read AND
  // fully body-specific (specificity 1.0) → strong negative.
  const fittedMismatch = bodyShapeAdjustment(
    [makeFitItem('t', 'top', 'slim'), makeFitItem('b', 'bottom', 'slim')], 'triangle');
  // inverted_triangle + oversized top + oversized bottom: mismatch (wants a
  // fitted top) but on low-specificity (oversized) garments → mild.
  const looseMismatch = bodyShapeAdjustment(
    [makeFitItem('t', 'top', 'oversized'), makeFitItem('b', 'bottom', 'oversized')], 'inverted_triangle');
  assert(fittedMismatch < 0 && looseMismatch < 0, 'both are mismatches');
  assert(Math.abs(fittedMismatch) > Math.abs(looseMismatch),
    `fitted |${fittedMismatch}| should exceed loose |${looseMismatch}|`);
});

Deno.test('bodyShapeAdjustment — amplifies the raw rule on fitted looks', () => {
  // hourglass + tailored (slim/regular): raw +0.07, specificity ≈ (1.0+0.7)/2 = 0.85
  const items = [makeFitItem('t', 'top', 'slim'), makeFitItem('b', 'bottom', 'regular')];
  const raw = bodyShapeMultiplier(items, 'hourglass');
  const adj = bodyShapeAdjustment(items, 'hourglass');
  assert(raw > 0, 'hourglass rewards tailored');
  assert(adj > raw, `adjusted ${adj} should exceed raw ${raw} on a fitted look`);
});

// ─── bodyShapeMultiplier: missing axis must not be a fake penalty (2026-08-03) ──
// evaluate-item/scoring.ts:283 calls bodyShapeAdjustment([item], shape) with a
// SINGLE item, so the bottom axis is routinely absent. A missing axis must
// contribute 0 distance, never be treated as maximally wrong.
Deno.test('bodyShapeMultiplier — a single top-only item is not penalised for the absent bottom axis', () => {
  // apple wants a loose top (targets topVol 3/4); a lone oversized top (vol 5)
  // is close to that on the ONE axis that exists. If the missing bottom axis
  // were scored as a full-distance miss instead of 0, this would come out
  // much lower than the two-item (top+bottom) equivalent.
  const singleTop = [makeFitItem('t', 'top', 'oversized')];
  const withNeutralBottom = [makeFitItem('t', 'top', 'oversized'), makeFitItem('b', 'bottom', 'regular')];
  const deltaSingle = bodyShapeMultiplier(singleTop, 'apple');
  const deltaWithBottom = bodyShapeMultiplier(withNeutralBottom, 'apple');
  assert(deltaSingle > 0, `expected a positive delta for a single loose top on apple, got ${deltaSingle}`);
  // Distance on the top axis alone (|5-4|=1) is <= the two-axis distance to
  // the nearest target with a regular (vol 2) bottom (|5-4|+|2-2|=1) — same
  // best distance here, so the single-item delta should be at least as good,
  // never punished for the axis that simply isn't there.
  assert(deltaSingle >= deltaWithBottom - 1e-9,
    `single-item delta (${deltaSingle}) should not be penalised below the two-item equivalent (${deltaWithBottom})`);
});

Deno.test('scoreOutfitFit — body-shape delta separates two outfits for inverted_triangle', () => {
  const body: BodyMeasurements = { body_bust: 90, body_waist: 74, body_hip: 92, body_shape: 'inverted_triangle' };
  // Wide/oversized top is penalised for inverted_triangle
  const badItems = [
    makeFitItem('t', 'top', 'oversized', { chest: 104, waist_top: 84 }),
    makeFitItem('b', 'bottom', 'slim', { waist: 80, hip: 96, inseam: 76 }),
  ];
  // Relaxed bottom is rewarded
  const goodItems = [
    makeFitItem('t2', 'top', 'regular', { chest: 96, waist_top: 80 }),
    makeFitItem('b2', 'bottom', 'relaxed', { waist: 80, hip: 100, inseam: 76 }),
  ];
  const scoreBad  = scoreOutfitFit(badItems, body);
  const scoreGood = scoreOutfitFit(goodItems, body);
  assert(scoreGood > scoreBad, `expected good(${scoreGood}) > bad(${scoreBad}) for inverted_triangle`);
});

// ─── body_neutral: stripping body_shape removes ALL shape influence (2026-07-07) ──
// The body-neutral toggle (recommendation #6, docs/research/body-shape-importance-
// FINAL.md) works by nulling `body_shape` out of BodyMeasurements at the edge
// function layer (generate-outfits / evaluate-item / wardrobe-critic) BEFORE it
// reaches this engine. scoreOutfitFit already guards every body-shape read
// behind `if (!body.body_shape)` — so once the key is gone, two users with
// different (even opposite) body shapes score the same shape-sensitive outfit
// identically.
Deno.test('scoreOutfitFit — body_neutral: stripping body_shape makes two different shapes score identically', () => {
  // Oversized top + slim bottom: shape-sensitive per bodyShapeMultiplier rules
  // above (inverted_triangle penalises the wide top AND the slim bottom;
  // apple rewards the loose top and is silent on the bottom).
  const items = [
    makeFitItem('t', 'top', 'oversized', { chest: 104, waist_top: 84 }),
    makeFitItem('b', 'bottom', 'slim', { waist: 80, hip: 96, inseam: 76 }),
  ];
  const bodyInverted: BodyMeasurements = { body_bust: 90, body_waist: 74, body_hip: 92, body_shape: 'inverted_triangle' };
  const bodyApple: BodyMeasurements    = { body_bust: 90, body_waist: 74, body_hip: 92, body_shape: 'apple' };

  // Sanity: with body_shape present, the two shapes actually diverge for this
  // outfit (mirrors the existing inverted_triangle test above).
  const scoreInverted = scoreOutfitFit(items, bodyInverted);
  const scoreApple = scoreOutfitFit(items, bodyApple);
  assert(scoreInverted !== scoreApple, 'expected shape to affect the score before suppression');

  // body_neutral: the edge function sets body_shape to undefined before calling
  // the engine — simulated here directly on the same measurements.
  const neutralInverted: BodyMeasurements = { ...bodyInverted, body_shape: undefined };
  const neutralApple: BodyMeasurements = { ...bodyApple, body_shape: undefined };
  const scoreNeutralInverted = scoreOutfitFit(items, neutralInverted);
  const scoreNeutralApple = scoreOutfitFit(items, neutralApple);
  assertEquals(scoreNeutralInverted, scoreNeutralApple);
  // And it matches the plain no-shape baseline (base measured-fit score only).
  const scoreNoShapeAtAll = scoreOutfitFit(items, { body_bust: 90, body_waist: 74, body_hip: 92 });
  assertEquals(scoreNeutralInverted, scoreNoShapeAtAll);
});

// ─── Bug 2: easeScore — girth vs length curve ────────────────────────────────

Deno.test('easeScore (girth) — too-tight chest scores near 0 (unwearable)', () => {
  // chest ok=[0,12] ideal=[2,6]; ease=-1 is below ok[0] → should return 0.0
  // Fit is deliberately 'regular' (2026-08-03, fit-relative ease shift):
  // 'regular' is FIT_EASE_PCT's zero-shift anchor, so this probes the base
  // FIT_THRESHOLDS curve unperturbed — a 'slim' label would shift the window
  // tighter and change the numbers this test is asserting on.
  const body: BodyMeasurements = { body_bust: 90 };
  // garment chest = 89 → ease = -1 (below ok[0]=0) → score must be 0
  const item = makeFitItem('t', 'top', 'regular', { chest: 89 });
  const result = scoreOutfitFit([item], body);
  // Only 1 fit point (chest), score should be 0 because ease < ok[0]
  assert(result <= 0.1, `expected near-0 for too-tight chest, got ${result}`);
});

Deno.test('easeScore (girth) — marginally tight chest (ease just above ok[0]) scores low, well below ideal', () => {
  // chest ok=[0,12] ideal=[2,6]; ease=0 is at ok[0]: ratio=0, isGirth → score=0
  // ease=1 is between ok[0] and ideal[0]: ratio=0.5, isGirth → 0.5*0.5=0.25
  // Both items are 'regular' (the zero-shift anchor, 2026-08-03) so the
  // fit-relative ease shift does not move either window — this test probes
  // the base absolute curve, not the new fit-aware behaviour (covered
  // separately below).
  const body: BodyMeasurements = { body_bust: 90 };
  const tightItem = makeFitItem('t', 'top', 'regular', { chest: 91 }); // ease=1
  const idealItem = makeFitItem('t2', 'top', 'regular', { chest: 93 }); // ease=3 (ideal)
  const scoreTight = scoreOutfitFit([tightItem], body);
  const scoreIdeal = scoreOutfitFit([idealItem], body);
  assert(scoreTight < scoreIdeal, `expected tight(${scoreTight}) < ideal(${scoreIdeal})`);
  assert(scoreTight < 0.5, `expected tight girth score below 0.5, got ${scoreTight}`);
});

Deno.test('easeScore (length) — slightly short sleeve is suboptimal but wearable (>0.4)', () => {
  // sleeves ok=[-3,4] ideal=[-1,2]; ease=-2 is between ok[0]=-3 and ideal[0]=-1
  // ratio = (-2 - (-3)) / (-1 - (-3)) = 1/2 = 0.5 → length curve: 0.4 + 0.6*0.5 = 0.70
  const body: BodyMeasurements = { body_sleeve_length: 65 };
  const item = makeFitItem('t', 'top', 'regular', { sleeves: 63 }); // ease=-2
  const score = scoreOutfitFit([item], body);
  assert(score > 0.4, `expected short-sleeve score > 0.4 (wearable), got ${score}`);
  assert(score < 1.0, `expected short-sleeve score < 1.0 (not ideal), got ${score}`);
});

// ─── Bug 3: fall/autumn season key normalisation ─────────────────────────────

Deno.test("fall colorSeason resolves identically to autumn in scoreColorHarmony", () => {
  // Both should resolve the same SEASON_FLATTERING rules — identical score.
  const items = [tee('Burgundy')]; // Burgundy is in autumn.avoid → penalty under autumn rules
  const scoreAutumn = scoreColorHarmony(items, [], 'autumn', undefined);
  const scoreFall   = scoreColorHarmony(items, [], 'fall',   undefined);
  assertAlmostEquals(scoreAutumn, scoreFall, 1e-10,
    `'fall' and 'autumn' should produce identical scores but got autumn=${scoreAutumn} fall=${scoreFall}`);
});

Deno.test("fall colorSeason does not silently return 0 (was undefined lookup before fix)", () => {
  // Before the fix, SEASON_FLATTERING['fall'] was undefined → bonus returned 0
  // meaning no personal-color bias at all. After fix, should differ from a totally
  // unknown season (which also returns 0 bonus) by at least having an undertone effect.
  const warmItems = [tee('Camel')]; // warm undertone — matches autumn/fall
  const fallScore    = scoreColorHarmony(warmItems, [], 'fall',    undefined);
  const noSeasonScore = scoreColorHarmony(warmItems, [], undefined, undefined);
  // fall should give a small positive nudge for warm-undertone colours (matchRatio * 0.07)
  assert(fallScore >= noSeasonScore,
    `'fall' season should give warm-undertone bonus but got fall=${fallScore} < noSeason=${noSeasonScore}`);
});

// ─── Bug 1 fix: numericSim clamped to [0,1] ──────────────────────────────────

Deno.test('attributeSimilarity — never returns negative even with maximal numeric divergence', () => {
  // patternLevel and textureRichness can reach ~4.5 in the style catalog.
  // A gap of >4 used to push numericSim negative, dragging attributeSimilarity
  // and styleCoherence below 0. After the clamp fix, minimum must be 0.
  const maxAttrs: StyleAttributes = {
    formality: 5, patternLevel: 4.5, textureRichness: 4.5,
    colorPalette: ['bold'], silhouette: ['oversized'], mood: ['edgy'],
  };
  const minAttrs: StyleAttributes = {
    formality: 1, patternLevel: 0, textureRichness: 0,
    colorPalette: ['neutral'], silhouette: ['tailored'], mood: ['clean'],
  };
  const sim = attributeSimilarity(maxAttrs, minAttrs);
  assert(sim >= 0, `attributeSimilarity must be ≥ 0, got ${sim}`);
  assert(sim <= 1, `attributeSimilarity must be ≤ 1, got ${sim}`);
});

Deno.test('attributeSimilarity — identical attributes score 1.0', () => {
  const attrs: StyleAttributes = {
    formality: 3, patternLevel: 2, textureRichness: 2,
    colorPalette: ['earth'], silhouette: ['relaxed'], mood: ['clean'],
  };
  assertAlmostEquals(attributeSimilarity(attrs, attrs), 1.0, 1e-9);
});

// ─── Bug 4 fix: scoreOutfitFit averages only measured items ──────────────────

Deno.test('scoreOutfitFit — unmeasured items do not dilute a high-scoring measured item', () => {
  // One item with a perfect fit score; two items with no measurements.
  // Before fix: (1.0 + 0.5 + 0.5) / 3 ≈ 0.67
  // After fix:  only the measured item counts → 1.0
  const body: BodyMeasurements = { body_bust: 90 };
  const measuredItem = makeFitItem('top', 'top', 'regular', { chest: 93 }); // ease=3, ideal → score 1.0
  const unmeasured1  = makeFitItem('bot', 'bottom', 'regular');             // no garmentMeasurements
  const unmeasured2  = makeFitItem('shoes', 'shoes', 'regular');            // no garmentMeasurements

  const dilutedScore = scoreOutfitFit([measuredItem, unmeasured1, unmeasured2], body);
  // Must be considerably higher than the diluted 0.67
  assert(dilutedScore > 0.85, `expected score > 0.85 (only measured item counts), got ${dilutedScore}`);
});

Deno.test('scoreOutfitFit — all unmeasured items return neutral 0.5', () => {
  const body: BodyMeasurements = { body_bust: 90 };
  const items = [
    makeFitItem('a', 'top',    'regular'),
    makeFitItem('b', 'bottom', 'regular'),
  ];
  const score = scoreOutfitFit(items, body);
  assertAlmostEquals(score, 0.5, 1e-9, `all-unmeasured outfit should score exactly 0.5, got ${score}`);
});

Deno.test('scoreItemFit — measured flag is false when garmentMeasurements is absent', () => {
  const body: BodyMeasurements = { body_bust: 90 };
  const item = makeFitItem('t', 'top', 'regular'); // no garmentMeasurements
  const result = scoreItemFit(item, body);
  assertEquals(result.measured, false, 'item without garment measurements should have measured=false');
  assertAlmostEquals(result.score, 0.5, 1e-9);
});

Deno.test('scoreItemFit — measured flag is true when a fit point is scored', () => {
  const body: BodyMeasurements = { body_bust: 90 };
  const item = makeFitItem('t', 'top', 'regular', { chest: 94 }); // ease=4, in ideal
  const result = scoreItemFit(item, body);
  assertEquals(result.measured, true, 'item with scored fit point should have measured=true');
  assert(result.score > 0.5, `expected score > 0.5 for ideal-range ease, got ${result.score}`);
});

// ─── Fit-relative ease windows (Part 1, 2026-08-03) ──────────────────────────
// FIT_THRESHOLDS now SLIDES per the garment's declared `fit`, scaled
// proportionally to the body measurement (KEY_EASE_WEIGHT), instead of
// judging every garment against one absolute window. `regular` is the
// zero-shift anchor; both a real (provenance.fit=true) and a guessed
// (provenance.fit=false) declared fit shift at FULL strength — a guessed
// label only widens the `ok` band (GUESS_WIDENING, see Part 1b below), it no
// longer shifts at half strength (that used to park the window halfway
// between the regular and labelled-fit window, matching neither).

function withRealFit(item: FitItem): FitItem {
  return { ...item, provenance: { ...item.provenance, fit: true } };
}

Deno.test('fit-relative ease — a correctly-cut oversized top scores materially higher than under absolute thresholds, while a too-small garment still scores near 0', () => {
  const body: BodyMeasurements = { body_bust: 90 };

  // Ease consistent with an OVERSIZED design intent: FIT_EASE_PCT.oversized
  // (0.22) - FIT_EASE_PCT.regular (0.06) = 0.16 of the body girth ≈ 14.4cm
  // shift for a real (non-guessed) fit label; chest ease of 18cm sits inside
  // the resulting shifted ideal window. Under the OLD absolute thresholds
  // (ok=[0,12]), this same ease of 18 was ABOVE ok[1]=12 → floored to 0.2.
  const wellCutOversized = withRealFit(makeFitItem('oversized_top', 'top', 'oversized', { chest: 108 })); // ease=18
  const oversizedResult = scoreItemFit(wellCutOversized, body);
  assert(oversizedResult.score > 0.9,
    `expected a correctly-cut oversized top to score > 0.9, got ${oversizedResult.score} (was 0.2 under absolute thresholds)`);

  // A genuinely too-small garment (declared slim, but even slim's small
  // negative shift can't rescue an ease this far below ok[0]) must still
  // floor to (near) 0 and still emit a tight warning — the guard against
  // Part 1 over-correcting into "everything passes".
  const tooSmall = withRealFit(makeFitItem('too_small_top', 'top', 'slim', { chest: 84 })); // ease=-6
  const tooSmallResult = scoreItemFit(tooSmall, body);
  assert(tooSmallResult.score < 0.05, `expected too-small garment to still score near 0, got ${tooSmallResult.score}`);
  assert(tooSmallResult.warnings.length > 0, 'expected a tight warning to still fire for a genuinely too-small garment');
  assert(tooSmallResult.points[0]?.category === 'tight', `expected category 'tight', got ${tooSmallResult.points[0]?.category}`);
});

// ─── Guess-widening (Part 1b, 2026-08-03) ────────────────────────────────────
// A guessed fit label (provenance.fit=false) is our best ESTIMATE of the cut,
// so it shifts the window at the SAME full strength as a real label — the
// old `shiftCm *= 0.5` halving is gone. What a guess buys instead is a wider
// `ok` band (GUESS_WIDENING) so a wrong guess degrades gracefully rather than
// being crushed toward 0. NOTE: names below deliberately avoid any
// FIT_FROM_STRING keyword substring (slim/regular/relaxed/wide/oversized/...)
// so makeFitItem's synthetic row name does not accidentally flip
// provenance.fit to true via the name-keyword fallback in
// deriveFitWithProvenance — these items must stay genuinely GUESSED.
Deno.test('fit-relative ease (Part 1b, guess-widening 2026-08-03) — a guessed-fit oversized top scores close to its real-fit counterpart, and a guessed-fit too-small top still scores near 0', () => {
  // Matches body-shape-sim.ts's 'apple' canonical body exactly (bust/waist/
  // shoulder/upper_arm/sleeve/body_length fields relevant to a top).
  const body: BodyMeasurements = {
    body_bust: 96, body_shoulder_width: 39, body_waist: 88,
    body_upper_arm: 29, body_sleeve_length: 59, body_upper_body_length: 41,
  };
  // Same fixture as body-shape-sim.ts's oversized_hoodie on the 'apple'
  // canonical body (chest ease 18cm, well past the OLD absolute ok[1]=12
  // ceiling) — real-fit score there is 0.910, guessed-fit is 0.943.
  const cutMeasurements: GarmentMeasurements = {
    chest: 114, shoulder_width: 47, waist_top: 106, upper_arm: 41, sleeves: 65, body_length: 50,
  };
  const realOversized = withRealFit(makeFitItem('wardrobe_test_top_a', 'top', 'oversized', cutMeasurements));
  const guessedOversized = makeFitItem('wardrobe_test_top_b', 'top', 'oversized', cutMeasurements);
  assertEquals(guessedOversized.provenance.fit, false, 'sanity check: item must be genuinely guessed for this test to be meaningful');
  assertEquals(realOversized.provenance.fit, true, 'sanity check: item must be genuinely real-labelled for this test to be meaningful');

  const realResult = scoreItemFit(realOversized, body);
  const guessedResult = scoreItemFit(guessedOversized, body);

  assert(realResult.score >= 0.85, `expected real-fit oversized top score >= 0.85, got ${realResult.score}`);
  assert(guessedResult.score >= 0.75, `expected guessed-fit oversized top score >= 0.75 (was ~0.404 under the old half-shift), got ${guessedResult.score}`);
  assert(Math.abs(realResult.score - guessedResult.score) <= 0.2,
    `expected guessed-fit score to stay within ~0.2 of the real-fit score, got real=${realResult.score} guessed=${guessedResult.score}`);

  // A genuinely too-small top must still score near 0 under a GUESSED label —
  // widening the `ok` band must not let a too-small garment through.
  const tooSmallGuessed = makeFitItem('wardrobe_test_top_c', 'top', 'slim', { chest: 84 }); // body_bust=96, ease=-12
  assertEquals(tooSmallGuessed.provenance.fit, false, 'sanity check: too-small item must be genuinely guessed for this test to be meaningful');
  const tooSmallResult = scoreItemFit(tooSmallGuessed, body);
  assert(tooSmallResult.score < 0.1, `expected too-small guessed-fit garment to still score near 0, got ${tooSmallResult.score}`);
  assert(tooSmallResult.warnings.length > 0, 'expected a tight warning to still fire for a too-small guessed-fit garment');
});

// ─── Girth-floor safety clamp (2026-08-03) ───────────────────────────────────
// shiftThresholds() may RAISE a girth window's ok[0] (a loose garment
// legitimately requires more ease before it counts as "ok") but must never
// LOWER it below the original, un-shifted FIT_THRESHOLDS table value — a body
// does not shrink to fit a smaller garment. `slim` is the one declared fit
// whose ease% sits BELOW the `regular` anchor (FIT_EASE_PCT.slim=0.02 <
// regular=0.06), so it is the one that produces a NEGATIVE shiftCm and is the
// real risk case; `regular` (zero shift) and `oversized` (a large positive
// shift) are included as controls that should trivially still floor a
// too-small garment to ~0 regardless. Checked under BOTH a real
// (provenance.fit=true) and a guessed (provenance.fit=false) label — guessed
// additionally WIDENS the ok band, which is exactly the mechanism that could
// otherwise let a too-small garment sneak under a lowered floor.
Deno.test('girth-floor clamp — a garment measuring less than the body scores ~0 for slim, regular AND oversized labels, real and guessed', () => {
  const body: BodyMeasurements = { body_bust: 90 };
  const fits: Array<FitItem['fit']> = ['slim', 'regular', 'oversized'];
  for (const fit of fits) {
    const guessedItem = makeFitItem(`too_small_${fit}_guessed`, 'top', fit, { chest: 86 }); // ease = -4
    const realItem = withRealFit(makeFitItem(`too_small_${fit}_real`, 'top', fit, { chest: 86 }));
    for (const [label, item] of [['guessed', guessedItem], ['real', realItem]] as const) {
      const result = scoreItemFit(item, body);
      assert(result.score <= 0.05,
        `expected a chest-ease -4 garment (fit=${fit}, ${label}) to score near 0, got ${result.score}`);
      assert(result.warnings.length > 0,
        `expected a tight warning for a chest-ease -4 garment (fit=${fit}, ${label})`);
      assertEquals(result.points[0]?.category, 'tight',
        `expected category 'tight' for fit=${fit} (${label}), got ${result.points[0]?.category}`);
    }
  }
});

Deno.test("girth-floor clamp — preserves shoulder_width's deliberately-negative base ok[0] (-1), not 0", () => {
  // shoulder_width's base ok[0] is -1 on purpose (a seam 1cm narrower than the
  // body still wears). The clamp must floor at that ORIGINAL value, not at 0.
  // Proof by distinguishing the two possible floors: ease -1.5 is below BOTH
  // candidate floors (-1 and 0) → must score 0 either way. Ease -0.9 is above
  // the correct floor (-1) but still below a wrong floor of 0 — it must score
  // > 0, which only holds if the clamp landed on -1, not on 0.
  const body: BodyMeasurements = { body_shoulder_width: 39 };
  const belowFloor = withRealFit(makeFitItem('shoulder_below_floor', 'top', 'slim', { shoulder_width: 37.5 })); // ease -1.5
  const aboveFloor = withRealFit(makeFitItem('shoulder_above_floor', 'top', 'slim', { shoulder_width: 38.1 })); // ease -0.9
  const belowResult = scoreItemFit(belowFloor, body);
  const aboveResult = scoreItemFit(aboveFloor, body);
  assertEquals(belowResult.score, 0, `expected ease -1.5 (below the -1 floor) to score 0, got ${belowResult.score}`);
  assert(aboveResult.score > 0, `expected ease -0.9 (above the -1 floor, below a wrong 0 floor) to score > 0, got ${aboveResult.score}`);
});

// ─── Preferred-fit anchor (Part 2, 2026-08-03) ───────────────────────────────

Deno.test('preferredFitDelta — returns 0 with no preferredFit', () => {
  const items = [makeFitItem('t', 'top', 'oversized'), makeFitItem('b', 'bottom', 'oversized')];
  assertEquals(preferredFitDelta(items, undefined), 0);
});

Deno.test('preferredFitDelta — stays within [-0.12, +0.12] across all fit/preference combos', () => {
  const fits: Array<FitItem['fit']> = ['slim', 'regular', 'relaxed', 'wide', 'oversized'];
  const prefs: PreferredFit[] = ['SLIM', 'REGULAR', 'RELAXED', 'OVERSIZED'];
  for (const pref of prefs) {
    for (const fit of fits) {
      const items = [makeFitItem('t', 'top', fit), makeFitItem('b', 'bottom', fit)];
      const delta = preferredFitDelta(items, pref);
      assert(delta >= -0.12 && delta <= 0.12, `delta ${delta} out of range for pref=${pref} fit=${fit}`);
    }
  }
});

Deno.test('preferredFitDelta — positive when item fits match the stated preference, negative when they clash', () => {
  const slimItems = [makeFitItem('t', 'top', 'slim'), makeFitItem('b', 'bottom', 'slim')];
  const oversizedItems = [makeFitItem('t', 'top', 'oversized'), makeFitItem('b', 'bottom', 'oversized')];

  const matchDelta = preferredFitDelta(slimItems, 'SLIM');
  const clashDelta = preferredFitDelta(oversizedItems, 'SLIM');
  assert(matchDelta > 0, `expected a positive delta for slim items under a SLIM preference, got ${matchDelta}`);
  assert(clashDelta < 0, `expected a negative delta for oversized items under a SLIM preference, got ${clashDelta}`);
});

Deno.test('preferredFitDelta — excludes accessory/shoes from the core mean', () => {
  const withNoise = [makeFitItem('t', 'top', 'slim'), makeFitItem('s', 'shoes', 'oversized')];
  const withoutNoise = [makeFitItem('t', 'top', 'slim')];
  assertAlmostEquals(preferredFitDelta(withNoise, 'SLIM'), preferredFitDelta(withoutNoise, 'SLIM'), 1e-9);
});

Deno.test('scoreOutfitFit — applies the preferred-fit delta even when body_shape is absent', () => {
  // body_neutral mode (or a user who simply never set body_shape) nulls out
  // body_shape, but preferredFit is a STATED PREFERENCE, not body data — it
  // must still move the score. chest ease=5 is deliberately chosen to land
  // in the "a bit loose" branch (base ≈0.87, not ceiling-clamped at 1.0) so
  // the delta's effect is visible in both directions.
  const body: BodyMeasurements = { body_bust: 90 }; // no body_shape
  const slimItems = [
    withRealFit(makeFitItem('t', 'top', 'slim', { chest: 95 })), // ease=5
    withRealFit(makeFitItem('b', 'bottom', 'slim')),             // unmeasured — excluded from base, still counted in preferredFitDelta
  ];

  const noPref = scoreOutfitFit(slimItems, { ...body, preferredFit: undefined });
  const slimPref = scoreOutfitFit(slimItems, { ...body, preferredFit: 'SLIM' });
  const oversizedPref = scoreOutfitFit(slimItems, { ...body, preferredFit: 'OVERSIZED' });

  assert(noPref < 1.0, `expected base score to have headroom below the ceiling, got ${noPref}`);
  assert(slimPref > noPref, `expected SLIM preference to raise the score of an all-slim outfit (no body_shape), got ${slimPref} vs ${noPref}`);
  assert(oversizedPref < noPref, `expected OVERSIZED preference to lower the score of an all-slim outfit (no body_shape), got ${oversizedPref} vs ${noPref}`);
});

// ─── Fix A: soft-knee output shaping (2026-08-11) ────────────────────────────
// scoreOutfitFit's raw sum (base + shapeDelta + prefDelta) routinely exceeds
// 1.0 (documented case: hourglass + all-slim tailored, base 0.823 + shapeDelta
// 0.224 = 1.047). A hard clamp flattened every such outfit to exactly 1.0,
// destroying ranking separation. softKnee replaces the clamp with a smooth,
// strictly-monotone compression that is identity on [0.1, 0.9].

Deno.test('softKnee — identity in the confined blast radius [0.1, 0.9]', () => {
  for (const raw of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    assertEquals(softKnee(raw), raw, `expected softKnee(${raw}) to be untouched identity, got ${softKnee(raw)}`);
  }
});

Deno.test('softKnee — matches the specified sanity checks', () => {
  assertAlmostEquals(softKnee(1.047), 0.977, 0.001, `expected softKnee(1.047) ≈ 0.977, got ${softKnee(1.047)}`);
  assertAlmostEquals(softKnee(1.44), 0.9995, 0.0005, `expected softKnee(1.44) ≈ 0.9995, got ${softKnee(1.44)}`);
  assertEquals(softKnee(0.5), 0.5, `expected softKnee(0.5) to be exactly 0.5, got ${softKnee(0.5)}`);
});

Deno.test('softKnee — asymptotic toward 0 and 1 but never reaches them', () => {
  // Values chosen within double-precision range (an input of, say, 10 decays
  // exp() past the ~1e-16 representable threshold and legitimately rounds to
  // exactly 1 in floating point — a float limitation, not a domain concern,
  // since the real scoreOutfitFit input range tops out around 1.44).
  assert(softKnee(1.44) < 1, `expected softKnee(1.44) < 1, got ${softKnee(1.44)}`);
  assert(softKnee(3) < 1, `expected softKnee(3) < 1, got ${softKnee(3)}`);
  assert(softKnee(-2) > 0, `expected softKnee(-2) > 0, got ${softKnee(-2)}`);
  assert(softKnee(-1) > 0, `expected softKnee(-1) > 0, got ${softKnee(-1)}`);
});

Deno.test('softKnee — strictly monotone across the whole domain, including above 1 and below 0', () => {
  const samples: number[] = [];
  for (let x = -1.5; x <= 2.5; x += 0.05) samples.push(x);
  for (let i = 1; i < samples.length; i++) {
    const a = softKnee(samples[i - 1]);
    const b = softKnee(samples[i]);
    assert(a < b, `expected f(${samples[i - 1].toFixed(2)})=${a} < f(${samples[i].toFixed(2)})=${b} — monotonicity broken`);
  }
});

Deno.test('scoreOutfitFit — soft-knee preserves ranking separation for two outfits that both overshoot raw 1.0', () => {
  // Both outfits share the IDENTICAL top (fit=slim, chest ease=1 → base=1.0,
  // the only measured item) under an hourglass body + SLIM preference, so base
  // is held constant and only the bottom's fit — via bodyShapeAdjustment's
  // shape-match delta and preferredFitDelta's preference-match delta — varies
  // the amount by which raw overshoots 1.0. Before the fix both would clamp to
  // an indistinguishable 1.0; after the fix they must stay ordered and < 1.0.
  const body: BodyMeasurements = { body_bust: 90, body_shape: 'hourglass', preferredFit: 'SLIM' };
  const top = withRealFit(makeFitItem('top', 'top', 'slim', { chest: 91 })); // ease=1, lands in the shifted ideal band → score 1.0

  // Bottom volume 2 (regular) is an EXACT hourglass_fitted match (topVol=1,
  // bottomVol=2 → bestDist=0 → max +0.10 raw shape delta) and still fits the
  // SLIM preference reasonably (regular=0.6 compat) — the larger overshoot.
  const bottomBigOvershoot = makeFitItem('bot_big', 'bottom', 'regular');
  // Bottom volume 5 (oversized) is a poor hourglass match (bestDist=3 → 0 raw
  // shape delta) and clashes with the SLIM preference (oversized=0.1 compat)
  // — the smaller overshoot.
  const bottomSmallOvershoot = makeFitItem('bot_small', 'bottom', 'oversized');

  const scoreBigOvershoot = scoreOutfitFit([top, bottomBigOvershoot], body);
  const scoreSmallOvershoot = scoreOutfitFit([top, bottomSmallOvershoot], body);

  assert(scoreBigOvershoot < 1.0, `expected the bigger-overshoot outfit to stay below 1.0 (no hard clamp), got ${scoreBigOvershoot}`);
  assert(scoreSmallOvershoot < 1.0, `expected the smaller-overshoot outfit to stay below 1.0, got ${scoreSmallOvershoot}`);
  assert(scoreBigOvershoot > scoreSmallOvershoot,
    `expected separation to survive the knee: bigger raw overshoot (${scoreBigOvershoot}) should still outscore the smaller one (${scoreSmallOvershoot}) — a hard clamp would have flattened both to 1.0`);
});

// ─── Fix B: loose-side guess-widening ceiling clamp (2026-08-11) ─────────────
// Backlog: "Guess-widening still lets a guessed-fit score exceed its real-fit
// counterpart on the LOOSE side" — widening ok[1] for a guessed label can only
// ever RAISE a too-roomy point's score, never lower it, so a wrong guess
// mathematically outscored a correctly-labelled real garment whenever the ease
// landed between the real ok[1] and the wider guessed ok[1]. Fix: clamp a
// guessed GIRTH key's widened ok[1] to the ceiling a REAL label on the same
// garment/fit would have (the shift-only, pre-widening ok[1]) — a no-op for
// real items, only engages for guessed ones.

Deno.test('loose-side ceiling clamp — a guessed oversized top never outscores its real-fit counterpart at an ease between the real and (old) guessed ok[1]', () => {
  // body_bust=90, fit=oversized, chest key: shiftCm = (0.22-0.06)*90*1 = 14.4.
  // Real (unwidened) window: ideal=[16.4,20.4], ok=[14.4,26.4].
  // Guessed (pre-fix) widened window: ok=[14.4-4.8, 26.4+4.8] = [9.6, 31.2].
  // Ease=27 sits ABOVE the real ok[1]=26.4 (real floors to 0.2) but INSIDE the
  // old guessed ok[1]=31.2 (guessed would score well above 0.2) — exactly the
  // bug. After the fix, guessed's ok[1] is clamped to 26.4 too.
  // Names deliberately avoid any FIT_FROM_STRING keyword substring (slim/
  // regular/relaxed/wide/oversized/...) — see the Part 1b comment above —
  // so makeFitItem's synthetic row name doesn't accidentally flip the guessed
  // item's provenance.fit to true via the name-keyword fallback.
  const body: BodyMeasurements = { body_bust: 90 };
  const realTop = withRealFit(makeFitItem('wardrobe_real_top_ceiling', 'top', 'oversized', { chest: 117 })); // ease=27
  const guessedTop = makeFitItem('wardrobe_guessed_top_ceiling', 'top', 'oversized', { chest: 117 }); // ease=27
  assertEquals(guessedTop.provenance.fit, false, 'sanity check: item must be genuinely guessed');
  assertEquals(realTop.provenance.fit, true, 'sanity check: item must be genuinely real-labelled');

  const realResult = scoreItemFit(realTop, body);
  const guessedResult = scoreItemFit(guessedTop, body);

  assertAlmostEquals(realResult.score, 0.2, 0.01, `expected the real-labelled top (ease past its own ok[1]) to floor to ~0.2, got ${realResult.score}`);
  assert(guessedResult.score <= realResult.score + 1e-9,
    `expected guessed (${guessedResult.score}) to never exceed real (${realResult.score}) after the ceiling clamp`);
  assertAlmostEquals(guessedResult.score, realResult.score, 0.01,
    `expected the clamp to bring the guessed score down to (approximately) the real score, got guessed=${guessedResult.score} real=${realResult.score}`);
});

Deno.test('loose-side ceiling clamp — "real never scores below guessed" invariant holds on the LOOSE side across the documented residual fits/eases', () => {
  // Fix B is scoped to the LOOSE side (ok[1]) only — it deliberately does not
  // touch the pre-existing (2026-08-03, already-resolved, out of this fix's
  // scope) tight-side girth floor, which has its own separate, accepted
  // asymmetry (a guessed item's widened ok[0] may still legitimately beat a
  // real item's un-widened, fit-raised ok[0] down in the tight zone — that
  // clamp only guarantees a floor at the ABSOLUTE table value, not parity
  // with the real label). So this invariant is checked only for eases past
  // each fit's own shifted ideal[1] — the loose-side zone Fix B targets —
  // computed by hand from FIT_EASE_PCT/KEY_EASE_WEIGHT at body_bust=90,
  // weight(chest)=1: shiftCm = (FIT_EASE_PCT[fit]-0.06)*90, ideal[1] = 6+shiftCm.
  //   relaxed (0.11):   shiftCm=4.5  → ideal[1]=10.5
  //   wide (0.16):      shiftCm=9.0  → ideal[1]=15.0
  //   oversized (0.22): shiftCm=14.4 → ideal[1]=20.4
  const body: BodyMeasurements = { body_bust: 90 };
  const looseSideEases: Partial<Record<FitItem['fit'], number[]>> = {
    relaxed: [12, 14, 16, 18, 20],
    wide: [16, 18, 20, 22],
    oversized: [22, 24, 26, 28, 30],
  };
  // ids are deliberately keyword-free (see the comment on the test above) —
  // encoding fit/ease in the id string would flip the "guessed" item's
  // provenance.fit to true via the name-keyword fallback and silently make
  // this test vacuous (both sides "real", clamp never exercised).
  let counter = 0;
  for (const [fit, eases] of Object.entries(looseSideEases) as [FitItem['fit'], number[]][]) {
    for (const ease of eases) {
      counter++;
      const chest = 90 + ease;
      const real = withRealFit(makeFitItem(`wardrobe_pair_${counter}_real`, 'top', fit, { chest }));
      const guessed = makeFitItem(`wardrobe_pair_${counter}_guessed`, 'top', fit, { chest });
      assertEquals(guessed.provenance.fit, false, `sanity check: pair ${counter} (fit=${fit}, ease=${ease}) guessed item must be genuinely guessed`);
      const realResult = scoreItemFit(real, body);
      const guessedResult = scoreItemFit(guessed, body);
      assert(guessedResult.score <= realResult.score + 1e-9,
        `invariant violated for fit=${fit} ease=${ease}: guessed=${guessedResult.score} > real=${realResult.score}`);
    }
  }
});

Deno.test('loose-side ceiling clamp — does NOT touch the base per-fit shift for a REAL declared fit (only caps the guess-widening delta)', () => {
  // A correctly-cut REAL oversized top must still score materially higher
  // than under the old absolute thresholds (this mirrors the existing
  // Part 1 "fit-relative ease" test) — proving the clamp is a no-op for real
  // items and the legitimate per-fit outward shift is untouched.
  const body: BodyMeasurements = { body_bust: 90 };
  const wellCutOversized = withRealFit(makeFitItem('oversized_top_ceiling_check', 'top', 'oversized', { chest: 108 })); // ease=18
  const result = scoreItemFit(wellCutOversized, body);
  assert(result.score > 0.9, `expected a correctly-cut REAL oversized top to still score > 0.9 (base shift untouched by the ceiling clamp), got ${result.score}`);
});
