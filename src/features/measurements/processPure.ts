// Pure (no native / Expo imports) post-model half of the scan pipeline.
//
// processScan.ts (device) runs the MODELS (MoveNet/BlazePose/MODNet) and packs
// their raw outputs into `FrameModelOutput`s; everything AFTER the models —
// crop conversions, extractWidths, eraseDisk, extractSideDepths, medians,
// outlier rejection, keypointsToMeasurements, fusion — lives here so the SAME
// code runs on device and in the offline replay (scripts/offline-replay).
//
// `opts.S` / `opts.K` override the silhouette / landmark tunables for
// calibration sweeps; absent → production behaviour.

import type { Keypoint } from './poseEstimate';
import {
  extractWidths, maskVerticalExtent, eraseDisk, runEdgesAtRow, S,
  type SilhouetteMask, type SilhouetteWidths,
} from './silhouetteMath';
import { extractSideDepths, type SideDepths, type SideRowFracs } from './sideViewMath';
import { fullSquareToCropSquare, cropSquareLengthToFullSquare, type CropRect } from './cropMath';
import { demographicPrior, fuseWithPrior } from './demographicPrior';
import { applyResidualCorrection } from './residualCorrection';
import { keypointsToMeasurements, estimatePersonUnitH, K, type Sex, type MeasurementTunables } from './landmarksToMeasurements';
import type { EstimatedMeasurements } from '../../types/measurements';
import {
  medianKeypoints, medianWidths, medianSideDepths, medianExtent, scaleAgreement, rejectOutlierFrames,
} from './aggregateFrames';
import { Q, REQUIRED_KP } from './poseQuality';

// Latency guard (2026-07-12): BlazePose Heavy + MODNet cost noticeably more
// per frame than the Lightning/selfie-segmenter combo they augment — refine
// at most this many of the buffered frames per capture, not all of them.
export const MAX_REFINE_FRAMES = 3;
// SIDE (profile) pass — smaller cap: it is a bonus signal on top of an already
// complete front-only estimate.
export const SIDE_MAX_REFINE_FRAMES = 2;

/** Raw model outputs for ONE buffered frame (everything the pure stage needs). */
export interface FrameModelOutput {
  width: number;
  height: number;
  pitchRad?: number;
  /** Pass-1 (MoveNet) keypoints, full-square space. */
  pass1: Keypoint[];
  /** Present (even if null) only for refine CANDIDATES; undefined = not a candidate.
   *  null = no crop rect (person not locatable) or refine/segmentation failed. */
  cropRect?: CropRect | null;
  /** BlazePose refined keypoints (full-square), null when refine returned/threw nothing. */
  refined?: Keypoint[] | null;
  /** Person mask of the CROP (crop-square space) — candidates only. */
  cropMask?: SilhouetteMask | null;
  /** Full-frame mask — FRONT fallback branch only (<2 frames refined). */
  fullMask?: SilhouetteMask | null;
}

export interface ScanInputs { heightCm: number; weightKg?: number; sex?: Sex; ageYears?: number }

/** Result of a successful side-view processing pass. */
export interface SideProcessResult {
  /** Median-aggregated side keypoints, full-square space. */
  sideAggKps: Keypoint[];
  /** Median-aggregated measured depths, full-square units (fixture v2 exports these). */
  depthsU: SideDepths;
  /** Side mask's crown→sole vertical extent, full-square units. */
  maskExtentU?: number;
  /** Depths in cm via the SIDE view's own scale — feeds keypointsToMeasurements. */
  sideDepthsCm: { chestCm?: number; waistCm?: number; hipCm?: number };
  /** Median DeviceMotion pitch across the buffered side frames. */
  capturePitchRad?: number;
}

