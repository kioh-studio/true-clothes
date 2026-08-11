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
import { VOLUME, SHAPE_VOLUME_TARGETS } from './scoring.ts';

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

// Per-body_shape flattering default — reads SHAPE_VOLUME_TARGETS (scoring.ts),
// the single source of truth also consumed by bodyShapeMultiplier, so this
// target can never contradict that scoring delta again (2026-08-03).
function fromBodyShape(shape: BodyShape): DerivedTarget {
  return { source: `body_shape=${shape}`, targets: SHAPE_VOLUME_TARGETS[shape] };
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

// ─── Shape-goal cascade tier (2026-08-10) ────────────────────────────────────
// The user's durable "desired resulting body silhouette" choice — sourced
// from style_profiles.shape_goal, threaded onto ctx.shapeGoal. undefined or
// 'auto' means the tier is OFF: it must fall through to the EXACT same target
// the cascade would have picked without this feature (zero regression — see
// silhouette.test.ts). 'natural' means "don't try to reshape me" — neutral
// garment volume on both halves. A specific OutfitSilhouetteShape targets that
// resulting read via targetsForDesiredShape.
function fromShapeGoal(shapeGoal: EngineContext['shapeGoal'], bodyShape?: BodyShape): DerivedTarget | undefined {
  if (!shapeGoal || shapeGoal === 'auto') return undefined;
  if (shapeGoal === 'natural') {
    return { source: 'shapeGoal=natural', targets: [{ topVol: 2, bottomVol: 2, weight: 1.0, label: 'shape_goal_natural' }] };
  }
  return targetsForDesiredShape(shapeGoal, bodyShape);
}

/**
 * Volume target(s) that push generation/ranking toward outfits whose
 * RESULTING BODY SILHOUETTE (resultingBodySilhouette below) reads as `desired`,
 * starting from this body_shape's BODY_BASELINE (or the neutral 3/3 column
 * when body_shape is unknown). CALIBRATION-PENDING — a best-effort inverse of
 * resultingBodySilhouette's own diff/avg thresholds, not independently tuned.
 */
function targetsForDesiredShape(desired: OutfitSilhouetteShape, bodyShape?: BodyShape): DerivedTarget {
  const base = bodyShape ? BODY_BASELINE[bodyShape] : NEUTRAL_BASELINE;
  const tag = `shapeGoal=${desired}(body=${bodyShape ?? 'none'})`;

  switch (desired) {
    case 'oval':
      // avg >= 5 wins the resulting-shape read unconditionally (checked first
      // in resultingBodySilhouette) — max volume on both halves guarantees it
      // regardless of body baseline (every BODY_BASELINE entry has top/bottom
      // >= 2, so eTop/eBottom >= 2 + (5-2) = 5).
      return { source: tag, targets: [{ topVol: 5, bottomVol: 5, weight: 1.0, label: 'shape_goal_oval' }] };

    case 'triangle':
      // Slimmest top + widest bottom maximizes eBottom-eTop; guarantees
      // diff <= -2 even against the worst-case base (inverted_triangle's own
      // top>bottom lean, top=4/bottom=2): (bottom-top delta -2) + (1-5 delta
      // -4) = -6, comfortably past the -2 threshold for every shape.
      return { source: tag, targets: [{ topVol: 1, bottomVol: 5, weight: 1.0, label: 'shape_goal_triangle' }] };

    case 'inverted-triangle':
      // Mirror of 'triangle' above — widest top + slimmest bottom.
      return { source: tag, targets: [{ topVol: 5, bottomVol: 1, weight: 1.0, label: 'shape_goal_inverted_triangle' }] };

    case 'rectangle': {
      // Balance eTop ≈ eBottom by countering the body baseline's OWN
      // top/bottom asymmetry: topVol - bottomVol = base.bottom - base.top
      // (anchoring bottomVol at 2/regular) makes eTop - eBottom = 0 exactly
      // for triangle/inverted_triangle bases, and leaves symmetric bases
      // (hourglass/rectangle/apple, top===bottom) at neutral 2/2.
      // CALIBRATION-PENDING / known limitation: an 'apple' base has
      // rounded=true, which outranks a balanced read in resultingBodySilhouette
      // whenever avg < 5 (see the balanced-read branch above) — no volume pair
      // can make an apple-body wearer's outfit literally tag 'rectangle' short
      // of avg >= 5 (which tags 'oval' instead) or an outfit-made waist (which
      // tags 'hourglass' instead). Not fixed here — see backlog.md.
      const topVol = Math.max(1, Math.min(5, 2 + (base.bottom - base.top)));
      return { source: tag, targets: [{ topVol, bottomVol: 2, weight: 1.0, label: 'shape_goal_rectangle' }] };
    }

    case 'hourglass':
    default:
      // Hourglass is reached mostly through outfitWaistDefinition (belt /
      // structured tailored piece / fitted-and-structured combo), not through
      // volume alone — return balanced/neutral volume here and let
      // shapeGoalDelta (ranking.ts) reward outfits whose OWN items create the
      // waist, per the design instruction for this goal.
      return { source: tag, targets: [{ topVol: 2, bottomVol: 2, weight: 1.0, label: 'shape_goal_hourglass_balanced' }] };
  }
}

/**
 * Resolve the target silhouette for this generation pass. Override cascade:
 * explicit intent (proportionRule, then bodyGoal) > shapeGoal (user's durable
 * desired-shape choice, 2026-08-10) > style silhouette attribute > body_shape
 * flattering default > neutral fallback. shapeGoal sits ABOVE style/body_shape
 * because it is an explicit, standing user choice about their own body — but
 * BELOW intent, since intent is a one-off request for THIS generation ("make
 * me a business look") that should still win even when a shape goal is set.
 * `confidence` is computed independently of which cascade level fired — it
 * reflects how much of the wardrobe's top/bottom items carry REAL fit data,
 * which is what gates how strongly the target is allowed to influence
 * generation/ranking downstream (see generation.ts / scoring.ts). Fully
 * deterministic.
 */
export function resolveTargetSilhouette(ctx: EngineContext, items: FitItem[]): TargetSilhouette {
  const confidence = computeConfidence(items);

  const resolved: DerivedTarget =
    fromIntent(ctx.intent) ??
    fromShapeGoal(ctx.shapeGoal, ctx.bodyMeasurements.body_shape) ??
    fromStyleSilhouette(ctx.styleProfile.computedAttributes?.silhouette) ??
    (ctx.bodyMeasurements.body_shape ? fromBodyShape(ctx.bodyMeasurements.body_shape) : undefined) ??
    neutralFallback();

  return { targets: resolved.targets, confidence, source: resolved.source };
}

// ─── Display-only outfit silhouette tag (2026-07-12) ────────────────────────
// Not a scoring input — purely a feed-card label naming which silhouette
// family THIS outfit realizes. Mirrors the ScoredOutfit.silhouette union
// defined inline in types.ts (kept there, not re-exported from here, to avoid
// a types.ts <-> silhouette.ts import cycle).
export type OutfitSilhouette = 'fitted' | 'straight' | 'relaxed' | 'top-volume' | 'bottom-volume';

// Canonical silhouette family from a (topVol, bottomVol) pair (each 1..5).
function silhouetteFamily(topVol: number, bottomVol: number): OutfitSilhouette {
  const d = topVol - bottomVol;
  if (d >= 2) return 'top-volume';
  if (d <= -2) return 'bottom-volume';
  const avg = (topVol + bottomVol) / 2;
  if (avg < 2) return 'fitted';
  if (avg >= 4) return 'relaxed';
  return 'straight';
}

/**
 * Descriptive silhouette family of an outfit, from its OWN top/bottom garment
 * volumes (VOLUME map on item.fit). A pure description of the actual outfit —
 * it deliberately does NOT consult the target silhouette (that drives
 * generation/scoring, not what the finished outfit visually IS). onepiece fills
 * both roles. Missing top/bottom defaults to regular volume (2).
 */
export function outfitSilhouetteTag(items: FitItem[]): OutfitSilhouette {
  const topItem = items.find(i => i.category === 'top' || i.category === 'onepiece');
  const bottomItem = items.find(i => i.category === 'bottom' || i.category === 'onepiece');
  const outfitTop = topItem ? (VOLUME[topItem.fit] ?? 2) : 2;
  const outfitBottom = bottomItem ? (VOLUME[bottomItem.fit] ?? 2) : 2;
  return silhouetteFamily(outfitTop, outfitBottom);
}

// ─── Display-only geometric-shape tag (2026-07-12) ──────────────────────────
// Parallel to OutfitSilhouette above (descriptive/volume-based) — this maps
// each descriptive family 1-to-1 onto the standard fashion GEOMETRIC-SHAPE
// name, shown as an additional chip alongside (never instead of) the
// descriptive tag. Purely presentational — no scoring impact.
export type OutfitSilhouetteShape = 'hourglass' | 'rectangle' | 'oval' | 'inverted-triangle' | 'triangle';

// ─── Outfit-created waist definition (010-wardrobe-critic follow-up, 2026-08-10) ──
// Fixes a half-broken tag: the OLD `resultingBodySilhouette` only ever produced
// 'hourglass' via `base.waist`, and `waist: true` exists ONLY on the hourglass
// entry of BODY_BASELINE below — so no outfit could ever read as 'hourglass'
// unless the wearer's body_shape already WAS hourglass. Triangle/rectangle
// users could never see their "most flattering" outfit tagged hourglass, no
// matter how waist-defining the actual garments were. This function reads the
// OUTFIT's own items for a real waist-creating signal, independent of
// body_shape, so `resultingBodySilhouette` below can let a waist the CLOTHES
// created win over a waist (or lack of one) the BODY started with.
//
// CALIBRATION-PENDING: which real `typeName` values count as "waist-defining"
// is a judgment call — see WAIST_DEFINING_TYPES's own comment for the
// reasoning and what was deliberately left out.

// Vocabulary verified against enrichment.ts's CATEGORY_MAP/TYPE_DEFAULT_FIT
// (the engine's real typeName values) — not invented. Restricted to garment
// types that are STRUCTURALLY waist-defining by their own construction,
// regardless of styling: CORSET (boned waist-cincher, TYPE_DEFAULT_FIT=slim),
// BLAZER (tailored/darted torso shaping, the classic "structured shoulder +
// nipped waist" silhouette), VEST (a waistcoat — tailored to the torso by
// definition; STYLE_AFFINITIES ties it to oldmoney/smartcasual/preppy, the
// same tailored-wardrobe register as BLAZER). Deliberately EXCLUDES: DRESS
// (typeName can't distinguish a waist-defining wrap/fit-and-flare cut from a
// shapeless shift — no silhouette-cut attribute exists on the item today, see
// backlog.md); COAT/OVERCOAT/JACKET (TYPE_DEFAULT_FIT is 'relaxed' for
// coats — a belted trench reads via the explicit belt signal (a) below, not
// via the coat type itself, which is boxy/relaxed by default).
const WAIST_DEFINING_TYPES = new Set(['CORSET', 'BLAZER', 'VEST']);

/**
 * Does THIS OUTFIT (not the wearer's body) create a defined waist? Signals in
 * priority order — any one firing is enough:
 *  (a) an explicit belt accessory in the outfit;
 *  (b) a structurally waist-defining garment type (WAIST_DEFINING_TYPES)
 *      whose own fit isn't oversized/wide (an oversized blazer washes the
 *      waist shaping back out);
 *  (c) a fitted top (slim/regular) + fitted bottom (slim/regular) where at
 *      least one item carries a `structured` drape — a tailored, body-following
 *      silhouette reads as waist-defined even with no single "waist garment".
 * Pure/deterministic; magnitude of what counts is CALIBRATION-PENDING.
 */
export function outfitWaistDefinition(items: FitItem[]): boolean {
  if (items.some(i => i.category === 'accessory' && i.typeName === 'BELT')) return true;

  const structuralPiece = items.find(i =>
    WAIST_DEFINING_TYPES.has(i.typeName) && i.fit !== 'oversized' && i.fit !== 'wide');
  if (structuralPiece) return true;

  const topItem = items.find(i => i.category === 'top' || i.category === 'onepiece');
  const bottomItem = items.find(i => i.category === 'bottom' || i.category === 'onepiece');
  const topFitted = topItem ? (topItem.fit === 'slim' || topItem.fit === 'regular') : false;
  const bottomFitted = bottomItem ? (bottomItem.fit === 'slim' || bottomItem.fit === 'regular') : false;
  if (topFitted && bottomFitted && items.some(i => i.drape === 'structured')) return true;

  return false;
}

// Body-shape baseline as a coarse (top width, bottom width) pair on the same
// 1..5 volume scale as garments, plus whether the shape carries a defined waist
// and whether it reads rounded. Used to model the silhouette the user's body
// takes ON after an outfit adds volume — see resultingBodySilhouette.
const BODY_BASELINE: Record<BodyShape, { top: number; bottom: number; waist: boolean; rounded: boolean }> = {
  hourglass:         { top: 3, bottom: 3, waist: true,  rounded: false },
  rectangle:         { top: 3, bottom: 3, waist: false, rounded: false },
  triangle:          { top: 2, bottom: 4, waist: false, rounded: false },
  inverted_triangle: { top: 4, bottom: 2, waist: false, rounded: false },
  apple:             { top: 3, bottom: 3, waist: false, rounded: true  },
};
const NEUTRAL_BASELINE = { top: 3, bottom: 3, waist: false, rounded: false };

/**
 * The geometric silhouette the USER'S BODY reads as AFTER putting this outfit on.
 * Starts from the body_shape baseline (or a neutral 3/3 column when body_shape is
 * unknown) and shifts it by how much volume the garments add over a neutral
 * (regular) piece: a voluminous top widens the top read, a voluminous bottom
 * widens the bottom read. Outerwear counts toward the TOP read (max with the top
 * garment) since an open/worn coat defines the outer top volume. onepiece fills
 * both roles. Fully deterministic; no scoring impact.
 *
 * Mid layer (2026-08-10): deliberately NOT folded into this volume math. `items`
 * (from index.ts's itemsOf) orders mid AFTER outwear, and `.find` here takes the
 * first match, so `outerItem` always resolves to the TRUE outer (e.g. blazer),
 * never the mid piece underneath it (e.g. hoodie) — the mid item is simply
 * invisible to this function. That's a deliberate call, not an oversight: (a)
 * the physical rule already bans a HEAVY mid under a true outer (see
 * generation.ts midFitsUnderOuter), so the case where a mid layer would add
 * meaningful extra bulk on top of the outer is structurally excluded already;
 * (b) folding a third garment into `topGarmentVol` would mean re-deriving the
 * diff/avg thresholds below AND SHAPE_VOLUME_TARGETS/BODY_BASELINE against a
 * 3-garment top read, which this feature is explicitly not allowed to touch
 * (they're validated by this file's own golden-case tests). Revisit only as a
 * deliberate, separately-calibrated change — see backlog.md.
 *
 * Volume scale (VOLUME): slim=1 … regular=2 … oversized=5; neutral garment = 2.
 */
export function resultingBodySilhouette(items: FitItem[], bodyShape?: BodyShape): OutfitSilhouetteShape {
  const topItem    = items.find(i => i.category === 'top' || i.category === 'onepiece');
  const outerItem  = items.find(i => i.category === 'outwear');
  const bottomItem = items.find(i => i.category === 'bottom' || i.category === 'onepiece');

  // Outer layer defines the top read when it's the more voluminous piece; 0 so an
  // absent outer never wins the max.
  const topGarmentVol = Math.max(
    topItem  ? (VOLUME[topItem.fit]  ?? 2) : 2,
    outerItem ? (VOLUME[outerItem.fit] ?? 2) : 0,
  );
  const bottomGarmentVol = bottomItem ? (VOLUME[bottomItem.fit] ?? 2) : 2;

  return silhouetteFromVolumes(topGarmentVol, bottomGarmentVol, outfitWaistDefinition(items), bodyShape);
}

// Core resulting-shape math, factored out of resultingBodySilhouette (2026-08-11)
// so isShapeGoalReachable below can exhaustively probe the SAME branches —
// particularly the base.rounded/base.waist short-circuits — without either
// duplicating the thresholds by hand (which would drift) or constructing fake
// FitItem[] wardrobes just to reach them. `waistDefined` is the outcome
// outfitWaistDefinition(items) would have produced; resultingBodySilhouette
// computes it from real items, isShapeGoalReachable enumerates both booleans.
function silhouetteFromVolumes(
  topGarmentVol: number,
  bottomGarmentVol: number,
  waistDefined: boolean,
  bodyShape?: BodyShape,
): OutfitSilhouetteShape {
  const base = bodyShape ? BODY_BASELINE[bodyShape] : NEUTRAL_BASELINE;

  const eTop    = base.top    + (topGarmentVol - 2);
  const eBottom = base.bottom + (bottomGarmentVol - 2);
  const diff = eTop - eBottom;
  const avg  = (eTop + eBottom) / 2;

  if (diff >= 2) return 'inverted-triangle';  // top read clearly wider
  if (diff <= -2) return 'triangle';          // bottom read clearly wider
  // Balanced top/bottom read:
  if (avg >= 5) return 'oval';                 // voluminous all over → cocoon/round
  // 2026-08-10 fix: a waist the OUTFIT creates (belt / structured tailored
  // piece / fitted-and-structured silhouette — see outfitWaistDefinition
  // above) now wins over the body's own `rounded` read. Previously only
  // base.waist (true for hourglass ONLY) could ever produce 'hourglass', so
  // no triangle/rectangle/apple wearer could ever see it, no matter how
  // waist-defining their actual outfit was.
  if (waistDefined) return 'hourglass';
  if (base.rounded) return 'oval';             // apple midsection reads rounded, absent an outfit-made waist
  if (base.waist) return 'hourglass';          // defined waist survives a balanced look
  return 'rectangle';                          // straight column
}

const VOLUME_RANGE = [1, 2, 3, 4, 5];

/**
 * Reachability predicate for the shapeGoal penalty (010-wardrobe-critic
 * follow-up, 2026-08-11). Answers: for this body_shape baseline, does ANY
 * outfit exist whose resultingBodySilhouette could read as `goal`? Total and
 * pure — exhaustively walks the same (topGarmentVol, bottomGarmentVol,
 * waistDefined) space silhouetteFromVolumes consumes (5 x 5 x 2 = 50 cheap,
 * deterministic checks), so it is derived from the SAME branches
 * resultingBodySilhouette actually uses rather than a hand-maintained lookup
 * table that would drift the moment that function's thresholds change.
 *
 * Exists because some (baseline, goal) pairs are structurally impossible: an
 * 'apple' baseline's base.rounded=true always wins the balanced-read branch
 * over 'rectangle' (short of an extreme diff, which reads as
 * triangle/inverted-triangle instead, or avg>=5, which reads as oval
 * instead) — no outfit can ever make it read 'rectangle'. shapeGoalDelta
 * (ranking.ts) consults this to turn what would otherwise be a permanent,
 * unearnable penalty into a no-op for exactly those pairs.
 */
export function isShapeGoalReachable(bodyShape: BodyShape | undefined, goal: OutfitSilhouetteShape): boolean {
  for (const topVol of VOLUME_RANGE) {
    for (const bottomVol of VOLUME_RANGE) {
      if (silhouetteFromVolumes(topVol, bottomVol, false, bodyShape) === goal) return true;
      if (silhouetteFromVolumes(topVol, bottomVol, true, bodyShape) === goal) return true;
    }
  }
  return false;
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
 *
 * Dead-code audit (2026-08-11): intentionally uncalled. Shipped alongside
 * `pairSilhouetteMatch` in the "Silhouette-first resolution" work
 * (plan.md, 2026-07-12) and documented there as "reserved for future
 * anchor-biasing use beyond what generation.ts already covers via
 * measurementPriorityBoost" — i.e. it was never meant to be wired up yet.
 * `pairSilhouetteMatch()` below is the live sibling actually called from
 * `generation.ts:410`. Keep this function; do not delete as dead code.
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
