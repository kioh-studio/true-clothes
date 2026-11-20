// bodym-eval/run — benchmark + calibration of keypointsToMeasurements on converted BodyM fixtures.
//
//   deno run -A --node-modules-dir=none --sloppy-imports scripts/bodym-eval/run.ts <bodymDir> [--tag=base]
//        [--tunables=<file.json>]   evaluate with these tunables (default: current K)
//        [--calibrate=front|side]   weighted coordinate descent on TRAIN, then re-score test splits
//        [--no-scale]               with --calibrate: do not tune noseAnkleHeightFraction/maskExtentFudge
//        [--out=<file.json>]        also dump the numbers as JSON (put it OUTSIDE the repo)
//
// Weighted ("Asian-like", PRIMARY) = fixture.weight (see convert.ts: body-size density-ratio proxy, NOT
// ethnicity). Unweighted = every subject counts once.

import {
  keypointsToMeasurements, estimatePersonUnitH, K, type MeasurementTunables, type EstimateInputs,
} from '../../src/features/measurements/landmarksToMeasurements';
import { demographicPrior, fuseWithPrior } from '../../src/features/measurements/demographicPrior';
import { TUNABLE_FIELD_MAP, type Fixture, type MeasuredField } from '../../src/features/measurements/accuracyEval';

type Fx = Fixture & { weight: number; meta: { w: number } };
const arg = (n: string) => Deno.args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = Deno.args.find((a) => !a.startsWith('--'));
if (!dir) throw new Error('usage: run.ts <bodymDir> [--tag=base] [--calibrate=front|side]');
const tag = arg('tag') ?? 'base';

const load = (split: string) => {
  const j = JSON.parse(Deno.readTextFileSync(`${dir}/derived/${tag}/${split}.json`));
  return j.fixtures as Fx[];
};

// Fields. HIGH = measured from mask contours (girths); LOW = pure functions of pseudo-keypoint fractions * height.
const HIGH: MeasuredField[] = ['body_bust', 'body_waist', 'body_hip'];
const MID: MeasuredField[] = ['body_shoulder_width']; // contour term OK, kp term synthetic, A-pose arms inflate contour
const LOW: MeasuredField[] = ['body_inseam', 'body_upper_body_length'];
const FIELDS = [...HIGH, ...MID, ...LOW];
// sleeve: not benchmarked (no arm keypoints can be derived from a mask).

interface Cfg { side: boolean; fuse: boolean }
type Pred = Record<string, number | undefined>;

function predict(fx: Fx, t: MeasurementTunables | undefined, cfg: Cfg): { pred: Pred | null; why?: string } {
  const KC = { ...K, ...(t ?? {}) };
  let sideDepthsCm: EstimateInputs['sideDepthsCm'];
  if (cfg.side && fx.side) { // same conversion as accuracyEval.evaluateFixture / the app (side view has its OWN scale)
    const u = estimatePersonUnitH(fx.side.keypoints, fx.side.maskExtentU, KC);
    if (u != null && u > 0) {
      const s = fx.inputs.heightCm / u, d = fx.side.depthsU ?? {};
      sideDepthsCm = { chestCm: d.chestU != null ? d.chestU * s : undefined, waistCm: d.waistU != null ? d.waistU * s : undefined, hipCm: d.hipU != null ? d.hipU * s : undefined };
    }
  }
  const est = keypointsToMeasurements(fx.keypoints, fx.inputs.heightCm, {
    weightKg: fx.inputs.weightKg, sex: fx.inputs.sex, silhouette: fx.silhouette ?? undefined,
    maskExtentU: fx.inputs.maskExtentU, sideDepthsCm, tunables: t,
  });
  if (!est) {
    const u = estimatePersonUnitH(fx.keypoints, fx.inputs.maskExtentU, KC);
    return { pred: null, why: u == null ? 'no scale reference' : u < KC.minPersonFrameFraction ? 'person too small in frame' : 'required keypoint missing' };
  }
  const out = cfg.fuse ? fuseWithPrior(est, demographicPrior(fx.inputs.sex, fx.inputs.heightCm, fx.inputs.weightKg)) : est;
  return { pred: out as unknown as Pred };
}