export interface ScanResult {
  /** keypointsToMeasurements output, before the demographic-prior fusion. */
  rawEst: EstimatedMeasurements | null;
  /** After fuseWithPrior + applyResidualCorrection — what the app actually stores. */
  est: EstimatedMeasurements | null;
  /** scaleAgreement cv (honest multi-frame stability signal). */
  stability: number;
  aggKps: Keypoint[];
  widths?: SilhouetteWidths;
  maskExtentU?: number;
  frontCapturePitchRad?: number;
  side: SideProcessResult | null;
  refinedSuccessCount: number;
  /** __DEV__ diagnostics only. */
  diag: { frames: number; kept: number; refineCandidates: number; pass1Kps: Keypoint[][]; finalKps: Keypoint[][] };
}

export interface ReplayOpts { S?: Partial<typeof S>; K?: MeasurementTunables }

// ── candidate ranking (shared by device stage A and the pure stage) ──────────

/** Weakest REQUIRED_KP score (higher = more complete pass-1 pose). */
function requiredMinScore(kps: Keypoint[]): number {
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;
  let min = 1;
  for (const name of REQUIRED_KP) min = Math.min(min, by[name]?.score ?? 0);
  return min;
}

/** Weakest-link score for a SIDE frame — nose plus the best of each shoulder/hip/ankle pair. */
function sideRequiredMinScore(kps: Keypoint[]): number {
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;
  const pairBest = (a: string, b: string) => Math.max(by[a]?.score ?? 0, by[b]?.score ?? 0);
  return Math.min(
    by['nose']?.score ?? 0,
    pairBest('leftShoulder', 'rightShoulder'),
    pairBest('leftHip', 'rightHip'),
    pairBest('leftAnkle', 'rightAnkle'),
  );
}

const rank = (pass1s: Keypoint[][], score: (k: Keypoint[]) => number, max: number): number[] =>
  pass1s.map((_, i) => i).sort((a, b) => score(pass1s[b]) - score(pass1s[a])).slice(0, max);

/** Indices (ranked, best first) of the front frames to refine+segment. */
export const pickFrontCandidates = (pass1s: Keypoint[][]): number[] => rank(pass1s, requiredMinScore, MAX_REFINE_FRAMES);
/** Indices (ranked, best first) of the side frames to refine+segment. */
export const pickSideCandidates = (pass1s: Keypoint[][]): number[] => rank(pass1s, sideRequiredMinScore, SIDE_MAX_REFINE_FRAMES);

/** Number of candidates whose refine succeeded (decides refined vs fallback branch). */
export const countRefined = (frames: FrameModelOutput[]): number =>
  pickFrontCandidates(frames.map((f) => f.pass1)).filter((i) => !!frames[i].cropRect && !!frames[i].refined).length;

// ── geometry helpers ─────────────────────────────────────────────────────────

/**
 * Silhouette extraction (contour widths + vertical extent) for one frame's mask,
 * in whatever normalised space the mask lives in. The extent scan probes torso
 * centre + nose + each confident ankle (see `maskVerticalExtent`).
 */
function extractWidthsAndExtent(
  mask: SilhouetteMask, kps: Keypoint[], s: typeof S,
): { widths: SilhouetteWidths | null; extentSpan: number | null } {
  const widths = extractWidths(mask, kps, s) ?? null;
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;
  const need = ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip'];
  const probes: number[] = [];
  if (need.every((n) => by[n] && by[n].score >= Q.minScore)) {
    probes.push((by['leftShoulder'].x + by['rightShoulder'].x + by['leftHip'].x + by['rightHip'].x) / 4);
  }
  for (const name of ['nose', 'leftAnkle', 'rightAnkle']) {
    const k = by[name];
    if (k && k.score >= Q.minScore) probes.push(k.x);
  }
  const extent = maskVerticalExtent(mask, probes, s);
  return { widths, extentSpan: extent ? extent.botV - extent.topV : null };
}

/** Mask-extent probe columns for the SIDE view (lenient: any confident torso joints). */
function sideProbesOf(kps: Keypoint[]): number[] {
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;
  const probes: number[] = [];
  const torsoNames = ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip']
    .filter((n) => by[n] && by[n].score >= Q.minScore);
  if (torsoNames.length > 0) {
    probes.push(torsoNames.reduce((s, n) => s + by[n].x, 0) / torsoNames.length);
  }
  for (const name of ['nose', 'leftAnkle', 'rightAnkle']) {
    const k = by[name];
    if (k && k.score >= Q.minScore) probes.push(k.x);
  }
  return probes;
}

