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
   * Minimum standing height the person must span as a fraction of the frame
   * (normalised units, 0..1). Below this the subject is too far / partly out of
   * frame: keypoint precision collapses and a tiny nose↔ankle span explodes
   * cmPerUnit, yielding garbage that can still land inside the sane-range clamps.
   * A genuine full-body shot spans ~0.8–1.0; 0.2 rejects only unusable framing.
   */
  minPersonFrameFraction: 0.2,
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
 * trio, inseamProjectionFactor, noseAnkleHeightFraction.
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

/**
 * Convert front-visible width (cm) to estimated full circumference (cm)
 * using the ellipse-perimeter approximation.
 * depthRatio: body-depth-to-width ratio for the anatomical region.
 */
function widthToCircumference(widthCm: number, depthRatio: number): number {
  const a = widthCm / 2;
  const b = a * depthRatio;
  return ellipsePerimeter(a, b);
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

  const { weightKg, sex, ageYears, silhouette, tunables } = inputs;
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

  // All required landmarks must exceed the confidence threshold.
  const required = [nose, lShoulder, rShoulder, lHip, rHip, lAnkle, rAnkle];
  if (required.some((k) => !k || k.score < KC.minScore)) return null;

  const confidence = Math.min(...required.map((k) => k.score));

  // ── Scale reference ────────────────────────────────────────────────────────
  // Keypoints share a single normalised scale: the model input is a square
  // 192×192 that is UNIFORMLY scaled + letterbox-padded (see poseEstimate), so x
  // and y carry the same real-world unit. The ankle→nose span covers
  // noseAnkleHeightFraction of the full standing height.

  const avgAnkleY      = avg([lAnkle.y, rAnkle.y]);
  const personUnitH    = Math.abs(avgAnkleY - nose.y) / KC.noseAnkleHeightFraction;
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

  // Garment shoulder: outer-deltoid contour × inset, or the raw joint span.
  const shoulderWidthCm = silhouette?.shoulderU != null
    ? silhouette.shoulderU * cmPerUnit * KC.contourShoulderInset
    : kpShoulderCm;

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

  // ── Circumferences via ellipse perimeter ──────────────────────────────────
  const bustCm  = widthToCircumference(chestWidthCm, chestDepth);
  const waistCm = widthToCircumference(waistWidthCm, waistDepth);
  const hipCm   = widthToCircumference(hipWidthCm,   hipDepth);

  // ── Lengths (direct keypoint distance × scale — no depth guess) ────────────
  // Inseam: vertical distance from avg hip to avg ankle.
  const avgHipY    = avg([lHip.y, rHip.y]);
  const inseamRaw  = Math.abs(avgAnkleY - avgHipY) * cmPerUnit * KC.inseamProjectionFactor;

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
  const body_shoulder_width    = clampField(shoulderWidthRaw, 30, 60);
  const body_sleeve_length     = clampField(sleeveRaw,        40, 85);
  const body_upper_body_length = clampField(torsoRaw,         30, 70);

  return {
    body_bust, body_waist, body_hip, body_inseam,
    body_shoulder_width, body_sleeve_length, body_upper_body_length,
    confidence,
  };
}
