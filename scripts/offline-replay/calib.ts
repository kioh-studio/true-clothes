// offline-replay/calib — evaluate a LIST of {name,S,K} configs in one process (bodies loaded once).
//   deno run -A --sloppy-imports scripts/offline-replay/calib.ts --in <dump> --cfgs @cfgs.json [--out res.json] [--raw]
// Per config: per-field weighted bias/MAE (+unweighted MAE) for subsets all/train(even)/held(odd)/a25/a45,
// plus diagnostics (chest/shoulder width ratio, side hip-vs-waist depth). Applies nothing to src.
import { evaluateFixture, aggregate, MEASURED_FIELDS } from '../../src/features/measurements/accuracyEval';
import { estimatePersonUnitH, K } from '../../src/features/measurements/landmarksToMeasurements';
import { listBodyIds, loadBody, replayBody, parseJsonArg, flag } from './lib.ts';

const inDir = flag('in')!;
const cfgs: { name: string; S?: any; K?: any }[] = parseJsonArg(flag('cfgs'));
const fuse = !Deno.args.includes('--raw');
const only = flag('only'); // optional id regex
let ids = listBodyIds(inDir);
if (only) ids = ids.filter((i) => new RegExp(only).test(i));
const bodies = ids.map((id) => loadBody(inDir, id));
console.error(`[calib] loaded ${bodies.length} bodies`);
const num = (id: string) => Number(/(\d+)$/.exec(id)![1]);
const subsets: Record<string, (id: string) => boolean> = {
  all: () => true, train: (i) => num(i) % 2 === 0, held: (i) => num(i) % 2 === 1,
  a25: (i) => i.startsWith('a25'), a45: (i) => i.startsWith('a45'),
};
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const out: any[] = [];
for (const c of cfgs) {
  const t0 = Date.now();
  const res: { id: string; r: any; fx: any }[] = [];
  for (const b of bodies) {
    const fx: any = replayBody(b, { S: c.S, K: c.K });
    if (fx) res.push({ id: b.id, r: evaluateFixture(fx, c.K, { fuse }), fx });
  }
  const rec: any = { name: c.name, S: c.S, K: c.K, n: res.length, sub: {}, diag: {} };
  for (const [sn, f] of Object.entries(subsets)) {
    const a = aggregate(res.filter((x) => f(x.id)).map((x) => x.r));
    rec.sub[sn] = Object.fromEntries(MEASURED_FIELDS.map((k) => {
      const p = a.perField[k]; return [k.replace('body_', ''), p ? { b: +p.bias.toFixed(2), m: +p.mae.toFixed(2), um: +p.unweighted.mae.toFixed(2), ub: +p.unweighted.bias.toFixed(2), n: p.n } : null];
    }));
  }
  for (const grp of ['a25', 'a45']) {
    const g = res.filter((x) => x.id.startsWith(grp));
    rec.diag[grp] = {
      chestOverGtShoulder: (() => { const v = g.map((x) => { const u = estimatePersonUnitH(x.fx.keypoints, x.fx.inputs.maskExtentU, K); const gt = x.fx.groundTruth.body_shoulder_width; return u && x.fx.silhouette?.chestU != null && gt ? x.fx.silhouette.chestU * (x.fx.inputs.heightCm / u) / gt : NaN; }).filter((q) => isFinite(q)).sort((a, b) => a - b); const q = (f: number) => +v[Math.floor(f * (v.length - 1))]?.toFixed(3); return { p10: q(0.1), med: q(0.5), p90: q(0.9), gt1: +(v.filter((z) => z > 1).length / Math.max(1, v.length)).toFixed(3), n: v.length }; })(),
      chestOverShoulderMed: +med(g.map((x) => x.fx.silhouette?.chestU / x.fx.silhouette?.shoulderU).filter((v) => isFinite(v))).toFixed(3),
      sideHipLtWaistFrac: +(g.filter((x) => x.fx.side?.depthsU?.hipU != null && x.fx.side.depthsU.waistU != null && x.fx.side.depthsU.hipU < x.fx.side.depthsU.waistU).length / Math.max(1, g.filter((x) => x.fx.side?.depthsU?.hipU != null && x.fx.side.depthsU.waistU != null).length)).toFixed(3),
      sideHipOverWaistMed: +med(g.map((x) => x.fx.side?.depthsU?.hipU / x.fx.side?.depthsU?.waistU).filter((v) => isFinite(v))).toFixed(3),
      sideOk: g.filter((x) => x.fx.side).length, nG: g.length,
      depthSrcHip: g.filter((x) => x.r && x.fx.replay?.rawEst?.depthSource?.hip === 'side').length,
    };
  }
  out.push(rec);
  const f = (s: string, k: string) => { const v = rec.sub[s][k]; return v ? `${v.b >= 0 ? '+' : ''}${v.b}/${v.m}` : '-'; };
  console.log(`\n## ${c.name}  (${((Date.now() - t0) / 1000).toFixed(0)}s)  S=${JSON.stringify(c.S ?? {})} K=${JSON.stringify(c.K ?? {})}`);
  for (const s of ['all', 'train', 'held', 'a25', 'a45']) console.log(`${s.padEnd(5)} ` + ['bust', 'waist', 'hip', 'inseam', 'shoulder_width', 'sleeve_length', 'upper_body_length'].map((k) => `${k.slice(0, 8)} ${f(s, k)}`.padEnd(22)).join(' '));
  console.log('diag', JSON.stringify(rec.diag));
}
const o = flag('out'); if (o) Deno.writeTextFileSync(o, JSON.stringify(out, null, 1));