interface Stat { n: number; wMae: number; wBias: number; wRmse: number; uMae: number; uBias: number; omitted: number }
function score(fxs: Fx[], t: MeasurementTunables | undefined, cfg: Cfg, fields = FIELDS) {
  const acc: Record<string, { sw: number; se: number; sa: number; sq: number; uw: number; ue: number; ua: number; n: number; om: number }> = {};
  const rejected: Record<string, number> = {};
  for (const fx of fxs) {
    const { pred, why } = predict(fx, t, cfg);
    if (!pred) { rejected[why!] = (rejected[why!] ?? 0) + 1; continue; }
    const uw = fx.weight / fx.meta.w; // per-subject-equal weight, no density
    for (const f of fields) {
      const truth = fx.groundTruth[f];
      if (truth == null) continue;
      const a = (acc[f] ??= { sw: 0, se: 0, sa: 0, sq: 0, uw: 0, ue: 0, ua: 0, n: 0, om: 0 });
      const p = pred[f];
      if (p == null) { a.om++; continue; }
      const e = p - truth;
      a.sw += fx.weight; a.se += fx.weight * e; a.sa += fx.weight * Math.abs(e); a.sq += fx.weight * e * e;
      a.uw += uw; a.ue += uw * e; a.ua += uw * Math.abs(e); a.n++;
    }
  }
  const stats: Record<string, Stat> = {};
  for (const f of Object.keys(acc)) {
    const a = acc[f];
    stats[f] = { n: a.n, wMae: a.sa / a.sw, wBias: a.se / a.sw, wRmse: Math.sqrt(a.sq / a.sw), uMae: a.ua / a.uw, uBias: a.ue / a.uw, omitted: a.om };
  }
  return { stats, rejected, nFx: fxs.length };
}

const fmt = (x: number | undefined, d = 2) => (x == null || Number.isNaN(x) ? '-' : x.toFixed(d));
function table(title: string, r: ReturnType<typeof score>) {
  console.log(`\n${title}  (fixtures ${r.nFx}, rejected ${JSON.stringify(r.rejected)})`);
  console.log('| field | n | w-MAE | w-bias | w-RMSE | u-MAE | u-bias | omitted |\n|---|---|---|---|---|---|---|---|');
  for (const f of FIELDS) {
    const s = r.stats[f]; if (!s) continue;
    const tagv = LOW.includes(f as MeasuredField) ? ' (low-validity)' : MID.includes(f as MeasuredField) ? ' (mid)' : '';
    console.log(`| ${f}${tagv} | ${s.n} | ${fmt(s.wMae)} | ${fmt(s.wBias)} | ${fmt(s.wRmse)} | ${fmt(s.uMae)} | ${fmt(s.uBias)} | ${s.omitted} |`);
  }
}

const CFGS: [string, Cfg][] = [
  ['front-only raw', { side: false, fuse: false }], ['front+side raw', { side: true, fuse: false }],
  ['front-only fused', { side: false, fuse: true }], ['front+side fused', { side: true, fuse: true }],
];
const results: Record<string, unknown> = {};
function benchAll(label: string, t: MeasurementTunables | undefined, splits: Record<string, Fx[]>) {
  for (const [sp, fxs] of Object.entries(splits)) for (const [name, cfg] of CFGS) {
    const r = score(fxs, t, cfg);
    results[`${label} | ${sp} | ${name}`] = r;
    table(`### ${label} | ${sp} | ${name}`, r);
  }
  // shoulder with contour only (kp term is synthetic)
  for (const [sp, fxs] of Object.entries(splits)) {
    const r = score(fxs, { ...(t ?? {}), shoulderBlendContour: 1 }, CFGS[0][1], ['body_shoulder_width']);
    results[`${label} | ${sp} | shoulder contour-only`] = r;
    table(`### ${label} | ${sp} | shoulder, shoulderBlendContour=1`, r);
  }
}

