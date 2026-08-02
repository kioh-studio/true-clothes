// Offline accuracy/calibration harness — pure evaluation logic, no fs/native
// deps, so it runs under jest AND under the Deno CLI runner
// (scripts/measure-eval/run.ts) against the exact same source file.
//
// Pipeline: replay a captured scan (raw keypoints + silhouette widths + the
// inputs the user gave at scan time) through `keypointsToMeasurements`,
// compare the prediction field-by-field against a tape-measure ground truth,
// and report bias/MAE/RMSE plus a suggested calibration. See
// scripts/measure-eval/fixtures/README.md for the on-disk fixture schema and
// how to capture one on a device.

import {
  keypointsToMeasurements,
  estimatePersonUnitH,
  K,
  type EstimateInputs,
  type MeasurementTunables,
  type Sex,
} from './landmarksToMeasurements';
import type { Keypoint } from './poseEstimate';
import type { SilhouetteWidths } from './silhouetteMath';
import type { SideDepths } from './sideViewMath';
import { computeBodyShape, type BodyShape } from '../../types/measurements';

// ── Fixture schema ────────────────────────────────────────────────────────────

/** Fields both predicted by `keypointsToMeasurements` and measurable with a tape. */
export type MeasuredField =
  | 'body_bust'
  | 'body_waist'
  | 'body_hip'
  | 'body_inseam'
  | 'body_shoulder_width'
  | 'body_sleeve_length'
  | 'body_upper_body_length';

export const MEASURED_FIELDS: MeasuredField[] = [
  'body_bust', 'body_waist', 'body_hip', 'body_inseam',
  'body_shoulder_width', 'body_sleeve_length', 'body_upper_body_length',
];

/**
 * A single captured scan + its tape-measure ground truth. Matches the on-disk
 * JSON schema in scripts/measure-eval/fixtures/README.md exactly (that file
 * is the source of truth for anyone hand-writing/capturing a fixture).
 */
export interface Fixture {
  subjectId: string;
  /** Free-form date string, informational only — not read by the evaluator. */
  capturedAt?: string;
  /**
   * Schema version marker — 2 for fixtures captured after the side-view
   * (profile) depth-capture pass shipped (adds the optional `side` field
   * below + `capturePitchRad`). ABSENT/1 fixtures are the ORIGINAL schema
   * and evaluate byte-identically to before this field existed — nothing
   * here branches on the version number itself, only on whether `side` is
   * present, so an old fixture missing this field entirely keeps working
   * unchanged.
   */
  version?: number;
  inputs: {
    heightCm: number;
    weightKg?: number;
    sex?: Sex;
    ageYears?: number;
    /**
     * Person-mask crown→sole vertical extent (FULL-square units), or absent
     * if the captured scan had no cropped-segmentation pass to derive it
     * from. See `EstimateInputs.maskExtentU` in landmarksToMeasurements.ts.
     */
    maskExtentU?: number;
  };
  /** The 17 MoveNet keypoints exactly as captured (letterboxed-square space). */
  keypoints: Keypoint[];
  /** Segmentation-mask contour widths, or null/absent if the scan had none. */
  silhouette?: SilhouetteWidths | null;
  /**
   * FRONT capture's DeviceMotion pitch (radians, `rotation.beta`) at capture
   * time, median across the buffered good-pose frames — groundwork for a
   * future keystone/perspective correction, not read by any math yet (see
   * `capturePitchRad` in measurements-scan.tsx). Purely informational here.
   */
  capturePitchRad?: number;
  /**
   * SIDE (profile) capture data — absent for a front-only scan (or v1
   * fixtures, which never had this field at all). When present, `evaluateFixture`
   * recomputes `EstimateInputs.sideDepthsCm` from `depthsU` using the SAME
   * `estimatePersonUnitH` math the app uses for the side view's own scale
   * reference — see the module doc comment — so the harness can calibrate
   * `superellipseN`/`sideDepthWidthRatioMin`/`Max` against real ground truth
   * once fixtures with tape-measured depth exist.
   */
  side?: {
    /** The side frame's own (refined, where available) keypoints. */
    keypoints: Keypoint[];
    /** Measured front-to-back depths, in the SIDE mask's own normalised
     *  units (NOT centimetres — `evaluateFixture` converts, same as the app). */
    depthsU?: SideDepths;
    /** Side segmentation mask's crown→sole vertical extent, full-square units. */
    maskExtentU?: number;
    /** SIDE capture's own DeviceMotion pitch — same informational status as
     *  the front-level `capturePitchRad` above. */
    capturePitchRad?: number;
  };
  /** Tape-measure truth. Every field optional — score only what was measured. */
  groundTruth: Partial<Record<MeasuredField, number>>;
}

