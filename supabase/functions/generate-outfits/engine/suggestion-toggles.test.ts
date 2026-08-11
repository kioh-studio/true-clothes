// Deno tests for the "4 suggestion toggles" feature (2026-08-10):
// suggest_by_style / suggest_by_personal_color / suggest_by_formula /
// suggest_by_measurements. Only suggestByStyle and suggestByMeasurements are
// ranking.ts's concern — personal_color and formula are applied upstream in
// index.ts (nulling colorSeason/colorTone12/personal_palette, or skipping
// style_profiles.formula_preferences), so ranking.ts never sees those two.
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees:
//   - suggestByStyle=false drops styleCoherence out of the weighted average
//     (rankCandidates' `dims` valid flag), same "raw value untouched, just
//     excluded from totalScore" mechanism the provenance gates already use.
//   - suggestByMeasurements=false drops BOTH fitScore and proportionBalance
//     out the same way.
//   - undefined (unset column, pre-migration row) behaves exactly like true —
//     existing users see byte-for-byte unchanged behavior.
//   - suggestByMeasurements=false does NOT touch bodyMeasurements.body_shape
//     or the resolveTargetSilhouette body_shape cascade tier — that's
//     bodyNeutralMode's job, a separate, untouched toggle.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { rankCandidates } from './ranking.ts';
import { resolveTargetSilhouette } from './silhouette.ts';
import { FitItem, ItemCategory, EngineContext, OutfitCandidate, GarmentMeasurements } from './types.ts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    typeName?: string; primaryColor?: string;
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
    fit: 'regular',
    formality: 2.5,
    statementStrength: 0.5,
    provenance: { fit: opts.provenanceFit ?? false, material: false, pattern: false, warmthSeason: false },
  };
}

function baseCtx(overrides: Partial<EngineContext> = {}): EngineContext {
  return { bodyMeasurements: {}, styleProfile: { selectedStyles: [] }, colorPreferences: [], ...overrides };
}

const outfitItems = () => [
  fi('top',  'top',    { typeName: 'SHIRT',    primaryColor: 'white' }),
  fi('bot',  'bottom', { typeName: 'TROUSERS', primaryColor: 'navy' }),
  fi('shoe', 'shoes',  { typeName: 'SNEAKERS', primaryColor: 'white' }),
];
const candidates: OutfitCandidate[] = [
  { slots: { top: 'top', bottom: 'bot', shoes: 'shoe' }, formula: 'one_two_three' },
];

// ─── suggest_by_style ─────────────────────────────────────────────────────────

Deno.test('suggestByStyle=false: styleCoherence is computed unchanged but drops out of totalScore', () => {
  const items = outfitItems(); // styleTags: [] on every item — a deliberate mismatch
  // against the user's selected style, so styleCoherence lands at a neutral
  // 0.5 (see scoring.ts scoreStyleCoherence) — below this fixture's other
  // dims (color/formality/season/texture all > 0.65), so excluding it must
  // raise totalScore, not just change it by coincidence.
  const itemMap = new Map(items.map(i => [i.id, i]));
  const on = rankCandidates(candidates, itemMap, baseCtx({ styleProfile: { selectedStyles: ['minimalist'] }, suggestByStyle: true }));
  const off = rankCandidates(candidates, itemMap, baseCtx({ styleProfile: { selectedStyles: ['minimalist'] }, suggestByStyle: false }));

  assertEquals(on.length, 1);
  assertEquals(off.length, 1);
  // Raw dimension value: identical — the toggle excludes it from the average,
  // it does not zero or reinterpret the computed score itself.
  assertEquals(on[0].styleCoherence, off[0].styleCoherence);
  // Aggregate: measurably different, and in the expected direction (a
  // below-average dim dropping out raises the total).
  assert(off[0].totalScore > on[0].totalScore,
    `expected off (${off[0].totalScore}) > on (${on[0].totalScore})`);
});

