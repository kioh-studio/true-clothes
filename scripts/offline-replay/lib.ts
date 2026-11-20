// Shared loader for offline-replay: reads the device dump (<id>.frames.json +
// mask .bin) and re-runs the pure post-model pipeline.
import { processFromModelOutputs, type FrameModelOutput, type ReplayOpts } from '../../src/features/measurements/processPure';
import { scanToFixture, type ReplayMeta } from '../../src/features/measurements/scanFixture';
import type { SilhouetteMask } from '../../src/features/measurements/silhouetteMath';

export interface Body { id: string; meta: ReplayMeta; groundTruth: Record<string, number>; front: FrameModelOutput[]; side: FrameModelOutput[] }
export type { ReplayOpts };

interface MaskRef { file: string; size: number }
interface DumpFrame {
  view: 'front' | 'side'; index: number; width: number; height: number; pitchRad?: number;
  candidate: boolean; pass1: FrameModelOutput['pass1']; refined?: FrameModelOutput['refined']; cropRect?: FrameModelOutput['cropRect'];
  cropMask?: MaskRef | null; fullMask?: MaskRef | null;
}

function readMask(dir: string, ref: MaskRef | null | undefined, fmt: 'f32' | 'u8'): SilhouetteMask | null {
  if (!ref) return null;
  const b = Deno.readFileSync(`${dir}/${ref.file}`);
  const data = fmt === 'f32'
    ? new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) // little-endian, same as device
    : Float32Array.from(b, (v) => v / 255);
  if (data.length !== ref.size * ref.size) throw new Error(`${ref.file}: ${data.length} != ${ref.size}^2`);
  return { size: ref.size, data };
}

export function listBodyIds(dir: string): string[] {
  return [...Deno.readDirSync(dir)].map((e) => e.name).filter((n) => n.endsWith('.frames.json'))
    .map((n) => n.slice(0, -'.frames.json'.length)).sort();
}

export function loadBody(dir: string, id: string): Body {
  const d = JSON.parse(Deno.readTextFileSync(`${dir}/${id}.frames.json`));
  const fmt: 'f32' | 'u8' = d.maskFormat;
  const front: FrameModelOutput[] = [], side: FrameModelOutput[] = [];
  for (const f of (d.frames as DumpFrame[]).sort((a, b) => a.index - b.index)) {
    const o: FrameModelOutput = { width: f.width, height: f.height, pitchRad: f.pitchRad, pass1: f.pass1 };
    if (f.candidate) { // undefined (non-candidate) vs null (candidate, nothing obtained) matters
      o.cropRect = f.cropRect ?? null; o.refined = f.refined ?? null; o.cropMask = readMask(dir, f.cropMask, fmt);
    }
    if (f.fullMask) o.fullMask = readMask(dir, f.fullMask, fmt);
    (f.view === 'front' ? front : side).push(o);
  }
  return { id, meta: d.meta, groundTruth: d.groundTruth, front, side };
}

/** Run the pure stage; returns a fixture v2 (same schema as the device's) or null. */
export function replayBody(b: Body, opts: ReplayOpts = {}) {
  const scan = processFromModelOutputs(b.front, b.side,
    { heightCm: b.meta.heightCm, weightKg: b.meta.weightKg, sex: b.meta.sex, ageYears: b.meta.ageYears }, opts);
  return scan ? scanToFixture(b.id, b.meta, b.groundTruth, scan) : null;
}

/** JSON arg: inline JSON, or @path/to/file.json. */
export function parseJsonArg(v: string | undefined): any {
  if (!v) return undefined;
  return JSON.parse(v.startsWith('@') ? Deno.readTextFileSync(v.slice(1)) : v);
}
export const flag = (name: string): string | undefined => {
  const i = Deno.args.indexOf(`--${name}`);
  return i >= 0 ? Deno.args[i + 1] : undefined;
};
