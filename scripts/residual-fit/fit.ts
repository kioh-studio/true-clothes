// residual-fit — learn `real - app` ridge models for bust/waist/hip (per sex) and score them held-out.
// Run from the repo root (data stays OUTSIDE the repo; BodyM is CC BY-NC, aggregates only in reports):
//   deno run -A --node-modules-dir=none --sloppy-imports scripts/residual-fit/fit.ts \
//     --synth=<offline-replay out dir, pre-correction> --bodym=<bodym/derived/final dir> \
//     [--md=reports/residual-fit.md] [--json=scripts/residual-fit/coeffs.json]
// IMPORTANT: --synth must be an offline replay made BEFORE applyResidualCorrection existed (or with empty
// RESIDUAL_COEFFS); BodyM app is recomputed here with fusion only (no residual), so the fit never sees corrected values.
import * as M from '../../src/features/measurements/landmarksToMeasurements.ts';
import { demographicPrior, fuseWithPrior } from '../../src/features/measurements/demographicPrior.ts';
import { applyResidualCorrection, type ResidualCoeff, type ResidualCoeffs, type ResidualField } from '../../src/features/measurements/residualCorrection.ts';

const arg = (n: string) => Deno.args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const synthDir = arg('synth')!, bodymDir = arg('bodym')!;
const mdOut = arg('md') ?? 'reports/residual-fit.md', jsonOut = arg('json') ?? 'scripts/residual-fit/coeffs.json';
const FIELDS: ResidualField[] = ['body_bust', 'body_waist', 'body_hip'];
const KEY = { body_bust: 'bust', body_waist: 'waist', body_hip: 'hip' } as const;
const LAMBDAS = [0.1, 0.3, 1, 3, 10, 30, 100];
type Sex = 'male' | 'female';
type Src = 'synth' | 'bodym';
type Variant = 'both' | 'synth-only' | 'bodym-only';
type DS = 'synth_a25' | 'synth_a45' | 'bodym_train' | 'bodym_testA' | 'bodym_testB';

interface Sample {
  ds: DS; src: Src; heldOut: boolean; sex: Sex; field: ResidualField; group: string;
  app: number; real: number; h: number; wt: number; bmi: number; side: number; outlier: boolean; w: number;
}

// ── data ─────────────────────────────────────────────────────────────────────
const samples: Sample[] = [];
function add(fx: any, est: any, ds: DS, heldOut: boolean, group: string) {
  const { heightCm: h, weightKg: wt, sex } = fx.inputs;
  if (!sex || !h || !wt) return;
  for (const f of FIELDS) {
    const real = fx.groundTruth?.[f], app = est?.[f];
    if (real == null || app == null) continue;
    samples.push({
      ds, src: ds.startsWith('synth') ? 'synth' : 'bodym', heldOut, sex, field: f, group, app, real, h, wt,
      bmi: wt / (h / 100) ** 2, side: est.depthSource?.[KEY[f]] === 'side' ? 1 : 0,
      outlier: !!est.outliers?.includes(f), w: fx.weight ?? 1,
    });
  }
}
for (const n of [...Deno.readDirSync(synthDir)].map((e) => e.name).filter((n) => /^a\d+_body_\d+\.json$/.test(n)).sort()) {
  const fx = JSON.parse(Deno.readTextFileSync(`${synthDir}/${n}`));
  const num = Number(/(\d+)$/.exec(fx.subjectId)![1]);
  add(fx, fx.replay.est, fx.subjectId.startsWith('a45_') ? 'synth_a45' : 'synth_a25', num % 2 === 1, `s${num}`);
}
for (const sp of ['train', 'testA', 'testB']) {
  for (const fx of JSON.parse(Deno.readTextFileSync(`${bodymDir}/${sp}.json`)).fixtures) {
    let sideDepthsCm: any;
    if (fx.side) { // same path as bench_build.predict (side mode)
      const u = M.estimatePersonUnitH(fx.side.keypoints, fx.side.maskExtentU, M.K);
      if (u != null && u > 0) {
        const s = fx.inputs.heightCm / u, d = fx.side.depthsU ?? {};
        sideDepthsCm = { chestCm: d.chestU != null ? d.chestU * s : undefined, waistCm: d.waistU != null ? d.waistU * s : undefined, hipCm: d.hipU != null ? d.hipU * s : undefined };
      }
    }
    const raw = M.keypointsToMeasurements(fx.keypoints, fx.inputs.heightCm, {
      weightKg: fx.inputs.weightKg, sex: fx.inputs.sex, ageYears: fx.inputs.ageYears,
      silhouette: fx.silhouette ?? undefined, maskExtentU: fx.inputs.maskExtentU, sideDepthsCm,
    });
    if (!raw) continue;
    const est = fuseWithPrior(raw, demographicPrior(fx.inputs.sex, fx.inputs.heightCm, fx.inputs.weightKg, fx.inputs.ageYears));
    add(fx, est, `bodym_${sp}` as DS, sp !== 'train', `b${fx.meta?.subject ?? fx.subjectId}`);
  }
}

