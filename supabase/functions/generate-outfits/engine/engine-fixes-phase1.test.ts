// Deno tests for the "Phase 1 wiring bugs" fix pass (2026-08-06,
// docs/engine-fixes-phase1-instruction.md). Run:
//   deno test supabase/functions/generate-outfits/engine/
//
// Covers the three fixes at the engine boundary layer (index.ts itself is a
// Deno.serve handler with no exports and can't be unit-tested directly — these
// tests exercise the exact functions index.ts now calls at each boundary):
//   Fix 1 — toBodyMeasurements (enrichment.ts): DB row → BodyMeasurements,
//           preferred_fit -> preferredFit no longer silently dropped.
//   Fix 2 — computeUserAttributes -> styleProfile.computedAttributes ->
//           resolveTargetSilhouette's style-silhouette cascade level.
//   Fix 3 — toFitItem (enrichment.ts): primary_hex color refinement + the
//           structured `graphics` jsonb now activate.

import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { toBodyMeasurements, toFitItem } from './enrichment.ts';
import { scoreOutfitFit, computeUserAttributes } from './scoring.ts';
import { resolveTargetSilhouette } from './silhouette.ts';
import { ClothingItemRow, EngineContext, FitItem, ItemCategory } from './types.ts';

// ═══════════════════════════════════════════════════════════════════════════
// Fix 1 — BodyMeasurements snake_case → camelCase mapping
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('toBodyMeasurements: preferred_fit (DB) maps to preferredFit (engine)', () => {
  const row = { preferred_fit: 'SLIM', body_bust: 90 };
  const mapped = toBodyMeasurements(row);
  assertEquals(mapped.preferredFit, 'SLIM');
  assertEquals(mapped.body_bust, 90);
});

Deno.test('toBodyMeasurements: null/absent preferred_fit -> undefined (not the string "null")', () => {
  assertEquals(toBodyMeasurements({ preferred_fit: null }).preferredFit, undefined);
  assertEquals(toBodyMeasurements({}).preferredFit, undefined);
  assertEquals(toBodyMeasurements(null).preferredFit, undefined);
});

Deno.test('toBodyMeasurements: unrecognized preferred_fit value maps to undefined, not passed through raw', () => {
  // Defensive: a stale/dirty row must not reach FIT_COMPAT's exhaustive lookup
  // with a key it doesn't have (that would throw, not silently degrade).
  const mapped = toBodyMeasurements({ preferred_fit: 'slim' }); // legacy lowercase
  assertEquals(mapped.preferredFit, undefined);
});

Deno.test('toBodyMeasurements: body_shape passes through unchanged (was never actually dead — key names already matched)', () => {
  assertEquals(toBodyMeasurements({ body_shape: 'hourglass' }).body_shape, 'hourglass');
  assertEquals(toBodyMeasurements({ body_shape: 'not_a_real_shape' }).body_shape, undefined);
});

Deno.test('toBodyMeasurements: numeric body_* columns pass straight through by name', () => {
  const row = {
    body_height: 170, body_weight: 60, body_bust: 90, body_waist: 70,
    body_shoulder_width: 40, body_sleeve_length: 60, body_upper_body_length: 45,
    body_upper_arm: 28, body_neck: 35, body_hip: 95, body_inseam: 75,
    body_thigh: 55, body_rise: 25, body_foot_length: 24, body_foot_width: 9,
  };
  assertEquals(toBodyMeasurements(row), { ...row, preferredFit: undefined, body_shape: undefined });
});

