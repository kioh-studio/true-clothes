// colorMatch — map an arbitrary RGB to the nearest controlled colour name (feature 007).
// Reuses the LAB math from colorLab.ts and the 37 controlled-colour swatches from vocab.
// Always returns a valid controlled colour (no silent fallback).

import { rgb2lab, LABColor } from './colorLab';
import { COLOR_SWATCH } from '../features/wardrobe-add/vocab';

export interface RGB { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// Precompute LAB for each controlled colour swatch once.
const SWATCH_LAB: Array<{ name: string; lab: LABColor }> = Object.entries(COLOR_SWATCH).map(
  ([name, hex]) => {
    const { r, g, b } = hexToRgb(hex);
    return { name, lab: rgb2lab(r, g, b) };
  },
);

function deltaE(a: LABColor, b: LABColor): number {
  // CIE76 — sufficient for nearest-swatch matching.
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

/** Nearest controlled colour name for an RGB (0–255). Defaults to 'Natural' only if input is invalid. */
export function colorMatch(rgb: RGB | undefined | null): string {
  if (!rgb) return 'Natural';
  const lab = rgb2lab(rgb.r, rgb.g, rgb.b);
  let best = SWATCH_LAB[0];
  let bestD = Infinity;
  for (const s of SWATCH_LAB) {
    const d = deltaE(lab, s.lab);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best.name;
}
