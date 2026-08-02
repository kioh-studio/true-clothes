// Pure crop/letterbox geometry — no native/Expo imports so jest can test it.
//
// TWO coordinate spaces are in play throughout the measurement pipeline:
//
//   FULL-square space — the shared public contract every other module in this
//   feature reads/writes (poseEstimate's `Keypoint.x/y`, silhouetteMath's
//   `SilhouetteWidths`, landmarksToMeasurements' scale math). It comes from
//   letterboxing the WHOLE source frame: square side L = max(sW, sH), offsets
//   ox = (L−sW)/2, oy = (L−sH)/2, source pixel (px,py) → square coords
//   u = (px+ox)/L, v = (py+oy)/L.
//
//   CROP-square space — the same letterbox recipe applied to a crop rect
//   instead of the whole frame (the BlazePose pose-refinement pass and the
//   cropped-segmentation pass both run their model on a crop, not the full
//   frame, so its own model-input square is naturally in ITS OWN letterboxed
//   space): crop rect (cx,cy,cw,ch) in SOURCE pixels, Lc = max(cw,ch),
//   oxc = (Lc−cw)/2, oyc = (Lc−ch)/2, crop-square coords u'/v' the same way.
//
// A point converts between the two spaces by going crop-square → crop pixel
// → source pixel → full-square (or the reverse). A WIDTH or vertical EXTENT
// (a scalar, not a point) converts by the ratio of the two square sides,
// Lc/L — the letterbox padding offsets cancel out for a pure length because
// they're a translation, not a scale.

import type { Keypoint } from './poseEstimate';

// ── Tunables — CALIBRATION-PENDING (crop margins tuned on real photos) ───────
export const C = {
  /** Confidence floor for a keypoint to count toward the crop bbox. */
  minKpScore: 0.3,
  /** Extra margin above the raw keypoint bbox, as a fraction of bbox height/
   *  width. The crown of the head sits above the eye/nose keypoints, feet
   *  sit below the ankles, and the deltoids/arms overhang the shoulder-hip
   *  keypoint span — the crop needs slack on all four sides or the
   *  refinement/segmentation pass would clip the very features it exists to
   *  sharpen. */
  marginTop: 0.18,
  marginBottom: 0.10,
  marginSide: 0.20,
  /** A crop below this many pixels per side is too small to trust (and too
   *  small to be worth a second model pass on) — treat as "no usable crop". */
  minCropSide: 32,
  /** If the (already-margined) crop still covers more than this fraction of
   *  the frame area, cropping barely narrows the model's field of view —
   *  the refinement gain isn't worth a second inference pass, so skip it. */
  maxCropAreaFraction: 0.75,
};

/** Uniform-scale letterbox parameters for a w×h source into its square. */
export interface LetterboxParams {
  /** Square side — max(w, h). */
  L: number;
  /** Horizontal padding added to center the source in the square. */
  ox: number;
  /** Vertical padding added to center the source in the square. */
  oy: number;
}

export function letterboxParams(w: number, h: number): LetterboxParams {
  const L = Math.max(w, h);
  return { L, ox: (L - w) / 2, oy: (L - h) / 2 };
}

/** Source pixel (of a w×h image) → its letterboxed-square normalised coords. */
export function sourceToSquare(px: number, py: number, w: number, h: number): { u: number; v: number } {
  const { L, ox, oy } = letterboxParams(w, h);
  return { u: (px + ox) / L, v: (py + oy) / L };
}

/** Letterboxed-square normalised coords → source pixel (of a w×h image).
 *  Exact inverse of `sourceToSquare`. */
export function squareToSource(u: number, v: number, w: number, h: number): { px: number; py: number } {
  const { L, ox, oy } = letterboxParams(w, h);
  return { px: u * L - ox, py: v * L - oy };
}

/** Rectangle in SOURCE pixels — the exact shape `expo-image-manipulator`'s
 *  `crop` transform expects, so callers can pass this straight through. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Uniform long-side-to-`target` resize dimensions for a w×h source —
 * shared by every model-input resize in this feature (MoveNet Lightning,
 * BlazePose Heavy, MODNet, the selfie segmenter, both full-frame and
 * cropped) so the "long side scales to the model's input size, short side
 * stays proportional and gets letterbox-padded" recipe is defined exactly
 * once.
 */
