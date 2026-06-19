// Pure color-math utilities for personal colour detection.
// No React, no RN dependencies — safe to unit-test in Node.

export interface RGBPixel { r: number; g: number; b: number }
export interface LABColor  { L: number; a: number; b: number }

// RGB (0–255) → CIE L*a*b* (D65 illuminant)
export function rgb2lab(r: number, g: number, b: number): LABColor {
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? ((R + 0.055) / 1.055) ** 2.4 : R / 12.92;
  G = G > 0.04045 ? ((G + 0.055) / 1.055) ** 2.4 : G / 12.92;
  B = B > 0.04045 ? ((B + 0.055) / 1.055) ** 2.4 : B / 12.92;

  // D65 illuminant
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.00000;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;

  function f(t: number) { return t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116; }
  return { L: 116 * f(Y) - 16, a: 500 * (f(X) - f(Y)), b: 200 * (f(Y) - f(Z)) };
}

// Correct for LED rear-flash white-balance shift.
// flashRgb is the measured colour of a neutral white patch under the flash.
export function applyFlashCorrection(pixels: RGBPixel[], flashRgb: RGBPixel): RGBPixel[] {
  const scaleR = 128 / flashRgb.r;
  const scaleG = 128 / flashRgb.g;
  const scaleB = 128 / flashRgb.b;
  return pixels.map(p => ({
    r: Math.min(255, Math.round(p.r * scaleR)),
    g: Math.min(255, Math.round(p.g * scaleG)),
    b: Math.min(255, Math.round(p.b * scaleB)),
  }));
}

// Sample pixels from the centre of an image (flat RGBA byte array, row-major).
export function sampleCenter(
  width: number, height: number, rgba: Uint8Array, radiusFrac = 0.25,
): RGBPixel[] {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const rx = Math.floor(width * radiusFrac);
  const ry = Math.floor(height * radiusFrac);
  const pixels: RGBPixel[] = [];
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const i = (y * width + x) * 4;
      pixels.push({ r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
    }
  }
  return pixels;
}

// Classify skin undertone from sampled wrist pixels.
// Returns 'warm', 'cool', or 'neutral'.
export function classifyUndertone(pixels: RGBPixel[]): 'warm' | 'cool' | 'neutral' {
  if (pixels.length === 0) return 'neutral';
  const labs = pixels.map(p => rgb2lab(p.r, p.g, p.b));
  const avgA = labs.reduce((s, l) => s + l.a, 0) / labs.length; // +a = reddish/warm
  const avgB = labs.reduce((s, l) => s + l.b, 0) / labs.length; // +b = yellow/warm
  const warmScore = avgA * 0.4 + avgB * 0.6;
  if (warmScore > 4) return 'warm';
  if (warmScore < -4) return 'cool';
  return 'neutral';
}

// Classify hair shade and warmth from sampled hair-root pixels.
export function classifyHair(pixels: RGBPixel[]): { shade: 'light' | 'medium' | 'dark'; warmth: 'warm' | 'cool' } {
  if (pixels.length === 0) return { shade: 'medium', warmth: 'cool' };
  const labs = pixels.map(p => rgb2lab(p.r, p.g, p.b));
  const avgL = labs.reduce((s, l) => s + l.L, 0) / labs.length;
  const avgB = labs.reduce((s, l) => s + l.b, 0) / labs.length;
  const shade = avgL > 60 ? 'light' : avgL > 35 ? 'medium' : 'dark';
  const warmth = avgB > 2 ? 'warm' : 'cool';
  return { shade, warmth };
}
