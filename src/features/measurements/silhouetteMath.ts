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
  /**
   * ROW POSITION where each extreme width was found, expressed as a fraction
   * of the shoulder→hip vertical span (0 = shoulder line, 1 = hip line).
   * `hipRowFrac` can exceed 1 — the seat band the hip scan searches extends
   * BELOW the hip joints (see `S.hipDownLegFraction`), so its winning row can
   * sit past the hip line; the fraction stays linear there, nothing clamps
   * it to [0,1]. No `shoulderRowFrac` — the shoulder band is anchored
   * directly to the shoulder keypoints already, nothing downstream needs to
   * re-locate it by fraction.
   *
   * WHY THIS EXISTS: this is how the SIDE (profile) capture pass
   * (sideViewMath.ts) finds the SAME anatomical rows the front view already
   * measured — cross-view registration by torso FRACTION (view-invariant),
   * not by absolute y (which differs between a front and a side photo taken
   * at a different distance/crop). Absent when that field's band scan itself
   * found no valid extreme (same condition that leaves the width field
   * undefined).
   */
  chestRowFrac?: number;
  waistRowFrac?: number;
  hipRowFrac?: number;
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
 * Sub-pixel refinement of one end of a run: given the last IN-run pixel index
 * `edgeIdx` (probability ≥ threshold) and the direction toward the boundary
 * (`dir` = -1 for the left edge, +1 for the right), linearly interpolate the
 * exact position where the mask probability crosses `threshold`, between
 * `edgeIdx` and its first OUT-of-run neighbour (`edgeIdx + dir`). Mask values
 * are already float probabilities (0..1), not binary, so this is a genuine
 * sub-pixel edge, not a heuristic.
 *
 * Falls back to a flat half-pixel extension past `edgeIdx` (i.e. treats the
 * pixel boundary as sitting exactly between `edgeIdx` and its neighbour, the
 * old integer-run assumption) when:
 * - the neighbour is off the mask (image border — nothing to interpolate
 *   against), or
 * - the neighbour's probability isn't actually below `threshold`, or its
 *   probability exactly equals the in-run pixel's (both would make the
 *   interpolation denominator zero/undefined or the crossing direction
 *   ambiguous).
 */
function subpixelEdge(mask: SilhouetteMask, row: number, edgeIdx: number, dir: -1 | 1, threshold: number): number {
  const size = mask.size;
  const neighborIdx = edgeIdx + dir;
  const fallback = edgeIdx + dir * 0.5;
  if (neighborIdx < 0 || neighborIdx >= size) return fallback;

  const inVal = mask.data[row * size + edgeIdx];
  const outVal = mask.data[row * size + neighborIdx];
  if (!(outVal < threshold) || inVal === outVal) return fallback;

  // Position (in pixel-index units) where the linear interpolation between
  // (neighborIdx, outVal) and (edgeIdx, inVal) crosses `threshold`.
  const frac = (threshold - outVal) / (inVal - outVal);
  return neighborIdx - dir * frac;
}

