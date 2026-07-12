// Pure silhouette geometry — no native/Expo imports so jest can test it.
// Types + band-scanning math shared with silhouette.ts (which owns inference).

import type { Keypoint } from './poseEstimate';

const MIN_KP_SCORE = 0.3;

/** Person-probability mask in the letterboxed square (row-major, values 0..1). */
export interface SilhouetteMask {
  data: Float32Array;
  size: number;
}

/** Body-contour widths in letterboxed-square normalised units (0..1). */
export interface SilhouetteWidths {
  shoulderU?: number;
  chestU?: number;
  waistU?: number;
  hipU?: number;
}

// Tunables — CALIBRATION-PENDING (tune against real tape measurements).
export const S = {
  maskThreshold: 0.5,
  /** Band around the shoulder keypoint line scanned for the widest row. */
  shoulderBandAbove: 0.02,
  shoulderBandBelow: 0.08,
  /** Chest row as a fraction of the shoulder→hip vertical span. */
  chestAt: 0.25,
  chestBand: 0.04,
  /** Natural-waist search band as fractions of the shoulder→hip span. */
  waistFrom: 0.45,
  waistTo: 0.85,
  /** Hip/seat search band: from the hip-joint line down this fraction of leg length. */
  hipDownLegFraction: 0.25,
  hipUpTorsoFraction: 0.05,
  /** Minimum valid rows a band scan needs before trusting its extreme. */
  minBandRows: 3,
};



/**
 * Width of the mask run containing `centerXNorm` at row `yNorm`, in normalised
 * units. Using the CENTERLINE RUN (not the full row extent) keeps a detached
 * arm — separated from the torso by a visible gap — out of torso widths.
 * Returns null when the row is out of range or no person pixel sits near the
 * centreline.
 */
export function runWidthAt(
  mask: SilhouetteMask,
  yNorm: number,
  centerXNorm: number,
  threshold = S.maskThreshold,
): number | null {
  const size = mask.size;
  const row = Math.round(yNorm * (size - 1));
  if (row < 0 || row >= size) return null;
  const at = (x: number) => mask.data[row * size + x] >= threshold;

  let cx = Math.round(centerXNorm * (size - 1));
  cx = Math.max(0, Math.min(size - 1, cx));
  if (!at(cx)) {
    // The centreline may land on a mask hole (belt, hands) — nudge sideways.
    let found = -1;
    for (let d = 1; d <= 4 && found < 0; d++) {
      if (cx - d >= 0 && at(cx - d)) found = cx - d;
      else if (cx + d < size && at(cx + d)) found = cx + d;
    }
    if (found < 0) return null;
    cx = found;
  }

  let l = cx;
  while (l - 1 >= 0 && at(l - 1)) l--;
  let r = cx;
  while (r + 1 < size && at(r + 1)) r++;
  return (r - l + 1) / size;
}

/**
 * Extreme (min or max) centreline-run width across a horizontal band.
 * Needs at least `S.minBandRows` valid rows, otherwise null.
 */
export function bandExtremeWidth(
  mask: SilhouetteMask,
  yTopNorm: number,
  yBottomNorm: number,
  centerXNorm: number,
  mode: 'min' | 'max',
): number | null {
  const size = mask.size;
  const rowTop = Math.max(0, Math.round(yTopNorm * (size - 1)));
  const rowBot = Math.min(size - 1, Math.round(yBottomNorm * (size - 1)));
  if (rowBot < rowTop) return null;

  let best: number | null = null;
  let valid = 0;
  for (let row = rowTop; row <= rowBot; row++) {
    const w = runWidthAt(mask, row / (size - 1), centerXNorm);
    if (w == null) continue;
    valid++;
    if (best == null || (mode === 'min' ? w < best : w > best)) best = w;
  }
  return valid >= S.minBandRows ? best : null;
}

/**
 * Fuse pose keypoints (anatomical heights) with the segmentation mask
 * (contour widths). Returns null when the pose lacks confident shoulders/hips
 * — without those the bands cannot be placed.
 */
export function extractWidths(mask: SilhouetteMask, kps: Keypoint[]): SilhouetteWidths | null {
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;
  const need = ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip'];
  if (need.some((n) => !by[n] || by[n].score < MIN_KP_SCORE)) return null;

  const shoulderY = (by['leftShoulder'].y + by['rightShoulder'].y) / 2;
  const hipY      = (by['leftHip'].y + by['rightHip'].y) / 2;
  const torso = hipY - shoulderY;
  if (torso <= 0) return null;
  const centerX = (by['leftShoulder'].x + by['rightShoulder'].x + by['leftHip'].x + by['rightHip'].x) / 4;

  const ankles = [by['leftAnkle'], by['rightAnkle']].filter((k) => k && k.score >= MIN_KP_SCORE);
  const legLen = ankles.length
    ? (ankles.reduce((s, k) => s + k.y, 0) / ankles.length) - hipY
    : torso; // no ankles → approximate leg proportions from the torso span

  const shoulderU = bandExtremeWidth(
    mask, shoulderY - S.shoulderBandAbove, shoulderY + S.shoulderBandBelow, centerX, 'max');
  const chestY = shoulderY + S.chestAt * torso;
  const chestU = bandExtremeWidth(mask, chestY - S.chestBand, chestY + S.chestBand, centerX, 'max');
  const waistU = bandExtremeWidth(
    mask, shoulderY + S.waistFrom * torso, shoulderY + S.waistTo * torso, centerX, 'min');
  const hipU = bandExtremeWidth(
    mask, hipY - S.hipUpTorsoFraction * torso, hipY + S.hipDownLegFraction * legLen, centerX, 'max');

  if (shoulderU == null && chestU == null && waistU == null && hipU == null) return null;
  return {
    shoulderU: shoulderU ?? undefined,
    chestU:    chestU ?? undefined,
    waistU:    waistU ?? undefined,
    hipU:      hipU ?? undefined,
  };
}