// ── Per-subject evaluation ────────────────────────────────────────────────────

export interface FieldError {
  field: MeasuredField;
  /** Always 1 here — one prediction vs. one truth per subject. Kept so the
   *  shape lines up with `Aggregate.perField`, which sums this across subjects. */
  n: number;
  predicted: number;
  truth: number;
  /** predicted − truth. Positive → the estimate reads too large. */
  signedError: number;
  absError: number;
}

export interface SubjectResult {
  subjectId: string;
  fields: FieldError[];
  shapePredicted: BodyShape | null;
  shapeTruth: BodyShape | null;
  /** null when either side lacks a full bust/waist/hip triple — not counted. */
  shapeCorrect: boolean | null;
}

/**
 * Run one fixture through `keypointsToMeasurements` (optionally with
 * `tunables` overriding the defaults) and diff every present groundTruth
 * field against the prediction.
 */
export function evaluateFixture(fx: Fixture, tunables?: MeasurementTunables): SubjectResult {
  // Recompute the SIDE view's own cm-per-unit scale — using the SAME
  // `estimatePersonUnitH` math (and the same `tunables` override) the app
  // uses for the side pass — from the raw `depthsU` a v2 fixture stores.
  // Absent `fx.side` (front-only or a v1 fixture) → `sideDepthsCm` stays
  // undefined, byte-identical to pre-side-view evaluation.
  const KC = { ...K, ...(tunables ?? {}) };
  let sideDepthsCm: EstimateInputs['sideDepthsCm'];
  if (fx.side) {
    const sidePersonUnitH = estimatePersonUnitH(fx.side.keypoints, fx.side.maskExtentU, KC);
    if (sidePersonUnitH != null && sidePersonUnitH > 0 && fx.inputs.heightCm > 0) {
      const sideCmPerUnit = fx.inputs.heightCm / sidePersonUnitH;
      const d = fx.side.depthsU ?? {};
      sideDepthsCm = {
        chestCm: d.chestU != null ? d.chestU * sideCmPerUnit : undefined,
        waistCm: d.waistU != null ? d.waistU * sideCmPerUnit : undefined,
        hipCm:   d.hipU   != null ? d.hipU   * sideCmPerUnit : undefined,
      };
    }
  }

  const inputs: EstimateInputs = {
    weightKg: fx.inputs.weightKg,
    sex: fx.inputs.sex,
    ageYears: fx.inputs.ageYears,
    silhouette: fx.silhouette ?? undefined,
    maskExtentU: fx.inputs.maskExtentU,
    sideDepthsCm,
    tunables,
  };
  const predicted = keypointsToMeasurements(fx.keypoints, fx.inputs.heightCm, inputs);

  const fields: FieldError[] = [];
  for (const field of MEASURED_FIELDS) {
    const truth = fx.groundTruth[field];
    const pred = predicted?.[field];
    if (truth == null || pred == null) continue; // unscored / omitted — skip, don't count as zero error
    const signedError = pred - truth;
    fields.push({ field, n: 1, predicted: pred, truth, signedError, absError: Math.abs(signedError) });
  }

  const shapeTruth = computeBodyShape(fx.groundTruth);
  const shapePredicted = predicted ? computeBodyShape(predicted) : null;
  const shapeCorrect = shapeTruth != null && shapePredicted != null ? shapeTruth === shapePredicted : null;

  return { subjectId: fx.subjectId, fields, shapePredicted, shapeTruth, shapeCorrect };
}

