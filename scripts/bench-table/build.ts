// bench-table/build — one consolidated real-vs-machine benchmark over every dataset we have.
// See README.md. Measurement only: current tunables (K) are used, nothing is calibrated.
//
//   deno run -A --node-modules-dir=none --sloppy-imports scripts/bench-table/build.ts \
//     --csv=<per_subject.csv, OUTSIDE the repo> --md=reports/benchmark-all.md \
//     "BodyM=<bodym/derived/base>" "synth-set1 (bad framing)=<replay-out-set1>" [more name=dir ...]
//
// A dir with train/testA/testB.json ({fixtures:[...]}) is BodyM-style (split = file name);
// a dir with body_*.json fixtures is a synth/replay set (split = "all").

import { keypointsToMeasurements, estimatePersonUnitH, K, type EstimateInputs } from '../../src/features/measurements/landmarksToMeasurements';
import { demographicPrior, fuseWithPrior } from '../../src/features/measurements/demographicPrior';
import { evaluateFixture, MEASURED_FIELDS, type Fixture } from '../../src/features/measurements/accuracyEval';

type Fx = Fixture & { weight?: number; meta?: { w?: number } };
type Pred = Record<string, any>;
const arg = (n: string) => Deno.args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const csvPath = arg('csv'), mdPath = arg('md');
const specs = Deno.args.filter((a) => !a.startsWith('--') && a.includes('='));
if (!csvPath || !mdPath || !specs.length) throw new Error('usage: build.ts --csv=<file> --md=<file> "name=dir" ...');

const FIELDS = MEASURED_FIELDS as string[];
const short = (f: string) => f.replace('body_', '');

// ── load ──────────────────────────────────────────────────────────────────
interface Group { dataset: string; split: string; fxs: Fx[]; kind: 'bodym' | 'synth' }
const groups: Group[] = [];
for (const s of specs) {
  const i = s.indexOf('='), name = s.slice(0, i), dir = s.slice(i + 1);
  const names = [...Deno.readDirSync(dir)].map((e) => e.name);
  const splitFiles = ['train', 'testA', 'testB'].filter((x) => names.includes(`${x}.json`));
  if (splitFiles.length) {
    for (const sp of splitFiles) groups.push({ dataset: name, split: sp, kind: 'bodym', fxs: JSON.parse(Deno.readTextFileSync(`${dir}/${sp}.json`)).fixtures });
  } else {
    const fxs = names.filter((n) => /^body_\d+\.json$/.test(n)).sort().map((n) => JSON.parse(Deno.readTextFileSync(`${dir}/${n}`)) as Fx);
    groups.push({ dataset: name, split: 'all', kind: 'synth', fxs });
  }
}

// ── predict (same calls as the app / evaluateFixture) ───────────────────────
function predict(fx: Fx, side: boolean): { raw: Pred | null; fused: Pred | null; why?: string } {
  let sideDepthsCm: EstimateInputs['sideDepthsCm'];
  if (side && fx.side) {
    const u = estimatePersonUnitH(fx.side.keypoints, fx.side.maskExtentU, K);
    if (u != null && u > 0) {
      const s = fx.inputs.heightCm / u, d = fx.side.depthsU ?? {};
      sideDepthsCm = { chestCm: d.chestU != null ? d.chestU * s : undefined, waistCm: d.waistU != null ? d.waistU * s : undefined, hipCm: d.hipU != null ? d.hipU * s : undefined };
    }
  }
  const raw = keypointsToMeasurements(fx.keypoints, fx.inputs.heightCm, {
    weightKg: fx.inputs.weightKg, sex: fx.inputs.sex, ageYears: fx.inputs.ageYears,
    silhouette: fx.silhouette ?? undefined, maskExtentU: fx.inputs.maskExtentU, sideDepthsCm,
  });
  if (!raw) {
    const u = estimatePersonUnitH(fx.keypoints, fx.inputs.maskExtentU, K);
    return { raw: null, fused: null, why: u == null ? 'no scale reference' : u < K.minPersonFrameFraction ? 'person too small in frame (live gate)' : 'required keypoint missing' };
  }
  const fused = fuseWithPrior(raw, demographicPrior(fx.inputs.sex, fx.inputs.heightCm, fx.inputs.weightKg, fx.inputs.ageYears));
  return { raw: raw as unknown as Pred, fused: fused as unknown as Pred };
}

