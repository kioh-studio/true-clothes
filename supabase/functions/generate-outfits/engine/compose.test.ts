// Deno tests for anchor-first composition (S2, 2026-07-02).
//
// Guarantees:
//   - pairAffinity prefers harmonious pieces (a stylist's conditional pick)
//   - composition is deterministic for a fixed seed
//   - the loudest piece leads: it appears in the first emitted candidate
//   - counterparts are CHOSEN for the anchor, not enumerated: with a clashing
//     and a harmonious bottom available, the harmonious one is picked first
//   - anchor-major interleave: the first candidates come from different anchors
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { generateCandidates, pairAffinity } from './generation.ts';
import { FitItem, ItemCategory, GarmentMeasurements, TargetSilhouette } from './types.ts';

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    hue?: number; lum?: number; sat?: number; primaryColor?: string;
    undertone?: 'warm' | 'cool' | 'neutral'; formality?: number;
    statement?: number; fit?: FitItem['fit'];
    provenanceFit?: boolean; garmentMeasurements?: GarmentMeasurements;
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName: 'TEE',
    colorProfile: {
      primaryColor: (opts.primaryColor ?? 'gray') as FitItem['colorProfile']['primaryColor'],
      colorLightness: 'medium',
      colorSaturation: 'muted',
      hue: opts.hue,
      sat: opts.sat ?? 20,
      lum: opts.lum ?? 50,
      undertone: opts.undertone ?? 'neutral',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    garmentMeasurements: opts.garmentMeasurements,
    styleTags: [],
    fit: opts.fit ?? 'regular',
    warmth: 2,
    formality: opts.formality ?? 2.5,
    statementStrength: opts.statement ?? 0.5,
    provenance: { fit: opts.provenanceFit ?? false, material: false, pattern: false, warmthSeason: false },
  };
}

// ─── pairAffinity ────────────────────────────────────────────────────────────

Deno.test('pairAffinity: harmonious hue pair beats an awkward 90° pair', () => {
  const anchor = fi('a', 'top', { hue: 10, undertone: 'warm' });
  const analogous = fi('b', 'bottom', { hue: 30, undertone: 'warm', lum: 25 });
  const awkward = fi('c', 'bottom', { hue: 100, undertone: 'cool', lum: 25 });
  assert(pairAffinity(anchor, analogous) > pairAffinity(anchor, awkward));
});

Deno.test('pairAffinity: high_low rewards the register split it exists for', () => {
  const formal = fi('a', 'top', { formality: 4.0 });
  const casual = fi('b', 'bottom', { formality: 1.8, lum: 25 });
  assert(pairAffinity(formal, casual, 'high_low') > pairAffinity(formal, casual));
});

// ─── composition behaviour ───────────────────────────────────────────────────

// Wardrobe with one LOUD anchor top, one harmonious + one clashing bottom.
function wardrobe(): FitItem[] {
  return [
    // Loud warm-red statement top — the obvious anchor.
    fi('top-hero', 'top', { hue: 5, lum: 45, sat: 80, primaryColor: 'red', undertone: 'warm', statement: 3.0 }),
    // Quiet second top.
    fi('top-quiet', 'top', { primaryColor: 'white', lum: 90, statement: 0.3 }),
    // Harmonious bottom (neutral, good contrast) vs clashing bottom (cool green hue, same lum).
    fi('bot-good', 'bottom', { primaryColor: 'charcoal', lum: 22, statement: 0.3 }),
    fi('bot-clash', 'bottom', { hue: 110, lum: 48, sat: 60, primaryColor: 'green', undertone: 'cool', statement: 1.2 }),
    // Shoes.
    fi('shoe-a', 'shoes', { primaryColor: 'black', lum: 12, statement: 0.3 }),
    fi('shoe-b', 'shoes', { primaryColor: 'white', lum: 92, statement: 0.3 }),
  ];
}

// Compose behaviour is pool-scoped, so exercise it through rule_of_thirds —
// the one formula whose pool is the unfiltered wardrobe (hero-led generation
// across the WHOLE feed is generateHeroCandidates' job in index.ts, not this).
const RULE_OF_THIRDS = ['rule_of_thirds'] as Parameters<typeof generateCandidates>[1];

