// Behaviour-learned taste vector (lever L2).
//
// `ranking.ts` historically read ZERO user history. This module learns a small
// per-user preference vector from the outfits the user has SAVED or WORN (the
// only positive signals stored — there is no dismiss/skip event), then turns it
// into a gentle additive ranking bonus so the feed leans toward the user's own
// "gu" over time.
//
// Design principles:
//   • Positive-only. Absence of a save is NOT a negative — we never penalise.
//   • Confidence-scaled. Zero samples → no-op; a tiny sample barely nudges; the
//     bonus saturates only after CONF_FULL liked outfits.
//   • Capped well below the core dimensions (style/colour are 0.25 each) so taste
//     refines the ranking, never overrides good styling.
//   • Item-derived only — needs no extra stored metadata, just the items the
//     liked outfit was made of (recovered from the outfit-id slot key).

import { FitItem, TasteAggregate, TasteVector } from './types.ts';

const MAX_TASTE_BONUS = 0.06; // ceiling on the additive nudge (subordinate to core dims)
const CONF_FULL = 8;          // # liked outfits at which confidence saturates to 1
const AFFINITY_FLOOR = 0.4;   // affinity at/below this earns no bonus (so off-taste ≈ 0)

// Lift mode (2026-07-02): with enough impression history, the bonus rewards a
// candidate's similarity to the user's saves RELATIVE to the average feed shown
// to them. Guards against the self-reinforcing loop where "saves look like the
// feed because the feed is all they see" reads as a preference for the feed.
const MIN_EXPOSURE_SAMPLES = 10; // fewer impressions than this → fall back to raw affinity
const LIFT_SCALE = 0.25;         // (affinity − baseline) at which the bonus saturates

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Features that describe ONE outfit — used both to build the vector (over liked
// outfits) and to match a candidate against it. Accessories are excluded: they
// rarely define the character of a look.
function outfitFeatures(items: FitItem[]): {
  meanFormality: number; meanStatement: number; lightnessSpread: number; primaries: string[];
} {
  const visible = items.filter(i => i.category !== 'accessory');
  const base = visible.length > 0 ? visible : items;
  const n = base.length || 1;
  const meanFormality = base.reduce((s, i) => s + i.formality, 0) / n;
  const meanStatement = base.reduce((s, i) => s + i.statementStrength, 0) / n;
  const lums = base.map(i => i.colorProfile.lum);
  const lightnessSpread = lums.length > 1 ? Math.max(...lums) - Math.min(...lums) : 0;
  const primaries = base.map(i => i.colorProfile.primaryColor);
  return { meanFormality, meanStatement, lightnessSpread, primaries };
}

export interface PositiveOutfit {
  itemIds: string[]; // ids parsed from the saved/worn outfit-id slot key
  weight: number;    // worn = stronger positive than merely saved
}

// Weighted aggregation of outfit character over a set of outfits. Items are
// resolved against the wardrobe map; outfits whose items no longer exist
// contribute nothing. Returns undefined when nothing usable remains.
function aggregateOutfits(
  outfits: PositiveOutfit[], itemMap: Map<string, FitItem>,
): TasteAggregate | undefined {
  let totW = 0, fSum = 0, sSum = 0, lSum = 0, used = 0;
  const colorAccum: Record<string, number> = {};

  for (const p of outfits) {
    const items = p.itemIds.map(id => itemMap.get(id)).filter((i): i is FitItem => i !== undefined);
    if (items.length === 0) continue;
    const f = outfitFeatures(items);
    const w = p.weight > 0 ? p.weight : 1;
    totW += w; used++;
    fSum += f.meanFormality * w;
    sSum += f.meanStatement * w;
    lSum += f.lightnessSpread * w;
    for (const pc of f.primaries) colorAccum[pc] = (colorAccum[pc] ?? 0) + w;
  }

  if (used === 0 || totW === 0) return undefined;

  const colorTot = Object.values(colorAccum).reduce((a, b) => a + b, 0) || 1;
  const colorWeight: Record<string, number> = {};
  for (const [k, v] of Object.entries(colorAccum)) colorWeight[k] = v / colorTot;

  return {
    sampleCount: used,
    meanFormality: fSum / totW,
    meanStatement: sSum / totW,
    meanLightnessSpread: lSum / totW,
    colorWeight,
  };
}

// Build a taste vector from the user's liked outfits, optionally paired with
// their exposure history (impressions — what the feed showed them, weight 1
// each). Exposure attaches only past MIN_EXPOSURE_SAMPLES so a thin history
// can't produce a noisy baseline. Returns undefined when there is no usable
// positive history (→ caller leaves ctx.tasteVector unset → ranking unaffected).
export function buildTasteVector(
  positives: PositiveOutfit[],
  itemMap: Map<string, FitItem>,
  exposures?: Array<{ itemIds: string[] }>,
): TasteVector | undefined {
  const positive = aggregateOutfits(positives, itemMap);
  if (!positive) return undefined;

  const exposure = exposures && exposures.length > 0
    ? aggregateOutfits(exposures.map(e => ({ itemIds: e.itemIds, weight: 1 })), itemMap)
    : undefined;

  return exposure && exposure.sampleCount >= MIN_EXPOSURE_SAMPLES
    ? { ...positive, exposure }
    : positive;
}

// Similarity between one outfit's features and an aggregate, in [0, 1].
function affinityTo(f: ReturnType<typeof outfitFeatures>, agg: TasteAggregate): number {
  const formalitySim = 1 - Math.min(1, Math.abs(f.meanFormality - agg.meanFormality) / 4);
  const statementSim = 1 - Math.min(1, Math.abs(f.meanStatement - agg.meanStatement) / 5);
  const contrastSim  = 1 - Math.min(1, Math.abs(f.lightnessSpread - agg.meanLightnessSpread) / 100);

  // Colour affinity: how much of the candidate's palette sits in the colours the
  // aggregate gravitates to, normalised by the single heaviest colour weight so a
  // perfectly on-palette outfit approaches 1 regardless of how spread the set is.
  const maxColorW = Object.values(agg.colorWeight).reduce((m, v) => Math.max(m, v), 0) || 1;
  const colorSim = f.primaries.length === 0
    ? 0.5
    : clamp01((f.primaries.reduce((s, pc) => s + (agg.colorWeight[pc] ?? 0), 0) / f.primaries.length) / maxColorW);

  return 0.30 * formalitySim + 0.25 * statementSim + 0.20 * contrastSim + 0.25 * colorSim;
}

// How close a candidate outfit is to the learned taste, returned as a small
// additive bonus in [0, MAX_TASTE_BONUS]. Purely positive (no penalty) and
// scaled by confidence in the positive sample size.
//
// Two modes:
// • Lift (exposure attached): the bonus keys on affinity(saves) MINUS
//   affinity(average shown feed). Saves indistinguishable from the feed carry
//   no signal (delta ≈ 0 everywhere); saves that deviate from the feed reveal
//   a real preference direction and only candidates in THAT direction score.
// • Fallback (no/thin exposure history): raw positive affinity gated by an
//   absolute floor, exactly the original L2 behaviour.
export function tasteAffinityDelta(items: FitItem[], tv: TasteVector): number {
  const f = outfitFeatures(items);
  const affinity = affinityTo(f, tv);

  const norm = tv.exposure
    ? clamp01((affinity - affinityTo(f, tv.exposure)) / LIFT_SCALE)
    : clamp01((affinity - AFFINITY_FLOOR) / (1 - AFFINITY_FLOOR));

  const confidence = Math.min(1, tv.sampleCount / CONF_FULL);
  return norm * MAX_TASTE_BONUS * confidence;
}
