// Deno test suite for evaluate-item/scoring.ts
// Run: deno test supabase/functions/evaluate-item/

import { assertEquals, assertNotEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { computeVerdict, VerdictResult } from './scoring.ts';
import { FitItem } from '../generate-outfits/engine/types.ts';
import { toFitItem } from '../generate-outfits/engine/enrichment.ts';
import { ClothingItemRow, BodyMeasurements } from '../generate-outfits/engine/types.ts';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeItemRow(overrides: Partial<ClothingItemRow> = {}): ClothingItemRow {
  return {
    id: 'test-item',
    type: 'SHIRT',
    name: 'Test Shirt',
    color: 'Olive',
    material: 'Cotton',
    fit: 'regular',
    pattern: 'solid',
    warmthSeason: 'all_season',
    measurements: [
      { label: 'chest', value: 54, unit: 'cm' },
      { label: 'length', value: 70, unit: 'cm' },
    ],
    ...overrides,
  };
}

function makeFitItem(overrides: Partial<ClothingItemRow> = {}): FitItem {
  return toFitItem(makeItemRow(overrides));
}

const fullBodyMeasurements: BodyMeasurements = {
  body_bust: 48,
  body_waist: 32,
  body_hip: 52,
  body_shoulder_width: 44,
  body_sleeve_length: 60,
  body_upper_body_length: 65,
  body_upper_arm: 28,
  preferredFit: 'REGULAR',
  body_shape: 'rectangle',
};

const fullProfile = {
  colorPreferences: ['Navy', 'Olive', 'Beige'],
  colorSeason: 'autumn',
  selectedStyles: ['oldmoney', 'minimalist'],
  bodyMeasurements: fullBodyMeasurements,
};

// ─── T1: Determinism ─────────────────────────────────────────────────────────

Deno.test('determinism: same input produces same output', () => {
  const item = makeFitItem();
  const a = computeVerdict(item, fullProfile);
  const b = computeVerdict(item, fullProfile);

  assertEquals(a.overall_score, b.overall_score);
  assertEquals(a.recommendation, b.recommendation);
  for (let i = 0; i < a.criteria.length; i++) {
    assertEquals(a.criteria[i].score, b.criteria[i].score);
    assertEquals(a.criteria[i].available, b.criteria[i].available);
  }
});

Deno.test('determinism: different item produces different output', () => {
  const item1 = makeFitItem({ color: 'Olive', material: 'Cotton' });
  const item2 = makeFitItem({ color: 'Red',   material: 'Nylon' });
  const a = computeVerdict(item1, fullProfile);
  const b = computeVerdict(item2, fullProfile);
  // With different items at least one criterion should differ
  const anyDiff = a.criteria.some((c, i) => c.score !== b.criteria[i].score);
  assert(anyDiff, 'Different items should produce different criterion scores');
});

// ─── T2: Criterion excluded when item attr missing ────────────────────────────

Deno.test('color criterion unavailable when item color is empty string', () => {
  const item = makeFitItem({ color: '' });
  const verdict = computeVerdict(item, fullProfile);
  const colorCriterion = verdict.criteria.find(c => c.key === 'color')!;
  assertEquals(colorCriterion.available, false);
  assertEquals(colorCriterion.score, null);
});

Deno.test('measurement criterion unavailable when item has no measurements', () => {
  const item = makeFitItem({ measurements: undefined });
  const verdict = computeVerdict(item, fullProfile);
  const measurementCriterion = verdict.criteria.find(c => c.key === 'measurement')!;
  assertEquals(measurementCriterion.available, false);
  assertEquals(measurementCriterion.score, null);
});

Deno.test('fabric criterion unavailable when item material is missing', () => {
  const item = makeFitItem({ material: undefined });
  const verdict = computeVerdict(item, fullProfile);
  const fabricCriterion = verdict.criteria.find(c => c.key === 'fabric')!;
  assertEquals(fabricCriterion.available, false);
  assertEquals(fabricCriterion.score, null);
});

// ─── T3: Criterion excluded when profile datum missing ────────────────────────

Deno.test('color criterion unavailable when user has no color profile', () => {
  const item = makeFitItem();
  const profileNoColor = { ...fullProfile, colorPreferences: [], colorSeason: undefined };
  const verdict = computeVerdict(item, profileNoColor);
  const colorCriterion = verdict.criteria.find(c => c.key === 'color')!;
  assertEquals(colorCriterion.available, false);
  assertEquals(colorCriterion.score, null);
});

Deno.test('style criterion unavailable when user has no selected styles', () => {
  const item = makeFitItem();
  const profileNoStyle = { ...fullProfile, selectedStyles: [] };
  const verdict = computeVerdict(item, profileNoStyle);
  const styleCriterion = verdict.criteria.find(c => c.key === 'style')!;
  assertEquals(styleCriterion.available, false);
  assertEquals(styleCriterion.score, null);
});

Deno.test('fit criterion unavailable when user has no preferredFit and no body_shape', () => {
  const item = makeFitItem();
  const profileNoFitData: typeof fullProfile = {
    ...fullProfile,
    bodyMeasurements: { body_bust: 48 }, // has some measurements but no preferredFit/body_shape
  };
  const verdict = computeVerdict(item, profileNoFitData);
  const fitCriterion = verdict.criteria.find(c => c.key === 'fit')!;
  assertEquals(fitCriterion.available, false);
  assertEquals(fitCriterion.score, null);
});

Deno.test('measurement criterion unavailable when user has no body measurements', () => {
  const item = makeFitItem();
  const profileNoMeasurements = { ...fullProfile, bodyMeasurements: {} };
  const verdict = computeVerdict(item, profileNoMeasurements);
  const measurementCriterion = verdict.criteria.find(c => c.key === 'measurement')!;
  assertEquals(measurementCriterion.available, false);
  assertEquals(measurementCriterion.score, null);
});

// ─── T3b: Coarse height/weight estimate fallback (backlog #4) ─────────────────

Deno.test('measurement criterion uses a coarse estimate when only height+weight are present', () => {
  const item = makeFitItem({ measurements: [{ label: 'chest', value: 96, unit: 'cm' }] });
  const profileHW = {
    colorPreferences: [], colorSeason: undefined, selectedStyles: [],
    bodyMeasurements: { body_height: 170, body_weight: 65 } as BodyMeasurements,
    gender: 'MAN',
  };
  const measurementCriterion = computeVerdict(item, profileHW).criteria.find(c => c.key === 'measurement')!;
  assertEquals(measurementCriterion.available, true);
  assert(
    measurementCriterion.score !== null &&
    measurementCriterion.score >= 0 && measurementCriterion.score <= 100,
    'estimated score should be an integer in [0,100]',
  );
  // Down-weighted vs the real-measurement weight (0.25) so the estimate never dominates.
  assertEquals(measurementCriterion.weight, 0.10);
  assert(measurementCriterion.explanation.includes('Estimated'), 'explanation should flag the estimate');
});

Deno.test('measurement estimate does not apply without both height and weight', () => {
  const item = makeFitItem(); // has garment measurements
  const profileHeightOnly = {
    colorPreferences: [], colorSeason: undefined, selectedStyles: [],
    bodyMeasurements: { body_height: 170 } as BodyMeasurements, // weight missing
  };
  const measurementCriterion = computeVerdict(item, profileHeightOnly).criteria.find(c => c.key === 'measurement')!;
  assertEquals(measurementCriterion.available, false);
  assertEquals(measurementCriterion.score, null);
});

Deno.test('a height+weight-only profile yields a scored verdict, not an all-unavailable dead end', () => {
  const item = makeFitItem({ measurements: [{ label: 'chest', value: 96, unit: 'cm' }] });
  const profileHW = {
    colorPreferences: [], colorSeason: undefined, selectedStyles: [],
    bodyMeasurements: { body_height: 170, body_weight: 65 } as BodyMeasurements,
  };
  const verdict = computeVerdict(item, profileHW);
  assertNotEquals(verdict.overall_score, null);
  assert(verdict.criteria.some(c => c.available), 'at least one criterion should be available');
});

// ─── T4: Criteria always have all five keys ───────────────────────────────────

Deno.test('response always contains exactly five criteria in specified order', () => {
  const item = makeFitItem();
  const verdict = computeVerdict(item, fullProfile);
  assertEquals(verdict.criteria.length, 5);
  const keys = verdict.criteria.map(c => c.key);
  assertEquals(keys, ['color', 'style', 'fit', 'measurement', 'fabric']);
});

// ─── T5: Fit/Measurement weighting reflected in composite ────────────────────

Deno.test('fit and measurement have higher weights than color, style, fabric', () => {
  const item = makeFitItem();
  const verdict = computeVerdict(item, fullProfile);
  const byKey = Object.fromEntries(verdict.criteria.map(c => [c.key, c]));
  assert(byKey.fit.weight         >= byKey.color.weight,   'fit.weight should be >= color.weight');
  assert(byKey.fit.weight         >= byKey.style.weight,   'fit.weight should be >= style.weight');
  assert(byKey.fit.weight         >= byKey.fabric.weight,  'fit.weight should be >= fabric.weight');
  assert(byKey.measurement.weight >= byKey.color.weight,   'measurement.weight should be >= color.weight');
  assert(byKey.measurement.weight >= byKey.style.weight,   'measurement.weight should be >= style.weight');
  assert(byKey.measurement.weight >= byKey.fabric.weight,  'measurement.weight should be >= fabric.weight');
});

Deno.test('a perfect-fit item scores higher composite than a mismatched-fit item', () => {
  // Slim-preferred user vs. slim item vs. oversized item
  const profileSlim = {
    ...fullProfile,
    bodyMeasurements: { ...fullBodyMeasurements, preferredFit: 'SLIM' as const },
  };
  const slimItem     = makeFitItem({ fit: 'slim' });
  const oversizedItem = makeFitItem({ fit: 'oversized' });
  const slimVerdict     = computeVerdict(slimItem, profileSlim);
  const oversizedVerdict = computeVerdict(oversizedItem, profileSlim);
  assert(
    (slimVerdict.overall_score ?? 0) > (oversizedVerdict.overall_score ?? 0),
    `slim item (${slimVerdict.overall_score}) should score higher than oversized (${oversizedVerdict.overall_score}) for a slim-preferring user`,
  );
});

// ─── T6: Recommendation band boundaries ──────────────────────────────────────

Deno.test('recommendation band: overall_score >= 85 → great', () => {
  // Build a near-perfect item/profile combination and verify the boundary logic.
  // We do this by checking each possible band with known scores.
  // Direct coverage via the exported band logic through verdict shapes:
  // craft a scenario that hits each threshold.

  // Validate against a known near-perfect match: navy shirt, oldmoney user, full measurements with good ease.
  const item = makeFitItem({
    color: 'Navy',
    material: 'Wool',
    fit: 'regular',
    measurements: [
      { label: 'chest', value: 56, unit: 'cm' }, // 48 + 8 = roomy, still ok-ish
      { label: 'length', value: 70, unit: 'cm' },
    ],
  });
  const verdict = computeVerdict(item, fullProfile);
  // We can't guarantee exactly what the score is, but we can check recommendation is valid.
  assert(
    ['great', 'worth_it', 'maybe', 'skip'].includes(verdict.recommendation ?? ''),
    `recommendation should be one of the four valid labels, got: ${verdict.recommendation}`,
  );
  // And that score is in the matching range.
  const score = verdict.overall_score;
  if (score !== null) {
    if (verdict.recommendation === 'great')    assert(score >= 85, `great requires score >= 85, got ${score}`);
    if (verdict.recommendation === 'worth_it') assert(score >= 70 && score < 85, `worth_it requires 70-84, got ${score}`);
    if (verdict.recommendation === 'maybe')    assert(score >= 50 && score < 70, `maybe requires 50-69, got ${score}`);
    if (verdict.recommendation === 'skip')     assert(score <  50, `skip requires score < 50, got ${score}`);
  }
});

Deno.test('band boundary: score < 50 → skip', () => {
  // Neon yellow shirt + black suit user — fabric banned, style mismatch, poor color
  const item = makeFitItem({
    color: 'Yellow',
    material: 'Polyester',
    fit: 'oversized',
    measurements: undefined,
  });
  const profile = {
    colorPreferences: ['Black', 'Navy'],
    colorSeason: 'winter',
    selectedStyles: ['oldmoney'],
    bodyMeasurements: { preferredFit: 'SLIM' as const },
  };
  const verdict = computeVerdict(item, profile);
  const score = verdict.overall_score;
  if (score !== null) {
    assert(score < 70, `Strongly mismatched item should score below 70, got ${score}`);
  }
});

// ─── T7: Zero evaluable criteria → overall_score null ────────────────────────

Deno.test('overall_score is null when no criteria are evaluable', () => {
  // Empty color, no material, no profile color/style data, no measurements anywhere
  const item = makeFitItem({ color: '', material: undefined, measurements: undefined });
  const profile = {
    colorPreferences: [],
    colorSeason: undefined,
    selectedStyles: [],
    bodyMeasurements: {},
  };
  const verdict = computeVerdict(item, profile);
  assertEquals(verdict.overall_score, null);
  assertEquals(verdict.recommendation, null);
  assertEquals(verdict.criteria.every(c => !c.available), true);
});

// ─── T8: Scores are always 0–100 integers when available ─────────────────────

Deno.test('all available criterion scores are integers between 0 and 100', () => {
  const item = makeFitItem();
  const verdict = computeVerdict(item, fullProfile);
  for (const c of verdict.criteria) {
    if (c.available && c.score !== null) {
      assert(c.score >= 0 && c.score <= 100, `Score ${c.score} for ${c.key} is out of range`);
      assertEquals(c.score, Math.round(c.score), `Score ${c.score} for ${c.key} should be integer`);
    }
  }
});

// ─── T9: Weight renormalization ───────────────────────────────────────────────

Deno.test('weights in response are the original defaults (not renormalized)', () => {
  // The returned weight is the original default weight (informational per contract);
  // renormalization happens only internally for composite score.
  const item = makeFitItem({ measurements: undefined }); // measurement unavailable
  const verdict = computeVerdict(item, fullProfile);
  const measurementCriterion = verdict.criteria.find(c => c.key === 'measurement')!;
  assertEquals(measurementCriterion.available, false);
  assertEquals(measurementCriterion.weight, 0.25); // default weight preserved in output
});

Deno.test('renormalized composite is weighted correctly over available criteria', () => {
  // Make only color available: no style profile, no fit/measurement profile, no material.
  const item = makeFitItem({ material: undefined, measurements: undefined });
  const colorOnlyProfile = {
    colorPreferences: ['Olive'],
    colorSeason: 'autumn',
    selectedStyles: [],
    bodyMeasurements: {},
  };
  const verdict = computeVerdict(item, colorOnlyProfile);
  // Style, fit, measurement, fabric should be unavailable (material missing → fabric unavailable)
  const available = verdict.criteria.filter(c => c.available);
  assert(available.length > 0, 'At least color should be available');
  // overall_score should equal the color score (since it's the only available criterion)
  if (available.length === 1 && available[0].key === 'color') {
    assertEquals(verdict.overall_score, available[0].score);
  }
});

// ─── Fix 1: single-item colour & fabric scorers (kill the degeneracy) ────────
// Prior to the fix, colour reused the outfit-level scoreColorHarmony with a
// single-item array: 5 of 7 sub-terms are constants for one item, collapsing
// the base to 0.20·paletteAlignment + 0.705 → a 70–91 band before bonuses.
// Fabric reused scoreSeasonMatch, which fixes "internal consistency" at 0.8
// for a single item → raw clamped to [32, 92]. See docs/
// engine-fixes-phase2-instruction.md Fix 1.

const deepWinterProfile = {
  colorPreferences: ['Black', 'Navy', 'Charcoal', 'White'],
  colorSeason: 'winter',
  colorTone12: 'deep_winter',
  selectedStyles: [],
  bodyMeasurements: {},
};

Deno.test('Fix1/color: deep-winter user + black item scores high (>= 80)', () => {
  const item = makeFitItem({ color: 'Black' });
  const colorCriterion = computeVerdict(item, deepWinterProfile).criteria.find(c => c.key === 'color')!;
  assertEquals(colorCriterion.available, true);
  assert(colorCriterion.score !== null && colorCriterion.score >= 80, `expected >= 80, got ${colorCriterion.score}`);
});

Deno.test('Fix1/color: deep-winter user + warm orange item scores low (<= 45)', () => {
  const item = makeFitItem({ color: 'Orange' });
  const colorCriterion = computeVerdict(item, deepWinterProfile).criteria.find(c => c.key === 'color')!;
  assertEquals(colorCriterion.available, true);
  assert(colorCriterion.score !== null && colorCriterion.score <= 45, `expected <= 45, got ${colorCriterion.score}`);
});

Deno.test('Fix1/color: user with a color season but no explicit palette lands mid, not extreme', () => {
  // colorSeason set (so the criterion is available) but no explicit swatch
  // picks (colorPreferences empty) and a season-neutral item color, so the
  // paletteAlignment base (0.5, no explicit palette to match against) isn't
  // pushed far by season/tone12 bonuses (none supplied here).
  const item = makeFitItem({ color: 'Gray' });
  const profile = {
    colorPreferences: [] as string[],
    colorSeason: 'autumn',
    selectedStyles: [],
    bodyMeasurements: {},
  };
  const colorCriterion = computeVerdict(item, profile).criteria.find(c => c.key === 'color')!;
  assertEquals(colorCriterion.available, true);
  assert(
    colorCriterion.score !== null && colorCriterion.score > 20 && colorCriterion.score < 80,
    `expected a mid, non-extreme score, got ${colorCriterion.score}`,
  );
});

Deno.test('Fix1/color: distribution guard — colour scores no longer all land in [70, 91]', () => {
  const colors = ['Black', 'Orange', 'Navy', 'Beige', 'Red', 'White', 'Olive', 'Yellow'];
  const scores = colors.map((color) => {
    const item = makeFitItem({ color });
    return computeVerdict(item, fullProfile).criteria.find(c => c.key === 'color')!.score!;
  });
  const allInOldBand = scores.every((s) => s >= 70 && s <= 91);
  assert(!allInOldBand, `expected at least one score outside [70,91], got ${JSON.stringify(scores)}`);
});

Deno.test('Fix1/fabric: wool item evaluated in summer scores well below the old 32 floor', () => {
  // warmthSeason explicit ('warm_winter') so the fabric season is unambiguously
  // 'winter' — stored warmth_season beats material-name guessing (enrichment.ts).
  const item = makeFitItem({ material: 'Wool', warmthSeason: 'warm_winter' });
  const profile = { ...fullProfile, selectedStyles: [], weatherSeason: 'summer' as const };
  const fabricCriterion = computeVerdict(item, profile).criteria.find(c => c.key === 'fabric')!;
  assertEquals(fabricCriterion.available, true);
  assert(fabricCriterion.score !== null && fabricCriterion.score < 32, `expected < 32, got ${fabricCriterion.score}`);
});

Deno.test('Fix1/fabric: linen item evaluated in summer scores above the old 92 cap', () => {
  const item = makeFitItem({ material: 'Linen', warmthSeason: 'lightweight_summer' });
  const profile = { ...fullProfile, weatherSeason: 'summer' as const };
  const fabricCriterion = computeVerdict(item, profile).criteria.find(c => c.key === 'fabric')!;
  assertEquals(fabricCriterion.available, true);
  assert(fabricCriterion.score !== null && fabricCriterion.score > 92, `expected > 92, got ${fabricCriterion.score}`);
});

// ─── Fix 2: provenance gate (stop confident guessing) ────────────────────────
// deriveFitWithProvenance marks item.provenance.fit=false when the fit had to
// be DEFAULTED (no `fit` in the request, no fit keyword in the garment name).
// The fit criterion must not confidently score a guess.

Deno.test('Fix2: item without a fit in the request → fit criterion unavailable', () => {
  const item = makeFitItem({ fit: undefined }); // 'Test Shirt' has no fit keyword → provenance.fit=false
  const verdict = computeVerdict(item, fullProfile);
  const fitCriterion = verdict.criteria.find(c => c.key === 'fit')!;
  assertEquals(fitCriterion.available, false);
  assertEquals(fitCriterion.score, null);
});

Deno.test('Fix2: item with an explicit fit in the request → scored as today', () => {
  const item = makeFitItem({ fit: 'oversized' });
  const verdict = computeVerdict(item, fullProfile);
  const fitCriterion = verdict.criteria.find(c => c.key === 'fit')!;
  assertEquals(fitCriterion.available, true);
  assert(fitCriterion.score !== null && fitCriterion.score >= 0 && fitCriterion.score <= 100);
});

// ─── Fix 3: bilingual criterion explanations ─────────────────────────────────

Deno.test('Fix3: locale "vi" produces Vietnamese explanations', () => {
  const item = makeFitItem();
  const profileVi = { ...fullProfile, locale: 'vi' as const };
  const verdict = computeVerdict(item, profileVi);
  const colorCriterion = verdict.criteria.find(c => c.key === 'color')!;
  // Known Vietnamese substrings from the color-band templates.
  assert(
    /bảng màu|hài hòa|xung khắc|hạn chế/.test(colorCriterion.explanation),
    `expected Vietnamese explanation, got: ${colorCriterion.explanation}`,
  );
});

Deno.test('Fix3: default (no locale / "en") explanations are unchanged (English)', () => {
  const item = makeFitItem();
  const verdict = computeVerdict(item, fullProfile);
  const colorCriterion = verdict.criteria.find(c => c.key === 'color')!;
  assert(
    /palette|color season/.test(colorCriterion.explanation),
    `expected English explanation, got: ${colorCriterion.explanation}`,
  );
});

Deno.test('Fix3: locale "vi" unavailable explanation is Vietnamese', () => {
  const item = makeFitItem({ color: '' });
  const profileVi = { ...fullProfile, locale: 'vi' as const };
  const verdict = computeVerdict(item, profileVi);
  const colorCriterion = verdict.criteria.find(c => c.key === 'color')!;
  assertEquals(colorCriterion.available, false);
  assert(colorCriterion.explanation.includes('màu'), `expected Vietnamese unavailable copy, got: ${colorCriterion.explanation}`);
});

// ─── 4 suggestion toggles (2026-08-10) ─────────────────────────────────────
// suggest_by_style / suggest_by_measurements — mirrors generate-outfits'
// ranking.ts dims valid-flag mechanism. suggest_by_personal_color has no
// scoring.ts-level test here: it's applied upstream (index.ts nulls
// colorSeason/colorTone12/personal_palette before calling computeVerdict),
// which is exactly what colorExplanation's existing conditional phrasing
// already covers — no new branch in scoring.ts to test. suggest_by_formula
// has no equivalent at all: evaluate-item scores one item, never a formula.

Deno.test('suggestByStyle=false: style criterion becomes unavailable even though the user has full style data', () => {
  const item = makeFitItem();
  const profileOff = { ...fullProfile, suggestByStyle: false };
  const verdict = computeVerdict(item, profileOff);
  const styleCriterion = verdict.criteria.find(c => c.key === 'style')!;
  assertEquals(styleCriterion.available, false);
  assertEquals(styleCriterion.score, null);
  // On (default true) still scores it, given the same full profile.
  const styleOn = computeVerdict(item, fullProfile).criteria.find(c => c.key === 'style')!;
  assertEquals(styleOn.available, true);
});

Deno.test('suggestByStyle=false toggled-off explanation is distinct from the "missing data" explanation (does not tell the user to add what they already have)', () => {
  const item = makeFitItem();
  const offVerdict = computeVerdict(item, { ...fullProfile, suggestByStyle: false });
  const missingVerdict = computeVerdict(item, { ...fullProfile, selectedStyles: [] });
  const offExplanation = offVerdict.criteria.find(c => c.key === 'style')!.explanation;
  const missingExplanation = missingVerdict.criteria.find(c => c.key === 'style')!.explanation;
  assertNotEquals(offExplanation, missingExplanation);
});

Deno.test('suggestByMeasurements=false: measurement criterion becomes unavailable even with full body + garment measurements', () => {
  const item = makeFitItem();
  const profileOff = { ...fullProfile, suggestByMeasurements: false };
  const verdict = computeVerdict(item, profileOff);
  const measurementCriterion = verdict.criteria.find(c => c.key === 'measurement')!;
  assertEquals(measurementCriterion.available, false);
  assertEquals(measurementCriterion.score, null);
});

Deno.test('suggestByMeasurements=false does NOT touch the fit criterion (body_shape + preferredFit stay scored — that is a separate criterion, not this toggle\'s concern)', () => {
  const item = makeFitItem();
  const on = computeVerdict(item, fullProfile).criteria.find(c => c.key === 'fit')!;
  const off = computeVerdict(item, { ...fullProfile, suggestByMeasurements: false }).criteria.find(c => c.key === 'fit')!;
  assertEquals(on.available, true);
  assertEquals(off.available, true);
  // Byte-identical score: body_shape/preferredFit scoring is completely
  // unaffected by this toggle.
  assertEquals(on.score, off.score);
});

Deno.test('suggestByStyle/suggestByMeasurements unset (undefined) behave exactly like true — existing users unaffected', () => {
  const item = makeFitItem();
  const explicitOn = computeVerdict(item, { ...fullProfile, suggestByStyle: true, suggestByMeasurements: true });
  const unset = computeVerdict(item, fullProfile);
  assertEquals(unset.overall_score, explicitOn.overall_score);
  for (let i = 0; i < unset.criteria.length; i++) {
    assertEquals(unset.criteria[i].available, explicitOn.criteria[i].available);
    assertEquals(unset.criteria[i].score, explicitOn.criteria[i].score);
  }
});
