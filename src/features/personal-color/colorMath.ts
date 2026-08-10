// Pure colour-math helpers for personal-colour detection.
// NO native/Expo imports here — this file must be importable from Jest
// without a device (jpeg decoding / image manipulation live in analyzePhoto.ts).

export interface RGB { r: number; g: number; b: number }
export interface LAB { L: number; a: number; b: number }

// ── sRGB ↔ linear (per-channel) ─────────────────────────────────────────────

function linChannel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function delinChannel(c: number): number {
  // Inverse of linChannel: linear [0,1] → sRGB [0,255].
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return s * 255;
}

/** sRGB [0,255] → linear-light, scale [0,1] (the per-channel curve `rgbToLab`
 *  has always used internally, now exposed as its own step). */
export function srgbToLinear(rgb: RGB): { r: number; g: number; b: number } {
  return { r: linChannel(rgb.r), g: linChannel(rgb.g), b: linChannel(rgb.b) };
}

/** Inverse of `srgbToLinear`: linear-light [0,1] → sRGB [0,255] (unclamped —
 *  callers that need a valid pixel clamp the result themselves). */
export function linearToSrgb(lin: { r: number; g: number; b: number }): RGB {
  return { r: delinChannel(lin.r), g: delinChannel(lin.g), b: delinChannel(lin.b) };
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, n));
}

/** Flash/no-flash reflectance isolation (PLOS ONE method): linearize both
 *  frames, subtract per-channel in linear space (floored at 0 — the ambient
 *  frame should never be brighter than the flash frame in a correctly-lit
 *  capture, but sensor noise can nudge a channel negative), delinearize back
 *  to a normal 0–255 pixel. Cancels the ambient illuminant's colour cast,
 *  leaving (approximately) just the flash-lit reflectance. */
export function subtractAmbient(flash: RGB, ambient: RGB): RGB {
  const fl = srgbToLinear(flash);
  const al = srgbToLinear(ambient);
  const diff = {
    r: Math.max(0, fl.r - al.r),
    g: Math.max(0, fl.g - al.g),
    b: Math.max(0, fl.b - al.b),
  };
  const out = linearToSrgb(diff);
  return { r: clamp255(out.r), g: clamp255(out.g), b: clamp255(out.b) };
}

// ── sRGB (hex) → LAB (D65) ───────────────────────────────────────────────────

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToLab({ r, g, b }: RGB): LAB {
  const { r: R, g: G, b: B } = srgbToLinear({ r, g, b });
  // XYZ (D65)
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  X = f(X); Y = f(Y); Z = f(Z);
  return { L: 116 * Y - 16, a: 500 * (X - Y), b: 200 * (Y - Z) };
}

// ── Hue / gamut / undertone ──────────────────────────────────────────────────

/** Hue angle of the a/b chroma plane, in degrees, range [0, 360). */
export function labHueAngleDeg(lab: LAB): number {
  const deg = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  return deg < 0 ? deg + 360 : deg;
}

// CALIBRATION-PENDING: a generous skin gamut in LAB space — wide enough to
// admit most skin tones under varied lighting/flash, narrow enough to reject
// obvious non-skin pixels (background, fabric, deep shadow, near-glare).
export function isSkinPixelLab(lab: LAB): boolean {
  return lab.L >= 25 && lab.L <= 90
    && lab.a >= 2 && lab.a <= 32
    && lab.b >= 4 && lab.b <= 40;
}

// CALIBRATION-PENDING: skin b*/a* hue rises with yellowness (warmth), so we
// classify undertone by hue angle rather than raw a/b distance. Thresholds are
// chosen so typical golden skin (b≈22, a≈13 → ~59°) reads warm and rosy skin
// (b≈14, a≈15 → ~43°) reads cool; the band in between reads neutral.
export function classifyUndertone(lab: LAB): 'warm' | 'cool' | 'neutral' {
  const angle = labHueAngleDeg(lab);
  if (angle >= 57) return 'warm';
  if (angle <= 47) return 'cool';
  return 'neutral';
}

// ── ITA° (Individual Typology Angle) — the clinical skin-value metric ───────

/** ITA° = atan2(L*−50, b*)·180/π. Captures VALUE (light↔deep) only — it
 *  ignores a*, so undertone still comes from hue angle (`labHueAngleDeg`/
 *  `classifyUndertone`), not from this. */
export function itaDeg(lab: LAB): number {
  return Math.atan2(lab.L - 50, lab.b) * (180 / Math.PI);
}

// CALIBRATION-PENDING: piecewise-linear map of the published ITA° bands (>55
// very light, 41–55 light, 28–41 intermediate, 10–28 tan, −30–10 brown, <−30
// dark) onto the tone12 value axis, where +1 = full light pole and −1 = full
// deep pole (see tone12.ts's `ToneAxes` sign convention). The 7 anchor points
// below are evenly spaced in VALUE (1, 2/3, 1/3, 0, −1/3, −2/3, −1) — each
// gap corresponds to exactly one published band, so the six known bands map
// onto six equal steps of the axis rather than guessed spacing.
const ITA_ANCHORS: ReadonlyArray<readonly [ita: number, value: number]> = [
  [65, 1],
  [55, 2 / 3],
  [41, 1 / 3],
  [28, 0],
  [10, -1 / 3],
  [-30, -2 / 3],
  [-45, -1],
];

