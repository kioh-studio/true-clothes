// Capture-time scan processing, extracted verbatim from app/measurements-scan.tsx's
// finish() so the SAME code can be driven by the live screen and by the dev
// replay screen (app/dev-scan-replay.tsx).
//
// Split (2026-11): this file runs the MODELS (stage A — refine, segmentation) and
// packs their raw outputs into FrameModelOutput[]; everything after the models is
// the pure `processFromModelOutputs` (processPure.ts), shared with the offline
// replay (scripts/offline-replay).
//
// PRIVACY: frames are in-RAM RgbaImages - processScan never touches files. When it
// finishes it ZEROES every buffered frame's pixel data (callers must not reuse the
// frames; copies that share one data buffer are zeroed once).

import { refineKeypoints, type Keypoint } from './poseEstimate';
import { estimateSilhouette, estimateSilhouetteCropped } from './silhouette';
import type { RgbaImage } from './rgbaImage';
import { personCropRect } from './cropMath';
import { buildRetake, type RetakeInfo, type ScanFailReason } from './scanFailure';
import {
  processFromModelOutputs, pickFrontCandidates, pickSideCandidates, countRefined,
  type FrameModelOutput, type ScanInputs, type ScanResult,
} from './processPure';

export {
  MAX_REFINE_FRAMES, SIDE_MAX_REFINE_FRAMES,
  type ScanInputs, type ScanResult, type SideProcessResult, type FrameModelOutput,
} from './processPure';
export type { RetakeInfo, ScanFailReason } from './scanFailure';

/** processScan result: either a normal ScanResult, or `retake` (no estimate). */
export type ScanOutcome = ScanResult | { retake: RetakeInfo };

/** One buffered live-poll frame — shared shape for BOTH the front and side
 *  ring buffers. `pitchRad` is the DeviceMotion beta (radians) read at the
 *  moment this frame was captured (groundwork for a future keystone correction). */
export interface BufferedFrame {
  keypoints: Keypoint[];
  /** In-RAM RGBA pixels (width/height come from the image). */
  image: RgbaImage;
  pitchRad?: number;
}

/** DEV-only capture of the raw model outputs (see app/dev-scan-replay.tsx).
 *  Masks are the live instances — clone/serialise them inside the callback. */
export interface DebugFrameInfo extends FrameModelOutput {
  view: 'front' | 'side';
  index: number;
  /** Was this frame a refine candidate (cropRect/refined/cropMask present)? */
  candidate: boolean;
  /** Front only: which branch the capture took. */
  branch?: 'refined' | 'fallback';
}
export interface ScanDebug { onFrame(info: DebugFrameInfo): void }

/**
 * Everything finish() used to do between the buffer snapshot and the
 * setPendingEstimate call. `front` must be non-empty (returns null otherwise).
 * Zeroes every front+side frame's pixel data when done.
 */
async function processScanInner(
  front: BufferedFrame[], side: BufferedFrame[], inputs: ScanInputs,
  progress?: { addToTotal(n: number): void; frameDone(): void; debug?: ScanDebug },
  /** Dev replay/benchmark only: keep the legacy fullframe-fallback numbers
   *  instead of returning a retake when <2 front frames refine. */
  opts: { allowFallback?: boolean } = {},
): Promise<ScanOutcome | null> {
  if (front.length === 0) return null;
  const bumpDone = () => progress?.frameDone();
  const addToTotal = (n: number) => progress?.addToTotal(n);
  const base = (b: BufferedFrame): FrameModelOutput =>
    ({ width: b.image.width, height: b.image.height, pitchRad: b.pitchRad, pass1: b.keypoints });

  // Refine + crop-segment one candidate. A throw anywhere leaves whatever was
  // already obtained (e.g. refined kept when only the mask throws).
  // Returns why the candidate failed (undefined = refined OK, mask included).
  const runCandidate = async (b: BufferedFrame, o: FrameModelOutput): Promise<ScanFailReason | undefined> => {
    o.cropRect = null; o.refined = null; o.cropMask = null;
    let reason: ScanFailReason | undefined;
    try {
      o.cropRect = personCropRect(b.keypoints, b.image.width, b.image.height);
      if (!o.cropRect) {
        reason = 'cropped';
      } else {
        const r = await refineKeypoints(b.image, b.keypoints);
        if (r.ok) o.refined = r.keypoints; else reason = r.reason;
        o.cropMask = (await estimateSilhouetteCropped(b.image, o.cropRect)) ?? null;
        if (!reason && !o.cropMask) reason = 'mask';
      }
    } catch {
      reason = 'error';
    }
    bumpDone();
    return reason;
  };

  // ── FRONT models ──
  const frontOut = front.map(base);
  const frontReasons: ScanFailReason[] = [];
  for (const i of pickFrontCandidates(front.map((b) => b.keypoints))) {
    const r = await runCandidate(front[i], frontOut[i]);
    if (r && !frontOut[i].refined) frontReasons.push(r); // mask-only failures keep the refined frame
  }
  const branch: 'refined' | 'fallback' = countRefined(frontOut) >= 2 ? 'refined' : 'fallback';
  if (branch === 'fallback' && !opts.allowFallback) {
    // <2 refined frames: the fullframe fallback can be ~24 cm off - don't hand
    // the user numbers; ask for a retake with specific guidance instead.
    const retake = buildRetake(frontReasons);
    console.warn('[MEASURE_SCAN_RETAKE]', retake.reasons.join(','));
    return { retake };
  }
  if (branch === 'fallback') {
    // Reprocess EVERY buffered frame with the full-frame segmenter — grow the
    // progress total by the full buffer size so "x/y" never overshoots.
    addToTotal(front.length);
    for (const [i, b] of front.entries()) {
      try {
        frontOut[i].fullMask = (await estimateSilhouette(b.image)) ?? null;
      } catch {
        frontOut[i].fullMask = null;
      }
      bumpDone();
    }
  }

  // ── SIDE models (bonus signal; failure = silent front-only fallback) ──
  const sideOut = side.map(base);
  try {
    for (const i of pickSideCandidates(side.map((b) => b.keypoints))) await runCandidate(side[i], sideOut[i]);
  } catch {
    // swallowed like the pre-split processSideFrames wrapper
  }

  if (__DEV__ && progress?.debug) {
    frontOut.forEach((o, index) => progress.debug!.onFrame({ ...o, view: 'front', index, candidate: o.cropRect !== undefined, branch }));
    sideOut.forEach((o, index) => progress.debug!.onFrame({ ...o, view: 'side', index, candidate: o.cropRect !== undefined }));
  }

  return processFromModelOutputs(frontOut, sideOut, inputs);
}

/** Zero every distinct pixel buffer once (copies may share one). */
function wipe(frames: BufferedFrame[]): void {
  for (const d of new Set(frames.map((b) => b.image.data))) d.fill(0);
}

export async function processScan(
  front: BufferedFrame[], side: BufferedFrame[], inputs: ScanInputs,
  progress?: { addToTotal(n: number): void; frameDone(): void; debug?: ScanDebug },
  opts: { allowFallback?: boolean } = {},
): Promise<ScanOutcome | null> {
  try {
    return await processScanInner(front, side, inputs, progress, opts);
  } finally {
    wipe([...front, ...side]);
  }
}