export function longSideResize(w: number, h: number, target: number): { width: number; height: number } {
  const scale = target / Math.max(w, h);
  return {
    width: Math.max(1, Math.min(target, Math.round(w * scale))),
    height: Math.max(1, Math.min(target, Math.round(h * scale))),
  };
}

/**
 * Bounding box (in SOURCE pixels, of an sW×sH frame) around every keypoint
 * scoring ≥ `C.minKpScore`, expanded by the head/feet/arm margins and
 * clamped to the frame — the crop rect fed to the BlazePose refinement pass
 * and the cropped-segmentation pass.
 *
 * Returns null when:
 * - no keypoint clears the score floor (nothing to bound),
 * - the raw bbox is degenerate (zero width or height — e.g. every kept
 *   keypoint coincides on one axis),
 * - the margined+clamped crop is smaller than `C.minCropSide` on either
 *   side (too small to trust or bother re-inferring), or
 * - the crop still covers more than `C.maxCropAreaFraction` of the frame
 *   (cropping wouldn't meaningfully tighten the model's field of view).
 */
export function personCropRect(kps: Keypoint[], sW: number, sH: number): CropRect | null {
  const pts = kps
    .filter((k) => k.score >= C.minKpScore)
    .map((k) => squareToSource(k.x, k.y, sW, sH));
  if (pts.length === 0) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.px < minX) minX = p.px;
    if (p.px > maxX) maxX = p.px;
    if (p.py < minY) minY = p.py;
    if (p.py > maxY) maxY = p.py;
  }
  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw <= 0 || bh <= 0) return null;

  // Margins are fractions of the RAW keypoint bbox — not the already-margined
  // one — so each side's expansion is computed once, independently.
  let left   = minX - C.marginSide   * bw;
  let right  = maxX + C.marginSide   * bw;
  let top    = minY - C.marginTop    * bh;
  let bottom = maxY + C.marginBottom * bh;

  left   = Math.max(0, left);
  top    = Math.max(0, top);
  right  = Math.min(sW, right);
  bottom = Math.min(sH, bottom);

  const originX = Math.round(left);
  const originY = Math.round(top);
  const width   = Math.round(right - left);
  const height  = Math.round(bottom - top);

  if (width < C.minCropSide || height < C.minCropSide) return null;
  if (width * height > C.maxCropAreaFraction * sW * sH) return null;

  return { originX, originY, width, height };
}

/**
 * Crop-square normalised point → FULL-square normalised point.
 * crop-square (u,v) → crop pixel → source pixel (+ crop origin) → full-square.
 */
export function cropSquareToFullSquare(
  u: number, v: number, cropRect: CropRect, sW: number, sH: number,
): { u: number; v: number } {
  const { px: cropPx, py: cropPy } = squareToSource(u, v, cropRect.width, cropRect.height);
  const sourcePx = cropPx + cropRect.originX;
  const sourcePy = cropPy + cropRect.originY;
  return sourceToSquare(sourcePx, sourcePy, sW, sH);
}

/**
 * FULL-square normalised point → crop-square normalised point. Exact inverse
 * of `cropSquareToFullSquare` — used to express keypoints (already mapped to
 * the shared full-square space) back in a specific frame's crop-square space
 * so they line up with that frame's OWN cropped-segmentation mask.
 */
export function fullSquareToCropSquare(
  u: number, v: number, cropRect: CropRect, sW: number, sH: number,
): { u: number; v: number } {
  const { px, py } = squareToSource(u, v, sW, sH);
  const cropPx = px - cropRect.originX;
  const cropPy = py - cropRect.originY;
  return sourceToSquare(cropPx, cropPy, cropRect.width, cropRect.height);
}

/**
 * Convert a WIDTH or vertical EXTENT (a scalar length, not a point) measured
 * in crop-square normalised units to the equivalent length in full-square
 * units. Unlike a point conversion, a length only scales — the letterbox
 * offsets are a translation and cancel out for a difference of two
 * coordinates — so the factor is just the ratio of the two square sides.
 */
export function cropSquareLengthToFullSquare(
  lengthInCropSquare: number, cropRect: CropRect, sW: number, sH: number,
): number {
  const Lc = Math.max(cropRect.width, cropRect.height);
  const { L } = letterboxParams(sW, sH);
  return lengthInCropSquare * (Lc / L);
}
