// Deno tests for silhouette-first resolution (010-wardrobe-critic follow-up).
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees:
//   - each body_shape derives a target direction that agrees with
//     bodyShapeMultiplier (scoring.ts) — never contradicts it
//   - intent.proportionRule overrides the body_shape default
//   - confidence ≈ 0 with no measured items, higher with several
//   - measurementPriorityBoost ranks a measured item above a guessed one
//   - pairSilhouetteMatch is monotonic in distance from the target
//   - resolveTargetSilhouette is deterministic for a fixed input

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  resolveTargetSilhouette, pairSilhouetteMatch, measurementPriorityBoost,
} from './silhouette.ts';
import { EngineContext, FitItem, ItemCategory, GarmentMeasurements } from './types.ts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    fit?: FitItem['fit'];
    provenanceFit?: boolean;
    garmentMeasurements?: GarmentMeasurements;
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName: 'TEE',
    colorProfile: {
      primaryColor: 'gray', colorLightness: 'medium', colorSaturation: 'muted',
      sat: 20, lum: 50, undertone: 'neutral',
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
  return {
    bodyMeasurements: {},
    styleProfile: { selectedStyles: [] },
    colorPreferences: [],
    ...overrides,
  };
}

const NO_ITEMS: FitItem[] = [];

// ─── body_shape direction agrees with bodyShapeMultiplier ───────────────────

Deno.test('body_shape=triangle: target favours a bottom volume >= top volume (wide/broad bottom, per +0.07 reward)', () => {
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'triangle' } });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'body_shape=triangle');
  for (const t of target.targets) assert(t.bottomVol >= t.topVol, `expected bottomVol >= topVol, got ${JSON.stringify(t)}`);
});

Deno.test('body_shape=inverted_triangle: target favours a fitted top and a wider bottom (per -0.08 top / +0.06 bottom)', () => {
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'inverted_triangle' } });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'body_shape=inverted_triangle');
  for (const t of target.targets) assert(t.topVol < t.bottomVol, `expected topVol < bottomVol, got ${JSON.stringify(t)}`);
});

Deno.test('body_shape=hourglass: target favours tailored (low-volume) fit on both halves (per +0.07 slim/regular reward)', () => {
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'hourglass' } });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'body_shape=hourglass');
  for (const t of target.targets) {
    assert(t.topVol <= 2, `expected a tailored (<=2) top volume, got ${t.topVol}`);
    assert(t.bottomVol <= 2, `expected a tailored (<=2) bottom volume, got ${t.bottomVol}`);
  }
});

Deno.test('body_shape=apple: target favours a looser top over a comparatively slimmer bottom (per +0.07 loose top reward)', () => {
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'apple' } });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'body_shape=apple');
  for (const t of target.targets) assert(t.topVol > t.bottomVol, `expected topVol > bottomVol, got ${JSON.stringify(t)}`);
});

Deno.test('body_shape=rectangle: target offers volume contrast in both directions (no single fit-specific rule to contradict)', () => {
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'rectangle' } });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'body_shape=rectangle');
  assert(target.targets.some(t => t.topVol > t.bottomVol));
  assert(target.targets.some(t => t.topVol < t.bottomVol));
});

Deno.test('no body_shape, no style silhouette, no intent -> neutral fallback', () => {
  const ctx = baseCtx();
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'neutral_fallback');
  assert(target.targets.length >= 2);
});

// ─── Override cascade ─────────────────────────────────────────────────────────

Deno.test('intent.proportionRule overrides body_shape', () => {
  const ctx = baseCtx({
    bodyMeasurements: { body_shape: 'triangle' },
    intent: { proportionRule: 'oversized_top' },
  });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'intent.proportionRule=oversized_top');
  for (const t of target.targets) assert(t.topVol > t.bottomVol, 'oversized_top should point top volume above bottom');
});

Deno.test('intent.bodyGoal overrides body_shape when no proportionRule is set', () => {
  const ctx = baseCtx({
    bodyMeasurements: { body_shape: 'apple' },
    intent: { bodyGoal: 'define_waist' },
  });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'intent.bodyGoal=define_waist');
});

Deno.test('style silhouette overrides body_shape when no intent is set', () => {
  const ctx = baseCtx({
    bodyMeasurements: { body_shape: 'hourglass' },
    styleProfile: {
      selectedStyles: [],
      computedAttributes: {
        formality: 3, colorPalette: [], silhouette: ['oversized'], patternLevel: 2, textureRichness: 2, mood: [],
      },
    },
  });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'style.silhouette=oversized');
});

// ─── Confidence ───────────────────────────────────────────────────────────────

