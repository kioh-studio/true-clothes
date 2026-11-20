// Demographic prior for bust/waist/hip girth from sex + height + weight + age
// (no camera) and an inverse-variance fusion with the scan estimate.
// Pure — no native imports. Source: reports/anthro-fit-ansur.md §3c
// (waist = NHANES Asian 2011–2023 pooled, n 1286 M / 1335 F; hip = NHANES Asian-only; chest = ANSUR II Asian-weighted).
// ANTHRO-FIT: tape re-tune pending.

import type { EstimatedMeasurements } from '../../types/measurements';
import type { Sex } from './landmarksToMeasurements';

export interface GirthPrior { mean: number; sd: number }
export interface DemographicPrior { bust: GirthPrior; waist: GirthPrior; hip: GirthPrior }

type Coef = { int: number; stature: number; kg: number; age: number; sd: number };

// girth_cm = int + stature·cm + kg·kg + age·years; sd = Asian OOF residual SD.
const COEF: Record<Sex, Record<'bust' | 'waist' | 'hip', Coef>> = {
  male: {
    waist: { int: 88.854, stature: -0.3906, kg: 0.8210, age: 0.1896, sd: 4.05 },
    hip:   { int: 77.622, stature: -0.1252, kg: 0.5614, age: -0.0186, sd: 2.93 },
    bust:  { int: 96.775, stature: -0.2613, kg: 0.6049, age: 0.107, sd: 3.11 },
  },
  female: {
    waist: { int: 86.788, stature: -0.3875, kg: 0.8786, age: 0.1462, sd: 4.45 },
    hip:   { int: 74.806, stature: -0.1502, kg: 0.7383, age: 0.0145, sd: 3.67 },
    bust:  { int: 93.226, stature: -0.3072, kg: 0.7077, age: 0.1206, sd: 3.82 },
  },
};

const DEFAULT_AGE = 30;
// The prior predicts the navel/iliac waist, larger than the narrowest waist the
// scan measures: subtract this many cm and inflate its SD.
// ponytail: offset of AIST minimum-waist means vs NHANES/ANSUR Asian priors, n=48, low confidence; replace once VN STEPS / tape data exist.
const WAIST_OFFSET_CM: Record<Sex, number> = { male: 3.5, female: 6.5 };
const WAIST_SD_INFLATE = 1.5;

// Scan SD by depth path (published front+side vs front-only MAE bands).
// ponytail: hand-picked from literature, not measured on our own fixtures.
const SCAN_SD_SIDE = 2.5;
const SCAN_SD_GUESS = 4.0;
const OUTLIER_SIGMAS = 3;

export function demographicPrior(
  sex: Sex | undefined, heightCm: number | undefined, weightKg: number | undefined, ageYears?: number,
): DemographicPrior | null {
  if (!sex || !heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const age = ageYears ?? DEFAULT_AGE;
  const at = (c: Coef): GirthPrior => ({
    mean: c.int + c.stature * heightCm + c.kg * weightKg + c.age * age,
    sd: c.sd,
  });
  const waist = at(COEF[sex].waist);
  return {
    bust: at(COEF[sex].bust),
    waist: { mean: waist.mean - WAIST_OFFSET_CM[sex], sd: waist.sd * WAIST_SD_INFLATE },
    hip: at(COEF[sex].hip),
  };
}

type Field = 'body_bust' | 'body_waist' | 'body_hip';
const FIELDS: Array<[Field, 'bust' | 'waist' | 'hip']> = [
  ['body_bust', 'bust'], ['body_waist', 'waist'], ['body_hip', 'hip'],
];

/** Inverse-variance fuse scan girths with the prior. Returns a new object. */
export function fuseWithPrior(est: EstimatedMeasurements, prior: DemographicPrior | null): EstimatedMeasurements {
  if (!prior) return est;
  const out: EstimatedMeasurements = { ...est };
  const outliers: Field[] = [];
  for (const [field, key] of FIELDS) {
    const scan = est[field];
    if (scan == null) continue; // never fill a missing field from the prior
    const sdScan = est.depthSource?.[key] === 'side' ? SCAN_SD_SIDE : SCAN_SD_GUESS;
    const p = prior[key];
    if (Math.abs(scan - p.mean) > OUTLIER_SIGMAS * Math.sqrt(sdScan ** 2 + p.sd ** 2)) {
      outliers.push(field); // real-but-unusual body: keep the raw scan
      continue;
    }
    const wS = 1 / sdScan ** 2;
    const wP = 1 / p.sd ** 2;
    out[field] = Math.round((scan * wS + p.mean * wP) / (wS + wP));
  }
  if (outliers.length) out.outliers = outliers;
  return out;
}