/** Maps a raw ITA° onto the tone12 value axis in [−1, 1] using the published
 *  band anchors above; clamps outside the [−45, 65] domain. */
export function itaToValueAxis(ita: number): number {
  const first = ITA_ANCHORS[0], last = ITA_ANCHORS[ITA_ANCHORS.length - 1];
  if (ita >= first[0]) return first[1];
  if (ita <= last[0]) return last[1];
  for (let i = 0; i < ITA_ANCHORS.length - 1; i++) {
    const [x0, y0] = ITA_ANCHORS[i];
    const [x1, y1] = ITA_ANCHORS[i + 1];
    if (ita <= x0 && ita >= x1) {
      const t = (ita - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 0; // unreachable — domain fully covered by the loop above
}

/** LAB chroma C*ab = sqrt(a² + b²) — colourfulness regardless of hue. */
export function chromaC(lab: LAB): number {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}

// ── Sclera white-reference correction ───────────────────────────────────────

// CALIBRATION-PENDING: gains outside this range mean the "sclera" sample was
// probably not a clean white reference (bloodshot, shadowed, blue-lit, or
// just a bad crop) — refusing the correction rather than applying an extreme
// per-channel gain protects the rest of the pipeline from being pushed off a
// cliff by a bad white-balance read.
const SCLERA_GAIN_MIN = 0.6;
const SCLERA_GAIN_MAX = 1.6;

/** Diagonal (von-Kries-style) white-balance gains derived from a set of
 *  sclera (eye-white) pixels: the mean linear RGB of the sample is compared
 *  to its own mean luminance, so a channel that reads darker than the
 *  average gets boosted toward neutral gray and vice-versa. Returns null
 *  (correction refused) if the sample is empty, degenerate (a mean channel
 *  at exactly 0), or any resulting gain falls outside [0.6, 1.6]. */
export function scleraGains(scleraPixels: RGB[]): { r: number; g: number; b: number } | null {
  if (scleraPixels.length === 0) return null;

  let sumR = 0, sumG = 0, sumB = 0;
  for (const px of scleraPixels) {
    const lin = srgbToLinear(px);
    sumR += lin.r; sumG += lin.g; sumB += lin.b;
  }
  const n = scleraPixels.length;
  const meanR = sumR / n, meanG = sumG / n, meanB = sumB / n;
  if (meanR <= 0 || meanG <= 0 || meanB <= 0) return null; // degenerate — can't safely divide

  const meanLum = (meanR + meanG + meanB) / 3;
  const gains = { r: meanLum / meanR, g: meanLum / meanG, b: meanLum / meanB };

  const outOfRange = [gains.r, gains.g, gains.b].some(
    (g) => g < SCLERA_GAIN_MIN || g > SCLERA_GAIN_MAX,
  );
  return outOfRange ? null : gains;
}

/** Applies diagonal white-balance gains (from `scleraGains`) to a pixel in
 *  linear space, then delinearizes and clamps back to a valid [0,255] pixel. */
export function applyGains(rgb: RGB, gains: { r: number; g: number; b: number }): RGB {
  const lin = srgbToLinear(rgb);
  const gained = { r: lin.r * gains.r, g: lin.g * gains.g, b: lin.b * gains.b };
  const out = linearToSrgb(gained);
  return { r: clamp255(out.r), g: clamp255(out.g), b: clamp255(out.b) };
}

// ── Aggregation helpers ──────────────────────────────────────────────────────

export function averageLab(labs: LAB[]): LAB | null {
  if (labs.length === 0) return null;
  let L = 0, a = 0, b = 0;
  for (const lab of labs) { L += lab.L; a += lab.a; b += lab.b; }
  const n = labs.length;
  return { L: L / n, a: a / n, b: b / n };
}

/** Sort by lightness ascending, return the darkest `frac` fraction of samples. */
export function darkestFraction(labs: LAB[], frac: number): LAB[] {
  const sorted = [...labs].sort((x, y) => x.L - y.L);
  const count = Math.ceil(sorted.length * frac);
  return sorted.slice(0, count);
}

/** Nearest swatch by full-LAB squared distance, plus a confidence margin —
 *  1 minus the ratio of the nearest to the second-nearest distance. Higher
 *  margin = a clearer winner; 0 when there's no runner-up or it's a dead tie. */
export function nearestSwatch<T extends string>(
  lab: LAB,
  swatches: Array<{ key: T; lab: LAB }>,
): { key: T; margin: number } | null {
  if (swatches.length === 0) return null;

  const dists = swatches
    .map(s => {
      const dL = lab.L - s.lab.L, da = lab.a - s.lab.a, db = lab.b - s.lab.b;
      return { key: s.key, d: dL * dL + da * da + db * db };
    })
    .sort((x, y) => x.d - y.d);

  if (dists.length === 1) return { key: dists[0].key, margin: 0 };

  const [d1, d2] = dists;
  const margin = d2.d === 0 ? 0 : 1 - d1.d / d2.d;
  return { key: d1.key, margin };
}
