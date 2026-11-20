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
  /** Diagnostic (not a length): how the tracked chest edges were obtained. */
  chestEdge?: ChestEdgeInfo;
}

export interface ChestEdgeInfo {
  left: 'clean' | 'extrapolated';
  right: 'clean' | 'extrapolated';
  /** Chest-band rows where at least one side came from the fitted curve. */
  extrapolatedRows: number;
}

// Tunables — CALIBRATION-PENDING (tune against real tape measurements).
export const S = {
  maskThreshold: 0.5,
  /** Band around the shoulder keypoint line scanned for the widest row. */
  shoulderBandAbove: 0.02,
  shoulderBandBelow: 0.08,
  /**
   * Chest row as a fraction of the shoulder→hip vertical span. 0.50 ≈ mid-torso
   * (about the lower sternum / under-bust, NOT the armpit; 0.25 was the armpit,
   * where lats + arm roots widen the contour). Source: reports/calibration-sweep.md
   * (synthetic 350 bodies + BodyM, held-out validated; flat optimum 0.48–0.52;
   * tape re-tune pending).
   */
  chestAt: 0.50,
  chestBand: 0.04,
  /** Natural-waist search band as fractions of the shoulder→hip span. */
  waistFrom: 0.45,
  waistTo: 0.85,
  /** Hip/seat search band: from the hip-joint line down this fraction of leg length. */
  hipDownLegFraction: 0.25,
  hipUpTorsoFraction: 0.05,
  /** Minimum valid rows a band scan needs before trusting its extreme. */
  minBandRows: 3,
  /** Torso-edge tracking (chest). ponytail: CALIBRATION-PENDING, tune on replay fixtures. */
  trackSeedRows: 6,
  trackSeedFrac: 0.05,       // seed rows = max(trackSeedRows, this x torso span px)
  trackTolPx: 2,
  trackTolFrac: 0.015,       // tol = max(trackTolPx, this x torso span px)
  maxEdgeExtrapolation: 0.35, // x shoulder->hip span
  /** Side-view hand-erase disk radius (x person-unit height) around each wrist. */
  handEraseRadius: 0.06,
  /** 1 = erase only disk pixels OUTSIDE the torso contour interpolated from rows above/below the disk (calibration option; 0 = legacy full disk). */
  handEraseOutsideTorso: 0,
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
  const e = runEdgesAtRow(mask, Math.round(yNorm * (mask.size - 1)), centerXNorm, threshold);
  return e ? (e.right - e.left) / mask.size : null;
}

/** Sub-pixel left/right edges (pixel units) of the centreline run at a pixel row. */
export function runEdgesAtRow(
  mask: SilhouetteMask,
  row: number,
  centerXNorm: number,
  threshold = S.maskThreshold,
): { left: number; right: number } | null {
  const size = mask.size;
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
  return { left: leftEdge, right: rightEdge };
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
  s: typeof S = S,
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
      const w = runWidthAt(mask, yNorm, probeX, s.maskThreshold);
      if (w != null && w * size >= 2) { hit = true; break; } // reject sub-2px specks
    }
    if (!hit) continue;
    validRows++;
    if (topRow < 0) topRow = row;
    botRow = row;
  }

  if (validRows < s.minBandRows || topRow < 0) return null;
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
  s: typeof S = S,
): BandExtreme | null {
  const size = mask.size;
  const rowTop = Math.max(0, Math.round(yTopNorm * (size - 1)));
  const rowBot = Math.min(size - 1, Math.round(yBottomNorm * (size - 1)));
  if (rowBot < rowTop) return null;

  let best: BandExtreme | null = null;
  let valid = 0;
  for (let row = rowTop; row <= rowBot; row++) {
    const w = runWidthAt(mask, row / (size - 1), centerXNorm, s.maskThreshold);
    if (w == null) continue;
    valid++;
    if (best == null || (mode === 'min' ? w < best.width : w > best.width)) best = { width: w, row };
  }
  return valid >= s.minBandRows ? best : null;
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
  s: typeof S = S,
): number | null {
  const r = bandExtremeWidthRow(mask, yTopNorm, yBottomNorm, centerXNorm, mode, s);
  return r ? r.width : null;
}

/** Least-squares polynomial of `deg` through (t, x); returns evaluator. */
function polyFit(ts: number[], xs: number[], deg: 1 | 2): (t: number) => number {
  const n = ts.length;
  const m = deg + 1;
  const A: number[][] = Array.from({ length: m }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < m; a++) {
      for (let b = 0; b < m; b++) A[a][b] += Math.pow(ts[i], a + b);
      A[a][m] += xs[i] * Math.pow(ts[i], a);
    }
  }
  const mean = xs.reduce((q, v) => q + v, 0) / n;
  for (let c = 0; c < m; c++) { // gauss-jordan, partial pivot
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-9) return () => mean;
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
    }
  }
  const coef = A.map((row, i) => row[m] / row[i]);
  return (t) => coef.reduce((q, c, i) => q + c * Math.pow(t, i), 0);
}

interface SideTrack {
  /** pixel row -> accepted measured edge x */
  accepted: Map<number, number>;
  /** topmost (smallest) accepted row */
  lastRow: number;
  predict: (row: number) => number;
}

/**
 * Walk upward (pts ordered by descending row) accepting edge points that stay
 * on the fitted curve. `outward` = +1 for the right edge, -1 for the left.
 * An outward jump beyond `tol` (arm contact) ends tracking for good; an inward
 * outlier is just skipped.
 */
