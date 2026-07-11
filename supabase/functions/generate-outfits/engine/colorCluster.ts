// Measured-hex color layer (2026-07-06) — deterministic dominant-colour
// extraction from raw RGBA pixels. Pure (no I/O, no image decoding, no RNG)
// so it's unit-testable with synthetic pixel arrays; callers (generate-item-
// image, backfill-item-metadata) own decoding the actual image bytes and pass
// in the resulting bitmap. Lives in engine/ so every edge function can import
// it (mirrors the existing cross-function import precedent — e.g.
// wardrobe-critic imports from generate-outfits/engine/*).
//
// DUPLICATED on the client as src/features/wardrobe-add/colorCluster.ts (the
// on-device extract-by-item path computes hex at ingest) — keep the two in
// sync manually, same convention as TONE12_AVOID (client can't import a
// Deno-only file; this file can't import an RN module).
//
// Algorithm (CALIBRATION-PENDING thresholds — tune against real photos later):
//   1. Sample every Nth pixel, capped at ~4000 samples, for speed on large images.
//   2. Drop background/shadow pixels: near-transparent, near-white, near-black —
//      isolated product photos are shot on a plain bg/keyed to transparency, and
//      shadow/highlight pixels aren't the garment's real colour.
//   3. Quantize surviving pixels to a coarse grid (>>4 per channel = 16 buckets/
//      channel) and histogram — find the most popular bucket.
//   4. "Primary" colour = the AVERAGE (not bucket center) of every sampled pixel
//      within a small Manhattan distance of that bucket's representative pixel —
//      keeps the result a real observed colour, not a quantization artifact.
//   5. Remove those pixels from the pool, repeat once for "secondary". Only
//      reported if its cluster is ≥15% of kept samples (else null — a
//      genuinely near-solid garment shouldn't get a fabricated 2nd colour).
//   6. Too few kept samples (<50, e.g. an almost-entirely-transparent/blank
//      image) → both null.

export interface DominantHexes {
  primaryHex: string | null;
  secondaryHex: string | null;
}

export interface DominantHexOptions {
  maxSamples?: number;
  minKeptSamples?: number;
  secondaryMinShare?: number; // fraction of kept samples the 2nd cluster needs
  clusterTolerance?: number;  // Manhattan RGB distance to join the top bucket's cluster
}

const DEFAULTS: Required<DominantHexOptions> = {
  maxSamples: 4000,
  minKeptSamples: 50,
  secondaryMinShare: 0.15,
  clusterTolerance: 32,
};

// CALIBRATION-PENDING: thresholds for "not real garment colour" pixels.
const ALPHA_MIN = 200;      // below this → treated as background/edge-feather
const NEAR_WHITE_MIN = 238; // min(r,g,b) above this → near-white bg/highlight
const NEAR_BLACK_MAX = 18;  // max(r,g,b) below this → near-black shadow/bg

interface Pixel { r: number; g: number; b: number }

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const h = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function manhattan(a: Pixel, b: Pixel): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

/**
 * Deterministic dominant-colour extraction over raw RGBA pixels.
 * `pixels` is a flat RGBA buffer of length width*height*4 (0-255 per channel).
 */
export function dominantHexes(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  opts?: DominantHexOptions,
): DominantHexes {
  const cfg = { ...DEFAULTS, ...opts };
  const totalPixels = width * height;
  if (totalPixels <= 0) return { primaryHex: null, secondaryHex: null };

  const stride = Math.max(1, Math.floor(totalPixels / cfg.maxSamples));

  const kept: Pixel[] = [];
  for (let i = 0; i < totalPixels; i += stride) {
    const o = i * 4;
    const a = pixels[o + 3];
    if (a < ALPHA_MIN) continue;
    const r = pixels[o], g = pixels[o + 1], b = pixels[o + 2];
    if (Math.min(r, g, b) > NEAR_WHITE_MIN) continue; // near-white
    if (Math.max(r, g, b) < NEAR_BLACK_MAX) continue; // near-black
    kept.push({ r, g, b });
  }

  if (kept.length < cfg.minKeptSamples) return { primaryHex: null, secondaryHex: null };

  const extractCluster = (pool: Pixel[]): { hex: string; clusterSize: number; rest: Pixel[] } | null => {
    if (pool.length === 0) return null;

    // Quantize to a coarse grid (>>4 per channel ≈ 16 buckets/channel) and
    // histogram to find the most popular bucket's representative pixel.
    const buckets = new Map<string, { count: number; sum: Pixel }>();
    for (const p of pool) {
      const key = `${p.r >> 4}_${p.g >> 4}_${p.b >> 4}`;
      const entry = buckets.get(key);
      if (entry) {
        entry.count++;
        entry.sum.r += p.r; entry.sum.g += p.g; entry.sum.b += p.b;
      } else {
        buckets.set(key, { count: 1, sum: { ...p } });
      }
    }
    let topKey: string | null = null;
    let topCount = -1;
    for (const [key, entry] of buckets) {
      if (entry.count > topCount) { topCount = entry.count; topKey = key; }
    }
    if (topKey === null) return null;
    const top = buckets.get(topKey)!;
    const bucketAvg: Pixel = {
      r: top.sum.r / top.count, g: top.sum.g / top.count, b: top.sum.b / top.count,
    };

    // Average every pixel within tolerance of the bucket's average — the real
    // reported colour, not the quantized bucket center.
    let sr = 0, sg = 0, sb = 0, n = 0;
    const rest: Pixel[] = [];
    for (const p of pool) {
      if (manhattan(p, bucketAvg) <= cfg.clusterTolerance) {
        sr += p.r; sg += p.g; sb += p.b; n++;
      } else {
        rest.push(p);
      }
    }
    if (n === 0) return null;
    return { hex: toHex(sr / n, sg / n, sb / n), clusterSize: n, rest };
  };

  const primary = extractCluster(kept);
  if (!primary) return { primaryHex: null, secondaryHex: null };

  const secondary = extractCluster(primary.rest);
  const secondaryHex =
    secondary && secondary.clusterSize / kept.length >= cfg.secondaryMinShare
      ? secondary.hex
      : null;

  return { primaryHex: primary.hex, secondaryHex };
}