const toCrop = (kps: Keypoint[], cropRect: CropRect, w: number, h: number): Keypoint[] =>
  kps.map((k) => {
    const { u, v } = fullSquareToCropSquare(k.x, k.y, cropRect, w, h);
    return { ...k, x: u, y: v };
  });

/**
 * Calibration option (S.handEraseOutsideTorso): erase only the disk pixels that lie
 * OUTSIDE the torso contour, where the contour at each row is linearly interpolated
 * between the centreline-run edges just above and just below the disk. Pixels inside
 * the torso span (buttock/belly) are kept.
 */
function eraseDiskOutsideTorso(mask: SilhouetteMask, cxN: number, cyN: number, rN: number, kps: Keypoint[], s: typeof S): void {
  if (rN <= 0) return;
  const size = mask.size;
  const cx = cxN * (size - 1), cy = cyN * (size - 1), r = rN * (size - 1);
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;
  const tk = ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip'].filter((n) => by[n] && by[n].score >= Q.minScore);
  if (tk.length === 0) return;
  const centerX = tk.reduce((a, n) => a + by[n].x, 0) / tk.length;
  const rowA = Math.max(0, Math.floor(cy - r) - 2), rowB = Math.min(size - 1, Math.ceil(cy + r) + 2);
  const ea = runEdgesAtRow(mask, rowA, centerX, s.maskThreshold);
  const eb = runEdgesAtRow(mask, rowB, centerX, s.maskThreshold);
  if (!ea || !eb) { eraseDisk(mask, cxN, cyN, rN); return; }
  const r2 = r * r;
  for (let row = Math.max(0, Math.floor(cy - r)); row <= Math.min(size - 1, Math.ceil(cy + r)); row++) {
    const t = (row - rowA) / Math.max(1, rowB - rowA);
    const L = ea.left + t * (eb.left - ea.left), R = ea.right + t * (eb.right - ea.right);
    for (let col = Math.max(0, Math.floor(cx - r)); col <= Math.min(size - 1, Math.ceil(cx + r)); col++) {
      const dx = col - cx, dy = row - cy;
      if (dx * dx + dy * dy <= r2 && (col < L || col > R)) mask.data[row * size + col] = 0;
    }
  }
}

// ── side stage ───────────────────────────────────────────────────────────────