/**
 * Width of the mask run containing `centerXNorm` at row `yNorm`, in normalised
 * units. Using the CENTERLINE RUN (not the full row extent) keeps a detached
 * arm — separated from the torso by a visible gap — out of torso widths.
 * Edges are refined to SUB-PIXEL precision (see `subpixelEdge`) — for a hard
 * binary mask with `threshold = 0.5` (as in this file's unit tests) the
 * refinement reduces exactly to the old whole-pixel-run width, since a 0→1
 * step crosses 0.5 exactly halfway between the two pixels; the fractional
 * result only diverges from the old integer count on a REAL (graded)
 * probability mask, which is the whole point of doing this.
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
    // The nudge radius is SIZE-RELATIVE (2% of the mask side, floor 4px) —
    // a fixed 4px was tuned against the 256px full-frame/crop masks this
    // module originally shipped with, but MODNet's 512px mask (silhouette.ts)
    // makes a fixed 4px nudge proportionally half as wide as before; scaling
    // it keeps the nudge covering the same fraction of the body regardless
    // of which segmenter produced the mask.
    const nudge = Math.max(4, Math.round(size * 0.02));
    let found = -1;
    for (let d = 1; d <= nudge && found < 0; d++) {
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

  const leftEdge = subpixelEdge(mask, row, l, -1, threshold);
  const rightEdge = subpixelEdge(mask, row, r, 1, threshold);
  return (rightEdge - leftEdge) / size;
}

/**
 * Topmost and bottommost rows where `runWidthAt` finds a run at least 2 px
 * wide (rejecting single-pixel specks — segmentation noise, not the person)
 * at ANY of the given probe columns, scanning the FULL mask height. This is
 * the crown-to-sole vertical extent used as an independent scale reference
 * alongside the nose→ankle keypoint span (see `landmarksToMeasurements.ts`'s
 * `maskExtentU`) — a continuous mask edge can be a steadier reference than
 * two single joint keypoints.
 *
 * WHY multiple probe columns, not a single torso centreline: below the
 * crotch, the torso-centre column falls in the GAP between the two legs —
 * `runWidthAt`'s ±4px sideways nudge is usually not enough to reach a leg,
 * so a single-centreline scan stops at the crotch and reports roughly HALF
 * the true crown→sole extent, which then always fails the hMask/hKp
 * agreement band and silently deactivates the scale reference for anyone
 * standing with feet even slightly apart. The head can likewise sit
 * x-offset from the torso centre (slight lean / head tilt). Callers pass a
 * probe per relevant landmark (torso centre + nose + each visible ankle);
 * a row counts as valid when ANY probe hits a run there.
 *
 * Values are in the mask's OWN normalised space (0..1) — full-square when
 * given a full-frame mask, crop-square when given a cropped one; the caller
 * converts to full-square units via cropMath when needed.
 *
 * Returns null when no probes were given, or when fewer than
 * `S.minBandRows` rows produced a valid run — too little of the mask to
 * trust as a height reference (e.g. the person is mostly out of frame, or
 * segmentation failed broadly).
 */
export function maskVerticalExtent(
  mask: SilhouetteMask,
  probeXNorms: number[],
): { topV: number; botV: number } | null {
  if (probeXNorms.length === 0) return null;
  const size = mask.size;
  let topRow = -1;
  let botRow = -1;
  let validRows = 0;

  for (let row = 0; row < size; row++) {
    const yNorm = row / (size - 1);
    // A row is valid when ANY probe column yields a ≥2px run at it.
    let hit = false;
    for (const probeX of probeXNorms) {
      const w = runWidthAt(mask, yNorm, probeX);
      if (w != null && w * size >= 2) { hit = true; break; } // reject sub-2px specks
    }
    if (!hit) continue;
    validRows++;
    if (topRow < 0) topRow = row;
    botRow = row;
  }

  if (validRows < S.minBandRows || topRow < 0) return null;
  return { topV: topRow / (size - 1), botV: botRow / (size - 1) };
}

/** Result of a band-extreme scan that also reports WHICH row won — needed by
 *  `extractWidths` to compute the row-fraction registration fields (see
 *  `SilhouetteWidths`'s doc comment) — `bandExtremeWidth` below stays the
 *  plain width-only signature every existing caller/test already uses. */
export interface BandExtreme {
  /** The extreme (min or max) centreline-run width found in the band. */
  width: number;
  /** Pixel row (0-indexed, mask-native resolution) where it occurred. */
  row: number;
}

/**
 * Extreme (min or max) centreline-run width across a horizontal band, PLUS
 * which row it occurred at. Needs at least `S.minBandRows` valid rows,
 * otherwise null. `bandExtremeWidth` below is a thin width-only wrapper kept
 * for every pre-existing caller/test that only ever wanted the number.
 */
