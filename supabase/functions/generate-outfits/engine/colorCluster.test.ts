// Deno test suite for colorCluster.ts — deterministic dominant-hex extraction.
// Run: deno test supabase/functions/generate-outfits/engine/

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { dominantHexes } from './colorCluster.ts';

// Build a flat RGBA buffer for a W×H image where each pixel is chosen by `pick`.
function makeImage(
  width: number,
  height: number,
  pick: (x: number, y: number) => [number, number, number, number],
): Uint8Array {
  const buf = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const [r, g, b, a] = pick(x, y);
      buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = a;
    }
  }
  return buf;
}

const NAVY: [number, number, number] = [30, 40, 80];

Deno.test('dominantHexes — solid navy image → primary ≈ navy, secondary null', () => {
  const W = 40, H = 40;
  const img = makeImage(W, H, () => [...NAVY, 255]);
  const { primaryHex, secondaryHex } = dominantHexes(img, W, H);
  assertEquals(primaryHex, '#1e2850');
  assertEquals(secondaryHex, null);
});

Deno.test('dominantHexes — 70/30 two-colour image → both returned, primary is the majority', () => {
  const W = 20, H = 10; // 200 px total
  const RED: [number, number, number] = [200, 30, 30];
  const GREENC: [number, number, number] = [30, 160, 60];
  // First 70% of rows (row-major) red, remaining 30% green.
  const threshold = Math.floor(W * H * 0.7);
  const img = makeImage(W, H, (x, y) => {
    const idx = y * W + x;
    const [r, g, b] = idx < threshold ? RED : GREENC;
    return [r, g, b, 255];
  });
  const { primaryHex, secondaryHex } = dominantHexes(img, W, H);
  assertEquals(primaryHex, '#c81e1e');
  assertEquals(secondaryHex, '#1ea03c');
});

Deno.test('dominantHexes — all-white image → both null (background, no garment colour)', () => {
  const W = 30, H = 30;
  const img = makeImage(W, H, () => [255, 255, 255, 255]);
  const { primaryHex, secondaryHex } = dominantHexes(img, W, H);
  assertEquals(primaryHex, null);
  assertEquals(secondaryHex, null);
});

Deno.test('dominantHexes — all-transparent image → both null (too few kept samples)', () => {
  const W = 30, H = 30;
  const img = makeImage(W, H, () => [0, 0, 0, 0]);
  const { primaryHex, secondaryHex } = dominantHexes(img, W, H);
  assertEquals(primaryHex, null);
  assertEquals(secondaryHex, null);
});

Deno.test('dominantHexes — tiny secondary cluster (<15%) is dropped, not reported', () => {
  const W = 20, H = 10; // 200 px
  const BLUE: [number, number, number] = [40, 60, 200];
  const FLECK: [number, number, number] = [200, 200, 40]; // < 15% of pixels
  const flecks = Math.floor(W * H * 0.05);
  const img = makeImage(W, H, (x, y) => {
    const idx = y * W + x;
    const [r, g, b] = idx < flecks ? FLECK : BLUE;
    return [r, g, b, 255];
  });
  const { primaryHex, secondaryHex } = dominantHexes(img, W, H);
  assertEquals(primaryHex, '#283cc8');
  assertEquals(secondaryHex, null);
});

Deno.test('dominantHexes — 0×0 image is degenerate, returns nulls without throwing', () => {
  const { primaryHex, secondaryHex } = dominantHexes(new Uint8Array(0), 0, 0);
  assertEquals(primaryHex, null);
  assertEquals(secondaryHex, null);
});