function trackSide(pts: Array<{ row: number; x: number }>, seedN: number, tol: number, outward: 1 | -1): SideTrack | null {
  if (pts.length < seedN) return null;
  const r0 = pts[0].row;
  const ts: number[] = [];
  const xs: number[] = [];
  const accepted = new Map<number, number>();
  const take = (p: { row: number; x: number }) => { ts.push(r0 - p.row); xs.push(p.x); accepted.set(p.row, p.x); };
  const fit = () => polyFit(ts, xs, ts.length >= 8 ? 2 : 1);
  for (let i = 0; i < seedN; i++) take(pts[i]);
  let f = fit();
  let lastRow = pts[seedN - 1].row;
  for (let i = seedN; i < pts.length; i++) {
    const d = pts[i].x - f(r0 - pts[i].row);
    if (Math.abs(d) <= tol) { take(pts[i]); lastRow = pts[i].row; f = fit(); }
    else if (d * outward > 0) break;
  }
  return { accepted, lastRow, predict: (row) => f(r0 - row) };
}

/**
 * Chest width from independently TRACKED left/right torso edges. In an A-pose
 * the upper arms touch the torso at chest height so the centreline run spans
 * arm-to-arm; here each edge is followed up from `startRow` (natural waist,
 * arms still separated) and, once an edge jumps outward (arm contact), the
 * fitted curve is extrapolated instead. Max width over the chest band rows
 * (same rule as the old band scan). Null when too few seed rows, too few band
 * rows, or the extrapolation distance exceeds `S.maxEdgeExtrapolation`.
 * `spanPx` = shoulder→hip span in pixels (scales tolerances).
 */
export function trackedTorsoWidthAt(
  mask: SilhouetteMask,
  startRow: number,
  shoulderRow: number,
  bandTopRow: number,
  bandBotRow: number,
  centerXNorm: number,
  spanPx: number,
  s: typeof S = S,
): { width: number; row: number; edge: ChestEdgeInfo } | null {
  const seedN = Math.max(s.trackSeedRows, Math.round(s.trackSeedFrac * spanPx));
  const tol = Math.max(s.trackTolPx, s.trackTolFrac * spanPx);
  const L: Array<{ row: number; x: number }> = [];
  const R: Array<{ row: number; x: number }> = [];
  for (let row = startRow; row >= shoulderRow; row--) {
    const e = runEdgesAtRow(mask, row, centerXNorm, s.maskThreshold);
    if (!e) continue;
    L.push({ row, x: e.left });
    R.push({ row, x: e.right });
  }
  const tl = trackSide(L, seedN, tol, -1);
  const tr = trackSide(R, seedN, tol, 1);
  if (!tl || !tr) return null;

  const maxEx = s.maxEdgeExtrapolation * spanPx;
  let best: { width: number; row: number; l: boolean; r: boolean } | null = null;
  let valid = 0;
  let extRows = 0;
  for (let row = Math.max(bandTopRow, 0); row <= Math.min(bandBotRow, mask.size - 1); row++) {
    const lx = tl.accepted.get(row);
    const rx = tr.accepted.get(row);
    if ((lx == null && tl.lastRow - row > maxEx) || (rx == null && tr.lastRow - row > maxEx)) return null;
    const left = lx ?? tl.predict(row);
    const right = rx ?? tr.predict(row);
    valid++;
    if (lx == null || rx == null) extRows++;
    const w = (right - left) / mask.size;
    if (best == null || w > best.width) best = { width: w, row, l: lx != null, r: rx != null };
  }
  if (!best || valid < s.minBandRows) return null;
  return {
    width: best.width,
    row: best.row,
    edge: { left: best.l ? 'clean' : 'extrapolated', right: best.r ? 'clean' : 'extrapolated', extrapolatedRows: extRows },
  };
}

/**
 * Fuse pose keypoints (anatomical heights) with the segmentation mask
 * (contour widths). Returns null when the pose lacks confident shoulders/hips
 * — without those the bands cannot be placed.
 */
export function extractWidths(mask: SilhouetteMask, kps: Keypoint[], s: typeof S = S): SilhouetteWidths | null {
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
    mask, shoulderY - s.shoulderBandAbove, shoulderY + s.shoulderBandBelow, centerX, 'max', s);
  const chestY = shoulderY + s.chestAt * torso;
  const waistExtreme = bandExtremeWidthRow(
    mask, shoulderY + s.waistFrom * torso, shoulderY + s.waistTo * torso, centerX, 'min', s);
  // Chest: track torso edges up from the waist (arms touch the torso here in an A-pose).
  const px = (y: number) => Math.round(y * (size - 1));
  const chestExtreme = trackedTorsoWidthAt(
    mask,
    waistExtreme?.row ?? px(shoulderY + ((s.waistFrom + s.waistTo) / 2) * torso),
    px(shoulderY),
    px(chestY - s.chestBand),
    px(chestY + s.chestBand),
    centerX,
    Math.max(1, torso * (size - 1)),
    s,
  );
  const hipExtreme = bandExtremeWidthRow(
    mask, hipY - s.hipUpTorsoFraction * torso, hipY + s.hipDownLegFraction * legLen, centerX, 'max', s);

  if (!shoulderExtreme && !chestExtreme && !waistExtreme && !hipExtreme) return null;
  return {
    shoulderU: shoulderExtreme?.width,
    chestU:    chestExtreme?.width,
    waistU:    waistExtreme?.width,
    hipU:      hipExtreme?.width,
    chestRowFrac: chestExtreme ? rowFrac(chestExtreme.row) : undefined,
    waistRowFrac: waistExtreme ? rowFrac(waistExtreme.row) : undefined,
    hipRowFrac:   hipExtreme   ? rowFrac(hipExtreme.row)   : undefined,
    chestEdge: chestExtreme?.edge,
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
