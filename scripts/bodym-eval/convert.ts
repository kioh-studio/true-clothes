// bodym-eval/convert — BodyM silhouette masks -> measure-eval fixture v2 (JSON, written OUTSIDE the repo).
// BodyM is CC BY-NC 4.0, internal benchmarking only: never write data into the repo.
//
//   deno run -A --sloppy-imports scripts/bodym-eval/convert.ts <bodymDir> [--splits=train,testA,testB]
//        [--tag=base] [--S=chestAt=0.2,waistFrom=0.4] [--F=acromion=0.83] [--max-per-subject=N]
// <bodymDir> holds raw/<split>/{mask,mask_left}/*.png and <split>_{hwg_metadata,measurements,subject_to_photo_map}.csv
// Output: <bodymDir>/derived/<tag>/<split>.json ({skipped, fixtures[]}).
//
// Width/depth/scale extraction goes through the app's own TS (extractWidths,
// maskVerticalExtent, extractSideDepths); only the KEYPOINTS are synthetic.

import { Buffer } from 'node:buffer';
import { PNG } from 'npm:pngjs@7.0.0';
import { extractWidths, maskVerticalExtent, S, type SilhouetteMask } from '../../src/features/measurements/silhouetteMath';
import { extractSideDepths } from '../../src/features/measurements/sideViewMath';
import type { Keypoint } from '../../src/features/measurements/poseEstimate';

// ponytail: THIS IS THE MAIN LIMITATION OF THE BENCHMARK. Masks carry no RGB so BlazePose cannot run; keypoints
// are invented from standard stature fractions (height above the floor = mask sole row) + the mask's own
// vertical extent. Every field that depends on keypoint y/x (inseam, torso length, kp shoulder term, hip-joint
// fallback, band PLACEMENT of chest/waist/hip rows) inherits any error in these constants and in the person's
// proportions differing from the textbook ones. Real BlazePose joints deviate per person; these never do.
export const F = {
  nose: 0.936,       // = K.noseCrownFraction (user-specified)
  acromion: 0.818,   // shoulder line
  hip: 0.52,         // hip joint / greater trochanter
  ankle: 0.039,      // lateral malleolus
  shoulderSpan: 0.23,// joint-to-joint biacromial span / stature (constant => kp shoulder term carries no per-person info)
  hipSpan: 0.10,     // hip-joint separation / stature
  ankleSpread: 0.05, // ankle x offset from centre / stature
};
// ponytail: elbow/wrist deliberately omitted: A-pose arms merge with the torso mask, and any invented arm
// joints would make sleeve a pure stature-fraction. body_sleeve_length is therefore NOT benchmarked.

const N = 480; // working mask side (MODNet-like); BodyM masks are 720x960 -> padded to 960 square -> 2x box-downsampled

function arg(name: string): string | undefined {
  return Deno.args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}
function overrides(target: Record<string, number>, s?: string) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    if (!(k in target)) throw new Error(`unknown key ${k}`);
    target[k] = Number(v);
  }
}
overrides(S as unknown as Record<string, number>, arg('S'));
overrides(F, arg('F'));

function readCsv(path: string): Record<string, string>[] {
  const [head, ...rows] = Deno.readTextFileSync(path).trim().split(/\r?\n/);
  const cols = head.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v])));
}

function loadMask(path: string): SilhouetteMask {
  const png = PNG.sync.read(Buffer.from(Deno.readFileSync(path)));
  const L = Math.max(png.width, png.height);
  const offX = Math.floor((L - png.width) / 2), offY = Math.floor((L - png.height) / 2);
  const f = L / N;
  const data = new Float32Array(N * N);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      let sum = 0, cnt = 0;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
        const x = Math.floor(c * f + dx) - offX, y = Math.floor(r * f + dy) - offY;
        cnt++;
        if (x >= 0 && y >= 0 && x < png.width && y < png.height && png.data[(y * png.width + x) * 4] > 127) sum++;
      }
      data[r * N + c] = sum / cnt;
    }
  }
  return { data, size: N };
}

interface Pseudo { kps: Keypoint[]; probes: number[] }
const kp = (name: string, x: number, y: number): Keypoint => ({ name, x, y, score: 1 });

