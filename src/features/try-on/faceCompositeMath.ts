// Pure geometry/color math for face compositing — no native/Expo imports so
// jest can test it directly. Mirrors the split used by silhouette.ts /
// silhouetteMath.ts: this module owns the math, faceComposite.ts owns
// native decode/encode/IO around it.
//
// All points here are in PIXEL space (the caller converts from normalised
// 0..1 landmark coords before calling into this module).

export type Pt = { x: number; y: number };

/**
 * 2D similarity transform: [[a, -b], [b, a]] * p + [tx, ty].
 * Represents uniform scale `sqrt(a^2+b^2)` + rotation `atan2(b, a)` + translation.
 */
export interface Similarity {
  a: number;
  b: number;
  tx: number;
  ty: number;
}

/**
 * Least-squares similarity (scale + rotation + translation, NO shear) mapping
 * `src[i] -> dst[i]`. Closed-form solution (Umeyama restricted to 2D similarity,
 * no reflection): centre both point sets, solve the 2x2 linear system for
 * (a, b) via the standard Procrustes-style normal equations, then recover the
 * translation from the centroids.
 *
 * Needs at least 2 non-degenerate correspondences (we call this with 4: both
 * eyes, nose, mouth). Degenerate input (identical points) yields the identity
 * transform.
 */
export function estimateSimilarity(src: Pt[], dst: Pt[]): Similarity {
  const n = Math.min(src.length, dst.length);
  if (n === 0) return { a: 1, b: 0, tx: 0, ty: 0 };

  let scx = 0, scy = 0, dcx = 0, dcy = 0;
  for (let i = 0; i < n; i++) {
    scx += src[i].x; scy += src[i].y;
    dcx += dst[i].x; dcy += dst[i].y;
  }
  scx /= n; scy /= n; dcx /= n; dcy /= n;

  // Solve for (a, b) minimising sum |R(sx,sy) + t - (dx,dy)|^2 over centred
  // points, where R = [[a,-b],[b,a]]. Standard result:
  //   a = sum(sx*dx + sy*dy) / sum(sx^2 + sy^2)
  //   b = sum(sx*dy - sy*dx) / sum(sx^2 + sy^2)
  let num_a = 0, num_b = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i].x - scx, sy = src[i].y - scy;
    const dx = dst[i].x - dcx, dy = dst[i].y - dcy;
    num_a += sx * dx + sy * dy;
    num_b += sx * dy - sy * dx;
    den += sx * sx + sy * sy;
  }

  if (den < 1e-9) return { a: 1, b: 0, tx: dcx - scx, ty: dcy - scy };

  const a = num_a / den;
  const b = num_b / den;
  // Translation: R * centroid(src) + t = centroid(dst)
  const tx = dcx - (a * scx - b * scy);
  const ty = dcy - (b * scx + a * scy);
  return { a, b, tx, ty };
}

/** Apply a similarity transform to a single point. */
export function applySim(p: Pt, s: Similarity): Pt {
  return {
    x: s.a * p.x - s.b * p.y + s.tx,
    y: s.b * p.x + s.a * p.y + s.ty,
  };
}

/** Inverse of a similarity transform (also a similarity, assuming a,b not both 0). */
export function invertSim(s: Similarity): Similarity {
  const det = s.a * s.a + s.b * s.b;
  if (det < 1e-12) return { a: 1, b: 0, tx: -s.tx, ty: -s.ty };
  const ia = s.a / det;
  const ib = -s.b / det;
  // Inverse rotation+scale is [[ia,-ib],[ib,ia]]; inverse translation is
  // -R^-1 * t.
  const itx = -(ia * s.tx - ib * s.ty);
  const ity = -(ib * s.tx + ia * s.ty);
  return { a: ia, b: ib, tx: itx, ty: ity };
}

/** Extract uniform scale and rotation (degrees) from a similarity transform. */
export function similarityScaleRot(s: Similarity): { scale: number; rotDeg: number } {
  const scale = Math.sqrt(s.a * s.a + s.b * s.b);
  const rotDeg = (Math.atan2(s.b, s.a) * 180) / Math.PI;
  return { scale, rotDeg };
}