// ── rows ──────────────────────────────────────────────────────────────────
interface Row { dataset: string; split: string; mode: 'front' | 'side'; id: string; sex: string; h: number; kg: number; w: number; uw: number; field: string; real: number; raw?: number; fused?: number; depth: string; outlier: boolean }
const rows: Row[] = [];
interface Rej { dataset: string; split: string; mode: string; nFx: number; rejected: Record<string, number>; omitted: number }
const rejs: Rej[] = [];
let xcheckBad = 0, xcheckN = 0, fxCount = 0;
for (const g of groups) for (const mode of ['front', 'side'] as const) {
  const rej: Rej = { dataset: g.dataset, split: g.split, mode, nFx: g.fxs.length, rejected: {}, omitted: 0 };
  for (const fx of g.fxs) {
    const w = fx.weight ?? 1;
    const uw = g.kind === 'bodym' && fx.meta?.w ? w / fx.meta.w : 1; // BodyM: each subject sums to 1 over its photos
    const { raw, fused, why } = predict(fx, mode === 'side');
    if (!raw) { rej.rejected[why!] = (rej.rejected[why!] ?? 0) + 1; continue; }
    // cross-check against the app's own evaluator (every 25th fixture)
    if (fxCount++ % 25 === 0) {
      const ev = evaluateFixture(mode === 'side' ? fx : { ...fx, side: undefined }, undefined, { fuse: true });
      for (const f of ev.fields) { xcheckN++; if (Math.abs(f.predicted - (fused as Pred)[f.field]) > 1e-9) xcheckBad++; }
    }
    const depth = Object.entries((raw as Pred).depthSource ?? {}).map(([k, v]) => `${k}:${v}`).join('|');
    for (const f of FIELDS) {
      const real = (fx.groundTruth as Record<string, number | undefined>)[f];
      if (real == null) continue;
      if (raw![f] == null) { rej.omitted++; continue; }
      const outlier = ((fused as Pred).outliers ?? []).includes(f) || (g.kind === 'synth' && (((fx as any).replay?.est?.outliers ?? []) as string[]).includes(f));
      rows.push({ dataset: g.dataset, split: g.split, mode, id: fx.subjectId, sex: fx.inputs.sex ?? '', h: fx.inputs.heightCm, kg: fx.inputs.weightKg ?? NaN, w, uw, field: f, real, raw: raw![f], fused: (fused as Pred)[f], depth, outlier });
    }
  }
  rejs.push(rej);
}

// ── CSV (scratchpad only) ──────────────────────────────────────────────────
const r2 = (x: number | undefined) => (x == null ? '' : x.toFixed(2));
const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
Deno.writeTextFileSync(csvPath!, ['dataset,split,mode,subjectId,sex,heightCm,weightKg,weight_asian,field,real_cm,machine_raw_cm,machine_fused_cm,err_raw,err_fused,depthSource,outlier'].concat(
  rows.map((r) => [q(r.dataset), r.split, r.mode, q(r.id), r.sex, r.h, r.kg, r.w.toPrecision(4), short(r.field), r2(r.real), r2(r.raw), r2(r.fused), r2(r.raw! - r.real), r2(r.fused! - r.real), r.depth, r.outlier ? 1 : 0].join(','))).join('\n') + '\n');

// ── stats ──────────────────────────────────────────────────────────────────
interface St { n: number; real: number; mach: number; bias: number; mae: number; rmse: number; p90: number; w2: number; w4: number }
function stat(rs: Row[], v: 'raw' | 'fused', weighted: boolean): St | null {
  if (!rs.length) return null;
  const wt = (r: Row) => (weighted ? r.w : r.uw);
  const W = rs.reduce((a, r) => a + wt(r), 0);
  const m = (f: (r: Row) => number) => rs.reduce((a, r) => a + wt(r) * f(r), 0) / W;
  const e = (r: Row) => r[v]! - r.real;
  const sorted = rs.map((r) => ({ a: Math.abs(e(r)), w: wt(r) })).sort((x, y) => x.a - y.a);
  let c = 0, p90 = sorted[sorted.length - 1].a;
  for (const s of sorted) { c += s.w; if (c >= 0.9 * W) { p90 = s.a; break; } }
  return { n: rs.length, real: m((r) => r.real), mach: m((r) => r[v]!), bias: m(e), mae: m((r) => Math.abs(e(r))), rmse: Math.sqrt(m((r) => e(r) ** 2)), p90, w2: 100 * m((r) => (Math.abs(e(r)) <= 2 ? 1 : 0)), w4: 100 * m((r) => (Math.abs(e(r)) <= 4 ? 1 : 0)) };
}
const f1 = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const sgn = (x: number) => (x >= 0 ? '+' : '') + f1(x);
const cells = (s: St | null) => (s ? `${f1(s.mach)} | ${sgn(s.bias)} | ${f1(s.mae)} | ${f1(s.rmse)} | ${f1(s.p90)} | ${f1(s.w2, 0)} | ${f1(s.w4, 0)}` : '- | - | - | - | - | - | -');
const gkey = (r: { dataset: string; split: string; mode: string }) => `${r.dataset}\u0000${r.split}\u0000${r.mode}`;
const keys = [...new Set(rejs.map(gkey))];
const byKeyField = new Map<string, Row[]>();
for (const r of rows) { const k = gkey(r) + '\u0000' + r.field; (byKeyField.get(k) ?? byKeyField.set(k, []).get(k)!).push(r); }

