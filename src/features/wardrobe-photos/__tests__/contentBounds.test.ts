// Jest suite for the pure content-bounds crop measurement (contentBounds.ts)
// — locating a garment's tight bounding box inside a photo that may carry
// large background margins. Synthetic RGBA fixtures only, no device/Expo.

import {
  measureContentBounds,
  PAD,
  type ContentMeasure,
} from '../contentBounds';

const W = 64, H = 64;

// Build a flat RGBA buffer: a solid background colour everywhere, with a
// filled rectangle of a distinct colour at [rectX, rectY, rectW, rectH]
// (pixel coords, inclusive of rectW/rectH pixels starting at rectX/rectY).
function makeImage(
  bg: [number, number, number],
  rect: { x: number; y: number; w: number; h: number } | null,
  color: [number, number, number],
  width = W,
  height = H,
): Uint8Array {
  const buf = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const inRect = rect != null
        && x >= rect.x && x < rect.x + rect.w
        && y >= rect.y && y < rect.y + rect.h;
      const [r, g, b] = inRect ? color : bg;
      buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
    }
  }
  return buf;
}

// Expected padded box, computed the same way measureContentBounds does, so
// the assertions verify the fixture lands where the algorithm should place
// it (not just "close to the raw unpadded rect").
function expectedMeasure(
  rect: { x: number; y: number; w: number; h: number },
  width = W,
  height = H,
): ContentMeasure {
  const minX = rect.x, maxX = rect.x + rect.w - 1;
  const minY = rect.y, maxY = rect.y + rect.h - 1;
  const padX = PAD * width;
  const padY = PAD * height;
  const x0 = Math.max(0, minX - padX);
  const y0 = Math.max(0, minY - padY);
  const x1 = Math.min(width, maxX + 1 + padX);
  const y1 = Math.min(height, maxY + 1 + padY);
  const boxWpx = x1 - x0;
  const boxHpx = y1 - y0;
  return {
    rect: { x: x0 / width, y: y0 / height, w: boxWpx / width, h: boxHpx / height },
    aspect: boxWpx / boxHpx,
  };
}

const TOL = 1 / 64 + PAD; // 1px/64 quantization slack + the pad itself

function closeTo(a: number, b: number, tol = TOL) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
}

describe('measureContentBounds', () => {
  it('white background + centered dark rect → rect ≈ known position, aspect ≈ rectW/rectH', () => {
    const rect = { x: 22, y: 17, w: 20, h: 30 };
    const img = makeImage([255, 255, 255], rect, [10, 10, 10]);
    const measure = measureContentBounds(img, W, H);
    expect(measure).not.toBeNull();
    const expected = expectedMeasure(rect);
    closeTo(measure!.rect.x, expected.rect.x);
    closeTo(measure!.rect.y, expected.rect.y);
    closeTo(measure!.rect.w, expected.rect.w);
    closeTo(measure!.rect.h, expected.rect.h);
    // The 2% pad is applied per-axis in pixels, so for a non-square rect the
    // padded aspect only ≈ the raw rectW/rectH, not exactly — compare
    // against the same padded-box formula for an exact check instead.
    closeTo(measure!.aspect, expected.aspect, 1e-6);
  });

  it('black background (flattened transparency) + light rect → rect ≈ known position, aspect ≈ rectW/rectH', () => {
    const rect = { x: 10, y: 30, w: 40, h: 15 };
    const img = makeImage([0, 0, 0], rect, [230, 230, 230]);
    const measure = measureContentBounds(img, W, H);
    expect(measure).not.toBeNull();
    const expected = expectedMeasure(rect);
    closeTo(measure!.rect.x, expected.rect.x);
    closeTo(measure!.rect.y, expected.rect.y);
    closeTo(measure!.rect.w, expected.rect.w);
    closeTo(measure!.rect.h, expected.rect.h);
    closeTo(measure!.aspect, expected.aspect, 1e-6);
  });

  it('full-bleed content (≥96% of both dims) → null (already tight / busy background)', () => {
    // Content fills everything but a 1px border ring — 62/64 ≈ 96.9% both axes.
    const rect = { x: 1, y: 1, w: 62, h: 62 };
    const img = makeImage([255, 255, 255], rect, [10, 10, 10]);
    expect(measureContentBounds(img, W, H)).toBeNull();
  });

  it('blank frame (no content pixels) → null', () => {
    const img = makeImage([200, 200, 200], null, [0, 0, 0]);
    expect(measureContentBounds(img, W, H)).toBeNull();
  });

  it('tiny speck (<1% of pixels) → null', () => {
    // 5x5 = 25px out of 4096 (0.61%), below the 1% MIN_CONTENT_FRACTION floor.
    const rect = { x: 30, y: 30, w: 5, h: 5 };
    const img = makeImage([255, 255, 255], rect, [10, 10, 10]);
    expect(measureContentBounds(img, W, H)).toBeNull();
  });
});