// ── ridge ────────────────────────────────────────────────────────────────────
const featOf = (s: Sample) => [s.app, s.h, s.wt, s.bmi, s.side];
const P = 5;

function solve(A: number[][], b: number[]): number[] { // Gaussian elimination, partial pivoting
  const n = b.length, m = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = c + 1; r < n; r++) { const f = m[r][c] / m[c][c]; for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = m[r][n]; for (let k = r + 1; k < n; k++) s -= m[r][k] * x[k]; x[r] = s / m[r][r]; }
  return x;
}

/** Weighted ridge on standardised features, intercept unpenalised; returns ORIGINAL-unit coefficients. */
function ridge(rows: Sample[], wts: number[], lambda: number): ResidualCoeff {
  const W = wts.reduce((a, b) => a + b, 0);
  const X = rows.map(featOf), mu = new Array(P).fill(0), va = new Array(P).fill(0);
  X.forEach((x, i) => x.forEach((v, j) => (mu[j] += wts[i] * v / W)));
  X.forEach((x, i) => x.forEach((v, j) => (va[j] += wts[i] * (v - mu[j]) ** 2 / W)));
  const sd = va.map((v) => Math.sqrt(v)).map((v) => (v > 1e-9 ? v : 0));
  const idx = sd.map((v, j) => (v ? j : -1)).filter((j) => j >= 0), q = idx.length + 1;
  const A = Array.from({ length: q }, () => new Array(q).fill(0)), b = new Array(q).fill(0);
  rows.forEach((r, i) => {
    const z = [1, ...idx.map((j) => (X[i][j] - mu[j]) / sd[j])], y = r.real - r.app;
    for (let a = 0; a < q; a++) { b[a] += wts[i] * z[a] * y; for (let c = 0; c < q; c++) A[a][c] += wts[i] * z[a] * z[c]; }
  });
  for (let a = 1; a < q; a++) A[a][a] += lambda;
  const beta = solve(A, b), v = [0, 0, 0, 0, 0];
  let b0 = beta[0];
  idx.forEach((j, k) => { v[j] = beta[k + 1] / sd[j]; b0 -= v[j] * mu[j]; });
  return { b0, app: v[0], h: v[1], w: v[2], bmi: v[3], side: v[4] };
}

// ── scoring (uses the production applyResidualCorrection) ────────────────────
const fieldCoeffs = (c: Record<Sex, ResidualCoeff | null>, f: ResidualField): ResidualCoeffs => ({
  male: c.male ? { [f]: c.male } : {}, female: c.female ? { [f]: c.female } : {},
});
function corrected(s: Sample, coeffs: ResidualCoeffs | null): number {
  if (!coeffs) return s.app;
  const est: any = { confidence: 1, [s.field]: s.app, depthSource: { [KEY[s.field]]: s.side ? 'side' : 'guess' }, outliers: s.outlier ? [s.field] : [] };
  return (applyResidualCorrection(est, { sex: s.sex, heightCm: s.h, weightKg: s.wt }, coeffs) as any)[s.field];
}
interface St { n: number; bias: number; mae: number; w2: number; w4: number }
function stats(rs: Sample[], coeffs: ResidualCoeffs | null): St {
  const W = rs.reduce((a, r) => a + r.w, 0);
  const m = (f: (e: number) => number) => rs.reduce((a, r) => a + r.w * f(corrected(r, coeffs) - r.real), 0) / W;
  return { n: rs.length, bias: m((e) => e), mae: m(Math.abs), w2: 100 * m((e) => (Math.abs(e) <= 2 ? 1 : 0)), w4: 100 * m((e) => (Math.abs(e) <= 4 ? 1 : 0)) };
}