/** Crown/sole = first/last row with >=2 person px; x-centre = median row midpoint over the torso rows. */
function pseudoKeypoints(m: SilhouetteMask): Pseudo | null {
  const { size, data } = m;
  const span = (row: number): [number, number] | null => {
    let l = -1, r = -1;
    for (let c = 0; c < size; c++) if (data[row * size + c] >= 0.5) { if (l < 0) l = c; r = c; }
    return l >= 0 && r - l >= 1 ? [l, r] : null;
  };
  let top = -1, bot = -1;
  for (let r = 0; r < size; r++) if (span(r)) { if (top < 0) top = r; bot = r; }
  if (top < 0 || bot - top < size * 0.3) return null;
  const Hn = (bot - top) / (size - 1), yFloor = bot / (size - 1);
  const yAt = (frac: number) => yFloor - frac * Hn;
  const mids: number[] = [];
  for (let r = Math.round(yAt(F.acromion) * (size - 1)); r <= Math.round(yAt(F.hip) * (size - 1)); r++) {
    const s = span(r); if (s) mids.push((s[0] + s[1]) / 2 / (size - 1));
  }
  if (mids.length < 3) return null;
  mids.sort((a, b) => a - b);
  const cx = mids[mids.length >> 1];
  const ys = yAt(F.acromion), yh = yAt(F.hip), ya = yAt(F.ankle);
  const kps = [
    kp('nose', cx, yAt(F.nose)),
    kp('leftShoulder', cx - F.shoulderSpan * Hn / 2, ys), kp('rightShoulder', cx + F.shoulderSpan * Hn / 2, ys),
    kp('leftHip', cx - F.hipSpan * Hn / 2, yh), kp('rightHip', cx + F.hipSpan * Hn / 2, yh),
    kp('leftAnkle', cx - F.ankleSpread * Hn, ya), kp('rightAnkle', cx + F.ankleSpread * Hn, ya),
  ];
  const probes = [cx, cx - F.ankleSpread * Hn, cx + F.ankleSpread * Hn, cx - 2 * F.ankleSpread * Hn, cx + 2 * F.ankleSpread * Hn];
  return { kps, probes };
}

const dir = Deno.args.find((a) => !a.startsWith('--'));
if (!dir) throw new Error('usage: convert.ts <bodymDir> [--splits=..] [--tag=..]');
const tag = arg('tag') ?? 'base';
const splits = (arg('splits') ?? 'train,testA,testB').split(',');
const maxPer = Number(arg('max-per-subject') ?? 0);
Deno.mkdirSync(`${dir}/derived/${tag}`, { recursive: true });

// ── "Asian-like" importance weights (PROXY: body size, NOT ethnicity — BodyM's csvs carry no ethnicity field) ──
// w = clip(p_asian(height, BMI | sex) / p_bodym(height, BMI | sex), 0.2, 5). p_asian = 2D Gaussian from NHANES
// 2017-18 + 2021-23 adults 18-65, RIDRETH3==6 (n 430 M / 505 F). p_bodym = 2D Gaussian fitted to the TRAIN subjects.
const ASIAN: Record<string, { mu: [number, number]; cov: [number, number, number] }> = { // cov = [var_h, cov_hb, var_b]
  male: { mu: [170.675, 26.653], cov: [49.759, 2.375, 23.041] },
  female: { mu: [156.870, 25.191], cov: [34.269, -6.115, 24.820] },
};
function gauss2(x: [number, number], g: { mu: [number, number]; cov: [number, number, number] }): number {
  const [a, b, d] = g.cov, det = a * d - b * b, dx = x[0] - g.mu[0], dy = x[1] - g.mu[1];
  return Math.exp(-0.5 * (d * dx * dx - 2 * b * dx * dy + a * dy * dy) / det) / (2 * Math.PI * Math.sqrt(det));
}
const bodymFit: typeof ASIAN = {};
{
  const pts: Record<string, [number, number][]> = { male: [], female: [] };
  for (const r of readCsv(`${dir}/train_hwg_metadata.csv`)) {
    const h = Number(r.height_cm); pts[r.gender].push([h, Number(r.weight_kg) / (h / 100) ** 2]);
  }
  for (const sx of ['male', 'female']) {
    const P = pts[sx], n = P.length, mh = P.reduce((s, p) => s + p[0], 0) / n, mb = P.reduce((s, p) => s + p[1], 0) / n;
    let a = 0, b = 0, d = 0;
    for (const p of P) { a += (p[0] - mh) ** 2; b += (p[0] - mh) * (p[1] - mb); d += (p[1] - mb) ** 2; }
    bodymFit[sx] = { mu: [mh, mb], cov: [a / (n - 1), b / (n - 1), d / (n - 1)] };
  }
}

