// offline-replay/run — re-run the post-model scan pipeline on dumped model outputs.
// See README.md.
//   deno run -A --sloppy-imports scripts/offline-replay/run.ts --in ./replay-out [--out ./offline-out]
//        [--S '{"chestAt":0.3}'] [--K '{"minScore":0.25}'] [--validate]
// --S/--K accept inline JSON or @file.json.
import { listBodyIds, loadBody, replayBody, parseJsonArg, flag } from './lib.ts';

const inDir = flag('in');
if (!inDir) { console.error('--in <dir with *.frames.json> required'); Deno.exit(1); }
const outDir = flag('out');
const opts = { S: parseJsonArg(flag('S')), K: parseJsonArg(flag('K')) };
const validate = Deno.args.includes('--validate');
if (outDir) Deno.mkdirSync(outDir, { recursive: true });

// Max |a-b| over every numeric leaf present in BOTH (plus structural mismatches).
function diff(a: any, b: any, path: string, acc: { max: number; at: string; missing: string[] }) {
  if (typeof a === 'number' && typeof b === 'number') {
    const d = Math.abs(a - b);
    if (d > acc.max) { acc.max = d; acc.at = path; }
    return;
  }
  if ((a == null) !== (b == null)) { acc.missing.push(path); return; }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`, acc);
  } else if (typeof a !== typeof b) acc.missing.push(path);
  else if (a !== b) acc.missing.push(path + '(value)');
}

let worst = 0;
for (const id of listBodyIds(inDir)) {
  const fx = replayBody(loadBody(inDir, id), opts);
  if (!fx) { console.log(`${id}: pipeline returned null`); continue; }
  if (outDir) Deno.writeTextFileSync(`${outDir}/${id}.json`, JSON.stringify(fx, null, 2));
  if (validate) {
    const dev = JSON.parse(Deno.readTextFileSync(`${inDir}/${id}.json`));
    const acc = { max: 0, at: '', missing: [] as string[] };
    const pick = (f: any) => ({ inputs: f.inputs, keypoints: f.keypoints, silhouette: f.silhouette, side: f.side, est: f.replay?.est, rawEst: f.replay?.rawEst });
    diff(pick(JSON.parse(JSON.stringify(fx))), pick(dev), '', acc);
    worst = Math.max(worst, acc.max);
    console.log(`${id}: max|diff|=${acc.max.toExponential(2)} at ${acc.at || '-'}${acc.missing.length ? `  STRUCT MISMATCH: ${acc.missing.slice(0, 5).join(', ')}` : ''}`);
  } else console.log(`${id}: ok`);
}
if (validate) console.log(`\nWORST max|diff| over all bodies: ${worst.toExponential(3)} (f32 dump expects ~0; u8 dump = quantisation level)`);
