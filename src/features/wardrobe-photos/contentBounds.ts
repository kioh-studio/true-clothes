// Content-bounds measurement — locate a garment's tight bounding box inside
// a photo that may carry large empty background margins (real wardrobe
// photos, unlike the bundled catalog PNGs which are already tight-cropped).
// Pure TypeScript, zero RN/Expo imports, so it's importable from plain
// ts-jest/node without a device — mirrors collageLayout.ts's discipline.
// The uri → pixels wrapper (expo-image-manipulator + jpeg-js decode) lives
// in contentBoundsUri.ts, same split as colorCluster.ts / colorClusterUri.ts.
//
// Algorithm:
//   1. Estimate the background colour from the 1px border ring (per-channel
//      MEDIAN — robust to a stray content pixel touching the edge).
//   2. Classify every pixel as "content" when its Manhattan RGB distance
//      from the background exceeds CONTENT_DIST_THRESHOLD.
//   3. Bounding box over content pixels, plus a content-pixel count.
//   4. Bail out to null ("no usable crop, render the full frame") when the
//      content is too sparse (likely noise), already fills the frame
//      (cropping would be a no-op or wrong on a busy/full-bleed photo), or
//      the box is implausibly thin on either axis.
//   5. Otherwise pad the box by PAD on every side and report both the
//      normalized rect and the true pixel aspect ratio of the padded box.

export type ContentRect = { x: number; y: number; w: number; h: number }; // normalized 0..1
export type ContentMeasure = { rect: ContentRect; aspect: number };       // aspect = garment w/h

export const CONTENT_DIST_THRESHOLD = 60; // Manhattan RGB distance from bg → "content"
export const MIN_CONTENT_FRACTION = 0.01; // below this share of pixels → treat as noise
export const MAX_TIGHT_FRACTION = 0.96;   // box covers ≥96% of BOTH dims → already tight/busy
export const MIN_BOX_FRACTION = 0.04;     // box width/height below this share → too small
export const PAD = 0.02;                  // padding added on every side, as a fraction of each dim

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function measureContentBounds(data: Uint8Array, width: number, height: number): ContentMeasure | null {
  if (width <= 0 || height <= 0) return null;
  const totalPixels = width * height;

  // 1) Background colour = per-channel median of the 1px border ring.
  const borderR: number[] = [];
  const borderG: number[] = [];
  const borderB: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1) continue;
      const o = (y * width + x) * 4;
      borderR.push(data[o]);
      borderG.push(data[o + 1]);
      borderB.push(data[o + 2]);
    }
  }
  if (borderR.length === 0) return null;
  const bg = { r: median(borderR), g: median(borderG), b: median(borderB) };

  // 2) + 3) Classify pixels, track the bounding box + content count.
  let minX = width, minY = height, maxX = -1, maxY = -1, contentCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const dist = Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
      if (dist <= CONTENT_DIST_THRESHOLD) continue;
      contentCount++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // 4) Bail-out conditions.
  if (contentCount === 0) return null;
  if (contentCount < MIN_CONTENT_FRACTION * totalPixels) return null;

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  if (boxW / width >= MAX_TIGHT_FRACTION && boxH / height >= MAX_TIGHT_FRACTION) return null;
  if (boxW / width < MIN_BOX_FRACTION || boxH / height < MIN_BOX_FRACTION) return null;

  // 5) Pad by PAD (fraction of each dimension) on every side, clamp to the frame.
  const padX = PAD * width;
  const padY = PAD * height;
  const x0 = Math.max(0, minX - padX);
  const y0 = Math.max(0, minY - padY);
  const x1 = Math.min(width, maxX + 1 + padX);
  const y1 = Math.min(height, maxY + 1 + padY);

  const boxWpx = x1 - x0;
  const boxHpx = y1 - y0;
  if (boxWpx <= 0 || boxHpx <= 0) return null;

  return {
    rect: { x: x0 / width, y: y0 / height, w: boxWpx / width, h: boxHpx / height },
    aspect: boxWpx / boxHpx,
  };
}