function processSideOutputs(
  frames: FrameModelOutput[], frontRowFracs: SideRowFracs, heightCm: number, s: typeof S, KC: typeof K,
): SideProcessResult | null {
  if (frames.length === 0) return null;
  const perFrameKps: Keypoint[][] = [];
  const perFrameDepths: (SideDepths | null)[] = [];
  const perFrameExtents: (number | null)[] = [];

  for (const i of pickSideCandidates(frames.map((f) => f.pass1))) {
    const f = frames[i];
    let finalKps = f.pass1;
    let depths: SideDepths | null = null;
    let extentSpan: number | null = null;
    try {
      if (f.cropRect) {
        if (f.refined) finalKps = f.refined;
        // Clone: eraseDisk mutates, and offline sweeps reuse the same mask.
        const mask = f.cropMask ? { size: f.cropMask.size, data: f.cropMask.data.slice() } : null;
        if (mask) {
          const kpsInCropSpace = toCrop(finalKps, f.cropRect, f.width, f.height);
          // Hand erasure BEFORE the depth scan — radius 0.06 x person-unit height.
          const personUnitForHand = estimatePersonUnitH(kpsInCropSpace, undefined, KC);
          if (personUnitForHand != null) {
            for (const wristName of ['leftWrist', 'rightWrist']) {
              const wrist = kpsInCropSpace.find((k) => k.name === wristName);
              if (wrist && wrist.score >= Q.minScore) {
                if (s.handEraseOutsideTorso) eraseDiskOutsideTorso(mask, wrist.x, wrist.y, s.handEraseRadius * personUnitForHand, kpsInCropSpace, s);
                else eraseDisk(mask, wrist.x, wrist.y, s.handEraseRadius * personUnitForHand);
              }
            }
          }
          const sd = extractSideDepths(mask, kpsInCropSpace, frontRowFracs, s);
          const cv = (u: number | undefined) => u != null ? cropSquareLengthToFullSquare(u, f.cropRect!, f.width, f.height) : undefined;
          depths = sd.chestU != null || sd.waistU != null || sd.hipU != null
            ? { chestU: cv(sd.chestU), waistU: cv(sd.waistU), hipU: cv(sd.hipU) }
            : null;
          const extent = maskVerticalExtent(mask, sideProbesOf(kpsInCropSpace), s);
          if (extent) extentSpan = cropSquareLengthToFullSquare(extent.botV - extent.topV, f.cropRect, f.width, f.height);
        }
      }
    } catch {
      // Candidate failed — contributes only its pass-1 keypoints.
    }
    perFrameKps.push(finalKps);
    perFrameDepths.push(depths);
    perFrameExtents.push(extentSpan);
  }

  const depthsU = medianSideDepths(perFrameDepths);
  if (depthsU.chestU == null && depthsU.waistU == null && depthsU.hipU == null) return null;

  const sideAggKps = medianKeypoints(perFrameKps);
  const maskExtentU = medianExtent(perFrameExtents);
  const capturePitchRad = medianExtent(frames.map((f) => f.pitchRad));

  const sidePersonUnitH = estimatePersonUnitH(sideAggKps, maskExtentU, KC);
  if (sidePersonUnitH == null || sidePersonUnitH <= 0) return null;

  const sideCmPerUnit = heightCm / sidePersonUnitH;
  const sideDepthsCm = {
    chestCm: depthsU.chestU != null ? depthsU.chestU * sideCmPerUnit : undefined,
    waistCm: depthsU.waistU != null ? depthsU.waistU * sideCmPerUnit : undefined,
    hipCm:   depthsU.hipU   != null ? depthsU.hipU   * sideCmPerUnit : undefined,
  };
  return { sideAggKps, depthsU, maskExtentU, sideDepthsCm, capturePitchRad };
}

// ── front stage + fusion ─────────────────────────────────────────────────────

/**
 * Everything processScan does after the models ran — see the policy comments
 * in app/measurements-scan.tsx's finish() (latency guard, >=2-refined branch,
 * fallback, outlier rejection, side pass). `front` must be non-empty.
 */