for (const split of splits) {
  const hwg = new Map(readCsv(`${dir}/${split}_hwg_metadata.csv`).map((r) => [r.subject_id, r]));
  const meas = new Map(readCsv(`${dir}/${split}_measurements.csv`).map((r) => [r.subject_id, r]));
  const perSubject = new Map<string, number>();
  const out: unknown[] = [];
  const skipped: Record<string, number> = {};
  const skip = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1; };

  for (const { subject_id, photo_id } of readCsv(`${dir}/${split}_subject_to_photo_map.csv`)) {
    const h = hwg.get(subject_id), t = meas.get(subject_id);
    if (!h || !t) { skip('no metadata'); continue; }
    if (maxPer && (perSubject.get(subject_id) ?? 0) >= maxPer) continue;
    let front: SilhouetteMask, side: SilhouetteMask;
    try {
      front = loadMask(`${dir}/raw/${split}/mask/${photo_id}.png`);
      side = loadMask(`${dir}/raw/${split}/mask_left/${photo_id}.png`);
    } catch (e) { if (!skipped["mask missing/unreadable"]) console.error(e); skip("mask missing/unreadable"); continue; }

    const pf = pseudoKeypoints(front);
    if (!pf) { skip('front mask: no pseudo-keypoints'); continue; }
    // Mirrors measurements-scan.tsx finish(): widths from extractWidths, extent from maskVerticalExtent.
    const silhouette = extractWidths(front, pf.kps);
    const ext = maskVerticalExtent(front, pf.probes);
    const maskExtentU = ext ? ext.botV - ext.topV : undefined;

    let sideBlock: unknown;
    const ps = pseudoKeypoints(side);
    if (ps) {
      const depthsU = extractSideDepths(side, ps.kps, silhouette ?? {});
      const sext = maskVerticalExtent(side, ps.probes);
      sideBlock = { keypoints: ps.kps, depthsU, maskExtentU: sext ? sext.botV - sext.topV : undefined };
    } else skip('side mask: no pseudo-keypoints (side dropped, front kept)');

    const heightCm = Number(h.height_cm), n = (k: string) => Number(t[k]);
    out.push({
      subjectId: `${subject_id}/${photo_id}`, version: 2,
      inputs: { heightCm, weightKg: Number(h.weight_kg), sex: h.gender, maskExtentU },
      keypoints: pf.kps, silhouette, side: sideBlock,
      groundTruth: {
        body_bust: n('chest'), body_waist: n('waist'), body_hip: n('hip'), body_shoulder_width: n('shoulder-breadth'),
        body_inseam: n('leg-length'), body_upper_body_length: n('shoulder-to-crotch'), body_sleeve_length: n('arm-length'),
      },
      meta: { subject: subject_id, bmi: Number(h.weight_kg) / (heightCm / 100) ** 2 },
    });
    perSubject.set(subject_id, (perSubject.get(subject_id) ?? 0) + 1);
  }
  // top-level `weight` (fixture v2 extension, read by run.ts --weights and by measure-eval/run.ts): density weight
  // divided by the subject's photo count, so every subject counts once per split.
  for (const f of out as { weight: number; inputs: { sex: string; heightCm: number }; meta: { subject: string; bmi: number; w: number } }[]) {
    const x: [number, number] = [f.inputs.heightCm, f.meta.bmi];
    f.meta.w = Math.min(5, Math.max(0.2, gauss2(x, ASIAN[f.inputs.sex]) / gauss2(x, bodymFit[f.inputs.sex])));
    f.weight = f.meta.w / (perSubject.get(f.meta.subject) ?? 1);
  }
  Deno.writeTextFileSync(`${dir}/derived/${tag}/${split}.json`, JSON.stringify({ skipped, fixtures: out }));
  console.log(`${split}: ${out.length} fixtures, ${perSubject.size} subjects, skipped ${JSON.stringify(skipped)}`);
}
