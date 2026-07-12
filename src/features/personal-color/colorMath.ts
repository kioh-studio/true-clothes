// Pure colour-math helpers for personal-colour detection.
// NO native/Expo imports here — this file must be importable from Jest
// without a device (jpeg decoding / image manipulation live in analyzePhoto.ts).

export interface RGB { r: number; g: number; b: number }
export interface LAB { L: number; a: number; b: number }

// ── sRGB (hex) → LAB (D65) ───────────────────────────────────────────────────

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToLab({ r, g, b }: RGB): LAB {
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