export function processFromModelOutputs(
  front: FrameModelOutput[], side: FrameModelOutput[], inputs: ScanInputs, opts: ReplayOpts = {},
): ScanResult | null {
  if (front.length === 0) return null;
  const s: typeof S = { ...S, ...(opts.S ?? {}) };
  const KC: typeof K = { ...K, ...(opts.K ?? {}) };
  const { weightKg, sex, ageYears } = inputs;

  const candIdx = pickFrontCandidates(front.map((f) => f.pass1));
  const refineResults: { succeeded: boolean; keypoints: Keypoint[]; widths: SilhouetteWidths | null; extent: number | null }[] = [];

  for (const i of candIdx) {
    const b = front[i];
    let finalKps = b.pass1;
    let widthsForFrame: SilhouetteWidths | null = null;
    let extentForFrame: number | null = null;
    let succeeded = false;
    try {
      const cropRect = b.cropRect;
      if (cropRect) {
        if (b.refined) { finalKps = b.refined; succeeded = true; }
        if (b.cropMask) {
          // Mask is crop-square; map this frame's final keypoints into ITS crop.
          const { widths, extentSpan } = extractWidthsAndExtent(b.cropMask, toCrop(finalKps, cropRect, b.width, b.height), s);
          const cv = (u: number | undefined) => u != null ? cropSquareLengthToFullSquare(u, cropRect, b.width, b.height) : undefined;
          if (widths) {
            widthsForFrame = {
              shoulderU: cv(widths.shoulderU), chestU: cv(widths.chestU),
              waistU: cv(widths.waistU), hipU: cv(widths.hipU),
              // Row FRACTIONS are dimensionless — copy through unconverted.
              chestRowFrac: widths.chestRowFrac,
              waistRowFrac: widths.waistRowFrac,
              hipRowFrac:   widths.hipRowFrac,
              chestEdge:    widths.chestEdge,
            };
          }
          if (extentSpan != null) extentForFrame = cropSquareLengthToFullSquare(extentSpan, cropRect, b.width, b.height);
        }
      }
    } catch {
      // `succeeded` stays as it was; the branch below decides.
    }
    refineResults.push({ succeeded, keypoints: finalKps, widths: widthsForFrame, extent: extentForFrame });
  }

  const refinedSuccessCount = refineResults.filter((r) => r.succeeded).length;
  const finalKpsPerFrame: Keypoint[][] = [];
  const collectedWidths: (SilhouetteWidths | null)[] = [];
  const collectedExtents: (number | null)[] = [];

  if (refinedSuccessCount >= 2) {
    // Un-refined/failed-refine frames are dropped entirely.
    for (const r of refineResults) {
      if (!r.succeeded) continue;
      finalKpsPerFrame.push(r.keypoints);
      collectedWidths.push(r.widths);
      collectedExtents.push(r.extent);
    }
  } else {
    // Pre-refinement pipeline UNIFORMLY for every buffered frame (full-frame masks).
    for (const b of front) {
      let widthsForFrame: SilhouetteWidths | null = null;
      let extentForFrame: number | null = null;
      try {
        if (b.fullMask) {
          const { widths, extentSpan } = extractWidthsAndExtent(b.fullMask, b.pass1, s);
          widthsForFrame = widths;
          extentForFrame = extentSpan; // already full-square
        }
      } catch { /* widths/extent stay null for this frame */ }
      finalKpsPerFrame.push(b.pass1);
      collectedWidths.push(widthsForFrame);
      collectedExtents.push(extentForFrame);
    }
  }

  // Outlier rejection on apparent scale, over the FINAL keypoints.
  const frames = rejectOutlierFrames(finalKpsPerFrame);
  const cv = scaleAgreement(frames);
  const aggKps = medianKeypoints(frames);

  const mergedWidths = medianWidths(collectedWidths);
  const widths: SilhouetteWidths | undefined = Object.keys(mergedWidths).length > 0 ? mergedWidths : undefined;
  const maskExtentU = medianExtent(collectedExtents);
  const frontCapturePitchRad = medianExtent(front.map((b) => b.pitchRad));

  // SIDE — bonus signal; any failure is a silent fallback to front-only.
  let sideResult: SideProcessResult | null = null;
  if (side.length > 0) {
    try {
      sideResult = processSideOutputs(side, widths ?? {}, inputs.heightCm, s, KC);
    } catch {
      sideResult = null;
    }
  }

  const rawEst = keypointsToMeasurements(aggKps, inputs.heightCm, {
    weightKg, sex, ageYears, silhouette: widths, maskExtentU,
    sideDepthsCm: sideResult?.sideDepthsCm,
    tunables: opts.K,
  });
  const fused = rawEst ? fuseWithPrior(rawEst, demographicPrior(sex, inputs.heightCm, weightKg, ageYears)) : null;
  const est = fused ? applyResidualCorrection(fused, { sex, heightCm: inputs.heightCm, weightKg }) : null;
  return {
    rawEst, est, stability: cv, aggKps, widths, maskExtentU, frontCapturePitchRad,
    side: sideResult, refinedSuccessCount,
    diag: {
      frames: front.length, kept: frames.length, refineCandidates: candIdx.length,
      pass1Kps: front.map((b) => b.pass1), finalKps: finalKpsPerFrame,
    },
  };
}
