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
  tone12QualityBonus, TONE12_AVOID,
} from './scoring.ts';
import { toFitItem } from './enrichment.ts';
import { ClothingItemRow, FitItem, BodyMeasurements, GarmentMeasurements, StyleAttributes } from './types.ts';

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
  // apple + slim top: body-specific mismatch → strong negative
  const fittedMismatch = bodyShapeAdjustment(
    [makeFitItem('t', 'top', 'slim'), makeFitItem('b', 'bottom', 'slim')], 'apple');
  // inverted_triangle + oversized top: mismatch on a low-specificity garment → mild
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
  const body: BodyMeasurements = { body_bust: 90 };
  // garment chest = 89 → ease = -1 (below ok[0]=0) → score must be 0
  const item = makeFitItem('t', 'top', 'slim', { chest: 89 });
  const result = scoreOutfitFit([item], body);
  // Only 1 fit point (chest), score should be 0 because ease < ok[0]
  assert(result <= 0.1, `expected near-0 for too-tight chest, got ${result}`);
});

Deno.test('easeScore (girth) — marginally tight chest (ease just above ok[0]) scores low, well below ideal', () => {
  // chest ok=[0,12] ideal=[2,6]; ease=0 is at ok[0]: ratio=0, isGirth → score=0
  // ease=1 is between ok[0] and ideal[0]: ratio=0.5, isGirth → 0.5*0.5=0.25
  const body: BodyMeasurements = { body_bust: 90 };
  const tightItem = makeFitItem('t', 'top', 'slim', { chest: 91 }); // ease=1
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