// ── Aggregation ────────────────────────────────────────────────────────────────

export interface Aggregate {
  perField: Record<string, {
    n: number;
    bias: number;
    mae: number;
    rmse: number;
    /** Scalar to multiply every prediction by to zero out the mean bias. */
    suggestMultiplier: number;
    /** Constant to add to every prediction to zero out the mean bias. */
    suggestOffset: number;
  }>;
  /** null when no fixture had a full truth+predicted bust/waist/hip triple. */
  shapeAccuracy: number | null;
  nSubjects: number;
}

function mean(vals: number[]): number {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** Roll a list of per-subject results into per-field error stats + calibration suggestions. */
export function aggregate(results: SubjectResult[]): Aggregate {
  const byField = new Map<MeasuredField, FieldError[]>();
  for (const r of results) {
    for (const fe of r.fields) {
      const list = byField.get(fe.field) ?? [];
      list.push(fe);
      byField.set(fe.field, list);
    }
  }

  const perField: Aggregate['perField'] = {};
  for (const [field, errs] of byField) {
    const n = errs.length;
    const bias = mean(errs.map((e) => e.signedError));
    const mae = mean(errs.map((e) => e.absError));
    const rmse = Math.sqrt(mean(errs.map((e) => e.signedError ** 2)));
    // suggestMultiplier: mean(truth / predicted) — the scalar that would have
    // zeroed each prediction's error, averaged across subjects. Predictions
    // are circumferences/lengths in cm and the sane-range clamps keep them
    // well away from 0, so the guard below is just defensive.
    const ratios = errs.filter((e) => e.predicted !== 0).map((e) => e.truth / e.predicted);
    const suggestMultiplier = ratios.length ? mean(ratios) : 1;
    const suggestOffset = mean(errs.map((e) => e.truth - e.predicted));
    perField[field] = { n, bias, mae, rmse, suggestMultiplier, suggestOffset };
  }

  const shapeScored = results.filter((r) => r.shapeCorrect != null);
  const shapeAccuracy = shapeScored.length
    ? shapeScored.filter((r) => r.shapeCorrect).length / shapeScored.length
    : null;

  return { perField, shapeAccuracy, nSubjects: results.length };
}

// ── Calibration suggestion ────────────────────────────────────────────────────

/**
 * Maps each landmark-space tunable to the measured field(s) it primarily
 * drives — used to weight the coordinate-descent search below so moving e.g.
 * `hipWidthCorrection` is judged against hip error only, not the average of
 * every field. `noseAnkleHeightFraction` sets the overall cm-per-unit scale
 * reference, so it touches every length AND (via the ellipse widths) every
 * circumference — it's listed against all seven fields.
 */
export const TUNABLE_FIELD_MAP: Record<string, MeasuredField[]> = {
  noseAnkleHeightFraction: [...MEASURED_FIELDS],
  maskExtentFudge: [...MEASURED_FIELDS],
  contourShoulderInset: ['body_shoulder_width'],
  shoulderBlendContour: ['body_shoulder_width'],
  kpShoulderFactor: ['body_shoulder_width'],
  torsoFromShoulderHip: ['body_upper_body_length'],
  inseamProjectionFactor: ['body_inseam'],
  hipWidthCorrection: ['body_hip'],
  chestFromShoulder: ['body_bust'],
  waistBlendShoulder: ['body_waist'],
  waistBlendHip: ['body_waist'],
  waistScale: ['body_waist'],
  chestDepthRatio: ['body_bust'],
  waistDepthRatio: ['body_waist'],
  hipDepthRatio: ['body_hip'],
  // Torso cross-section shape exponent — applies to bust/waist/hip
  // regardless of whether the depth semi-axis came from the BMI-guessed
  // path or a measured side-view depth (see the doc comment on
  // `K.superellipseN`). NOT `sideDepthWidthRatioMin`/`Max` — those are
  // validity GATES for a measured depth, not a calibratable shape param.
  superellipseN: ['body_bust', 'body_waist', 'body_hip'],
};

/** The standard set of landmark-space constants worth calibrating offline
 *  (see the CALIBRATION-PENDING note on `MeasurementTunables`). */
export const CALIBRATABLE_KEYS: (keyof MeasurementTunables)[] = Object.keys(TUNABLE_FIELD_MAP) as (keyof MeasurementTunables)[];

export interface CalibrationOptions {
  /** Multiplicative search range around each key's current default. */
  rangeLow?: number;
  rangeHigh?: number;
  /** Number of grid points sampled across [rangeLow, rangeHigh] (inclusive). */
  steps?: number;
  /** Coordinate-descent passes over the whole key list. */
  passes?: number;
}

export interface CalibrationResult {
  tunables: MeasurementTunables;
  beforeMae: number;
  afterMae: number;
}

/**
 * Coordinate-descent search for a `MeasurementTunables` override that
 * reduces total MAE across the given fixtures, restricted to `keys`.
 *
 * Method (deliberately simple — no RNG, no gradient, fully deterministic):
 * for each key, in order, try a 1D grid of multiplicative factors
 * (`rangeLow`..`rangeHigh`, `steps` points) applied to that key's ORIGINAL
 * default value from `K` — not the value found so far, so the grid doesn't
 * drift across passes — keep whichever factor minimizes the weighted MAE
 * of the fields that key influences (see `TUNABLE_FIELD_MAP`), evaluated
 * with every OTHER key held at whatever `suggestCalibration` has already
 * settled on this run. Repeat for `passes` rounds so keys can react to each
 * other's updates (a later pass may nudge an earlier key's optimum). This is
 * plain coordinate descent, not a global optimizer — good enough for a
 * handful of near-independent constants and small fixture counts.
 */
export function suggestCalibration(
  fixtures: Fixture[],
  keys: (keyof MeasurementTunables)[],
  opts: CalibrationOptions = {},
): CalibrationResult {
  const { rangeLow = 0.7, rangeHigh = 1.3, steps = 13, passes = 3 } = opts;

  const influencedFields = Array.from(new Set(keys.flatMap((k) => TUNABLE_FIELD_MAP[k as string] ?? [])));

  function weightedMae(tunables: MeasurementTunables): number {
    if (!influencedFields.length || !fixtures.length) return 0;
    const agg = aggregate(fixtures.map((fx) => evaluateFixture(fx, tunables)));
    let sumAbs = 0;
    let count = 0;
    for (const field of influencedFields) {
      const stat = agg.perField[field];
      if (!stat) continue;
      sumAbs += stat.mae * stat.n;
      count += stat.n;
    }
    return count ? sumAbs / count : 0;
  }

  const current: MeasurementTunables = {};
  const beforeMae = weightedMae(current);

  for (let pass = 0; pass < passes; pass++) {
    for (const key of keys) {
      const base = K[key as keyof typeof K];
      if (typeof base !== 'number') continue; // every real tunable is numeric — defensive only

      let bestValue = current[key] ?? base;
      let bestScore = weightedMae(current);
      for (let i = 0; i < steps; i++) {
        const t = steps === 1 ? 0 : i / (steps - 1);
        const factor = rangeLow + t * (rangeHigh - rangeLow);
        const candidateValue = base * factor;
        const candidate: MeasurementTunables = { ...current, [key]: candidateValue };
        const score = weightedMae(candidate);
        if (score < bestScore) {
          bestScore = score;
          bestValue = candidateValue;
        }
      }
      (current as Record<string, number>)[key as string] = bestValue;
    }
  }

  const afterMae = weightedMae(current);
  return { tunables: current, beforeMae, afterMae };
}