// ── markdown ───────────────────────────────────────────────────────────────
const L: string[] = [];
L.push('# MIEN body-scan benchmark — all datasets', '',
  `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/bench-table/build.ts\` with the CURRENT tunables (nothing calibrated). Aggregates only; per-subject BodyM rows live outside the repo (BodyM is CC BY-NC, internal use).`, '',
  'Conventions: error = machine - real (positive = over-read), cm. **raw** = `keypointsToMeasurements`, **fused** = + `fuseWithPrior(demographicPrior)` (what the app stores). **front** = no side depth (depth guessed from priors), **side** = side-view depths used. **Weighted** (primary) uses the Asian-likeness proxy weight (BodyM: body-size density ratio, NOT ethnicity; synth: fixture weight); **unweighted** counts every subject once (BodyM photos are weighted so each subject sums to 1). P90 = 90th percentile of |err|; ±2/±4 = % of samples within that many cm.', '',
  `Datasets: ${groups.map((g) => `${g.dataset}/${g.split} (${g.fxs.length} fixtures)`).join(', ')}.`, '');

L.push('## Rejected / omitted', '', 'A fixture is "rejected" when `keypointsToMeasurements` returns null (the app would refuse the scan). "Fields omitted" = a field with ground truth where the engine returned no value.', '',
  '| dataset | split | mode | fixtures | rejected | reasons | fields omitted |', '|---|---|---|---|---|---|---|');
for (const r of rejs) { const n = Object.values(r.rejected).reduce((a, b) => a + b, 0); L.push(`| ${r.dataset} | ${r.split} | ${r.mode} | ${r.nFx} | ${n} | ${Object.entries(r.rejected).map(([k, v]) => `${k}: ${v}`).join('; ') || '-'} | ${r.omitted} |`); }
L.push('');

L.push('## Headline (fused, weighted) — bust / waist / hip / shoulder', '', '| dataset | split | mode | field | n | real | machine | bias | MAE | P90 | ±2 | ±4 |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const k of keys) for (const f of ['body_bust', 'body_waist', 'body_hip', 'body_shoulder_width']) {
  const rs = byKeyField.get(k + '\u0000' + f); const s = rs && stat(rs, 'fused', true); if (!s) continue;
  const [d, sp, m] = k.split('\u0000'); L.push(`| ${d} | ${sp} | ${m} | ${short(f)} | ${s.n} | ${f1(s.real)} | ${f1(s.mach)} | ${sgn(s.bias)} | ${f1(s.mae)} | ${f1(s.p90)} | ${f1(s.w2, 0)} | ${f1(s.w4, 0)} |`);
}
L.push('');

L.push('## Full tables per field', '', 'Columns per variant: machine mean | bias | MAE | RMSE | P90 | ±2 % | ±4 %. "real" is the mean ground truth over the same n.', '');
for (const f of FIELDS) {
  for (const weighted of [true, false]) {
    L.push(`### ${short(f)} — ${weighted ? 'weighted (primary)' : 'unweighted'}`, '', '| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |', '|' + '---|'.repeat(19));
    for (const k of keys) {
      const rs = byKeyField.get(k + '\u0000' + f); if (!rs) continue;
      const a = stat(rs, 'raw', weighted)!, b = stat(rs, 'fused', weighted);
      const [d, sp, m] = k.split('\u0000'); L.push(`| ${d} | ${sp} | ${m} | ${a.n} | ${f1(a.real)} | ${cells(a)} | ${cells(b)} |`);
    }
    L.push('');
  }
}

