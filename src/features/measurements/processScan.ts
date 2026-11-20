// Capture-time scan processing, extracted verbatim from app/measurements-scan.tsx's
// finish() so the SAME code can be driven by the live screen and by the dev
// replay screen (app/dev-scan-replay.tsx).
//
// Split (2026-11): this file runs the MODELS (stage A — refine, segmentation) and
// packs their raw outputs into FrameModelOutput[]; everything after the models is
// the pure `processFromModelOutputs` (processPure.ts), shared with the offline
// replay (scripts/offline-replay).
//
// PRIVACY: processScan DELETES every frame uri it is given (front + side) —
// callers that need the source files to survive must pass copies.

import * as FileSystem from 'expo-file-system/legacy';
import { refineKeypoints, type Keypoint } from './poseEstimate';
import { estimateSilhouette, estimateSilhouetteCropped } from './silhouette';
import { personCropRect } from './cropMath';
import {
  processFromModelOutputs, pickFrontCandidates, pickSideCandidates, countRefined,
  type FrameModelOutput, type ScanInputs, type ScanResult,
} from './processPure';

export {
  MAX_REFINE_FRAMES, SIDE_MAX_REFINE_FRAMES,
  type ScanInputs, type ScanResult, type SideProcessResult, type FrameModelOutput,
} from './processPure';

/** One buffered live-poll frame — shared shape for BOTH the front and side
 *  ring buffers. `pitchRad` is the DeviceMotion beta (radians) read at the
 *  moment this frame was captured (groundwork for a future keystone correction). */
export interface BufferedFrame {
  keypoints: Keypoint[];
  uri: string;
  width: number;
  height: number;
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
 * Deletes every front+side frame uri it consumes.
 */
export async function processScan(
  front: BufferedFrame[], side: BufferedFrame[], inputs: ScanInputs,
  progress?: { addToTotal(n: number): void; frameDone(): void; debug?: ScanDebug },
): Promise<ScanResult | null> {
  if (front.length === 0) return null;
  const bumpDone = () => progress?.frameDone();
  const addToTotal = (n: number) => progress?.addToTotal(n);
  const base = (b: BufferedFrame): FrameModelOutput =>
    ({ width: b.width, height: b.height, pitchRad: b.pitchRad, pass1: b.keypoints });

  // Refine + crop-segment one candidate. A throw anywhere leaves whatever was
  // already obtained (e.g. refined kept when only the mask throws).
  const runCandidate = async (b: BufferedFrame, o: FrameModelOutput) => {
    o.cropRect = null; o.refined = null; o.cropMask = null;
    try {
      o.cropRect = personCropRect(b.keypoints, b.width, b.height);
      if (o.cropRect) {
        o.refined = (await refineKeypoints(b.uri, b.width, b.height, b.keypoints)) ?? null;
        o.cropMask = (await estimateSilhouetteCropped(b.uri, b.width, b.height, o.cropRect)) ?? null;
      }
    } catch {
      // see above
    }
    bumpDone();
  };

  // ── FRONT models ──
  const frontOut = front.map(base);
  for (const i of pickFrontCandidates(front.map((b) => b.keypoints))) await runCandidate(front[i], frontOut[i]);
  const branch: 'refined' | 'fallback' = countRefined(frontOut) >= 2 ? 'refined' : 'fallback';
  if (branch === 'refined') {
    for (const b of front) FileSystem.deleteAsync(b.uri, { idempotent: true }).catch(() => {});
  } else {
    // Reprocess EVERY buffered frame with the full-frame segmenter — grow the
    // progress total by the full buffer size so "x/y" never overshoots.
    addToTotal(front.length);
    for (const [i, b] of front.entries()) {
      try {
        frontOut[i].fullMask = (await estimateSilhouette(b.uri, b.width, b.height)) ?? null;
      } catch {
        frontOut[i].fullMask = null;
      } finally {
        FileSystem.deleteAsync(b.uri, { idempotent: true }).catch(() => {});
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
  } finally {
    for (const b of side) FileSystem.deleteAsync(b.uri, { idempotent: true }).catch(() => {});
  }

  if (__DEV__ && progress?.debug) {
    frontOut.forEach((o, index) => progress.debug!.onFrame({ ...o, view: 'front', index, candidate: o.cropRect !== undefined, branch }));
    sideOut.forEach((o, index) => progress.debug!.onFrame({ ...o, view: 'side', index, candidate: o.cropRect !== undefined }));
  }

  return processFromModelOutputs(frontOut, sideOut, inputs);
}
