// On-device colour analysis for the personal-colour camera path.
// Reads the dominant tone from the wrist / hair photo and maps it to the quiz's
// controlled options (so the camera ACTUALLY contributes, not just decorates).
//
// Pipeline (all on-device, no remote AI): expo-image-manipulator downscales the
// photo to a tiny tile → jpeg-js decodes it to RGBA → we average the central
// region (trimming near-black shadow and blown-out flash glare) → convert to LAB
// → nearest controlled swatch. LAB is used so matching is perceptual; for skin
// we compare only the a*/b* chroma plane (ignoring lightness) because phone
// auto-white-balance shifts brightness far more than hue.
//
// Every step is wrapped so a failure returns null → the quiz simply stays manual.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { SKIN_OPTIONS, HAIR_OPTIONS, type SkinOption } from './colorSeasonData';

interface RGB { r: number; g: number; b: number }
interface LAB { L: number; a: number; b: number }

// ── base64 JPEG → RGBA ───────────────────────────────────────────────────────

function decodeJpeg(base64: string): { width: number; height: number; data: Uint8Array } {
  const bin = atob(base64); // Hermes provides atob on Expo 54
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // useTArray → return a Uint8Array (RN has no Node Buffer)
  return jpeg.decode(bytes, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
}

// Average the central 50% region; skip near-black (shadow/background) and
// near-white (flash glare) pixels so they don't drag the mean.
function averageCentralRGB(img: { width: number; height: number; data: Uint8Array }): RGB | null {
  const { width: W, height: H, data } = img;
  const x0 = Math.floor(W * 0.25), x1 = Math.ceil(W * 0.75);
  const y0 = Math.floor(H * 0.25), y1 = Math.ceil(H * 0.75);

  let r = 0, g = 0, b = 0, n = 0;
  let rAll = 0, gAll = 0, bAll = 0, nAll = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * W + x) * 4;
      const R = data[o], G = data[o + 1], B = data[o + 2];
      rAll += R; gAll += G; bAll += B; nAll++;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx < 25 || mn > 240) continue;
      r += R; g += G; b += B; n++;
    }
  }
  if (n >= 16) return { r: r / n, g: g / n, b: b / n };
  if (nAll > 0) return { r: rAll / nAll, g: gAll / nAll, b: bAll / nAll };
  return null;
}

// ── sRGB → LAB (D65) ─────────────────────────────────────────────────────────

function rgbToLab({ r, g, b }: RGB): LAB {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  // XYZ (D65)
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  X = f(X); Y = f(Y); Z = f(Z);
  return { L: 116 * Y - 16, a: 500 * (X - Y), b: 200 * (Y - Z) };
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Pre-compute swatch LABs once.
const SKIN_LAB = SKIN_OPTIONS.map((o) => ({ key: o.key, lab: rgbToLab(hexToRgb(o.swatchHex)) }));
const HAIR_LAB = HAIR_OPTIONS.map((o) => ({ key: o.key, lab: rgbToLab(hexToRgb(o.swatchHex)) }));

// ── Sampling ─────────────────────────────────────────────────────────────────

async function sampleAverageLab(uri: string): Promise<LAB | null> {
  try {
    const res = await manipulateAsync(uri, [{ resize: { width: 48, height: 48 } }], {
      base64: true, compress: 0.9, format: SaveFormat.JPEG,
    });
    if (!res.base64) return null;
    const rgb = averageCentralRGB(decodeJpeg(res.base64));
    return rgb ? rgbToLab(rgb) : null;
  } catch {
    return null; // any decode/manipulate failure → caller falls back to manual
  }
}

// ── Public: map a photo to a quiz option ─────────────────────────────────────

/** Wrist photo → skin undertone. Compares only the chroma plane (a, b) so it's
 *  robust to the brightness shifts phone auto-white-balance introduces. */
export async function analyzeWristUndertone(uri: string): Promise<SkinOption['key'] | null> {
  const lab = await sampleAverageLab(uri);
  if (!lab) return null;
  let best: SkinOption['key'] | null = null;
  let bestD = Infinity;
  for (const s of SKIN_LAB) {
    const da = lab.a - s.lab.a, db = lab.b - s.lab.b;
    const d = da * da + db * db;
    if (d < bestD) { bestD = d; best = s.key; }
  }
  return best;
}

/** Hair photo → nearest HAIR_OPTIONS key (full LAB — shade + warmth both matter). */
export async function analyzeHairColor(uri: string): Promise<string | null> {
  const lab = await sampleAverageLab(uri);
  if (!lab) return null;
  let best: string | null = null;
  let bestD = Infinity;
  for (const h of HAIR_LAB) {
    const dL = lab.L - h.lab.L, da = lab.a - h.lab.a, db = lab.b - h.lab.b;
    const d = dL * dL + da * da + db * db;
    if (d < bestD) { bestD = d; best = h.key; }
  }
  return best;
}