export function bandExtremeWidthRow(
  mask: SilhouetteMask,
  yTopNorm: number,
  yBottomNorm: number,
  centerXNorm: number,
  mode: 'min' | 'max',
): BandExtreme | null {
  const size = mask.size;
  const rowTop = Math.max(0, Math.round(yTopNorm * (size - 1)));
  const rowBot = Math.min(size - 1, Math.round(yBottomNorm * (size - 1)));
  if (rowBot < rowTop) return null;

  let best: BandExtreme | null = null;
  let valid = 0;
  for (let row = rowTop; row <= rowBot; row++) {
    const w = runWidthAt(mask, row / (size - 1), centerXNorm);
    if (w == null) continue;
    valid++;
    if (best == null || (mode === 'min' ? w < best.width : w > best.width)) best = { width: w, row };
  }
  return valid >= S.minBandRows ? best : null;
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
  const r = bandExtremeWidthRow(mask, yTopNorm, yBottomNorm, centerXNorm, mode);
  return r ? r.width : null;
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

  const size = mask.size;
  // Row fraction of the shoulder→hip span for a winning row (mask-native
  // pixel row → normalised y → fraction) — see `SilhouetteWidths`'s doc
  // comment on why this is stored (side-view row registration).
  const rowFrac = (row: number) => ((row / (size - 1)) - shoulderY) / torso;

  const shoulderExtreme = bandExtremeWidthRow(
    mask, shoulderY - S.shoulderBandAbove, shoulderY + S.shoulderBandBelow, centerX, 'max');
  const chestY = shoulderY + S.chestAt * torso;
  const chestExtreme = bandExtremeWidthRow(mask, chestY - S.chestBand, chestY + S.chestBand, centerX, 'max');
  const waistExtreme = bandExtremeWidthRow(
    mask, shoulderY + S.waistFrom * torso, shoulderY + S.waistTo * torso, centerX, 'min');
  const hipExtreme = bandExtremeWidthRow(
    mask, hipY - S.hipUpTorsoFraction * torso, hipY + S.hipDownLegFraction * legLen, centerX, 'max');

  if (!shoulderExtreme && !chestExtreme && !waistExtreme && !hipExtreme) return null;
  return {
    shoulderU: shoulderExtreme?.width,
    chestU:    chestExtreme?.width,
    waistU:    waistExtreme?.width,
    hipU:      hipExtreme?.width,
    chestRowFrac: chestExtreme ? rowFrac(chestExtreme.row) : undefined,
    waistRowFrac: waistExtreme ? rowFrac(waistExtreme.row) : undefined,
    hipRowFrac:   hipExtreme   ? rowFrac(hipExtreme.row)   : undefined,
  };
}

// ── Hand erasure (side-view hip/waist depth pass) ────────────────────────────
//
// In a profile photo taken with arms relaxed at the sides, the hands hang at
// roughly seat/hip level — right where the hip DEPTH scan (sideViewMath.ts)
// looks for the widest front-to-back row. A hand's silhouette adds width
// there that has nothing to do with the torso's true depth, biasing the
// measured hip depth wide. This erases a disk around each confident wrist
// keypoint from the mask BEFORE any side-depth scan runs.

/**
 * Zero mask probabilities inside a disk of radius `radiusNorm` centred at
 * (`cxNorm`, `cyNorm`) — all three in the mask's own normalised unit space
 * (0..1), same convention as `runWidthAt`'s row/x arguments. Mutates `mask`
 * in place (the caller already owns a private per-frame mask instance — see
 * `estimateSilhouetteCropped` — so mutating it directly avoids an extra
 * full-mask copy).
 *
 * `radiusNorm <= 0` is an explicit no-op (not just a zero-area loop) — a
 * disk of zero radius erases nothing, not even the single centre pixel.
 * A centre outside [0,1] (or a disk that partially/fully falls off the mask)
 * is handled by clamping the scanned pixel range to the mask bounds, not by
 * throwing or silently doing nothing.
 */
