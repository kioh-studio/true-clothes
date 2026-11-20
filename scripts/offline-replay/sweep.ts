// offline-replay/sweep — coordinate descent over S.* / K.* constants on dumped model
// outputs. Fits on a TRAIN split, reports on a held-out split. Applies NOTHING to src.
//   deno run -A --sloppy-imports scripts/offline-replay/sweep.ts --in ./replay-out \
//     --spec '{"S.chestAt":[0.2,0.35,0.05],"S.waistFrom":[0.4,0.55,0.05],"K.hipWidthCorrection":[0.9,1.1,0.05]}' \
//     [--passes 2] [--fields body_bust,body_waist,body_hip] [--train even|odd] [--raw]
// --spec: inline JSON or @file.json; each key = "S.<name>" | "K.<name>" -> [lo, hi, step].
// Objective = mean over --fields of weighted MAE (fixture `weight`), scored on the FUSED estimate
// (what the app stores) unless --raw. Split: numeric suffix of the body id (body_007 -> 7), else list index.
import { evaluateFixture, aggregate, MEASURED_FIELDS } from '../../src/features/measurements/accuracyEval';
import { S } from '../../src/features/measurements/silhouetteMath';
import { K } from '../../src/features/measurements/landmarksToMeasurements';
import { listBodyIds, loadBody, replayBody, parseJsonArg, flag, type Body } from './lib.ts';

const inDir = flag('in');
const spec: Record<string, [number, number, number]> | undefined = parseJsonArg(flag('spec'));
if (!inDir || !spec) { console.error('--in <dir> and --spec <json|@file> required'); Deno.exit(1); }
const passes = Number(flag('passes') ?? 2);
const fields = (flag('fields')?.split(',') ?? ['body_bust', 'body_waist', 'body_hip', 'body_shoulder_width']) as string[];
const trainParity = flag('train') === 'odd' ? 1 : 0;
const fuse = !Deno.args.includes('--raw');

const ids = listBodyIds(inDir);
const bodies: Body[] = ids.map((id) => loadBody(inDir, id));
const parity = (id: string, i: number) => (Number(/(\d+)$/.exec(id)?.[1] ?? i)) % 2;
const train = bodies.filter((b, i) => parity(b.id, i) === trainParity);
const test = bodies.filter((b, i) => parity(b.id, i) !== trainParity);
console.log(`[sweep] ${bodies.length} bodies: train ${train.length}, held-out ${test.length}; fields=${fields.join(',')}; ${fuse ? 'fused' : 'raw'}`);

type Cfg = Record<string, number>; // "S.x" / "K.x" -> value (only overrides)
const split = (cfg: Cfg) => {
  const o = { S: {} as Record<string, number>, K: {} as Record<string, number> };
  for (const [k, v] of Object.entries(cfg)) o[k[0] as 'S' | 'K'][k.slice(2)] = v;
  return o;
};
const dflt = (key: string): number => (key[0] === 'S' ? (S as any)[key.slice(2)] : (K as any)[key.slice(2)]);

function score(set: Body[], cfg: Cfg) {
  const opts = split(cfg);
  const results = [];
  for (const b of set) {
    const fx = replayBody(b, opts as any);
    if (fx) results.push(evaluateFixture(fx as any, opts.K as any, { fuse }));
  }
  const a = aggregate(results);
  const per: Record<string, number> = {};
  for (const f of fields) if (a.perField[f]) per[f] = a.perField[f].mae;
  const vals = Object.values(per);
  return { per, obj: vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : Infinity };
}

const grid = (lo: number, hi: number, step: number) => {
  const out: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e9) / 1e9);
  return out;
};

let cfg: Cfg = {};
for (const k of Object.keys(spec)) {
  if (!/^[SK]\./.test(k) || dflt(k) === undefined) { console.error(`unknown key ${k}`); Deno.exit(1); }
  cfg[k] = dflt(k);
}
let best = score(train, cfg);
console.log(`[sweep] start train obj=${best.obj.toFixed(3)} cm`);
for (let p = 1; p <= passes; p++) {
  let improved = false;
  for (const [k, [lo, hi, step]] of Object.entries(spec)) {
    let bestV = cfg[k], bestS = best;
    for (const v of grid(lo, hi, step)) {
      const s = score(train, { ...cfg, [k]: v });
      if (s.obj < bestS.obj - 1e-9) { bestS = s; bestV = v; }
    }
    if (bestV !== cfg[k]) { cfg = { ...cfg, [k]: bestV }; best = bestS; improved = true; }
    console.log(`  pass ${p} ${k.padEnd(28)} -> ${bestV}  train obj=${best.obj.toFixed(3)}`);
  }
  if (!improved) break;
}

// ── report ──
const base = Object.fromEntries(Object.keys(spec).map((k) => [k, dflt(k)]));
const d0 = { tr: score(train, base), te: score(test, base) };
const d1 = { tr: score(train, cfg), te: score(test, cfg) };
console.log('\nParam                         default      tuned');
for (const k of Object.keys(spec)) console.log(`${k.padEnd(28)}  ${String(base[k]).padStart(9)}  ${String(cfg[k]).padStart(9)}${cfg[k] !== base[k] ? '  *' : ''}`);
console.log('\nWeighted MAE (cm)        train def  train tuned   held-out def  held-out tuned');
for (const f of fields) {
  const g = (r: { per: Record<string, number> }) => (r.per[f] ?? NaN).toFixed(2).padStart(9);
  console.log(`${f.padEnd(22)}  ${g(d0.tr)}  ${g(d1.tr)}      ${g(d0.te)}      ${g(d1.te)}`);
}
console.log(`${'OBJECTIVE (mean)'.padEnd(22)}  ${d0.tr.obj.toFixed(2).padStart(9)}  ${d1.tr.obj.toFixed(2).padStart(9)}      ${d0.te.obj.toFixed(2).padStart(9)}  ${d1.te.obj.toFixed(2).padStart(9)}`);
console.log(`\nTuned overrides (NOT applied to src):\n${JSON.stringify(split(cfg), null, 2)}`);
if (d1.te.obj > d0.te.obj) console.log('WARNING: held-out got WORSE — likely overfit to the train split.');
