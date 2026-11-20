// offline-replay/selftest — synthetic end-to-end check of the dump format + loader + pure stage
// (no device needed). Writes a fake "device" dump (f32 or u8) into --out and the matching
// device-style fixtures, so `run.ts --in <out> --validate` can be exercised too.
//   deno run -A --sloppy-imports scripts/offline-replay/selftest.ts --out <tmpdir>
import { processFromModelOutputs, type FrameModelOutput } from '../../src/features/measurements/processPure';
import { scanToFixture } from '../../src/features/measurements/scanFixture';
import { personCropRect, fullSquareToCropSquare } from '../../src/features/measurements/cropMath';
import { loadBody, replayBody } from './lib.ts';
import { flag } from './lib.ts';

const out = flag('out');
if (!out) { console.error('--out <dir> required'); Deno.exit(1); }
Deno.mkdirSync(out, { recursive: true });

const NAMES = ['nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
  'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'];
const kp = (half: number, jitter: number) => {
  const P: Record<string, [number, number]> = {
    nose: [0.5, 0.1], leftEye: [0.49, 0.09], rightEye: [0.51, 0.09], leftEar: [0.47, 0.1], rightEar: [0.53, 0.1],
    leftShoulder: [0.5 - half, 0.22], rightShoulder: [0.5 + half, 0.22], leftElbow: [0.5 - half - 0.03, 0.36], rightElbow: [0.5 + half + 0.03, 0.36],
    leftWrist: [0.5 - half - 0.05, 0.48], rightWrist: [0.5 + half + 0.05, 0.48], leftHip: [0.5 - half * 0.6, 0.5], rightHip: [0.5 + half * 0.6, 0.5],
    leftKnee: [0.46, 0.7], rightKnee: [0.54, 0.7], leftAnkle: [0.45, 0.9], rightAnkle: [0.55, 0.9],
  };
  return NAMES.map((name) => ({ name, x: P[name][0] + jitter, y: P[name][1], score: 0.9 }));
};

/** Soft-edged torso/legs/head mask in CROP space, built from the crop-space keypoints. */
function mask(kps: ReturnType<typeof kp>, size: number, halfW: number): { size: number; data: Float32Array } {
  const by = Object.fromEntries(kps.map((k) => [k.name, k]));
  const cx = (by.leftShoulder.x + by.rightShoulder.x) / 2;
  const top = by.nose.y - 0.05 * 0.5, bot = by.leftAnkle.y + 0.03;
  const data = new Float32Array(size * size);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const x = c / (size - 1), y = r / (size - 1);
    if (y < top || y > bot) continue;
    const w = y < by.leftShoulder.y ? 0.04 : y < by.leftHip.y ? halfW * (1 - 0.3 * Math.sin((y - by.leftShoulder.y) / (by.leftHip.y - by.leftShoulder.y) * Math.PI)) : halfW * 0.8;
    const d = (w - Math.abs(x - cx)) * (size - 1); // px inside edge
    data[r * size + c] = Math.max(0, Math.min(1, 0.5 + d));
  }
  return { size, data };
}

function synth(halfShoulder: number, halfBody: number) {
  const mk = (n: number): FrameModelOutput[] => Array.from({ length: n }, (_, i) => {
    const pass1 = kp(halfShoulder, i * 0.001);
    const W = 480, H = 640; // crop must stay < C.maxCropAreaFraction of the frame
    const cropRect = personCropRect(pass1, W, H)!;
    const kc = pass1.map((k) => { const { u, v } = fullSquareToCropSquare(k.x, k.y, cropRect, W, H); return { ...k, x: u, y: v }; });
    return { width: W, height: H, pitchRad: 1.57, pass1, cropRect, refined: pass1.map((k) => ({ ...k, x: k.x + 0.0007 })), cropMask: mask(kc, 128, halfBody) };
  });
  return { front: mk(3), side: mk(2) };
}

const bodies = [['body_000', 0.10, 0.12], ['body_001', 0.12, 0.14], ['body_002', 0.09, 0.10]] as const;
const meta = { heightCm: 170, weightKg: 65, sex: 'female' as const, ageYears: 30, asianWeight: 1, pitchRad: 1.57 };
const gt = { body_bust: 90, body_waist: 72, body_hip: 96 };
for (const fmt of ['f32', 'u8'] as const) {
  const dir = `${out}/${fmt}`;
  Deno.mkdirSync(dir, { recursive: true });
  for (const [id, hs, hb] of bodies) {
    const { front, side } = synth(hs, hb);
    // device side: fixture straight from the in-memory outputs (what dev-scan-replay writes)
    const scan = processFromModelOutputs(front, side, meta)!;
    Deno.writeTextFileSync(`${dir}/${id}.json`, JSON.stringify(scanToFixture(id, meta, gt, scan)));
    // dump
    const frames: any[] = [];
    const dump = (view: 'front' | 'side', fs: FrameModelOutput[]) => fs.forEach((f, index) => {
      const w = (name: string, m?: { size: number; data: Float32Array } | null) => {
        if (!m) return null;
        const bytes = fmt === 'f32' ? new Uint8Array(m.data.buffer) : Uint8Array.from(m.data, (v) => Math.round(v * 255));
        Deno.writeFileSync(`${dir}/${name}`, bytes);
        return { file: name, size: m.size };
      };
      frames.push({ view, index, width: f.width, height: f.height, pitchRad: f.pitchRad, candidate: true, branch: 'refined',
        pass1: f.pass1, refined: f.refined, cropRect: f.cropRect, cropMask: w(`${id}.${view}.${index}.mask.bin`, f.cropMask), fullMask: null });
    });
    dump('front', front); dump('side', side);
    Deno.writeTextFileSync(`${dir}/${id}.frames.json`, JSON.stringify({ bodyId: id, maskFormat: fmt, meta, groundTruth: gt, frames }));

    // offline side
    const off = replayBody(loadBody(dir, id))!;
    const dev = JSON.parse(Deno.readTextFileSync(`${dir}/${id}.json`));
    const g = (f: any) => [f.silhouette.chestU, f.silhouette.waistU, f.silhouette.hipU, f.side?.depthsU?.hipU, f.replay.est.body_hip, f.replay.est.body_bust];
    const a = g(JSON.parse(JSON.stringify(off))), b = g(dev);
    const md = Math.max(...a.map((x: number, i: number) => (x === b[i] ? 0 : Math.abs(x - b[i]))));
    console.log(`${fmt} ${id}: chest/waist/hipU=${a.slice(0, 3).map((x: number) => x.toFixed(4))} sideHipU=${a[3]?.toFixed(4)} estHip=${a[4]} maxdiff=${md.toExponential(2)}`);
    if (fmt === 'f32' && md > 1e-9) throw new Error('f32 round-trip must be exact');
    // S override must move the result
    const alt = replayBody(loadBody(dir, id), { S: { chestAt: 0.4, waistFrom: 0.5 } })!;
    if (JSON.stringify(alt.silhouette) === JSON.stringify(off.silhouette)) throw new Error('S override had no effect');
  }
}
console.log('selftest OK');
