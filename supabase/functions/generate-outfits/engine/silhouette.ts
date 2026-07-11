// Silhouette-first resolution (010-wardrobe-critic follow-up, 2026-07-12).
//
// Resolves a TARGET SILHOUETTE — a small set of preferred (top volume, bottom
// volume) pairs — BEFORE outfit composition, then hands it to generation/
// ranking as a BIAS + SCORING term. Never a hard filter: guessed-fit items
// stay fully eligible everywhere, they just get a weaker nudge toward the
// target than items with real measurement/fit data (provenance.fit === true
// or a populated garmentMeasurements). Fully deterministic — no randomness
// anywhere in this module.
//
// Volume scale reused from scoring.ts (VOLUME: slim=1 … oversized=5) — this
// module does not redefine it.

import {
  FitItem, EngineContext, BodyShape, Silhouette, IntentContext, TargetSilhouette,
} from './types.ts';
import { VOLUME } from './scoring.ts';

export type { TargetSilhouette } from './types.ts';

// ─── Measurement-priority boost ─────────────────────────────────────────────
// Small, non-negative nudge toward items carrying real measurement/fit data.
// Deliberately small relative to the signals it's added to (statementStrength,
// pairAffinity) — enough to win a near-tie, never enough to override a clearly
// stronger signal (e.g. the "loudest piece leads" anchor property).
const BOOST_MEASURED = 0.06;    // garmentMeasurements present (highest confidence)
const BOOST_PROVENANCE = 0.03;  // provenance.fit === true but no measurements
const CONFIDENCE_SATURATION_K = 3;
const MAX_VOLUME_DIST = 8; // |Δtop| + |Δbottom|; each axis spans 1..5 (max Δ 4)

function hasMeasurements(item: FitItem): boolean {
  return !!item.garmentMeasurements && Object.keys(item.garmentMeasurements).length > 0;
}

function hasRealFitData(item: FitItem): boolean {
  return item.provenance.fit === true || hasMeasurements(item);
}

/**
 * Small non-negative boost for items with better fit provenance: higher when
 * `garmentMeasurements` is populated, medium when `provenance.fit` is a real
 * (non-defaulted) value, 0 when the item's fit is purely guessed.
 */
export function measurementPriorityBoost(item: FitItem): number {
  if (hasMeasurements(item)) return BOOST_MEASURED;
  if (item.provenance.fit) return BOOST_PROVENANCE;
  return 0;
}

// ─── Confidence ──────────────────────────────────────────────────────────────
// How much of the relevant (top/bottom) wardrobe carries real fit data. 0 with
// none — every downstream consumer gates on this, so a fully-guessed wardrobe
// is a complete no-op (degradable). Saturates toward 1 as coverage grows but
// never reaches it exactly.
function computeConfidence(items: FitItem[]): number {
  const relevant = items.filter(i => i.category === 'top' || i.category === 'bottom');
  const measured = relevant.filter(hasRealFitData).length;
  if (measured === 0) return 0;
  return measured / (measured + CONFIDENCE_SATURATION_K);
}

// ─── Target derivation ───────────────────────────────────────────────────────

type TargetSet = TargetSilhouette['targets'];
interface DerivedTarget { targets: TargetSet; source: string }

function fromIntent(intent?: IntentContext): DerivedTarget | undefined {
  if (!intent) return undefined;

  if (intent.proportionRule) {
    switch (intent.proportionRule) {
      case 'oversized_top':
        return {
          source: 'intent.proportionRule=oversized_top',
          targets: [
            { topVol: 5, bottomVol: 2, weight: 0.6, label: 'oversized_top' },
            { topVol: 4, bottomVol: 1, weight: 0.4, label: 'oversized_top_slim_bottom' },
          ],
        };
      case 'oversized_bottom':
        return {
          source: 'intent.proportionRule=oversized_bottom',
          targets: [
            { topVol: 2, bottomVol: 5, weight: 0.6, label: 'oversized_bottom' },
            { topVol: 1, bottomVol: 4, weight: 0.4, label: 'oversized_bottom_slim_top' },
          ],
        };
      case 'balanced':
        return {
          source: 'intent.proportionRule=balanced',
          targets: [
            { topVol: 2, bottomVol: 2, weight: 0.6, label: 'balanced_regular' },
            { topVol: 3, bottomVol: 3, weight: 0.4, label: 'balanced_relaxed' },
          ],
        };
      case 'rule_of_thirds':
        return {
          source: 'intent.proportionRule=rule_of_thirds',
          targets: [
            { topVol: 1, bottomVol: 4, weight: 0.5, label: 'thirds_fitted_top' },
            { topVol: 4, bottomVol: 1, weight: 0.5, label: 'thirds_fitted_bottom' },
          ],
        };
    }
  }

  if (intent.bodyGoal) {
    switch (intent.bodyGoal) {
      case 'elongation':
        return {
          source: 'intent.bodyGoal=elongation',
          targets: [
            { topVol: 2, bottomVol: 2, weight: 0.7, label: 'elongation_fitted' },
            { topVol: 1, bottomVol: 2, weight: 0.3, label: 'elongation_slim' },
          ],
        };
      case 'broaden_shoulders':
        return {
          source: 'intent.bodyGoal=broaden_shoulders',
          targets: [
            { topVol: 4, bottomVol: 2, weight: 0.7, label: 'broaden_top' },
            { topVol: 5, bottomVol: 1, weight: 0.3, label: 'broaden_top_strong' },
          ],
        };
      case 'define_waist':
        return {
          source: 'intent.bodyGoal=define_waist',
          targets: [
            { topVol: 1, bottomVol: 3, weight: 0.6, label: 'define_waist' },
            { topVol: 2, bottomVol: 4, weight: 0.4, label: 'define_waist_fuller' },
          ],
        };
      case 'balanced':
        return {
          source: 'intent.bodyGoal=balanced',
          targets: [{ topVol: 2, bottomVol: 2, weight: 1.0, label: 'goal_balanced' }],
        };
    }
  }

  return undefined;
}