// ── weighted coordinate descent (same scheme as accuracyEval.suggestCalibration, but weighted + valid fields only)
// inseamProjectionFactor / torsoFromShoulderHip are skipped: with pseudo-keypoints they would just fit the textbook fractions.
// Only waist + hip are calibrated. Bust and shoulder are EXCLUDED: BodyM subjects stand in an A-pose and their arms
// merge with the torso in the chest/shoulder rows of the mask (bust over-reads by ~55 cm raw, shoulder by ~10 cm), so
// any tunable fitted to them would just absorb that dataset artefact. Keys that are no-ops when a silhouette is
// present (waistBlend*, waistScale, hipWidthCorrection, kp/chest/shoulder terms) and the two keypoint-fraction-only
// length tunables (inseam/torso) are skipped as well.
const CAL_FIELDS: MeasuredField[] = ['body_waist', 'body_hip'];
const SKIP = new Set(['inseamProjectionFactor', 'torsoFromShoulderHip', 'waistBlendShoulder', 'waistBlendHip', 'waistScale', 'hipWidthCorrection']);
// --no-scale additionally drops the two global scale levers (noseAnkleHeightFraction, maskExtentFudge): with synthetic
// keypoints they mostly absorb the nose/ankle fraction mismatch and the waist-definition bias, not real behaviour.
if (Deno.args.includes('--no-scale')) { SKIP.add('noseAnkleHeightFraction'); SKIP.add('maskExtentFudge'); }
const CAL_KEYS = (Object.keys(TUNABLE_FIELD_MAP) as (keyof MeasurementTunables)[])
  .filter((k) => !SKIP.has(k as string) && TUNABLE_FIELD_MAP[k as string].some((f) => CAL_FIELDS.includes(f)));
function calibrate(train: Fx[], cfg: Cfg) {
  const lo = 0.6, hi = 1.4, steps = 17, passes = 3;
  const cur: MeasurementTunables = {};
  const obj = (t: MeasurementTunables, keys?: (keyof MeasurementTunables)[]) => {
    const fields = keys ? CAL_FIELDS.filter((f) => keys.some((k) => TUNABLE_FIELD_MAP[k as string].includes(f))) : CAL_FIELDS;
    const s = score(train, t, cfg, fields).stats;
    const v = fields.map((f) => s[f]?.wMae).filter((x): x is number => x != null);
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  const before = obj({});
  const moved: Record<string, { value: number; factor: number; atBound: boolean }> = {};
  for (let p = 0; p < passes; p++) for (const key of CAL_KEYS) {
    const base = K[key as keyof typeof K] as number;
    let best = cur[key] ?? base, bestScore = obj(cur, [key]);
    for (let i = 0; i < steps; i++) {
      const factor = lo + (i / (steps - 1)) * (hi - lo), cand = base * factor;
      const sc = obj({ ...cur, [key]: cand }, [key]);
      if (sc < bestScore) { bestScore = sc; best = cand; }
    }
    (cur as Record<string, number>)[key as string] = best;
    const f = best / base;
    moved[key as string] = { value: best, factor: f, atBound: Math.abs(f - lo) < 1e-9 || Math.abs(f - hi) < 1e-9 };
  }
  return { tunables: cur, before, after: obj(cur), moved };
}

const splits = { testA: load('testA'), testB: load('testB') };
const tun = arg('tunables') ? JSON.parse(Deno.readTextFileSync(arg('tunables')!)) as MeasurementTunables : undefined;
benchAll(tun ? 'custom tunables' : 'CURRENT constants', tun, splits);

const calMode = arg('calibrate');
if (calMode) {
  const train = load('train');
  const cfg: Cfg = { side: calMode === 'side', fuse: false };
  const c = calibrate(train, cfg);
  console.log(`\n## calibration (${calMode}, train n=${train.length}) weighted MAE over waist/hip: ${fmt(c.before, 3)} -> ${fmt(c.after, 3)}`);
  console.log('| tunable | default | calibrated | factor | flag |\n|---|---|---|---|---|');
  for (const [k, m] of Object.entries(c.moved)) {
    const flag = m.atBound ? 'AT BOUND' : Math.abs(m.factor - 1) > 0.3 ? '>30%' : '';
    console.log(`| ${k} | ${fmt(K[k as keyof typeof K] as number, 4)} | ${fmt(m.value, 4)} | ${fmt(m.factor, 3)} | ${flag} |`);
  }
  results[`calibration ${calMode}`] = c;
  benchAll(`CALIBRATED(${calMode}, train-only)`, c.tunables, splits);
}
if (arg('out')) Deno.writeTextFileSync(arg('out')!, JSON.stringify(results, null, 1));
