// Pure RGBA frame helpers (no native/Expo imports so jest can test them).
//
// Live-tracking migration: every model reads an in-RAM RgbaImage instead of an
// image file, so frames never touch disk (PRIVACY) and the live loop and the dev
// replay share one code path.

import jpeg from 'jpeg-js';
import type { CropRect } from './cropMath';

/** Raw RGBA frame, 4 bytes per pixel, row-major, no padding. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Crop `rect` (source pixels; null = whole image) and bilinear-resize to tW×tH.
 * Sampling at pixel centres, src = (x+0.5)*scale − 0.5, clamped to the crop edges —
 * the closest match to Android createScaledBitmap(filter=true).
 */
export function cropResizeRgba(img: RgbaImage, rect: CropRect | null, tW: number, tH: number): RgbaImage {
  const ox = rect ? rect.originX : 0;
  const oy = rect ? rect.originY : 0;
  const cw = rect ? rect.width : img.width;
  const ch = rect ? rect.height : img.height;
  const sx = cw / tW;
  const sy = ch / tH;
  const src = img.data;
  const out = new Uint8Array(tW * tH * 4);

  // Per-column taps are shared by every row.
  const x0s = new Int32Array(tW), x1s = new Int32Array(tW), fxs = new Float32Array(tW);
  for (let x = 0; x < tW; x++) {
    const fx = Math.min(Math.max((x + 0.5) * sx - 0.5, 0), cw - 1);
    const i0 = Math.floor(fx);
    x0s[x] = (ox + i0) * 4;
    x1s[x] = (ox + Math.min(i0 + 1, cw - 1)) * 4;
    fxs[x] = fx - i0;
  }
  for (let y = 0; y < tH; y++) {
    const fy = Math.min(Math.max((y + 0.5) * sy - 0.5, 0), ch - 1);
    const j0 = Math.floor(fy);
    const wy = fy - j0;
    const r0 = (oy + j0) * img.width * 4;
    const r1 = (oy + Math.min(j0 + 1, ch - 1)) * img.width * 4;
    let o = y * tW * 4;
    for (let x = 0; x < tW; x++) {
      const a = x0s[x], b = x1s[x], wx = fxs[x];
      for (let c = 0; c < 4; c++) {
        const top = src[r0 + a + c] + (src[r0 + b + c] - src[r0 + a + c]) * wx;
        const bot = src[r1 + a + c] + (src[r1 + b + c] - src[r1 + a + c]) * wx;
        out[o++] = Math.round(top + (bot - top) * wy);
      }
    }
  }
  return { width: tW, height: tH, data: out };
}

/** Decode a base64-encoded JPEG to RGBA. Hermes provides atob. */
export function decodeJpegBase64(base64: string): RgbaImage {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const d = jpeg.decode(bytes, { useTArray: true });
  return { width: d.width, height: d.height, data: d.data as unknown as Uint8Array };
}