Deno.test('confidence is 0 when no top/bottom item has real fit data', () => {
  const items = [
    fi('t1', 'top', { provenanceFit: false }),
    fi('b1', 'bottom', { provenanceFit: false }),
  ];
  const target = resolveTargetSilhouette(baseCtx(), items);
  assertEquals(target.confidence, 0);
});

Deno.test('confidence rises with more measured top/bottom items and saturates toward 1', () => {
  const few = [fi('t1', 'top', { provenanceFit: true }), fi('b1', 'bottom', { provenanceFit: false })];
  const many = [
    fi('t1', 'top', { provenanceFit: true }),
    fi('t2', 'top', { garmentMeasurements: { chest: 100 } }),
    fi('b1', 'bottom', { provenanceFit: true }),
    fi('b2', 'bottom', { garmentMeasurements: { waist: 80 } }),
    fi('b3', 'bottom', { provenanceFit: true }),
  ];
  const confFew = resolveTargetSilhouette(baseCtx(), few).confidence;
  const confMany = resolveTargetSilhouette(baseCtx(), many).confidence;
  assert(confFew > 0, 'one measured item should already lift confidence above 0');
  assert(confMany > confFew, `expected more measured coverage to raise confidence further: ${confFew} vs ${confMany}`);
  assert(confMany < 1, 'confidence should saturate but never reach exactly 1');
});

Deno.test('resolveTargetSilhouette is deterministic for the same input', () => {
  const items = [
    fi('t1', 'top', { provenanceFit: true }),
    fi('b1', 'bottom', { garmentMeasurements: { waist: 80 } }),
  ];
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'triangle' } });
  const a = resolveTargetSilhouette(ctx, items);
  const b = resolveTargetSilhouette(ctx, items);
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

// ─── measurementPriorityBoost ─────────────────────────────────────────────────

Deno.test('measurementPriorityBoost: garmentMeasurements > provenance.fit only > purely guessed', () => {
  const measured = fi('a', 'top', { garmentMeasurements: { chest: 100 } });
  const provenanceOnly = fi('b', 'top', { provenanceFit: true });
  const guessed = fi('c', 'top', { provenanceFit: false });

  const bMeasured = measurementPriorityBoost(measured);
  const bProvenance = measurementPriorityBoost(provenanceOnly);
  const bGuessed = measurementPriorityBoost(guessed);

  assert(bMeasured > bProvenance, `${bMeasured} should exceed ${bProvenance}`);
  assert(bProvenance > bGuessed, `${bProvenance} should exceed ${bGuessed}`);
  assertEquals(bGuessed, 0);
  assert(bMeasured >= 0 && bProvenance >= 0, 'boost is always non-negative');
});

// ─── pairSilhouetteMatch ────────────────────────────────────────────────────

Deno.test('pairSilhouetteMatch: exact match to a target pair scores 1', () => {
  const target = { targets: [{ topVol: 1, bottomVol: 4, weight: 1, label: 't' }], confidence: 1, source: 'test' };
  const top = fi('top', 'top', { fit: 'slim' });   // vol 1
  const bottom = fi('bottom', 'bottom', { fit: 'wide' }); // vol 4
  assertEquals(pairSilhouetteMatch(top, bottom, target), 1);
});

Deno.test('pairSilhouetteMatch is monotonic: farther top volume from the target scores lower', () => {
  const target = { targets: [{ topVol: 1, bottomVol: 4, weight: 1, label: 't' }], confidence: 1, source: 'test' };
  const bottom = fi('bottom', 'bottom', { fit: 'wide' }); // vol 4, matches target exactly
  const fits: FitItem['fit'][] = ['slim', 'regular', 'relaxed', 'wide', 'oversized']; // vol 1..5, increasing distance from topVol=1
  const scores = fits.map(f => pairSilhouetteMatch(fi('top', 'top', { fit: f }), bottom, target));
  for (let i = 1; i < scores.length; i++) {
    assert(scores[i] <= scores[i - 1], `expected non-increasing scores as distance grows: ${JSON.stringify(scores)}`);
  }
  assertEquals(scores[0], 1); // slim (vol 1) is the exact target match
});

Deno.test('pairSilhouetteMatch picks the BEST match across multiple target pairs', () => {
  const target = {
    targets: [
      { topVol: 1, bottomVol: 1, weight: 0.5, label: 'a' },
      { topVol: 5, bottomVol: 5, weight: 0.5, label: 'b' },
    ],
    confidence: 1, source: 'test',
  };
  const top = fi('top', 'top', { fit: 'oversized' });     // vol 5
  const bottom = fi('bottom', 'bottom', { fit: 'oversized' }); // vol 5
  assertEquals(pairSilhouetteMatch(top, bottom, target), 1); // matches the 'b' pair exactly
});