// CALIBRATION-PENDING: these bounds gate whether the source→generated face
// alignment is trustworthy enough to paste. Too loose → warped/misplaced
// faces slip through; too tight → legitimate but slightly off-angle photos
// get rejected and fall back to the raw generated image. Needs on-device
// tuning against a range of real user photos.
const MIN_PLAUSIBLE_SCALE = 0.3;
const MAX_PLAUSIBLE_SCALE = 3.0;
const MAX_PLAUSIBLE_ROT_DEG = 35;

/** Gate: reject wildly mismatched scale/rotation (bad detection or extreme pose). */
export function isAlignmentPlausible(s: Similarity): boolean {
  const { scale, rotDeg } = similarityScaleRot(s);
  if (!isFinite(scale) || !isFinite(rotDeg)) return false;
  if (scale < MIN_PLAUSIBLE_SCALE || scale > MAX_PLAUSIBLE_SCALE) return false;
  if (Math.abs(rotDeg) > MAX_PLAUSIBLE_ROT_DEG) return false;
  return true;
}

/** Smoothstep helper: 0 at edge0, 1 at edge1, smooth in between. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Alpha mask value at (x,y) for an ellipse centred at (cx,cy) with radii
 * (rx,ry): 1 inside `(1-feather)` of the ellipse, smoothly feathering to 0 at
 * the boundary, 0 outside. `feather` is a fraction of the ellipse radius
 * (e.g. 0.25 → the outer 25% of the radius is the feather ramp).
 */
export function ellipseAlpha(
  x: number, y: number, cx: number, cy: number, rx: number, ry: number, feather: number,
): number {
  if (rx <= 0 || ry <= 0) return 0;
  // Normalised elliptical distance: 0 at centre, 1 at the ellipse boundary.
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const d = Math.sqrt(nx * nx + ny * ny);
  const innerEdge = 1 - Math.max(0, Math.min(1, feather));
  if (d <= innerEdge) return 1;
  if (d >= 1) return 0;
  // Fades 1 -> 0 as d goes innerEdge -> 1.
  return 1 - smoothstep(innerEdge, 1, d);
}

/** Mean/std of a sample array (population std; 0 std for <2 samples). */
export function channelStats(samples: number[]): { mean: number; std: number } {
  const n = samples.length;
  if (n === 0) return { mean: 0, std: 0 };
  let sum = 0;
  for (const v of samples) sum += v;
  const mean = sum / n;
  if (n < 2) return { mean, std: 0 };
  let sq = 0;
  for (const v of samples) sq += (v - mean) * (v - mean);
  return { mean, std: Math.sqrt(sq / n) };
}

/**
 * Map a source-face pixel value onto the generated-face's tone: re-centre on
 * srcMean/srcStd, rescale to dstStd, recentre on dstMean. Clamped to a valid
 * 8-bit channel range. Falls back to a plain mean shift when srcStd ~ 0
 * (flat/degenerate source patch) to avoid dividing by ~0.
 */
export function colorTransfer(
  v: number, srcMean: number, srcStd: number, dstMean: number, dstStd: number,
): number {
  let out: number;
  if (srcStd < 1e-6) {
    out = v - srcMean + dstMean;
  } else {
    out = ((v - srcMean) / srcStd) * dstStd + dstMean;
  }
  return Math.max(0, Math.min(255, out));
}

/**
 * Bilinear sample of one RGBA channel from a flat RGBA buffer (stride 4).
 * `x`/`y` are in pixel coords (can be fractional); out-of-range coords clamp
 * to the nearest edge pixel.
 */
export function bilinearSample(
  data: Uint8Array | number[], w: number, h: number, x: number, y: number, ch: 0 | 1 | 2,
): number {
  const cx = Math.max(0, Math.min(w - 1, x));
  const cy = Math.max(0, Math.min(h - 1, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;

  const at = (px: number, py: number) => data[(py * w + px) * 4 + ch];

  const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx;
  const bot = at(x0, y1) * (1 - fx) + at(x1, y1) * fx;
  return top * (1 - fy) + bot * fy;
}