// Regression per the instruction: a profile with preferred_fit set must score
// differently from one without it, once threaded through toBodyMeasurements.
function fitItem(id: string, category: ItemCategory, fit: FitItem['fit']): FitItem {
  return {
    id, category, typeName: 'TEE',
    colorProfile: { primaryColor: 'gray', colorLightness: 'medium', colorSaturation: 'muted', sat: 20, lum: 50, undertone: 'neutral' },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    styleTags: [], fit, formality: 2.5, statementStrength: 0.5,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

Deno.test('Fix 1 regression: preferred_fit=SLIM vs no preferred_fit produce different fit scores for a slim outfit', () => {
  const slimOutfit = [fitItem('top', 'top', 'slim'), fitItem('bottom', 'bottom', 'slim')];
  const withPref = scoreOutfitFit(slimOutfit, toBodyMeasurements({ preferred_fit: 'SLIM' }));
  const withoutPref = scoreOutfitFit(slimOutfit, toBodyMeasurements({}));
  assertNotEquals(withPref, withoutPref);
  assert(withPref > withoutPref, `a SLIM preference on an all-slim outfit should score higher: ${withPref} vs ${withoutPref}`);
});

Deno.test('Fix 1 regression: preferred_fit=SLIM rewards a slim outfit and penalizes an oversized one relative to no preference', () => {
  const slimOutfit = [fitItem('top', 'top', 'slim'), fitItem('bottom', 'bottom', 'slim')];
  const oversizedOutfit = [fitItem('top', 'top', 'oversized'), fitItem('bottom', 'bottom', 'oversized')];
  const body = toBodyMeasurements({ preferred_fit: 'SLIM' });
  const noPref = toBodyMeasurements({});
  const slimWithPref = scoreOutfitFit(slimOutfit, body);
  const slimNoPref = scoreOutfitFit(slimOutfit, noPref);
  const oversizedWithPref = scoreOutfitFit(oversizedOutfit, body);
  const oversizedNoPref = scoreOutfitFit(oversizedOutfit, noPref);
  assert(slimWithPref > slimNoPref, 'slim outfit should score higher once the SLIM preference is wired in');
  assert(oversizedWithPref < oversizedNoPref, 'oversized outfit should score lower once the SLIM preference is wired in');
});

// ═══════════════════════════════════════════════════════════════════════════
// Fix 2 — style-silhouette cascade (computedAttributes wiring)
// ═══════════════════════════════════════════════════════════════════════════

function baseCtx(overrides: Partial<EngineContext> = {}): EngineContext {
  return { bodyMeasurements: {}, styleProfile: { selectedStyles: [] }, colorPreferences: [], ...overrides };
}

Deno.test('Fix 2: selectedStyles=[minimalist], no body_shape, no intent -> target comes from the style silhouette, not the neutral fallback', () => {
  const selectedStyles = ['minimalist'];
  // Mirrors exactly what index.ts now does at the boundary: compute the
  // attribute vector for the resolved styles and set it before resolving.
  const ctx = baseCtx({
    styleProfile: { selectedStyles, computedAttributes: computeUserAttributes(selectedStyles) },
  });
  const target = resolveTargetSilhouette(ctx, []);
  assertEquals(target.source, 'style.silhouette=tailored'); // minimalist's primary silhouette attribute
  assertNotEquals(target.source, 'neutral_fallback');
});

Deno.test('Fix 2: selectedStyles=[streetwear], no body_shape, no intent -> target comes from style.silhouette=oversized', () => {
  const selectedStyles = ['streetwear'];
  const ctx = baseCtx({
    styleProfile: { selectedStyles, computedAttributes: computeUserAttributes(selectedStyles) },
  });
  const target = resolveTargetSilhouette(ctx, []);
  assertEquals(target.source, 'style.silhouette=oversized');
  for (const t of target.targets) assert(t.topVol > t.bottomVol, `oversized style should favour top volume, got ${JSON.stringify(t)}`);
});

Deno.test('Fix 2 regression: WITHOUT computedAttributes wired (the pre-fix bug), the same profile falls through to neutral_fallback', () => {
  // Proves the bug was real: selectedStyles alone (no computedAttributes) never
  // reaches fromStyleSilhouette, which only reads ctx.styleProfile.computedAttributes.
  const ctx = baseCtx({ styleProfile: { selectedStyles: ['minimalist'] } }); // computedAttributes NOT set
  const target = resolveTargetSilhouette(ctx, []);
  assertEquals(target.source, 'neutral_fallback');
});

Deno.test('Fix 2: body_shape still wins when no style is selected (cascade order unchanged)', () => {
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'triangle' } });
  const target = resolveTargetSilhouette(ctx, []);
  assertEquals(target.source, 'body_shape=triangle');
});