function fromStyleSilhouette(silhouettes?: Silhouette[]): DerivedTarget | undefined {
  if (!silhouettes || silhouettes.length === 0) return undefined;
  // Style attribute arrays carry no explicit ranking beyond insertion order
  // (computeUserAttributes builds them deterministically) — the primary entry
  // leads, matching how itemAttributes/computeUserAttributes treat index 0.
  const primary = silhouettes[0];
  switch (primary) {
    case 'oversized':
      return {
        source: 'style.silhouette=oversized',
        targets: [
          { topVol: 5, bottomVol: 2, weight: 0.6, label: 'style_oversized_top' },
          { topVol: 4, bottomVol: 1, weight: 0.4, label: 'style_oversized_top_slim' },
        ],
      };
    case 'bodycon':
      return {
        source: 'style.silhouette=bodycon',
        targets: [{ topVol: 1, bottomVol: 1, weight: 1.0, label: 'style_bodycon' }],
      };
    case 'tailored':
      return {
        source: 'style.silhouette=tailored',
        targets: [
          { topVol: 2, bottomVol: 2, weight: 0.7, label: 'style_tailored' },
          { topVol: 2, bottomVol: 1, weight: 0.3, label: 'style_tailored_slim_bottom' },
        ],
      };
    case 'structured':
      return {
        source: 'style.silhouette=structured',
        targets: [
          { topVol: 3, bottomVol: 2, weight: 0.7, label: 'style_structured' },
          { topVol: 2, bottomVol: 2, weight: 0.3, label: 'style_structured_regular' },
        ],
      };
    case 'relaxed':
      return {
        source: 'style.silhouette=relaxed',
        targets: [
          { topVol: 3, bottomVol: 3, weight: 0.7, label: 'style_relaxed' },
          { topVol: 3, bottomVol: 4, weight: 0.3, label: 'style_relaxed_fuller_bottom' },
        ],
      };
    default:
      return undefined;
  }
}

// Per-body_shape flattering default. MUST agree in direction with
// bodyShapeMultiplier (scoring.ts) — read that function before changing any
// of these. E.g. it rewards a wide/relaxed/oversized bottom for 'triangle'
// (+0.07) and penalises a slim one (-0.07), so the triangle target below also
// points at a wider bottom, never a slimmer one.
function fromBodyShape(shape: BodyShape): DerivedTarget {
  switch (shape) {
    case 'triangle':
      // bodyShapeMultiplier: +0.07 wide/relaxed/oversized bottom, +0.03 broad
      // (wide/oversized) top, -0.07 slim bottom.
      return {
        source: 'body_shape=triangle',
        targets: [
          { topVol: 4, bottomVol: 4, weight: 0.6, label: 'triangle_broad_top_wide_bottom' },
          { topVol: 3, bottomVol: 5, weight: 0.4, label: 'triangle_wide_bottom' },
        ],
      };
    case 'inverted_triangle':
      // bodyShapeMultiplier: -0.08 wide/oversized top, +0.06 wide/relaxed
      // bottom, -0.05 slim bottom.
      return {
        source: 'body_shape=inverted_triangle',
        targets: [
          { topVol: 2, bottomVol: 4, weight: 0.6, label: 'inverted_triangle_fitted_top_wide_bottom' },
          { topVol: 1, bottomVol: 3, weight: 0.4, label: 'inverted_triangle_slim_top' },
        ],
      };
    case 'hourglass':
      // bodyShapeMultiplier: +0.07 tailored slim/regular fit, -0.07 for 2+
      // oversized pieces.
      return {
        source: 'body_shape=hourglass',
        targets: [
          { topVol: 2, bottomVol: 2, weight: 0.7, label: 'hourglass_tailored' },
          { topVol: 1, bottomVol: 2, weight: 0.3, label: 'hourglass_fitted' },
        ],
      };
    case 'apple':
      // bodyShapeMultiplier: +0.07 loose/relaxed/oversized top, -0.07 slim
      // top; no bottom-specific rule.
      return {
        source: 'body_shape=apple',
        targets: [
          { topVol: 4, bottomVol: 2, weight: 0.6, label: 'apple_loose_top' },
          { topVol: 3, bottomVol: 2, weight: 0.4, label: 'apple_relaxed_top' },
        ],
      };
    case 'rectangle':
    default:
      // bodyShapeMultiplier: +0.05 for a layered look (3+ items), no
      // fit-specific volume direction — a mild top/bottom volume contrast
      // (either direction) is the generic flattering default, matching what
      // scoreProportionBalance already rewards for this shape.
      return {
        source: 'body_shape=rectangle',
        targets: [
          { topVol: 3, bottomVol: 2, weight: 0.5, label: 'rectangle_top_led' },
          { topVol: 2, bottomVol: 3, weight: 0.5, label: 'rectangle_bottom_led' },
        ],
      };
  }
}