// ── fitting ──────────────────────────────────────────────────────────────────
const srcOf = (v: Variant): Src[] => (v === 'both' ? ['synth', 'bodym'] : [v === 'synth-only' ? 'synth' : 'bodym']);
/** Per-source weights rescaled so every included source has equal total weight (overall mean weight 1). */
function balancedWeights(rows: Sample[], variant: Variant): number[] {
  const tot: Record<string, number> = {};
  for (const r of rows) tot[r.src] = (tot[r.src] ?? 0) + r.w;
  return rows.map((r) => (r.w / tot[r.src]) * (rows.length / srcOf(variant).length));
}
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

function fitVariant(field: ResidualField, sex: Sex, variant: Variant) {
  const rows = samples.filter((s) => !s.heldOut && !s.outlier && s.field === field && s.sex === sex && srcOf(variant).includes(s.src));
  if (rows.length < 20) return null;
  const wts = balancedWeights(rows, variant);
  let best = { lambda: LAMBDAS[0], cv: Infinity };
  for (const lambda of LAMBDAS) {
    let err = 0, tw = 0;
    for (let k = 0; k < 5; k++) {
      const all = rows.map((_, i) => i);
      const tr = all.filter((i) => hash(rows[i].group) % 5 !== k), te = all.filter((i) => hash(rows[i].group) % 5 === k);
      if (!tr.length || !te.length) continue;
      const c = ridge(tr.map((i) => rows[i]), tr.map((i) => wts[i]), lambda);
      const cc = fieldCoeffs({ male: c, female: c }, field);
      for (const i of te) { err += wts[i] * Math.abs(corrected(rows[i], cc) - rows[i].real); tw += wts[i]; }
    }
    if (err / tw < best.cv) best = { lambda, cv: err / tw };
  }
  return { lambda: best.lambda, coeff: ridge(rows, wts, best.lambda) };
}

// ── run ──────────────────────────────────────────────────────────────────────
const VARIANTS: Variant[] = ['both', 'synth-only', 'bodym-only'];
const synthOdd = (s: Sample) => s.src === 'synth' && s.heldOut;
const HO: { name: string; pick: (s: Sample) => boolean }[] = [
  { name: 'synth held-out a25 (odd ids)', pick: (s) => s.ds === 'synth_a25' && s.heldOut },
  { name: 'synth held-out a45 (odd ids)', pick: (s) => s.ds === 'synth_a45' && s.heldOut },
  { name: 'BodyM testA', pick: (s) => s.ds === 'bodym_testA' },
  { name: 'BodyM testB', pick: (s) => s.ds === 'bodym_testB' },
];
const heldOf = (f: ResidualField, pick: (s: Sample) => boolean) => samples.filter((s) => s.field === f && pick(s));
// Per-field rule: synth hip GT is INVALID (MakeHuman hip meshes are 7-9 cm wider than real hips), so body_hip is
// fitted bodym-only, lambda by CV on BodyM train, and judged ONLY on BodyM testA+testB. Other fields: default rule.
const BODYM_ONLY_FIELDS: ResidualField[] = ['body_hip'];
const critOf = (f: ResidualField, c: ResidualCoeffs | null) => {
  const bm = (stats(heldOf(f, (s) => s.ds === 'bodym_testA'), c).mae + stats(heldOf(f, (s) => s.ds === 'bodym_testB'), c).mae) / 2;
  return BODYM_ONLY_FIELDS.includes(f) ? bm : (stats(heldOf(f, synthOdd), c).mae + bm) / 2;
};

const fmt = (x: number, d = 1) => (Math.abs(x) < 0.05 && d === 1 ? '0.0' : x.toFixed(d));
const final: Record<Sex, Partial<Record<ResidualField, ResidualCoeff>>> = { male: {}, female: {} };
let md = `# Residual correction fit (2026-11-20)\n\nGenerated by \`scripts/residual-fit/fit.ts\`. Aggregates only (BodyM is CC BY-NC).\n\n` +
  `Model per field and sex: \`real - app = b0 + a*app + h*heightCm + w*weightKg + bmi*BMI + side*sideDepthUsed\`, weighted ridge (standardised features, intercept unpenalised), lambda by 5-fold CV (grouped by subject) on train from {${LAMBDAS.join(', ')}}. ` +
  `Applied after fuseWithPrior, clamped to +-6 cm, skipped for outlier fields. Train = synth even body ids + BodyM train; held-out = synth odd ids, BodyM testA/testB (never used for fitting or lambda). ` +
  `Weights: synth Asian x3, BodyM body-size proxy, each source rescaled to equal total weight. Errors are app - real (positive = over-read).\n\n` +
  `Selection per field: variant minimising mean[synth-odd MAE, mean(testA, testB) MAE]; ties -> both; no gain over uncorrected -> no correction. **Exception body_hip: synth hip GT is invalid (meshes 7-9 cm too wide), so hip is fitted bodym-only (lambda by CV on BodyM train) and judged only on mean(testA, testB) MAE; its synth rows below are informational.**\n\n`;