export function eraseDisk(mask: SilhouetteMask, cxNorm: number, cyNorm: number, radiusNorm: number): void {
  if (radiusNorm <= 0) return;
  const size = mask.size;
  const cx = cxNorm * (size - 1);
  const cy = cyNorm * (size - 1);
  const radiusPx = radiusNorm * (size - 1);

  const rowMin = Math.max(0, Math.floor(cy - radiusPx));
  const rowMax = Math.min(size - 1, Math.ceil(cy + radiusPx));
  const colMin = Math.max(0, Math.floor(cx - radiusPx));
  const colMax = Math.min(size - 1, Math.ceil(cx + radiusPx));
  const r2 = radiusPx * radiusPx;

  for (let row = rowMin; row <= rowMax; row++) {
    for (let col = colMin; col <= colMax; col++) {
      const dx = col - cx;
      const dy = row - cy;
      if (dx * dx + dy * dy <= r2) mask.data[row * size + col] = 0;
    }
  }
}

// ── MODNet NCHW input fill (pure — see silhouette.ts's `loadMatteModel`) ────
//
// Every OTHER model tensor fill in this feature (MoveNet Lightning/BlazePose
// in poseEstimate.ts, the selfie segmenter's HWC fill in silhouette.ts) uses
// HWC — height/width/channel INTERLEAVED — layout: for a given pixel, its R,
// G, B values sit next to each other in the buffer. MODNet's declared input
// shape is [1, 3, 512, 512] — NCHW, CHANNEL-PLANAR: the buffer is three
// separate same-sized planes (all R values, then all G values, then all B
// values), each itself row-major. This is a COMPLETELY different memory
// layout, not just a different normalisation — do NOT reuse this function's
// output as if it were HWC, and do NOT extend the HWC fill loops elsewhere
// in this feature to "also handle" NCHW; the indexing math doesn't
// generalise cleanly between the two and conflating them is how you'd get a
// channel-shuffled or plane-shuffled image silently fed to the model.
//
// Pure (no native/Expo imports) — exported so a unit test can fill a tiny
// synthetic image and assert the exact plane/row/col arithmetic directly,
// the same way `runWidthAt`/`bandExtremeWidth` are tested against synthetic
// masks above.

/**
 * Fill a Float32Array in NCHW (channel-planar) layout from decoded RGBA
 * pixel data, applying MODNet's declared [-1,1] normalisation
 * ((pixel/255 − 0.5) / 0.5). `destSize` is the model's square input side
 * (512 for MODNet); `offX`/`offY` are the letterbox offsets (same convention
 * as every other model in this feature — content centred, padding around it).
 *
 * PADDING VALUE: every other model in this feature normalises such that a
 * raw zero-initialised buffer (`new Float32Array(...)`, default 0) already
 * equals "pixel value 0 = black" (MoveNet's raw-byte convention, the selfie
 * segmenter's [0,1] convention). MODNet's [-1,1] convention does NOT share
 * that property — black (pixel 0) maps to (0/255−0.5)/0.5 = **-1**, not 0.
 * Leaving the buffer at its zero default would silently pad with MID-GRAY
 * instead of black, unlike every other model here — so this function
 * explicitly pre-fills with -1 before writing real pixels over it.
 */
export function fillNCHWFloat(
  imgData: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  destSize: number,
  offX: number,
  offY: number,
): Float32Array {
  const pixelCount = destSize * destSize;
  const out = new Float32Array(pixelCount * 3).fill(-1); // -1 = black in MODNet's [-1,1] convention

  for (let y = 0; y < imgHeight; y++) {
    const dy = y + offY;
    if (dy < 0 || dy >= destSize) continue;
    for (let x = 0; x < imgWidth; x++) {
      const dx = x + offX;
      if (dx < 0 || dx >= destSize) continue;
      const src = (y * imgWidth + x) * 4;
      const pixelIdx = dy * destSize + dx;
      // Plane c lives at offset c*pixelCount; within a plane, row-major.
      out[0 * pixelCount + pixelIdx] = (imgData[src]     / 255 - 0.5) / 0.5;
      out[1 * pixelCount + pixelIdx] = (imgData[src + 1] / 255 - 0.5) / 0.5;
      out[2 * pixelCount + pixelIdx] = (imgData[src + 2] / 255 - 0.5) / 0.5;
    }
  }

  return out;
}