function neutralFallback(): DerivedTarget {
  return {
    source: 'neutral_fallback',
    targets: [
      { topVol: 2, bottomVol: 3, weight: 0.5, label: 'neutral_fitted_top' },
      { topVol: 3, bottomVol: 2, weight: 0.5, label: 'neutral_fitted_bottom' },
    ],
  };
}

/**
 * Resolve the target silhouette for this generation pass. Override cascade:
 * explicit intent (proportionRule, then bodyGoal) > style silhouette
 * attribute > body_shape flattering default > neutral fallback. `confidence`
 * is computed independently of which cascade level fired — it reflects how
 * much of the wardrobe's top/bottom items carry REAL fit data, which is what
 * gates how strongly the target is allowed to influence generation/ranking
 * downstream (see generation.ts / scoring.ts). Fully deterministic.
 */
export function resolveTargetSilhouette(ctx: EngineContext, items: FitItem[]): TargetSilhouette {
  const confidence = computeConfidence(items);

  const resolved: DerivedTarget =
    fromIntent(ctx.intent) ??
    fromStyleSilhouette(ctx.styleProfile.computedAttributes?.silhouette) ??
    (ctx.bodyMeasurements.body_shape ? fromBodyShape(ctx.bodyMeasurements.body_shape) : undefined) ??
    neutralFallback();

  return { targets: resolved.targets, confidence, source: resolved.source };
}

// ─── Match / affinity helpers ────────────────────────────────────────────────

/**
 * How well a SPECIFIC top+bottom pair realizes the target — best (max) match
 * across the target's candidate (topVol, bottomVol) pairs, distance-based.
 * [0,1]; 1.0 = exact match to some target pair, 0 = as far as possible on
 * both axes at once.
 */
export function pairSilhouetteMatch(top: FitItem, bottom: FitItem, target: TargetSilhouette): number {
  if (target.targets.length === 0) return 0.5;
  const topVol = VOLUME[top.fit] ?? 2;
  const bottomVol = VOLUME[bottom.fit] ?? 2;

  let best = 0;
  for (const t of target.targets) {
    const dist = Math.abs(topVol - t.topVol) + Math.abs(bottomVol - t.bottomVol);
    const match = Math.max(0, 1 - dist / MAX_VOLUME_DIST);
    if (match > best) best = match;
  }
  return best;
}

/**
 * Per-item [0,1] fit to the NEARER side of the target's pairs — used to bias
 * anchor/hero selection toward pieces that already realize half of the target
 * (e.g. a slim top scores well when the target wants a fitted top over a wide
 * bottom, regardless of what bottom eventually pairs with it).
 */
export function silhouetteAffinity(item: FitItem, target: TargetSilhouette): number {
  if (target.targets.length === 0) return 0.5;
  const vol = VOLUME[item.fit] ?? 2;
  const isTop = item.category === 'top' || item.category === 'outwear' || item.category === 'onepiece';
  const isBottom = item.category === 'bottom' || item.category === 'onepiece';

  let best = 0;
  for (const t of target.targets) {
    const dists: number[] = [];
    if (isTop) dists.push(Math.abs(vol - t.topVol));
    if (isBottom) dists.push(Math.abs(vol - t.bottomVol));
    if (dists.length === 0) dists.push(Math.abs(vol - t.topVol), Math.abs(vol - t.bottomVol));
    const d = Math.min(...dists);
    const match = Math.max(0, 1 - d / 4); // single axis, max Δ 4 (volumes span 1..5)
    if (match > best) best = match;
  }
  return best;
}
