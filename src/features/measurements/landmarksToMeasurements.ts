/**
 * keypointsToMeasurements — convert MoveNet 2D pose keypoints + known height
 * into estimated body circumferences for form pre-fill.
 *
 * ACCURACY CAVEAT: ±5–10 cm rough estimate. Derived from a single front-facing
 * photo using anthropometric width-to-girth ratios and an ellipse-perimeter
 * approximation for the unseen depth dimension. Results are for user review
 * only — the app never auto-saves pose-estimated values.
 *
 * Approach reference: ANSUR II mean proportions (US Army anthropometric survey).
 * All tunable fudge constants live in the K object below.
 */

import type { Keypoint } from './poseEstimate';
import type { SilhouetteWidths } from './silhouetteMath';
import type { EstimatedMeasurements } from '../../types/measurements';

export type { EstimatedMeasurements };

// ── Anthropometric constants ──────────────────────────────────────────────────
// Every assumption is explicit here so they can be calibrated against real data.
// Exported (read-only intent — treat as constant) so the offline accuracy/
// calibration harness (scripts/measure-eval, src/features/measurements/
// accuracyEval.ts) can read the current defaults to search around. Nothing in
// the production app imports this — only the harness/tests do.

export const K = {
  /**
   * Fraction of standing height spanned by (ankle → nose) in a typical
   * full-body front shot. The head above the nose is ~12% of stature
   * (crown–nose / stature ≈ 0.12 from ANSUR). So nose–ankle ≈ 88%.
   */
  noseAnkleHeightFraction: 0.88,

  /**
   * Chest visible width as a fraction of shoulder width (front-view projection).
   * The chest is slightly narrower than the shoulders in a front shot because
   * the shoulder span includes the deltoid overhang.
   */
  chestFromShoulder: 0.92,

  /**
   * Waist visible width = weighted blend of shoulder and hip widths.
   * Shoulder contributes 40%, hip 60% (hip is a stronger predictor of waist
   * for typical build variation), then scaled by waistScale to account for
   * the narrowing between those two reference points.
   */
  waistBlendShoulder: 0.40,
  waistBlendHip:      0.60,
  waistScale:         0.72,

  /**
   * Depth-to-width ratios for the Ramanujan ellipse approximation.
   * These convert the front-visible "width" to the unseen body depth so we can
   * approximate the circumference as an ellipse perimeter.
   * Values are approximate cross-section depth:width from DXA/CT studies:
   *   chest ~0.72, waist slightly more round ~0.78, hip ~0.70.
   */
  chestDepthRatio: 0.72,
  waistDepthRatio:  0.78,
  hipDepthRatio:    0.70,

  /**
   * BMI-driven adjustment of the depth ratios. The base ratios above describe an
   * average build (≈ refBmi); a heavier build carries a rounder cross-section
   * (depth/width → 1), a leaner one a flatter section. We scale all three depth
   * ratios by `1 + bmiDepthGain·(BMI − refBmi)/refBmi`, clamped to a sane band.
   * Height + weight are both known, so this is free signal — when weight is
   * absent the factor is 1 (base ratios, unchanged behaviour).
   */
  refBmi: 22,
  bmiDepthGain: 0.5,
  depthFactorMin: 0.8,
  depthFactorMax: 1.3,
  depthRatioMin: 0.55,
  depthRatioMax: 0.95,

  /**
   * Age effect on waist depth only: visceral fat tends to rise with age at the
   * same BMI, rounding the waist cross-section. Applied above `ageWaistFrom`,
   * +`ageWaistGain` per decade, capped at `ageWaistMax`. Weak signal — kept small.
   * CALIBRATION-PENDING.
   */
  ageWaistFrom: 30,
  ageWaistGain: 0.015,
  ageWaistMax: 1.06,

  /**
   * Hip width from the MoveNet hip *joint* keypoints is narrower (and higher)
   * than the widest buttock circumference, biasing hip low. A small multiplicative
   * correction nudges the visible width toward the true widest girth.
   * CALIBRATION-PENDING: tune against real tape measurements.
   */
  hipWidthCorrection: 1.06,

  /**
   * Vertical hip→ankle distance is a slight overestimate of the true inseam
   * (which runs along the inner leg, shorter than the outer-leg projection).
   * 0.95 corrects for that ~5% shortening.
   */
  inseamProjectionFactor: 0.95,

  /**
   * Torso length ("base of neck → natural waist") as a fraction of the vertical
   * shoulder→hip span. The neck base sits a little above the shoulder line and the
   * natural waist sits above the hip line, so the on-body torso measure is a bit
   * shorter than the full shoulder→hip distance. CALIBRATION-PENDING.
   */
  torsoFromShoulderHip: 0.85,

  /** Minimum keypoint confidence score (0..1) to treat a landmark as reliable. */
  minScore: 0.3,

  /**
   * Garment-convention shoulder (acromion point to point) sits slightly INSIDE
   * the outer deltoid contour that the segmentation mask measures. Applied only
   * to the silhouette-derived shoulder width. CALIBRATION-PENDING.
   */
  contourShoulderInset: 0.96,

  /**
   * Shoulder width is field-reported as the single measurement most often off
   * by >5 cm, so it's no longer an either/or (contour-when-present, else raw
   * joint span) — it's a calibratable BLEND of both terms every time,
   * weighted by `shoulderBlendContour` (0..1, fraction of weight on the
   * contour term). 0.5 is a neutral starting split — CALIBRATION-PENDING
   * once real tape-measure fixtures exist to search around it. When the
   * contour width is absent (no silhouette pass succeeded this scan) the
   * blend degenerates to the kp term alone (weight effectively 1) — see
   * `shoulderWidthCm` below.
   */
  shoulderBlendContour: 0.5,

  /**
   * Biacromial breadth (garment-convention shoulder width) runs WIDER than
   * the raw MoveNet/BlazePose shoulder-JOINT span — the joints sit inside the
   * acromion processes the tape measure actually catches. 1.09 is a
   * physically-motivated ANSUR-proportion guess pending real calibration
   * (CALIBRATION-PENDING) — applied to the joint-span term of the shoulder
   * blend above, analogous to how `contourShoulderInset` corrects the
   * contour term in the other direction (contour reads slightly WIDE of the
   * garment convention; joint span reads slightly NARROW of it — the blend
   * pulls both terms toward the true biacromial breadth from opposite sides).
   */
  kpShoulderFactor: 1.09,

  /**
   * Minimum standing height the person must span as a fraction of the frame
   * (normalised units, 0..1). Below this the subject is too far / partly out of
   * frame: keypoint precision collapses and a tiny nose↔ankle span explodes
   * cmPerUnit, yielding garbage that can still land inside the sane-range clamps.
   * A genuine full-body shot spans ~0.8–1.0; 0.2 rejects only unusable framing.
   */
  minPersonFrameFraction: 0.2,

  /**
   * Mask-extent scale reference (crown→sole vertical span of the person
   * segmentation mask, in FULL-square units) — an independent estimate of the
   * scale reference alongside the existing nose→ankle keypoint span (see
   * `EstimateInputs.maskExtentU` and the scale-blend logic below). The
   * visible mask extent runs slightly TALLER than true barefoot stature: it
   * includes hair volume above the crown and shoe sole/heel below the foot,
   * neither of which the nose→ankle span picks up. `maskExtentFudge` divides
   * that overshoot back out. CALIBRATION-PENDING — 1.02 (≈2%) is a
   * physically-motivated guess pending real capture data.
   */
  maskExtentFudge: 1.02,

  /**
   * Blend weight of the mask-based height estimate (hMask) in the
   * survivor-median scale blend (see `blendPersonUnitH` below). 0.6 favours
   * the mask estimate slightly — a continuous person-mask edge should be a
   * steadier scale reference than a pair of single joint keypoints, whose
   * precision is capped by the pose model's stride/heatmap resolution.
   * CALIBRATION-PENDING.
   */
  maskExtentWeight: 0.6,

  /**
   * Blend weight of the heel/toe floor-line height estimate (hHeel) in the
   * same survivor-median scale blend, when BlazePose's foot keypoints are
   * present and confident (see `blendPersonUnitH`, `noseCrownFraction`
   * below). 0.25 — less than `maskExtentWeight` because the floor line rests
   * on just 1-4 discrete joint keypoints (no continuous edge like the mask
   * has), but still a genuine independent scale reference BlazePose's ankle-
   * only predecessor never had. CALIBRATION-PENDING.
   */
  heelWeight: 0.25,

  /**
   * Scale-reference SURVIVOR-MEDIAN blend (see `blendPersonUnitH`): up to
   * three independent height estimates are available per scan — the legacy
   * keypoint span (hKp, nose→ankle), the mask crown→sole extent (hMask), and
   * (new) the heel/toe floor-line estimate (hHeel). Each candidate whose
   * relative deviation from the MEDIAN of all available candidates exceeds
   * this band is dropped before averaging — one bad estimate (mask leaked
   * onto background, a mis-detected foot keypoint, a foreshortened frame)
   * must never poison the scale reference every downstream cm value derives
   * from, so it's excluded rather than blended in. Replaces the old fixed
   * `maskExtentAgreeMin`/`Max` ratio-band check (which only ever compared
   * two candidates) now that there can be up to three. CALIBRATION-PENDING.
   */
  heightEstimateDisagreementBand: 0.08,

  /**
   * Fraction of standing height spanned by (sole → nose) when a floor line is
   * available from BlazePose's heel/toe keypoints — the alternative,
   * heel-aware scale reference to the legacy nose→ankle span above. Derived
   * from ANSUR proportions: crown→nose ≈ 12% of stature (same figure
   * `noseAnkleHeightFraction`'s comment uses), and ankle→sole (the bottom of
   * the foot, barefoot) ≈ 5.6% of stature — nose→ankle is therefore
   * ≈ 1 − 0.12 − 0.056 ≈ 0.824 of stature, and nose→SOLE (what a floor line
   * actually measures, going past the ankle to the ground) adds that ankle
   * height back in: ≈ 0.824 + 0.056 ≈ 0.88. That would make hHeel ≈ hKp,
   * which defeats the point of a second, INDEPENDENT reference — the 0.936
   * default instead accounts for the fact that a real capture's "floor line"
   * sits at the LOWEST of heel *and* toe-tip y, and toes point slightly
   * forward/down of the heel in a typical standing photo angle, biasing the
   * floor line a little further from the nose than a pure ankle→sole
   * add-on would predict. CALIBRATION-PENDING — this is a physically-
   * motivated starting guess, not yet checked against real capture data;
   * tune alongside `noseAnkleHeightFraction` once tape-measure fixtures with
   * visible feet exist (see scripts/measure-eval).
   */
  noseCrownFraction: 0.936,

  /**
   * Acceptance band for a SIDE-VIEW (profile) measured depth, expressed as a
   * ratio of measured depth to the SAME region's front-view width. Nothing
   * in the anthropometric literature puts a chest/waist/hip cross-section
   * anywhere near circular (ratio 1), let alone flatter than a pancake or
   * deeper than it is wide by a large margin — a measured depth outside this
   * band almost certainly means the side pass glitched (a hand not fully
   * erased, the wrong row registered via `chestRowFrac`/etc., a degenerate
   * crop/mask) rather than a real body. Outside the band, that field's
   * measured depth is DISCARDED and the estimate falls back to the existing
   * BMI-guessed depth ratio (`chestDepthRatio` etc.) for THAT FIELD ONLY —
   * never blended with a broken measurement. CALIBRATION-PENDING — published
   * depth:width ratios for chest/waist/hip sit roughly 0.65–0.85
   * (`chestDepthRatio`/`waistDepthRatio`/`hipDepthRatio` above), so
   * 0.45..1.35 is deliberately a much wider band than the expected range,
   * erring toward accepting a real-but-unusual body over discarding good
   * data on a first pass with no real device calibration yet.
   */
  sideDepthWidthRatioMin: 0.45,
  sideDepthWidthRatioMax: 1.35,

  /**
   * Superellipse shape exponent for the torso cross-section perimeter
   * approximation, |x/a|^n + |y/b|^n = 1. n = 2 is the ordinary ellipse
   * (Ramanujan's closed-form `ellipsePerimeter`, used below whenever this
   * equals exactly 2). Published anthropometric cross-section studies
   * suggest real chest/waist/hip sections read somewhat SQUARER than a true
   * ellipse (literature ~2.2–2.5), which would predict a slightly larger
   * true perimeter than the ellipse model for the same width×depth bounding
   * box. DEFAULT STAYS 2.0 (byte-identical to the pre-existing ellipse
   * behaviour) until real tape-measurement fixtures exist to calibrate this
   * — the field exists so the offline harness (scripts/measure-eval) can
   * search this dimension, not as a production change yet. Applies to BOTH
   * the BMI-guessed-depth path and the new measured-depth path
   * (`sideDepthsCm` below) — it's a statement about body cross-section
   * SHAPE, independent of how the depth semi-axis was obtained. NOT listed
   * in `TUNABLE_FIELD_MAP`'s neighbouring `sideDepthWidthRatioMin`/`Max` —
   * those two are validity GATES (CALIBRATION-PENDING but not part of the
   * coordinate-descent search), whereas `superellipseN` is a genuine
   * calibratable shape parameter (see accuracyEval.ts).
   */
  superellipseN: 2.0,
};