// auto-detected systematic patterns (weighted)
L.push('## Systematic patterns (auto-detected, fused, weighted: |bias| >= 3 cm and >= 60% of MAE)', '', 'Numbers only; no calibration is proposed here.', '');
let any = false;
for (const k of keys) for (const f of FIELDS) {
  const rs = byKeyField.get(k + '\u0000' + f); if (!rs) continue;
  const [d, sp, m] = k.split('\u0000');
  for (const v of ['fused'] as const) {
    const s = stat(rs, v, true)!;
    if (Math.abs(s.bias) >= 3 && Math.abs(s.bias) >= 0.6 * s.mae) { any = true; L.push(`- ${d} / ${sp} / ${m} / ${short(f)} (${v}): ${s.bias > 0 ? 'over' : 'under'}-read, bias ${sgn(s.bias)} cm vs MAE ${f1(s.mae)} (n=${s.n}, real ${f1(s.real)} -> machine ${f1(s.mach)})`); }
  }
}
if (!any) L.push('- none above threshold');
L.push('');

// example table
for (const g of groups.filter((x) => x.kind === 'synth')) {
  const ids = new Set(g.fxs.slice(0, 10).map((x) => x.subjectId));
  L.push(`## Example: ${g.dataset} — 10 subjects, side mode, real vs machine (fused; raw in brackets)`, '', 'Cell = real -> machine (err) [raw machine]. Synthetic bodies are ours, so per-subject rows are shown.', '', '| subject | sex | H cm | kg | bust | waist | hip | shoulder |', '|---|---|---|---|---|---|---|---|');
  for (const fx of g.fxs.filter((x) => ids.has(x.subjectId))) {
    const c = (f: string) => { const r = rows.find((x) => x.dataset === g.dataset && x.mode === 'side' && x.id === fx.subjectId && x.field === f); return r ? `${f1(r.real)} -> ${f1(r.fused!)} (${sgn(r.fused! - r.real)}) [${f1(r.raw!)}]${r.outlier ? ' *' : ''}` : 'n/a'; };
    L.push(`| ${fx.subjectId} | ${fx.inputs.sex} | ${f1(fx.inputs.heightCm, 0)} | ${f1(fx.inputs.weightKg ?? NaN, 0)} | ${c('body_bust')} | ${c('body_waist')} | ${c('body_hip')} | ${c('body_shoulder_width')} |`);
  }
  L.push('', '`*` = flagged outlier by `fuseWithPrior` (raw scan kept). "n/a" = scan rejected or field omitted.', '');
}

L.push('## What each dataset can and cannot validate', '',
  '**BodyM** (Amazon, 8,978 photo pairs, CC BY-NC, internal only)',
  '- Masks only, no RGB: the pose model never runs. Keypoints are PSEUDO-keypoints placed from the mask with textbook stature fractions, so the keypoint terms of shoulder, inseam and upper_body_length are functions of height alone. Those three are low validity, not a test of the pose model.',
  '- Subjects stand in an A-pose; arms merge with the torso in the chest and shoulder mask rows, so **bust and shoulder are invalid** (arm artefact) and not usable for calibration. Waist and hip are the only girths it can judge, and only as contour/side-depth math (segmentation band, superellipse depth model), not as end-to-end performance.',
  '- Definition mismatches: BodyM shoulder-to-crotch (~60 cm) vs our `upper_body_length` (neck base to natural waist, ~0.85 x shoulder-to-hip) is a constant offset, not an error. BodyM waist is mesh-defined (probably navel/natural waist), larger than our narrowest-row waist. Sleeve has no arm keypoints, so it is not meaningfully scored. SMPL-mesh ground truth, not tape.',
  '- Weights are a body-size proxy for "Asian-like", not ethnicity; they cannot represent Asian-specific proportions.',
  '- Rows from the same subject are correlated (testA has ~19 photos per subject); effective n is the subject count.', '',
  '**Synthetic renders through the REAL app pipeline** (emulator replay, fixture v2)',
  '- Exercises the real pose model + segmentation + side-view on rendered bodies with exact mesh ground truth, so all seven fields are scored end-to-end.',
  '- Sim-to-real gap: rendered skin/clothing/lighting, mesh-defined landmarks, and generator body-shape priors can differ from real people; a bias here is a hint, not proof, on real users.',
  "- **synth-set1 has bad framing**: the person fills only about 0.5 of the frame and fails the app's live gate (`minPersonFrameFraction`), so numbers are pessimistic on resolution and are NOT representative of an accepted real scan. Re-run with set2 when available.",
  '- Small n (about 20 bodies): means are noisy and P90 is nearly the max.', '');

Deno.writeTextFileSync(mdPath!, L.join('\n'));
console.log(`rows=${rows.length} csv=${csvPath} md=${mdPath} xcheck(evaluateFixture vs script)=${xcheckBad}/${xcheckN} mismatches`);