Deno.test('suggestByStyle unset (undefined) behaves exactly like true — existing users unaffected', () => {
  const items = outfitItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  const explicitOn = rankCandidates(candidates, itemMap, baseCtx({ styleProfile: { selectedStyles: ['minimalist'] }, suggestByStyle: true }));
  const unset = rankCandidates(candidates, itemMap, baseCtx({ styleProfile: { selectedStyles: ['minimalist'] } }));
  assertEquals(unset[0].totalScore, explicitOn[0].totalScore);
});

// ─── suggest_by_measurements ────────────────────────────────────────────────

Deno.test('suggestByMeasurements=false: fitScore AND proportionBalance are computed unchanged but drop out of totalScore', () => {
  const items = outfitItems();
  // Give the top real garment measurements + real fit provenance so fitScore
  // is actually "measured" (fitHasData=true) and proportionBalance has real
  // fit data too (proportionHasData=true) — both dims must be `valid` when
  // the toggle is on, so this test actually exercises the flip, not a case
  // where they'd have been excluded anyway for lack of data.
  items[0] = fi('top', 'top', {
    typeName: 'SHIRT', primaryColor: 'white',
    garmentMeasurements: { chest: 100 }, provenanceFit: true,
  });
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_chest: 90, body_shape: 'rectangle' as const };

  const on = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, suggestByMeasurements: true }));
  const off = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, suggestByMeasurements: false }));

  assertEquals(on.length, 1);
  assertEquals(off.length, 1);
  assertEquals(on[0].fitScore, off[0].fitScore);
  assertEquals(on[0].proportionBalance, off[0].proportionBalance);
  assert(off[0].totalScore !== on[0].totalScore,
    `expected totalScore to change when both fit dims drop out (on=${on[0].totalScore}, off=${off[0].totalScore})`);
});

Deno.test('suggestByMeasurements unset (undefined) behaves exactly like true — existing users unaffected', () => {
  const items = outfitItems();
  items[0] = fi('top', 'top', { typeName: 'SHIRT', primaryColor: 'white', garmentMeasurements: { chest: 100 }, provenanceFit: true });
  const itemMap = new Map(items.map(i => [i.id, i]));
  const bodyMeasurements = { body_chest: 90, body_shape: 'rectangle' as const };
  const explicitOn = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements, suggestByMeasurements: true }));
  const unset = rankCandidates(candidates, itemMap, baseCtx({ bodyMeasurements }));
  assertEquals(unset[0].totalScore, explicitOn[0].totalScore);
});

// ─── suggest_by_measurements must NOT touch body_shape ─────────────────────

Deno.test('suggestByMeasurements=false does not suppress body_shape in resolveTargetSilhouette (that is bodyNeutralMode\'s job, not this toggle\'s)', () => {
  const ctx = baseCtx({
    bodyMeasurements: { body_shape: 'triangle' },
    suggestByMeasurements: false,
  });
  const target = resolveTargetSilhouette(ctx, []);
  // Same cascade tier/source as the plain body_shape case in silhouette.test.ts
  // — suggestByMeasurements plays no part in this function at all.
  assertEquals(target.source, 'body_shape=triangle');
  for (const t of target.targets) assert(t.bottomVol >= t.topVol);
});

Deno.test('suggestByMeasurements=false leaves bodyMeasurements.body_shape itself untouched', () => {
  const bodyMeasurements = { body_shape: 'hourglass' as const };
  const ctx = baseCtx({ bodyMeasurements, suggestByMeasurements: false });
  // ranking.ts must never mutate ctx.bodyMeasurements — confirm the object
  // passed in still carries body_shape after a full rankCandidates pass.
  const items = outfitItems();
  const itemMap = new Map(items.map(i => [i.id, i]));
  rankCandidates(candidates, itemMap, ctx);
  assertEquals(ctx.bodyMeasurements.body_shape, 'hourglass');
});