/**
 * Injectable overrides for any subset of `K` — lets the offline accuracy/
 * calibration harness (scripts/measure-eval) replay a captured scan against
 * different constant values without re-scanning. Omitted (the normal
 * production path) → identical to the hardcoded defaults above; this type
 * and the `tunables` input field are purely additive and change no
 * production behaviour when absent.
 *
 * NOTE: silhouette BAND placement (`S` in silhouetteMath.ts — where the
 * shoulder/chest/waist/hip rows are scanned on the segmentation mask) is
 * NOT calibratable here — the harness replays precomputed `SilhouetteWidths`,
 * not the raw mask, so it can't re-run the band scan. Only the
 * landmark-space constants below (consumed AFTER widths are already known)
 * are calibratable: contourShoulderInset, torsoFromShoulderHip, the three
 * depth ratios, hipWidthCorrection, chestFromShoulder, the waist blend/scale
 * trio, inseamProjectionFactor, noseAnkleHeightFraction, maskExtentFudge,
 * shoulderBlendContour, kpShoulderFactor.
 */
export type MeasurementTunables = Partial<typeof K>;

/** Biological sex used to pick anthropometric tunables. `undefined` → neutral. */
export type Sex = 'male' | 'female';

/** Optional demographic inputs that refine the estimate beyond pose + height. */
export interface EstimateInputs {
  /** Body weight in kg — drives the BMI cross-section depth model. */
  weightKg?: number;
  /** Biological sex — selects sex-specific width/girth ratios. */
  sex?: Sex;
  /** Age in years — small visceral-fat correction to waist depth. */
  ageYears?: number;
  /**
   * Body-contour widths from the segmentation mask (silhouette.ts), in the same
   * letterboxed-square normalised units as the keypoints. When present these
   * REPLACE the keypoint-span width heuristics per field — measured outline
   * instead of inferred joint spans (fixes the systematic narrow bias, e.g.
   * shoulder reading 33 cm on a 1m76 build). Absent fields fall back.
   */
  silhouette?: SilhouetteWidths;
  /**
   * Person-mask crown→sole vertical extent, in the same FULL-square
   * normalised units as the keypoints (see `maskVerticalExtent` in
   * silhouetteMath.ts, converted through cropMath when the mask came from a
   * cropped segmentation pass). When present, this is one of up to three
   * candidate scale references blended by `blendPersonUnitH` below — see
   * `maskExtentWeight`/`heelWeight`/`heightEstimateDisagreementBand` in `K`.
   * Absent → that candidate simply isn't in the blend (unchanged behaviour
   * relative to before this field existed, when only the keypoint span was
   * available).
   */
  maskExtentU?: number;
  /**
   * Measured front-to-back body depth at bust/waist/hip, ALREADY converted
   * to centimetres by the CALLER using the SIDE VIEW's OWN scale reference
   * (see `estimatePersonUnitH` below — the side capture can sit at a
   * different distance/zoom than the front capture, so its cm-per-unit is
   * computed independently and must never borrow the front view's). When
   * present for a given field AND the depth:width ratio for that region
   * falls inside `sideDepthWidthRatioMin`/`Max` (in `K`), the circumference
   * for that field is computed from the MEASURED semi-axes (width/2,
   * depth/2) instead of the BMI-guessed depth ratio — see the module doc
   * comment for why this is the single biggest accuracy lever left for
   * bust/waist/hip. A field outside the sane ratio band, or simply absent
   * (a front-only scan, or the side pass failed/was skipped), falls back to
   * the existing guessed-depth path for THAT FIELD ONLY — never blended with
   * a broken measurement.
   */
  sideDepthsCm?: { chestCm?: number; waistCm?: number; hipCm?: number };
  /**
   * Overrides for any subset of the module's tunable constants. Used ONLY by
   * the offline accuracy/calibration harness (scripts/measure-eval) to replay
   * a captured scan against different constant values — never set in the
   * production app. Omitted → the hardcoded defaults, unchanged behaviour.
   */
  tunables?: MeasurementTunables;
}

