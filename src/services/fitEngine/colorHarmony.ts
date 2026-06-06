import { ColorProfile, FitItem, PrimaryColor } from '../../types/fitEngine';
import { colorProfileOf } from './itemClassifier';

// ─── Color Harmony Scorer (HSL-based) ───────────────────────────────────────
// Uses continuous HSL values stored on each item's ColorProfile for:
//   - Color wheel relationships (complementary, analogous, clashing)
//   - Undertone consistency (warm/cool matching)
//   - Lightness contrast (2–3 levels preferred)
//   - Saturation consistency (accent rule)
//   - Color count (3-color rule)
//   - Graphic density
//   - Palette alignment

function hueDifference(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

// ─── Color wheel relationships using HSL hue values ─────────────────────────
// Now uses continuous hue angles instead of a discrete lookup table.
function colorRelationshipScore(profiles: ColorProfile[]): number {
  // Separate chromatic items (have hue) from achromatic (black/white/gray)
  const chromatic = profiles.filter(p => p.hue !== undefined);
  if (chromatic.length <= 1) return 0.9; // all neutrals or single color = safe

  const hues = chromatic.map(p => p.hue!);

  let totalScore = 0;
  let pairs = 0;
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const diff = hueDifference(hues[i], hues[j]);
      let pairScore: number;
      if (diff <= 30) pairScore = 1.0;         // analogous — harmonious
      else if (diff <= 50) pairScore = 0.85;    // near-analogous — still good
      else if (diff >= 150 && diff <= 180) pairScore = 0.9; // complementary — energetic
      else if (diff >= 120 && diff < 150) pairScore = 0.7;  // triadic zone — can work
      else if (diff >= 60 && diff < 120) pairScore = 0.4;   // clashing zone
      else pairScore = 0.65;                     // split-complementary — moderate
      totalScore += pairScore;
      pairs++;
    }
  }
  return pairs > 0 ? totalScore / pairs : 0.8;
}

// ─── Undertone consistency (warm/cool) ──────────────────────────────────────
// Warm colors with warm, cool with cool. Mixing undertones = unintentional clash.
function undertoneConsistency(profiles: ColorProfile[]): number {
  const tones = profiles.map(p => p.undertone).filter(t => t !== 'neutral');
  if (tones.length <= 1) return 1.0; // all neutral or single tone = fine

  const warm = tones.filter(t => t === 'warm').length;
  const cool = tones.filter(t => t === 'cool').length;
  const total = tones.length;

  // Mostly one undertone = good
  const dominantRatio = Math.max(warm, cool) / total;
  if (dominantRatio >= 0.85) return 1.0;    // nearly pure warm or cool
  if (dominantRatio >= 0.65) return 0.75;   // mostly consistent
  return 0.45;                               // mixed warm and cool = clash
}

// ─── Lightness contrast using continuous HSL lightness ──────────────────────
// Good outfits have 2–3 distinct lightness zones.
function lightnessContrast(profiles: ColorProfile[]): number {
  const lums = profiles.map(p => p.lum);
  const min = Math.min(...lums);
  const max = Math.max(...lums);
  const range = max - min;

  if (range < 15) return 0.5;       // monotone — too flat
  if (range <= 50) return 1.0;      // good contrast
  if (range <= 70) return 0.85;     // strong contrast — can be dramatic
  return 0.7;                        // extreme range (near-white + near-black)
}

// ─── Saturation consistency ─────────────────────────────────────────────────
// Penalize only when vivid items are >40% of outfit.
// A single vivid accent in a muted outfit = intentional and good.
function saturationConsistency(profiles: ColorProfile[]): number {
  const total = profiles.length;
  if (total === 0) return 1.0;

  const sats = profiles.map(p => p.sat);
  const highSat = sats.filter(s => s >= 60).length;  // vivid threshold
  const lowSat = sats.filter(s => s <= 30).length;   // muted threshold

  if (highSat === 0 || lowSat === 0) return 1.0; // uniform saturation

  const vividRatio = highSat / total;
  if (vividRatio <= 0.25) return 1.0;   // 1 vivid accent = great
  if (vividRatio <= 0.40) return 0.8;   // moderate vivid presence
  return 0.5;                            // too much vivid mixed with muted
}

// ─── Color count (3-color rule) ─────────────────────────────────────────────
function colorCountScore(profiles: ColorProfile[]): number {
  const distinct = new Set(profiles.map(p => p.primaryColor)).size;
  if (distinct <= 3) return 1.0;
  if (distinct === 4) return 0.7;
  return 0.4;
}

// ─── Palette alignment ──────────────────────────────────────────────────────
function paletteAlignment(profiles: ColorProfile[], userPrimaries: Set<PrimaryColor>): number {
  if (userPrimaries.size === 0) return 0.5;
  const matches = profiles.filter(p => userPrimaries.has(p.primaryColor)).length;
  return matches / profiles.length;
}

// ─── Graphic density ────────────────────────────────────────────────────────
function graphicDensityPenalty(items: FitItem[]): number {
  const heavy = items.filter(
    i => i.graphics.graphicWeight === 'large_graphic' || i.graphics.graphicWeight === 'full_print',
  ).length;
  return heavy > 1 ? 0.5 : 1.0;
}

// ─── Main scorer ────────────────────────────────────────────────────────────

export function scoreColorHarmony(
  items: FitItem[],
  userColorPreferences: string[],
): number {
  if (items.length === 0) return 0.5;

  const profiles = items.map(i => i.colorProfile);

  const userPrimaries = new Set<PrimaryColor>(
    userColorPreferences.map(name => colorProfileOf(name).primaryColor),
  );

  const alignment    = paletteAlignment(profiles, userPrimaries);
  const relationship = colorRelationshipScore(profiles);
  const undertone    = undertoneConsistency(profiles);
  const contrast     = lightnessContrast(profiles);
  const saturation   = saturationConsistency(profiles);
  const colorCount   = colorCountScore(profiles);
  const graphic      = graphicDensityPenalty(items);

  return (
    0.20 * alignment +
    0.20 * relationship +
    0.15 * undertone +
    0.15 * contrast +
    0.10 * saturation +
    0.10 * colorCount +
    0.10 * graphic
  );
}