const chosen: Record<string, unknown> = {};

for (const f of FIELDS) {
  const base = critOf(f, null);
  const results = (BODYM_ONLY_FIELDS.includes(f) ? (['bodym-only'] as Variant[]) : VARIANTS).map((v) => {
    const m = fitVariant(f, 'male', v), fe = fitVariant(f, 'female', v);
    const c = { male: m?.coeff ?? null, female: fe?.coeff ?? null };
    return { v, m, fe, c, crit: critOf(f, fieldCoeffs(c, f)) };
  });
  let pick = results[0];
  for (const r of results) if (r.crit < pick.crit - 1e-9) pick = r;
  const ship = pick.crit < base - 1e-9;
  const table = ship ? fieldCoeffs(pick.c, f) : null;
  if (ship) { if (pick.c.male) final.male[f] = pick.c.male; if (pick.c.female) final.female[f] = pick.c.female; }
  chosen[f] = { variant: ship ? pick.v : 'none', lambdaMale: ship ? pick.m?.lambda : null, lambdaFemale: ship ? pick.fe?.lambda : null };

  md += `## ${f}\n\nCriterion (lower is better): uncorrected ${fmt(base, 2)}; ${results.map((r) => `${r.v} ${fmt(r.crit, 2)}`).join(', ')}.\n` +
    `**Chosen: ${ship ? pick.v : 'none (no variant beats uncorrected; zero coefficients shipped)'}**` +
    (ship ? `, lambda male ${pick.m?.lambda}, female ${pick.fe?.lambda}` : '') + '\n\n';
  if (ship) {
    md += `| sex | b0 | a (app) | h (cm) | w (kg) | bmi | side |\n|---|---|---|---|---|---|---|\n`;
    for (const sex of ['male', 'female'] as Sex[]) { const c = pick.c[sex]; if (c) md += `| ${sex} | ${[c.b0, c.app, c.h, c.w, c.bmi, c.side].map((x) => x.toFixed(4)).join(' | ')} |\n`; }
    md += '\n';
  }
  md += `| held-out set | n | bias before -> after | MAE before -> after | within 2 cm | within 4 cm |\n|---|---|---|---|---|---|\n`;
  for (const h of HO) {
    const rs = heldOf(f, h.pick), b = stats(rs, null), a = stats(rs, table);
    md += `| ${h.name} | ${b.n} | ${fmt(b.bias)} -> ${fmt(a.bias)} | ${fmt(b.mae)} -> ${fmt(a.mae)} | ${fmt(b.w2, 0)}% -> ${fmt(a.w2, 0)}% | ${fmt(b.w4, 0)}% -> ${fmt(a.w4, 0)}% |\n`;
  }
  const tr = (src: Src) => samples.filter((s) => s.field === f && !s.heldOut && s.src === src && !s.outlier);
  const trs = tr('synth'), trb = tr('bodym');
  md += `\nTrain MAE (outliers excluded), before -> after: synth ${fmt(stats(trs, null).mae)} -> ${fmt(stats(trs, table).mae)} (n ${trs.length}); BodyM train ${fmt(stats(trb, null).mae)} -> ${fmt(stats(trb, table).mae)} (n ${trb.length}).\n\n`;
  if (f === 'body_waist') {
    const sy = stats(heldOf(f, synthOdd), null), ba = stats(heldOf(f, (s) => s.src === 'bodym' && s.heldOut), null);
    md += `**Source conflict (waist):** uncorrected bias is ${fmt(sy.bias)} cm on synth held-out but ${fmt(ba.bias)} cm on BodyM test. The two sources want opposite corrections (MakeHuman narrowest-row waist vs BodyM tape-style waist), so a pooled fit can only compromise; the true target is unknown until real tape-measured scans exist.\n\n`;
  }
}
Deno.writeTextFileSync(mdOut, md);
Deno.writeTextFileSync(jsonOut, JSON.stringify({ date: '2026-11-20', coeffs: final, chosen }, null, 1));
console.log(md);