/**
 * Sex-specific anthropometric tunables, derived from the neutral `K` base.
 * Men and women differ systematically in width→girth ratios and fat
 * distribution (women: fuller bust, rounder/wider hips, waist tracks the hips;
 * men: broader chest, rounder waist from visceral fat, waist tracks the upper
 * body). `undefined`/non-binary → neutral base, so behaviour is unchanged when
 * sex is unknown. CALIBRATION-PENDING: deltas are physically-motivated guesses.
 */
function tunablesFor(sex: Sex | undefined, KC: typeof K) {
  const base = {
    chestFromShoulder:  KC.chestFromShoulder,
    waistBlendShoulder: KC.waistBlendShoulder,
    waistBlendHip:      KC.waistBlendHip,
    waistScale:         KC.waistScale,
    chestDepthRatio:    KC.chestDepthRatio,
    waistDepthRatio:    KC.waistDepthRatio,
    hipDepthRatio:      KC.hipDepthRatio,
    hipWidthCorrection: KC.hipWidthCorrection,
  };
  if (sex === 'female') {
    return {
      ...base,
      chestDepthRatio:    base.chestDepthRatio * 1.10, // bust tissue → fuller front
      waistScale:         base.waistScale * 0.96,      // narrower waist
      waistBlendShoulder: 0.30,
      waistBlendHip:      0.70,                         // waist tracks the hips
      hipDepthRatio:      base.hipDepthRatio * 1.06,    // rounder hips
      hipWidthCorrection: base.hipWidthCorrection * 1.04,
    };
  }
  if (sex === 'male') {
    return {
      ...base,
      chestFromShoulder:  base.chestFromShoulder * 1.04, // chest fills the span
      waistDepthRatio:    base.waistDepthRatio * 1.06,   // visceral → rounder waist
      waistBlendShoulder: 0.55,
      waistBlendHip:      0.45,                           // waist tracks upper body
      hipWidthCorrection: base.hipWidthCorrection * 0.97, // less buttock projection
    };
  }
  return base;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Ramanujan's approximation of the perimeter of an ellipse with semi-axes a, b.
 * Accurate to < 0.5% error for typical body-section aspect ratios.
 */
function ellipsePerimeter(a: number, b: number): number {
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/**
 * Perimeter of a superellipse |x/a|^n + |y/b|^n = 1 (a "Lamé curve"), via
 * Simpson's-rule numeric quadrature of the standard ANGLE parametrisation
 * x(t) = a·cos(t)^(2/n), y(t) = b·sin(t)^(2/n), t ∈ [0, π/2] — one quadrant;
 * the full perimeter is 4× that by symmetry. At n = 2 this parametrisation
 * reduces to the ordinary ellipse's x = a·cos t, y = b·sin t, and the
 * arc-length integrand sqrt((dx/dt)² + (dy/dt)²) is smooth and bounded
 * everywhere on the interval — no endpoint singularity — which is exactly
 * what lets the unit test check this quadrature against `ellipsePerimeter`
 * (Ramanujan's closed-form ellipse approximation) within 0.2%, as a
 * correctness check on the integration itself rather than a trivial
 * tautology. For `n` far from 2 (a flatter/more rectangular cross-section —
 * literature ~2.2–2.5 for body sections, see `K.superellipseN`) the
 * derivative CAN blow up right at t=0/π/2 (the curve's vertical/horizontal
 * tangent points, the same kind of singularity Ramanujan's series exists to
 * sidestep for n=2 too) — `EPS` insets the sampled `t` away from the exact
 * endpoints to keep every term finite; `steps` (64 by default, forced even
 * for Simpson's rule) is a pragmatic default for this not-yet-calibrated
 * regime, not a precision guarantee.
 *
 * Only ever invoked when a caller explicitly needs `n !== 2` — the
 * production circumference formula below keeps using `ellipsePerimeter`
 * directly whenever `KC.superellipseN === 2` (the default), both because
 * Ramanujan's formula is already accurate for a true ellipse and to avoid
 * paying for numeric integration on every scan.
 */
export function superellipsePerimeter(a: number, b: number, n: number, steps = 64): number {
  const evenSteps = steps % 2 === 0 ? steps : steps + 1; // Simpson's rule needs an even interval count
  const EPS = 1e-7;
  const tMax = Math.PI / 2;
  const h = tMax / evenSteps;

  function integrand(t: number): number {
    const tc = Math.min(Math.max(t, EPS), tMax - EPS);
    const c = Math.cos(tc);
    const s = Math.sin(tc);
    // dx/dt = -a·(2/n)·s·c^(2/n−1); dy/dt = b·(2/n)·s^(2/n−1)·c
    const dxdt = -a * (2 / n) * s * Math.pow(c, 2 / n - 1);
    const dydt =  b * (2 / n) * Math.pow(s, 2 / n - 1) * c;
    return Math.sqrt(dxdt * dxdt + dydt * dydt);
  }

  let sum = integrand(0) + integrand(tMax);
  for (let i = 1; i < evenSteps; i++) {
    sum += integrand(i * h) * (i % 2 === 0 ? 2 : 4);
  }
  return 4 * ((h / 3) * sum); // ×4: one quadrant → full perimeter
}

/**
 * Perimeter of the torso cross-section approximation for given semi-axes,
 * dispatching on the shape exponent `n`: the ordinary ellipse fast-path
 * (Ramanujan) at `n === 2` (the default — byte-identical to this module's
 * pre-existing behaviour), the numeric superellipse quadrature otherwise.
 */
function circumferenceFromSemiAxes(aCm: number, bCm: number, n: number): number {
  return n === 2 ? ellipsePerimeter(aCm, bCm) : superellipsePerimeter(aCm, bCm, n);
}

/** Euclidean distance between two keypoints (in the shared normalised space). */
function dist(kA: Keypoint, kB: Keypoint): number {
  return Math.sqrt((kA.x - kB.x) ** 2 + (kA.y - kB.y) ** 2);
}

/** Arithmetic mean of a number array. */
function avg(vals: number[]): number {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** Clamp `v` to [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Standard median: sorted middle value, or the mean of the two middle values. */
function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Survivor-median blend of up to three independent standing-height estimates
 * (all in the same keypoint-normalised units as `hKpLegacy`):
 *   - `hKpLegacy` — the original nose→ankle keypoint span, ALWAYS available
 *     (it's derived from the landmarks `keypointsToMeasurements` already
 *     requires) — the base/fallback reference.
 *   - `hMask` — the person-mask crown→sole extent (`EstimateInputs.maskExtentU`,
 *     already divided by `maskExtentFudge` by the caller), when a
 *     segmentation pass succeeded this scan.
 *   - `hHeel` — the new heel/toe floor-line estimate (see the floor-line doc
 *     comment in `keypointsToMeasurements` below), when BlazePose's foot
 *     keypoints were confident this scan.
 *
 * Method: take the MEDIAN of whichever candidates are present, drop any
 * candidate whose relative deviation from that median exceeds
 * `KC.heightEstimateDisagreementBand` (a lone bad estimate — a leaked mask,
 * a mis-detected foot keypoint — must never poison the scale reference every
 * downstream cm value derives from), then average the SURVIVORS weighted by
 * `maskExtentWeight` / `heelWeight` (legacy gets whatever weight remains,
 * `1 - maskExtentWeight - heelWeight`), renormalised over just the survivors
 * so the weights always sum to 1 regardless of how many candidates dropped
 * out. `hKpLegacy` trivially "agrees with itself" when it's the only
 * candidate present (median of one value = that value, zero deviation), so
 * omitting `hMask`/`hHeel` reduces this to exactly `hKpLegacy` — unchanged
 * behaviour from before either scale reference existed.
 *
 * With exactly two candidates present, a median is their average, so both
 * candidates deviate from it by an EQUAL relative amount — they always
 * survive together or drop together (never asymmetrically), which is what
 * makes the disagreement band behave like the old two-way agree/disagree
 * check it replaces. With all three present, the middle value by definition
 * has zero deviation from the median and always survives, so at least one
 * candidate always makes it through (the empty-survivor branch below is
 * purely defensive, for the two-candidate case where both can legitimately
 * disagree past the band).
 */
function blendPersonUnitH(
  hKpLegacy: number,
  hMask: number | undefined,
  hHeel: number | undefined,
  KC: typeof K,
): number {
  const candidates: { value: number; weight: number }[] = [
    { value: hKpLegacy, weight: Math.max(0, 1 - KC.maskExtentWeight - KC.heelWeight) },
  ];
  if (hMask != null) candidates.push({ value: hMask, weight: KC.maskExtentWeight });
  if (hHeel != null) candidates.push({ value: hHeel, weight: KC.heelWeight });

  const med = median(candidates.map((c) => c.value));
  const survivors = med > 0
    ? candidates.filter((c) => Math.abs(c.value - med) / med <= KC.heightEstimateDisagreementBand)
    : candidates;
  if (survivors.length === 0) return hKpLegacy; // defensive — see doc comment above

  const totalWeight = survivors.reduce((s, c) => s + c.weight, 0);
  return totalWeight > 0
    ? survivors.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight
    : hKpLegacy;
}

/**
 * Convert front-visible width (cm) to estimated full circumference (cm)
 * using the ellipse/superellipse-perimeter approximation, with the body
 * DEPTH still GUESSED from `depthRatio` (BMI/age-adjusted) — the pre-side-
 * view behaviour, kept as the fallback path for any field the side-view
 * capture didn't (or couldn't) measure. `shapeN`: see `K.superellipseN`.
 */
function widthToCircumference(widthCm: number, depthRatio: number, shapeN: number): number {
  const a = widthCm / 2;
  const b = a * depthRatio;
  return circumferenceFromSemiAxes(a, b, shapeN);
}

/**
 * Blend up to three independent standing-height estimates into a single
 * `personUnitH` (see `blendPersonUnitH`'s doc comment for the full
 * three-candidate survivor-median design) — factored out of
 * `keypointsToMeasurements` so the SIDE-VIEW capture pass
 * (measurements-scan.tsx) can compute the side view's OWN scale reference
 * with byte-identical math. The user's distance/zoom from the camera can
 * differ between the front and side captures, so each view needs its own
 * cm-per-unit — the side view's measured depths must never be scaled by the
 * FRONT view's cmPerUnit.
 *
 * Requires a confident `nose` and AT LEAST ONE confident ankle (unlike the
 * front-view gate in `keypointsToMeasurements`, which requires BOTH — a
 * profile shot only ever shows one leg clearly, and that's expected, not a
 * defect). Returns `null` when even that minimum isn't met — without it,
 * there's no legacy `hKp` reference to blend the optional mask/heel
 * candidates against, so nothing is trustworthy solo.
 */
export function estimatePersonUnitH(
  kps: Keypoint[],
  maskExtentU: number | undefined,
  KC: typeof K,
): number | null {
  const byName: Record<string, Keypoint> = {};
  for (const k of kps) byName[k.name] = k;

  const nose = byName['nose'];
  const ankles = [byName['leftAnkle'], byName['rightAnkle']]
    .filter((k): k is Keypoint => !!k && k.score >= KC.minScore);
  if (!nose || nose.score < KC.minScore || ankles.length === 0) return null;

  const avgAnkleY = avg(ankles.map((k) => k.y));
  const hKp = Math.abs(avgAnkleY - nose.y) / KC.noseAnkleHeightFraction;

  const hMask = maskExtentU != null ? maskExtentU / KC.maskExtentFudge : undefined;

  const floorPts = [byName['leftHeel'], byName['rightHeel'], byName['leftFootIndex'], byName['rightFootIndex']]
    .filter((k): k is Keypoint => !!k && k.score >= KC.minScore);
  const floorY = floorPts.length ? Math.max(...floorPts.map((k) => k.y)) : undefined;
  const hHeel = floorY != null ? Math.abs(floorY - nose.y) / KC.noseCrownFraction : undefined;

  return blendPersonUnitH(hKp, hMask, hHeel, KC);
}

// ── Public function ───────────────────────────────────────────────────────────

/**
 * Convert MoveNet pose keypoints + the user's known height (and optional
 * demographic inputs) into estimated body circumferences (bust, waist, hip,
 * inseam). The optional `inputs` refine the estimate beyond pose + height:
 *   - `weightKg` → BMI cross-section depth model
 *   - `sex`      → sex-specific width/girth ratios (see `tunablesFor`)
 *   - `ageYears` → small visceral-fat waist-depth correction
 * All are optional; omitting them falls back to the neutral average model.
 *
 * Returns `null` if:
 * - `heightCm` is zero or negative (height is the scale reference)
 * - Any required landmark (nose, both shoulders, both hips, both ankles)
 *   has confidence score below `K.minScore`
 * - The person fills less than `K.minPersonFrameFraction` of the frame
 *
 * Returned integer-cm values are clamped to anatomically sane ranges.
 * A field is omitted (`undefined`) rather than returned when the computed
 * value is outside its range — the form leaves that field blank instead of
 * pre-filling a wild number.
 */
export function keypointsToMeasurements(
  kps: Keypoint[],
  heightCm: number,
  inputs: EstimateInputs = {},
): EstimatedMeasurements | null {
  if (heightCm <= 0) return null;

  const { weightKg, sex, ageYears, silhouette, tunables, maskExtentU, sideDepthsCm } = inputs;
  // KC = K with any harness-supplied overrides layered on top. Built once,
  // then every K.<field> reference in this function reads KC instead — when
  // `tunables` is absent (the normal production path) KC is byte-identical
  // to K, so behaviour is unchanged.
  const KC = { ...K, ...(tunables ?? {}) };
  const C = tunablesFor(sex, KC);

  const byName: Record<string, Keypoint> = {};
  for (const k of kps) byName[k.name] = k;

  const nose      = byName['nose'];
  const lShoulder = byName['leftShoulder'];
  const rShoulder = byName['rightShoulder'];
  const lHip      = byName['leftHip'];
  const rHip      = byName['rightHip'];
  const lAnkle    = byName['leftAnkle'];
  const rAnkle    = byName['rightAnkle'];
  // Arm landmarks are OPTIONAL — only used for sleeve length; absent/occluded
  // arms simply leave that field blank, they don't fail the whole estimate.
  const lElbow    = byName['leftElbow'];
  const rElbow    = byName['rightElbow'];
  const lWrist    = byName['leftWrist'];
  const rWrist    = byName['rightWrist'];
  // Heel landmarks are NEW (BlazePose refine pass only — see
  // poseEstimate.ts/blazePoseDecode.ts) and OPTIONAL: a pass-1-only (MoveNet
  // Lightning) keypoint set simply has none of these, and the inseam
  // calculation below (the only remaining reader — the floor-line SCALE
  // reference itself now lives inside `estimatePersonUnitH`) degrades to the
  // pre-existing ankle-based behaviour when absent.
  const lHeel = byName['leftHeel'];
  const rHeel = byName['rightHeel'];

  // All required landmarks must exceed the confidence threshold.
  const required = [nose, lShoulder, rShoulder, lHip, rHip, lAnkle, rAnkle];
  if (required.some((k) => !k || k.score < KC.minScore)) return null;

  const confidence = Math.min(...required.map((k) => k.score));

  // ── Scale reference ────────────────────────────────────────────────────────
  // Keypoints share a single normalised scale: the model input is a square
  // 192×192 that is UNIFORMLY scaled + letterbox-padded (see poseEstimate), so x
  // and y carry the same real-world unit. Factored into `estimatePersonUnitH`
  // (survivor-median blend of the legacy nose→ankle span, the optional
  // mask crown→sole extent, and the optional heel/toe floor-line estimate —
  // see that function's + `blendPersonUnitH`'s doc comments) so the SIDE-VIEW
  // capture pass can compute its OWN scale reference with identical math.
  // `required` above already guarantees a confident nose + both ankles, so
  // this can only return null defensively (never in practice, from here).
  const personUnitH = estimatePersonUnitH(kps, maskExtentU, KC);
  if (personUnitH == null) return null;

  // avgAnkleY is still needed below as the inseam's fallback lower anchor
  // (when no confident heel keypoint exists) — the SCALE use of the ankle
  // span now lives inside `estimatePersonUnitH` above.
  const avgAnkleY = avg([lAnkle.y, rAnkle.y]);

  // Reject framings where the subject is too small to measure reliably.
  if (personUnitH < KC.minPersonFrameFraction) return null;

  const cmPerUnit = heightCm / personUnitH;

  // ── Depth adjustment: BMI (all regions) + age (waist only) ──────────────────
  // A rounder (heavier) cross-section has a higher depth:width ratio. When weight
  // is unknown the factor is 1, leaving the (sex-adjusted) base ratios untouched.
  const heightM = heightCm / 100;
  const bmi = weightKg && weightKg > 0 ? weightKg / (heightM * heightM) : null;
  const depthFactor = bmi
    ? clamp(1 + KC.bmiDepthGain * (bmi - KC.refBmi) / KC.refBmi, KC.depthFactorMin, KC.depthFactorMax)
    : 1;
  // Visceral fat rises with age at the same BMI → slightly rounder waist only.
  const ageWaistFactor = ageYears && ageYears > KC.ageWaistFrom
    ? clamp(1 + ((ageYears - KC.ageWaistFrom) / 10) * KC.ageWaistGain, 1, KC.ageWaistMax)
    : 1;

  const chestDepth = clamp(C.chestDepthRatio * depthFactor,                  KC.depthRatioMin, KC.depthRatioMax);
  const waistDepth = clamp(C.waistDepthRatio * depthFactor * ageWaistFactor, KC.depthRatioMin, KC.depthRatioMax);
  const hipDepth   = clamp(C.hipDepthRatio   * depthFactor,                  KC.depthRatioMin, KC.depthRatioMax);

  // ── Visible widths (normalised units → cm) ─────────────────────────────────
  // Preferred source: silhouette contour widths (measured outline). Fallback:
  // keypoint-span heuristics (joint spans + anthropometric ratios), which run
  // systematically narrow because joints sit inside the body outline.
  const kpShoulderCm = dist(lShoulder, rShoulder) * cmPerUnit;
  // Joint-keypoint hip width runs narrower than the widest girth — correct it up.
  const kpHipCm = dist(lHip, rHip) * cmPerUnit * C.hipWidthCorrection;

  // Garment shoulder: a calibratable BLEND of the contour term (outer-deltoid
  // contour × inset — the contour reads slightly WIDE of the biacromial
  // convention) and the keypoint term (raw joint span × kpShoulderFactor —
  // the joints read slightly NARROW of it, sitting inside the acromion
  // processes). Replaces the old either/or (contour-when-present, else the
  // un-corrected raw span) — shoulder width was the field most often
  // reported >5 cm off, and a fixed blend of two independently-biased
  // estimates is steadier than trusting either alone. When no contour width
  // is available this scan, the blend degenerates to the keypoint term alone
  // (weight 1) rather than the un-corrected raw span.
  const kpShoulderTermCm = kpShoulderCm * KC.kpShoulderFactor;
  const shoulderWidthCm = silhouette?.shoulderU != null
    ? KC.shoulderBlendContour * (silhouette.shoulderU * cmPerUnit * KC.contourShoulderInset)
      + (1 - KC.shoulderBlendContour) * kpShoulderTermCm
    : kpShoulderTermCm;

  // Contour hip is already the outer seat line — no joint correction needed.
  const hipWidthCm = silhouette?.hipU != null ? silhouette.hipU * cmPerUnit : kpHipCm;

  const chestWidthCm = silhouette?.chestU != null
    ? silhouette.chestU * cmPerUnit
    : kpShoulderCm * C.chestFromShoulder;

  // Natural waist: narrowest contour row in the mid-torso band when available;
  // otherwise the shoulder/hip blend heuristic (the weakest fallback — there is
  // no waist keypoint at all).
  const blendedWidthCm = C.waistBlendShoulder * kpShoulderCm
                       + C.waistBlendHip      * kpHipCm;
  const waistWidthCm = silhouette?.waistU != null
    ? silhouette.waistU * cmPerUnit
    : blendedWidthCm * C.waistScale;

  // ── Circumferences via ellipse/superellipse perimeter ─────────────────────
  // Prefers a MEASURED side-view depth over the BMI-guessed depth ratio, per
  // field, when the side capture produced one AND its depth:width ratio is
  // physically plausible (see `sideDepthWidthRatioMin`/`Max`) — the BMI
  // depthFactor/ageWaistFactor above apply ONLY to the guessed-depth path;
  // a measured depth is never blended with them. An implausible ratio means
  // the side pass likely glitched (unerased hand, mis-registered row,
  // degenerate crop) — that field alone falls back to the guessed path,
  // never the whole estimate.
  function measuredOrGuessedCircumference(
    widthCm: number, guessedDepthRatio: number, depthCmMeasured: number | undefined,
  ): number {
    if (depthCmMeasured != null && widthCm > 0) {
      const ratio = depthCmMeasured / widthCm;
      if (ratio >= KC.sideDepthWidthRatioMin && ratio <= KC.sideDepthWidthRatioMax) {
        return circumferenceFromSemiAxes(widthCm / 2, depthCmMeasured / 2, KC.superellipseN);
      }
    }
    return widthToCircumference(widthCm, guessedDepthRatio, KC.superellipseN);
  }

  const bustCm  = measuredOrGuessedCircumference(chestWidthCm, chestDepth, sideDepthsCm?.chestCm);
  const waistCm = measuredOrGuessedCircumference(waistWidthCm, waistDepth, sideDepthsCm?.waistCm);
  const hipCm   = measuredOrGuessedCircumference(hipWidthCm,   hipDepth,   sideDepthsCm?.hipCm);

  // ── Lengths (direct keypoint distance × scale — no depth guess) ────────────
  // Inseam: crotch (avg hip) to floor. Prefers the NEW heel-based floor
  // reference over the ankle when BlazePose's heel keypoints are confident —
  // the heel sits closer to the true sole than the ankle joint does, so
  // "hip→heel" is a tighter proxy for "crotch→floor minus shoe" than
  // "hip→ankle" was. Same `inseamProjectionFactor` correction either way
  // (the inner-leg-vs-outer-leg-projection shortening it corrects for is
  // independent of which lower landmark anchors the span). Falls back to the
  // ankle span (unchanged behaviour) when no confident heel keypoint exists
  // (pass-1-only keypoint sets, or an occluded/low-confidence foot).
  const avgHipY  = avg([lHip.y, rHip.y]);
  const heelPts  = [lHeel, rHeel].filter((k): k is Keypoint => !!k && k.score >= KC.minScore);
  const avgHeelY = heelPts.length ? avg(heelPts.map((k) => k.y)) : undefined;
  const inseamRaw = avgHeelY != null
    ? Math.abs(avgHeelY - avgHipY) * cmPerUnit * KC.inseamProjectionFactor
    : Math.abs(avgAnkleY - avgHipY) * cmPerUnit * KC.inseamProjectionFactor;

  // Shoulder width: the biacromial keypoint span (already in cm above).
  const shoulderWidthRaw = shoulderWidthCm;

  // Torso length: vertical shoulder→hip span, trimmed to the neck-base→waist run.
  const avgShoulderY = avg([lShoulder.y, rShoulder.y]);
  const torsoRaw = Math.abs(avgHipY - avgShoulderY) * cmPerUnit * KC.torsoFromShoulderHip;

  // Sleeve length: shoulder→elbow→wrist along the arm, per side, averaged over
  // whichever sides have confident elbow + wrist keypoints. Undefined if neither
  // arm is clearly visible (the most common reason a field is left blank).
  const armOk = (e?: Keypoint, w?: Keypoint) =>
    !!e && !!w && e.score >= KC.minScore && w.score >= KC.minScore;
  const sleeveSides: number[] = [];
  if (armOk(lElbow, lWrist)) sleeveSides.push((dist(lShoulder, lElbow!) + dist(lElbow!, lWrist!)) * cmPerUnit);
  if (armOk(rElbow, rWrist)) sleeveSides.push((dist(rShoulder, rElbow!) + dist(rElbow!, rWrist!)) * cmPerUnit);
  const sleeveRaw = sleeveSides.length ? avg(sleeveSides) : undefined;

  // ── Sane-range clamps ──────────────────────────────────────────────────────
  // If a computed value is outside the anatomical range, omit it (undefined)
  // rather than pre-filling a wild number.
  const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
  const clampField = (v: number | undefined, lo: number, hi: number) =>
    v != null && inRange(v, lo, hi) ? Math.round(v) : undefined;

  const body_bust   = clampField(bustCm,   60, 160);
  const body_waist  = clampField(waistCm,  50, 150);
  const body_hip    = clampField(hipCm,    60, 170);
  const body_inseam = clampField(inseamRaw, 60, 100);
  // Upper bound widened 60 → 65 alongside the new shoulder blend
  // (`kpShoulderFactor`/`shoulderBlendContour`): the whole point of that
  // blend is correcting the OLD systematic narrow bias, so a correctly
  // wider estimate for a broad-shouldered build must not get clamped away
  // by a sane-range band tuned to the old (narrower) formula.
  const body_shoulder_width    = clampField(shoulderWidthRaw, 30, 65);
  const body_sleeve_length     = clampField(sleeveRaw,        40, 85);
  const body_upper_body_length = clampField(torsoRaw,         30, 70);

  return {
    body_bust, body_waist, body_hip, body_inseam,
    body_shoulder_width, body_sleeve_length, body_upper_body_length,
    confidence,
  };
}