// ═══════════════════════════════════════════════════════════════════════════
// Fix 3 — primary_hex / secondary_hex / graphics wiring
// ═══════════════════════════════════════════════════════════════════════════

function row(overrides: Partial<ClothingItemRow> = {}): ClothingItemRow {
  return { id: 'i1', type: 'TEE', name: 'Plain Cotton Tee', color: 'Black', ...overrides };
}

Deno.test('Fix 3a: primary_hex refines colorProfile hue/sat/lum, categorical name stays from `color`', () => {
  const withoutHex = toFitItem(row());
  const withHex = toFitItem(row({ primary_hex: '#FF0000' })); // pure red
  assertEquals(withoutHex.colorProfile.primaryColor, 'black');
  assertEquals(withHex.colorProfile.primaryColor, 'black'); // name unchanged
  assertNotEquals(withHex.colorProfile.hue, withoutHex.colorProfile.hue);
  assertEquals(withHex.colorProfile.hue, 0);
  assertEquals(withHex.colorProfile.sat, 100);
  assertEquals(withHex.colorProfile.lum, 50);
});

Deno.test('Fix 3a: an invalid primary_hex is ignored (no crash, falls back to the named color)', () => {
  const item = toFitItem(row({ primary_hex: 'not-a-hex' }));
  assertEquals(item.colorProfile.hue, undefined); // Black's canonical (achromatic) hue
});

Deno.test('Fix 3b: structured graphics jsonb overrides an innocent name (large graphic, no keyword in the name)', () => {
  const withoutGraphics = toFitItem(row()); // name has no graphic/print/logo keyword
  const withGraphics = toFitItem(row({ graphics: { present: true, size: 'large', kind: 'graphic', text: null } }));
  assertEquals(withoutGraphics.graphics.graphicWeight, 'none');
  assertEquals(withGraphics.graphics.graphicWeight, 'large_graphic');
  assertEquals(withGraphics.graphics.artworkType, 'graphic_illustration');
  assert(withGraphics.statementStrength > withoutGraphics.statementStrength,
    `structured graphics should raise statementStrength: ${withGraphics.statementStrength} vs ${withoutGraphics.statementStrength}`);
});

Deno.test('Fix 3b: graphics present:false is a definitive "no graphic" signal, even if the name would keyword-match', () => {
  const item = toFitItem(row({ name: 'Graphic Print Tee', graphics: { present: false, size: null, kind: null, text: null } }));
  assertEquals(item.graphics.graphicWeight, 'none');
  assertEquals(item.graphics.artworkType, 'none');
});

Deno.test('Fix 3b: graphics jsonb absent (null/undefined) falls back to name-keyword inference unchanged', () => {
  const viaNull = toFitItem(row({ name: 'Logo Tee', graphics: null }));
  const viaAbsent = toFitItem(row({ name: 'Logo Tee' }));
  assertEquals(viaNull.graphics, viaAbsent.graphics);
  assertEquals(viaAbsent.graphics.artworkType, 'brand_logo'); // 'logo' keyword inference
});

Deno.test('Fix 3c regression: null primary_hex/secondary_hex/graphics behave identically to the columns being absent', () => {
  const absent = toFitItem(row());
  const explicitNull = toFitItem(row({ primary_hex: null, secondary_hex: null, graphics: null }));
  assertEquals(JSON.stringify(explicitNull), JSON.stringify(absent));
});
