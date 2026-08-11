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
  resolveTargetSilhouette, pairSilhouetteMatch, measurementPriorityBoost, outfitSilhouetteTag,
  resultingBodySilhouette, outfitWaistDefinition,
} from './silhouette.ts';
import { EngineContext, FitItem, ItemCategory, GarmentMeasurements, TargetSilhouette } from './types.ts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    fit?: FitItem['fit'];
    provenanceFit?: boolean;
    garmentMeasurements?: GarmentMeasurements;
    typeName?: string;
    drape?: FitItem['drape'];
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName: opts.typeName ?? 'TEE',
    colorProfile: {
      primaryColor: 'gray', colorLightness: 'medium', colorSaturation: 'muted',
      sat: 20, lum: 50, undertone: 'neutral',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    garmentMeasurements: opts.garmentMeasurements,
    styleTags: [],
    fit: opts.fit ?? 'regular',
    formality: 2.5,
    statementStrength: 0.5,
    drape: opts.drape,
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

// ─── outfitSilhouetteTag (display-only, 2026-07-12) ─────────────────────────

Deno.test('outfitSilhouetteTag: no target, slim top + slim bottom -> fitted', () => {
  const items = [fi('t1', 'top', { fit: 'slim' }), fi('b1', 'bottom', { fit: 'slim' })];
  assertEquals(outfitSilhouetteTag(items), 'fitted');
});

Deno.test('outfitSilhouetteTag: no target, oversized top + slim bottom -> top-volume', () => {
  const items = [fi('t1', 'top', { fit: 'oversized' }), fi('b1', 'bottom', { fit: 'slim' })];
  assertEquals(outfitSilhouetteTag(items), 'top-volume');
});

Deno.test('outfitSilhouetteTag: no target, slim top + wide bottom -> bottom-volume', () => {
  const items = [fi('t1', 'top', { fit: 'slim' }), fi('b1', 'bottom', { fit: 'wide' })];
  assertEquals(outfitSilhouetteTag(items), 'bottom-volume');
});

Deno.test('outfitSilhouetteTag: no target, regular top + relaxed bottom -> straight', () => {
  const items = [fi('t1', 'top', { fit: 'regular' }), fi('b1', 'bottom', { fit: 'relaxed' })];
  assertEquals(outfitSilhouetteTag(items), 'straight');
});

Deno.test('outfitSilhouetteTag: ignores target — reads only the outfit\'s own realized volumes', () => {
  // Outfit realizes oversized top (5) + regular bottom (2) -> own volumes give
  // 'top-volume' regardless of any target silhouette (no longer an input).
  const items = [fi('t1', 'top', { fit: 'oversized' }), fi('b1', 'bottom', { fit: 'regular' })];
  assertEquals(outfitSilhouetteTag(items), 'top-volume');
});

// ─── resultingBodySilhouette (resulting on-body shape, 2026-07-12) ──────────
// Display-only — the geometric silhouette the USER'S BODY reads as after
// wearing the outfit: body_shape baseline shifted by how much volume the
// garments add over a neutral (regular) piece. Each expected value below is
// hand-verified against the eTop/eBottom/diff/avg formula in silhouette.ts.

Deno.test('resultingBodySilhouette: rectangle body + regular top + regular bottom -> rectangle', () => {
  const items = [fi('t1', 'top', { fit: 'regular' }), fi('b1', 'bottom', { fit: 'regular' })];
  assertEquals(resultingBodySilhouette(items, 'rectangle'), 'rectangle');
});

Deno.test('resultingBodySilhouette: rectangle body + wide bottom + regular top -> triangle', () => {
  const items = [fi('t1', 'top', { fit: 'regular' }), fi('b1', 'bottom', { fit: 'wide' })];
  assertEquals(resultingBodySilhouette(items, 'rectangle'), 'triangle');
});

Deno.test('resultingBodySilhouette: rectangle body + oversized top + regular bottom -> inverted-triangle', () => {
  const items = [fi('t1', 'top', { fit: 'oversized' }), fi('b1', 'bottom', { fit: 'regular' })];
  assertEquals(resultingBodySilhouette(items, 'rectangle'), 'inverted-triangle');
});

Deno.test('resultingBodySilhouette: triangle body + regular top + regular bottom -> triangle', () => {
  const items = [fi('t1', 'top', { fit: 'regular' }), fi('b1', 'bottom', { fit: 'regular' })];
  assertEquals(resultingBodySilhouette(items, 'triangle'), 'triangle');
});

Deno.test('resultingBodySilhouette: triangle body + oversized top + regular bottom -> rectangle (balances the pear)', () => {
  const items = [fi('t1', 'top', { fit: 'oversized' }), fi('b1', 'bottom', { fit: 'regular' })];
  assertEquals(resultingBodySilhouette(items, 'triangle'), 'rectangle');
});

Deno.test('resultingBodySilhouette: hourglass body + slim top + slim bottom -> hourglass', () => {
  const items = [fi('t1', 'top', { fit: 'slim' }), fi('b1', 'bottom', { fit: 'slim' })];
  assertEquals(resultingBodySilhouette(items, 'hourglass'), 'hourglass');
});

Deno.test('resultingBodySilhouette: hourglass body + oversized top + oversized bottom -> oval', () => {
  const items = [fi('t1', 'top', { fit: 'oversized' }), fi('b1', 'bottom', { fit: 'oversized' })];
  assertEquals(resultingBodySilhouette(items, 'hourglass'), 'oval');
});

Deno.test('resultingBodySilhouette: inverted_triangle body + wide bottom + regular top -> rectangle', () => {
  const items = [fi('t1', 'top', { fit: 'regular' }), fi('b1', 'bottom', { fit: 'wide' })];
  assertEquals(resultingBodySilhouette(items, 'inverted_triangle'), 'rectangle');
});

Deno.test('resultingBodySilhouette: apple body + regular top + regular bottom -> oval', () => {
  const items = [fi('t1', 'top', { fit: 'regular' }), fi('b1', 'bottom', { fit: 'regular' })];
  assertEquals(resultingBodySilhouette(items, 'apple'), 'oval');
});

Deno.test('resultingBodySilhouette: no body_shape + relaxed top + wide bottom -> rectangle (neutral baseline)', () => {
  // Neutral 3/3 baseline: eTop = 3+(3-2)=4, eBottom = 3+(4-2)=5, diff=-1 (not
  // <=-2), avg=4.5 (<5) -> balanced, no waist/rounded on neutral -> rectangle.
  const items = [fi('t1', 'top', { fit: 'relaxed' }), fi('b1', 'bottom', { fit: 'wide' })];
  assertEquals(resultingBodySilhouette(items, undefined), 'rectangle');
});

Deno.test('resultingBodySilhouette: rectangle body + regular top/bottom + oversized outerwear -> inverted-triangle', () => {
  // Outer layer wins the top-volume max: topGarmentVol = max(regular=2, oversized=5) = 5.
  // eTop = 3+(5-2)=6, eBottom = 3+0=3, diff=3 -> inverted-triangle.
  const items = [
    fi('t1', 'top', { fit: 'regular' }),
    fi('b1', 'bottom', { fit: 'regular' }),
    fi('o1', 'outwear', { fit: 'oversized' }),
  ];
  assertEquals(resultingBodySilhouette(items, 'rectangle'), 'inverted-triangle');
});

// ─── outfitWaistDefinition (2026-08-10 fix) ──────────────────────────────────

Deno.test('outfitWaistDefinition: belt accessory alone is enough', () => {
  const items = [
    fi('t1', 'top', { fit: 'oversized' }),
    fi('b1', 'bottom', { fit: 'wide' }),
    fi('belt', 'accessory', { typeName: 'BELT' }),
  ];
  assert(outfitWaistDefinition(items));
});

Deno.test('outfitWaistDefinition: structural piece (BLAZER) with non-oversized/wide fit is enough', () => {
  const items = [fi('o1', 'outwear', { typeName: 'BLAZER', fit: 'regular' })];
  assert(outfitWaistDefinition(items));
});

Deno.test('outfitWaistDefinition: structural piece (CORSET) with non-oversized/wide fit is enough', () => {
  const items = [fi('t1', 'top', { typeName: 'CORSET', fit: 'slim' })];
  assert(outfitWaistDefinition(items));
});

Deno.test('outfitWaistDefinition: an OVERSIZED blazer does not count — construction washed out', () => {
  const items = [fi('o1', 'outwear', { typeName: 'BLAZER', fit: 'oversized' })];
  assert(!outfitWaistDefinition(items));
});

Deno.test('outfitWaistDefinition: fitted top + fitted bottom + structured drape is enough', () => {
  const items = [
    fi('t1', 'top', { fit: 'slim', typeName: 'SHIRT' }),
    fi('b1', 'bottom', { fit: 'regular', typeName: 'TROUSERS', drape: 'structured' }),
  ];
  assert(outfitWaistDefinition(items));
});

Deno.test('outfitWaistDefinition: fitted top + fitted bottom WITHOUT structured drape does not count', () => {
  const items = [
    fi('t1', 'top', { fit: 'slim', typeName: 'SHIRT' }),
    fi('b1', 'bottom', { fit: 'regular', typeName: 'TROUSERS' }),
  ];
  assert(!outfitWaistDefinition(items));
});

Deno.test('outfitWaistDefinition: plain oversized top + wide bottom, no belt/structural piece/drape -> false', () => {
  const items = [
    fi('t1', 'top', { fit: 'oversized', typeName: 'TEE' }),
    fi('b1', 'bottom', { fit: 'wide', typeName: 'JEANS' }),
  ];
  assert(!outfitWaistDefinition(items));
});

// ─── resultingBodySilhouette: outfit-made waist beats base.rounded (2026-08-10 fix) ──
// Before this fix, `base.rounded` (apple) or the absence of `base.waist`
// (triangle/rectangle/inverted_triangle) made 'hourglass' UNREACHABLE for
// anyone whose body_shape wasn't already hourglass — no matter how
// waist-defining the outfit. These are the two guarantees required by the fix.

Deno.test('resultingBodySilhouette: apple body + waist-defining blazer + non-wide bottom -> hourglass (previously impossible)', () => {
  const items = [
    fi('o1', 'outwear', { typeName: 'BLAZER', fit: 'regular' }),
    fi('b1', 'bottom', { fit: 'regular', typeName: 'TROUSERS' }),
  ];
  assertEquals(resultingBodySilhouette(items, 'apple'), 'hourglass');
});

Deno.test('resultingBodySilhouette: rectangle body + belt -> hourglass (previously impossible)', () => {
  const items = [
    fi('t1', 'top', { fit: 'regular' }),
    fi('b1', 'bottom', { fit: 'regular' }),
    fi('belt', 'accessory', { typeName: 'BELT' }),
  ];
  assertEquals(resultingBodySilhouette(items, 'rectangle'), 'hourglass');
});

Deno.test('resultingBodySilhouette: apple body + plain regular top/bottom (no waist signal) -> still oval, unchanged', () => {
  // Guards against over-correcting: apple with no belt/structural piece/drape
  // signal must keep its pre-fix behavior exactly.
  const items = [fi('t1', 'top', { fit: 'regular' }), fi('b1', 'bottom', { fit: 'regular' })];
  assertEquals(resultingBodySilhouette(items, 'apple'), 'oval');
});

Deno.test('resultingBodySilhouette: outfit-made waist is still capped by avg>=5 (very voluminous everywhere reads oval even with a belt)', () => {
  const items = [
    fi('t1', 'top', { fit: 'oversized' }),
    fi('b1', 'bottom', { fit: 'oversized' }),
    fi('belt', 'accessory', { typeName: 'BELT' }),
  ];
  assertEquals(resultingBodySilhouette(items, 'apple'), 'oval');
});

// ─── shapeGoal cascade tier (2026-08-10) ─────────────────────────────────────

Deno.test('shapeGoal undefined -> resolveTargetSilhouette is byte-for-byte identical to the pre-feature cascade (body_shape tier)', () => {
  const withoutField = resolveTargetSilhouette(baseCtx({ bodyMeasurements: { body_shape: 'triangle' } }), NO_ITEMS);
  const explicitUndefined = resolveTargetSilhouette(
    baseCtx({ bodyMeasurements: { body_shape: 'triangle' }, shapeGoal: undefined }), NO_ITEMS,
  );
  assertEquals(withoutField.source, 'body_shape=triangle');
  assertEquals(JSON.stringify(withoutField), JSON.stringify(explicitUndefined));
});

Deno.test("shapeGoal='auto' -> resolveTargetSilhouette falls through exactly like undefined (zero regression)", () => {
  const auto = resolveTargetSilhouette(
    baseCtx({ bodyMeasurements: { body_shape: 'triangle' }, shapeGoal: 'auto' }), NO_ITEMS,
  );
  const unset = resolveTargetSilhouette(baseCtx({ bodyMeasurements: { body_shape: 'triangle' } }), NO_ITEMS);
  assertEquals(JSON.stringify(auto), JSON.stringify(unset));
});

Deno.test("shapeGoal='auto' also falls through to the style-silhouette tier unchanged when no body_shape is set", () => {
  const ctx = baseCtx({
    shapeGoal: 'auto',
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

Deno.test("shapeGoal specific value overrides BOTH style silhouette and body_shape", () => {
  const ctx = baseCtx({
    bodyMeasurements: { body_shape: 'hourglass' },
    styleProfile: {
      selectedStyles: [],
      computedAttributes: {
        formality: 3, colorPalette: [], silhouette: ['oversized'], patternLevel: 2, textureRichness: 2, mood: [],
      },
    },
    shapeGoal: 'triangle',
  });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assert(target.source.startsWith('shapeGoal=triangle'), `expected shapeGoal tier to fire, got source=${target.source}`);
  for (const t of target.targets) assert(t.bottomVol > t.topVol, `expected a bottom-heavy target, got ${JSON.stringify(t)}`);
});

Deno.test("intent still overrides a set shapeGoal (intent > shapeGoal in the cascade)", () => {
  const ctx = baseCtx({
    shapeGoal: 'triangle',
    intent: { proportionRule: 'oversized_top' },
  });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'intent.proportionRule=oversized_top');
});

Deno.test("shapeGoal='natural' returns neutral balanced volume, not a body_shape-flattering one", () => {
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'apple' }, shapeGoal: 'natural' });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.source, 'shapeGoal=natural');
  assertEquals(target.targets, [{ topVol: 2, bottomVol: 2, weight: 1.0, label: 'shape_goal_natural' }]);
});

Deno.test("shapeGoal='oval' targets maximum volume on both halves", () => {
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'rectangle' }, shapeGoal: 'oval' });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  for (const t of target.targets) { assertEquals(t.topVol, 5); assertEquals(t.bottomVol, 5); }
});

Deno.test("shapeGoal='hourglass' targets balanced volume (the waist itself comes from outfitWaistDefinition/shapeGoalDelta, not volume)", () => {
  const ctx = baseCtx({ bodyMeasurements: { body_shape: 'triangle' }, shapeGoal: 'hourglass' });
  const target = resolveTargetSilhouette(ctx, NO_ITEMS);
  assertEquals(target.targets, [{ topVol: 2, bottomVol: 2, weight: 1.0, label: 'shape_goal_hourglass_balanced' }]);
});