Deno.test('composition is deterministic for a fixed seed', () => {
  const a = generateCandidates(wardrobe(), RULE_OF_THIRDS, 'seed-1');
  const b = generateCandidates(wardrobe(), RULE_OF_THIRDS, 'seed-1');
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test('the loudest piece in the pool leads the first composed look', () => {
  const candidates = generateCandidates(wardrobe(), RULE_OF_THIRDS, 'seed-1');
  assert(candidates.length > 0);
  const first = candidates[0].slots;
  assert(first.top === 'top-hero' || first.bottom === 'top-hero',
    `expected top-hero in first candidate, got ${JSON.stringify(first)}`);
});

Deno.test('the counterpart is chosen FOR the anchor: harmonious bottom before clashing one', () => {
  const candidates = generateCandidates(wardrobe(), RULE_OF_THIRDS, 'seed-1');
  const firstHero = candidates.find(c => c.slots.top === 'top-hero');
  assert(firstHero !== undefined);
  assertEquals(firstHero!.slots.bottom, 'bot-good');
});

Deno.test('anchor-major interleave: first two distinct cores come from different anchors', () => {
  const candidates = generateCandidates(wardrobe(), RULE_OF_THIRDS, 'seed-1');
  const coreKey = (c: typeof candidates[number]) => `${c.slots.top}|${c.slots.bottom}|${c.slots.shoes}`;
  const distinctCores: string[] = [];
  const anchorsSeen = new Set<string>();
  for (const c of candidates) {
    const key = coreKey(c);
    if (distinctCores.includes(key)) continue;
    distinctCores.push(key);
    // Which anchor led this look? The loudest item in it.
    anchorsSeen.add([c.slots.top, c.slots.bottom].join('|'));
    if (distinctCores.length >= 2) break;
  }
  assert(anchorsSeen.size >= 2, 'first two cores should be led by different anchors');
});

// ─── Silhouette-first resolution (2026-07-12) ───────────────────────────────
//
// Guarantees exercised here:
//   - a MEASURED item that realizes the target beats an equally
//     color-harmonious GUESSED item that doesn't (Phase C)
//   - a target with confidence 0 (the resolveTargetSilhouette output for a
//     fully-guessed wardrobe) is a byte-identical no-op — degradable
//   - the target never ELIMINATES a mismatching guessed item; it can only be
//     out-ranked, never filtered out entirely

// A wardrobe where the top and both bottom candidates are colour/formality-
// IDENTICAL (same hue/lum/sat/undertone/formality) so pairAffinity's color,
// light, formality and undertone terms are tied — only proportion (fit
// volume) and measurement provenance differ between the two bottoms.
function silhouetteWardrobe(): FitItem[] {
  const shared = { primaryColor: 'gray', lum: 50, sat: 20, undertone: 'neutral' as const, formality: 2.5 };
  return [
    fi('top1', 'top', { ...shared, fit: 'slim', statement: 1.0 }),
    // Measured (detailed garmentMeasurements) wide bottom — realizes a
    // fitted-top/wide-bottom target.
    fi('bot-wide-measured', 'bottom', { ...shared, fit: 'wide', statement: 0.3, garmentMeasurements: { waist: 80 } }),
    // Guessed slim bottom — equally color-harmonious, but does NOT realize
    // the target and carries no real fit provenance.
    fi('bot-slim-guessed', 'bottom', { ...shared, fit: 'slim', statement: 0.3, provenanceFit: false }),
    fi('shoe1', 'shoes', { primaryColor: 'black', lum: 12, sat: 0, statement: 0.3 }),
  ];
}

// Target: a fitted top over a wide bottom — matches 'bot-wide-measured' exactly.
const FITTED_TOP_WIDE_BOTTOM: TargetSilhouette = {
  targets: [{ topVol: 1, bottomVol: 4, weight: 1, label: 'fitted_top_wide_bottom' }],
  confidence: 1,
  source: 'test',
};

Deno.test('silhouette-first: without a target, the equally-harmonious pair with closer generic proportion wins (baseline)', () => {
  const candidates = generateCandidates(silhouetteWardrobe(), RULE_OF_THIRDS, 'seed-1');
  const firstForTop1 = candidates.find(c => c.slots.top === 'top1');
  assert(firstForTop1 !== undefined);
  // Generic proportion rewards a SMALL fit-volume gap (dv 1-2) over identical
  // volumes (dv 0) or a large gap (dv 3+) — slim+slim (dv 0, score 0.7) beats
  // slim+wide (dv 3, score 0.5), so the guessed slim bottom wins by default.
  assertEquals(firstForTop1!.slots.bottom, 'bot-slim-guessed');
});

Deno.test('silhouette-first: a MEASURED wide-leg bottom is chosen as counterpart over an equally color-harmonious GUESSED slim bottom, when the target favours it', () => {
  const candidates = generateCandidates(silhouetteWardrobe(), RULE_OF_THIRDS, 'seed-1', FITTED_TOP_WIDE_BOTTOM);
  const firstForTop1 = candidates.find(c => c.slots.top === 'top1');
  assert(firstForTop1 !== undefined);
  assertEquals(firstForTop1!.slots.bottom, 'bot-wide-measured');
});

Deno.test('degradable: a target with confidence 0 (fully-guessed wardrobe) leaves composition byte-identical to no target at all', () => {
  const zeroConfTarget: TargetSilhouette = {
    targets: [{ topVol: 5, bottomVol: 1, weight: 1, label: 'x' }],
    confidence: 0,
    source: 'test',
  };
  const withTarget = generateCandidates(wardrobe(), RULE_OF_THIRDS, 'seed-1', zeroConfTarget);
  const withoutTarget = generateCandidates(wardrobe(), RULE_OF_THIRDS, 'seed-1');
  assertEquals(JSON.stringify(withTarget), JSON.stringify(withoutTarget));
});

Deno.test('the target never eliminates a mismatching guessed item — a sparse wardrobe still composes a full outfit around it', () => {
  // The ONLY bottom available badly mismatches a high-confidence target
  // (target wants bottomVol 5, wardrobe only has a guessed slim bottom,
  // bottomVol 1) — it must still be used, never filtered out.
  const sparse: FitItem[] = [
    fi('top1', 'top', { fit: 'slim', statement: 1.0 }),
    fi('bot-only', 'bottom', { fit: 'slim', statement: 0.3, provenanceFit: false }),
    fi('shoe1', 'shoes', { primaryColor: 'black', lum: 12, statement: 0.3 }),
  ];
  const strongMismatch: TargetSilhouette = {
    targets: [{ topVol: 1, bottomVol: 5, weight: 1, label: 'x' }],
    confidence: 1,
    source: 'test',
  };
  const candidates = generateCandidates(sparse, RULE_OF_THIRDS, 'seed-1', strongMismatch);
  assert(candidates.length > 0, 'a mismatching item must still produce candidates, never be filtered out');
  assert(candidates.some(c => c.slots.bottom === 'bot-only'));
});
