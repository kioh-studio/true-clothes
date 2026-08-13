// All 7 scoring dimensions + anchor clarity + style catalog.
// Merges: colorHarmony, styleCoherence, fitMatcher, proportionBalance,
//         formalityConsistency, seasonMatch, textureHarmony, anchorClarity,
//         styleCatalog (for styleCoherence lookups).

import {
  FitItem, ColorProfile, PrimaryColor, BodyMeasurements, BodyShape,
  StyleAttributes, StyleDef, Mood, ColorPalette, Silhouette,
  FabricWeight, ItemFit, Season, FitPoint, FitCategory, ItemFitResult,
  TargetSilhouette, PreferredFit,
} from './types.ts';
import { colorProfileOf } from './enrichment.ts';
import { STYLE_CONFIGS } from './filtering.ts';
import { CLASSIC_TRIPLES, CLASHING_PAIRS } from './taste-data.ts';

// Colours that flatter each personal colour season.
// Keyed by undertone ('warm'/'cool') and lightness ('light'/'dark'/'vivid').
const SEASON_FLATTERING: Record<string, { undertones: string[]; avoid: string[] }> = {
  spring: {
    undertones: ['warm'],
    avoid: ['black', 'navy', 'burgundy', 'charcoal'],
  },
  summer: {
    undertones: ['cool'],
    avoid: ['orange', 'olive', 'mustard', 'rust'],
  },
  autumn: {
    undertones: ['warm'],
    avoid: ['black', 'navy', 'pink', 'fuchsia'],
  },
  winter: {
    undertones: ['cool'],
    avoid: ['orange', 'brown', 'beige', 'camel'],
  },
  // Belt-and-suspenders alias: 'fall' resolves to the same rules as 'autumn'.
  fall: {
    undertones: ['warm'],
    avoid: ['black', 'navy', 'pink', 'fuchsia'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLE CATALOG (data — will move to `styles` DB table)
// ═══════════════════════════════════════════════════════════════════════════

// Derived from STYLE_CONFIGS (filtering.ts) — single source of truth for
// style attributes/neighbors/popularity, no more drift between the two files.
const STYLE_CATALOG: StyleDef[] = STYLE_CONFIGS.map(c => ({
  id: c.id, name: c.name, popularity: c.popularity,
  attributes: c.attributes, neighbors: c.neighbors,
}));

export const styleById = (id: string): StyleDef | undefined =>
  STYLE_CATALOG.find(s => s.id === id);

// ═══════════════════════════════════════════════════════════════════════════
// 1. COLOR HARMONY
// ═══════════════════════════════════════════════════════════════════════════

function hueDifference(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

function colorRelationshipScore(profiles: ColorProfile[]): number {
  const chromatic = profiles.filter(p => p.hue !== undefined);
  if (chromatic.length <= 1) return 0.9;
  const hues = chromatic.map(p => p.hue!);
  let totalScore = 0, pairs = 0;
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const diff = hueDifference(hues[i], hues[j]);
      let pairScore: number;
      if (diff <= 30) pairScore = 1.0;
      else if (diff <= 50) pairScore = 0.85;
      else if (diff >= 150 && diff <= 180) pairScore = 0.9;
      else if (diff >= 120 && diff < 150) pairScore = 0.7;
      else if (diff >= 60 && diff < 120) pairScore = 0.4;
      else pairScore = 0.65;
      totalScore += pairScore; pairs++;
    }
  }
  return pairs > 0 ? totalScore / pairs : 0.8;
}

function undertoneConsistency(profiles: ColorProfile[]): number {
  const tones = profiles.map(p => p.undertone).filter(t => t !== 'neutral');
  if (tones.length <= 1) return 1.0;
  const warm = tones.filter(t => t === 'warm').length;
  const cool = tones.filter(t => t === 'cool').length;
  const dominantRatio = Math.max(warm, cool) / tones.length;
  if (dominantRatio >= 0.85) return 1.0;
  if (dominantRatio >= 0.65) return 0.75;
  return 0.45;
}

// Distinct tactile surfaces among the non-accessory items — the stylist's
// substitute for tonal contrast in a deliberate single-tone look.
function textureVariety(items: FitItem[]): number {
  const visible = items.filter(i => i.category !== 'accessory');
  return new Set(visible.map(i => i.fabricName ?? `${i.fabric.fabricWeight}_${i.fabric.pattern}`)).size;
}

function lightnessContrast(profiles: ColorProfile[], items?: FitItem[], formula?: string): number {
  const lums = profiles.map(p => p.lum);
  const range = Math.max(...lums) - Math.min(...lums);
  if (range < 15) {
    // Formula contract (monochrome): a tight tonal look is the CONCEPT, not a
    // failure — provided texture carries the interest instead ("varied by
    // texture and shade"). Same rule stylists apply to all-black dressing.
    if (formula === 'monochrome' && items && textureVariety(items) >= 2) return 0.85;
    return 0.5;
  }
  if (range <= 50) return 1.0;
  if (range <= 70) return 0.85;
  return 0.7;
}

function saturationConsistency(profiles: ColorProfile[]): number {
  if (profiles.length === 0) return 1.0;
  const highSat = profiles.filter(p => p.sat >= 60).length;
  const lowSat = profiles.filter(p => p.sat <= 30).length;
  if (highSat === 0 || lowSat === 0) return 1.0;
  const vividRatio = highSat / profiles.length;
  if (vividRatio <= 0.25) return 1.0;
  if (vividRatio <= 0.40) return 0.8;
  return 0.5;
}

function colorCountScore(profiles: ColorProfile[]): number {
  const distinct = new Set(profiles.map(p => p.primaryColor)).size;
  if (distinct <= 3) return 1.0;
  if (distinct === 4) return 0.7;
  return 0.4;
}

export function paletteAlignment(profiles: ColorProfile[], userPrimaries: Set<PrimaryColor>): number {
  if (userPrimaries.size === 0) return 0.5;
  const matches = profiles.filter(p => userPrimaries.has(p.primaryColor)).length;
  return matches / profiles.length;
}

function graphicDensityPenalty(items: FitItem[]): number {
  const heavy = items.filter(i => i.graphics.graphicWeight === 'large_graphic' || i.graphics.graphicWeight === 'full_print').length;
  return heavy > 1 ? 0.5 : 1.0;
}

/** Normalise season strings so both 'fall' and 'autumn' resolve to the same key. */
function normSeason(s: string): string {
  return s === 'fall' ? 'autumn' : s;
}

export function seasonCompatibilityBonus(profiles: ColorProfile[], colorSeason: string): number {
  const rule = SEASON_FLATTERING[normSeason(colorSeason)];
  if (!rule) return 0;
  const total = profiles.length;
  if (total === 0) return 0;

  let penaltyCount = 0;
  let undertoneMatchCount = 0;
  for (const p of profiles) {
    if (rule.avoid.includes(p.primaryColor)) penaltyCount++;
    if (rule.undertones.includes(p.undertone)) undertoneMatchCount++;
  }
  const penaltyRatio = penaltyCount / total;
  const matchRatio = undertoneMatchCount / total;
  // Small bonus/penalty: max ±0.10
  return matchRatio * 0.07 - penaltyRatio * 0.10;
}

// ── Weather-season colour nudge (distinct from personal colour season above) ──
// Convention: summer/spring favour LIGHT + BRIGHT colours; winter favours DARK
// (and tolerates DEEP/saturated); autumn favours darker, MUTED/earthy tones.
// Uses each colour's lightness (lum) and saturation (sat). Neutral-undertone
// staples (black/white/grey/charcoal) are season-agnostic and exempt. Capped at
// ±WEATHER_COLOR_MAX — slightly below the personal-season bonus so the user's
// own palette stays primary. Tunable.
const WEATHER_COLOR_MAX = 0.08;
const WEATHER_COLOR_PREF: Record<Season, { lum: number; sat: number }> = {
  summer:    { lum: 1.0,  sat: 0.6 },
  spring:    { lum: 0.8,  sat: 0.6 },
  fall:      { lum: -0.4, sat: -0.5 },
  winter:    { lum: -1.0, sat: 0.2 },
  allSeason: { lum: 0,    sat: 0 },
};

export function weatherSeasonColorBonus(profiles: ColorProfile[], weatherSeason: Season): number {
  const pref = WEATHER_COLOR_PREF[weatherSeason];
  if (!pref || (pref.lum === 0 && pref.sat === 0)) return 0;
  // Only chromatic (non-neutral) items carry a seasonal colour temperature.
  const chromatic = profiles.filter(p => p.undertone !== 'neutral');
  if (chromatic.length === 0) return 0;
  let total = 0;
  for (const p of chromatic) {
    const normLum = (p.lum - 50) / 50;   // -1 dark .. +1 light
    const normSat = (p.sat - 50) / 50;   // -1 muted .. +1 vivid
    const align = Math.max(-1, Math.min(1, pref.lum * normLum + pref.sat * normSat));
    total += align;
  }
  return (total / chromatic.length) * WEATHER_COLOR_MAX;
}

// ── 12-tone quality bonus (refines colorSeason with a lightness/clarity axis) ──
// The 4-way colorSeason (spring/summer/autumn/winter) already encodes undertone
// via seasonCompatibilityBonus above. The 12-tone system (color_tone12) adds an
// orthogonal QUALITY dimension per season — light_*/deep_*/bright_*/soft_*/true_*
// — describing which colour "temperature × depth × clarity" band actually
// flatters the person. This bonus scores that quality dimension alone (using lum
// for light/deep, sat for bright/soft), independent of undertone. 'true_*' has no
// extra quality signal beyond the parent season, so it is a no-op (0). Includes
// ALL items (unlike weatherSeasonColorBonus) — a neutral like black/white still
// reads unambiguously deep/light, which is exactly the signal this bonus needs.
// Magnitude CALIBRATION-PENDING: mirrors weatherSeasonColorBonus's structure and
// is capped at the same ±TONE12_QUALITY_MAX, keeping both "secondary" colour
// nudges in the same band and below the primary seasonCompatibilityBonus (±0.10).
const TONE12_QUALITY_MAX = 0.08;

type Tone12Quality = 'light' | 'deep' | 'bright' | 'soft' | 'true';
const TONE12_QUALITIES = new Set<Tone12Quality>(['light', 'deep', 'bright', 'soft', 'true']);

function tone12Quality(tone12: string): Tone12Quality | undefined {
  const prefix = tone12.split('_')[0]?.toLowerCase();
  return TONE12_QUALITIES.has(prefix as Tone12Quality) ? (prefix as Tone12Quality) : undefined;
}

// 12-tone "better to skip" colour lists — draft-curated by the design lead
// (2026-07-06). Same data as the client copy in
// src/features/personal-color/tone12.ts (TONE12_AVOID) — the two are
// duplicated across runtimes INTENTIONALLY (client can't import this Deno-only
// file; this file can't import a React Native module) and must stay in sync
// manually. Typed as PrimaryColor[] so a name outside the engine's vocabulary
// fails to compile here — the client reproduces the same drops via a runtime
// filter (tone12.ts). 'mustard'/'rust'/'fuchsia' entries below were dead code
// until the +11 vocabulary expansion (2026-07-06, types.ts) made them valid —
// they now fire for real.
export const TONE12_AVOID: Record<string, PrimaryColor[]> = {
  light_spring:  ['black', 'charcoal', 'burgundy', 'navy'],
  true_spring:   ['black', 'charcoal', 'burgundy', 'navy'],
  bright_spring: ['olive', 'beige', 'brown', 'charcoal'],
  light_summer:  ['orange', 'rust', 'mustard', 'camel', 'black'],
  true_summer:   ['orange', 'rust', 'mustard', 'olive', 'black'],
  soft_summer:   ['orange', 'rust', 'black', 'fuchsia'],
  soft_autumn:   ['black', 'fuchsia', 'pink', 'navy'],
  true_autumn:   ['black', 'navy', 'pink', 'fuchsia'],
  deep_autumn:   ['pink', 'fuchsia', 'navy'],
  bright_winter: ['beige', 'camel', 'mustard', 'olive', 'orange'],
  true_winter:   ['orange', 'brown', 'beige', 'camel', 'mustard'],
  deep_winter:   ['camel', 'orange', 'beige', 'mustard'],
};

// Deliberately below the parent-season penalty (seasonCompatibilityBonus,
// ±0.10) — the 12-tone skip-list refines the 4-season one, it doesn't outrank
// it. CALIBRATION-PENDING.
const TONE12_AVOID_MAX = 0.06;

// Additional penalty for items whose colour is on the tone12 skip-list but
// NOT already covered by the parent season's SEASON_FLATTERING.avoid — avoids
// double-penalising a colour the 4-season bonus already dings. Parent season
// is derived from the tone12 suffix after the first '_' (e.g. 'deep_autumn'
// → 'autumn'), independent of whether a colorSeason argument was passed.
export function tone12AvoidPenalty(profiles: ColorProfile[], tone12: string): number {
  const avoidList = TONE12_AVOID[tone12];
  if (!avoidList || avoidList.length === 0 || profiles.length === 0) return 0;

  const parentSeason = normSeason(tone12.split('_')[1] ?? '');
  const parentAvoid = new Set(SEASON_FLATTERING[parentSeason]?.avoid ?? []);
  const dedupedAvoid = new Set(avoidList.filter(c => !parentAvoid.has(c)));
  if (dedupedAvoid.size === 0) return 0;

  const dedupedAvoidCount = profiles.filter(p => dedupedAvoid.has(p.primaryColor)).length;
  if (dedupedAvoidCount === 0) return 0;

  return -(dedupedAvoidCount / profiles.length) * TONE12_AVOID_MAX;
}

export function tone12QualityBonus(profiles: ColorProfile[], tone12: string): number {
  const quality = tone12Quality(tone12);
  // Unknown/absent prefix or 'true' (undertone-only, no extra quality signal) → no-op.
  if (!quality || quality === 'true' || profiles.length === 0) return 0;

  let total = 0;
  for (const p of profiles) {
    const normLum = (p.lum - 50) / 50; // -1 dark .. +1 light
    const normSat = (p.sat - 50) / 50; // -1 muted .. +1 vivid
    let align: number;
    switch (quality) {
      case 'light':  align = normLum;  break; // reward light, mirror-penalise very deep
      case 'deep':   align = -normLum; break; // reward deep, mirror-penalise very light
      case 'bright': align = normSat;  break; // reward clear/saturated, penalise muted
      case 'soft':   align = -normSat; break; // reward muted, penalise very saturated
    }
    total += Math.max(-1, Math.min(1, align));
  }
  return (total / profiles.length) * TONE12_QUALITY_MAX;
}

export function scoreColorHarmony(
  items: FitItem[],
  userColorPreferences: string[],
  colorSeason?: string,
  weatherSeason?: Season,
  formula?: string,
  colorTone12?: string,
): number {
  if (items.length === 0) return 0.5;
  const profiles = items.map(i => i.colorProfile);
  const userPrimaries = new Set<PrimaryColor>(userColorPreferences.map(name => colorProfileOf(name).primaryColor));
  const base = (
    0.20 * paletteAlignment(profiles, userPrimaries) +
    0.20 * colorRelationshipScore(profiles) +
    0.15 * undertoneConsistency(profiles) +
    0.15 * lightnessContrast(profiles, items, formula) +
    0.10 * saturationConsistency(profiles) +
    0.10 * colorCountScore(profiles) +
    0.10 * graphicDensityPenalty(items)
  );
  if (!colorSeason && !weatherSeason && !colorTone12) return base;
  let result = base;
  if (colorSeason) result += seasonCompatibilityBonus(profiles, colorSeason);
  if (weatherSeason) result += weatherSeasonColorBonus(profiles, weatherSeason);
  if (colorTone12) {
    result += tone12QualityBonus(profiles, colorTone12);
    result += tone12AvoidPenalty(profiles, colorTone12);
  }
  return Math.max(0, Math.min(1, result));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. STYLE COHERENCE
// ═══════════════════════════════════════════════════════════════════════════

function numericSim(a: number, b: number): number { return Math.max(0, Math.min(1, 1 - Math.abs(a - b) / 4)); }

function jaccardSim<T>(a: T[], b: T[]): number {
  if (a.length === 0 && b.length === 0) return 1.0;
  const setA = new Set(a);
  const intersection = b.filter(x => setA.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1.0 : intersection / union;
}

export function attributeSimilarity(a: StyleAttributes, b: StyleAttributes): number {
  return (
    0.25 * numericSim(a.formality, b.formality) +
    0.25 * jaccardSim<Mood>(a.mood, b.mood) +
    0.20 * jaccardSim<Silhouette>(a.silhouette, b.silhouette) +
    0.15 * jaccardSim<ColorPalette>(a.colorPalette, b.colorPalette) +
    0.10 * numericSim(a.textureRichness, b.textureRichness) +
    0.05 * numericSim(a.patternLevel, b.patternLevel)
  );
}

export function computeUserAttributes(selectedStyles: string[]): StyleAttributes | undefined {
  if (selectedStyles.length === 0) return undefined;
  const defs = selectedStyles.map(id => styleById(id)).filter((d): d is StyleDef => d !== undefined);
  if (defs.length === 0) return undefined;

  const n = defs.length;
  const weights = defs.map((_, i) => Math.pow(0.8, n - 1 - i));
  const total = weights.reduce((s, w) => s + w, 0);

  const formality       = defs.reduce((s, d, i) => s + d.attributes.formality * weights[i], 0) / total;
  const patternLevel    = defs.reduce((s, d, i) => s + d.attributes.patternLevel * weights[i], 0) / total;
  const textureRichness = defs.reduce((s, d, i) => s + d.attributes.textureRichness * weights[i], 0) / total;

  const paletteScores: Record<string, number> = {};
  const silhouetteScores: Record<string, number> = {};
  const moodScores: Record<string, number> = {};

  defs.forEach((d, i) => {
    const w = weights[i] / total;
    d.attributes.colorPalette.forEach(v => { paletteScores[v] = (paletteScores[v] ?? 0) + w; });
    d.attributes.silhouette.forEach(v => { silhouetteScores[v] = (silhouetteScores[v] ?? 0) + w; });
    d.attributes.mood.forEach(v => { moodScores[v] = (moodScores[v] ?? 0) + w; });
  });

  return {
    formality, patternLevel, textureRichness,
    colorPalette: Object.entries(paletteScores).filter(([, s]) => s > 0.15).map(([v]) => v) as ColorPalette[],
    silhouette:   Object.entries(silhouetteScores).filter(([, s]) => s > 0.15).map(([v]) => v) as Silhouette[],
    mood:         Object.entries(moodScores).filter(([, s]) => s > 0.15).map(([v]) => v) as Mood[],
  };
}

function itemAttributes(item: FitItem): StyleAttributes | null {
  const defs = item.styleTags.slice(0, 2).map(id => styleById(id)).filter((d): d is StyleDef => d !== undefined);
  if (defs.length === 0) return null;

  const weights = defs.map((_, i) => (i === 0 ? 3 : 1));
  const total = weights.reduce((s, w) => s + w, 0);

  const formality       = defs.reduce((s, d, i) => s + d.attributes.formality * weights[i], 0) / total;
  const patternLevel    = defs.reduce((s, d, i) => s + d.attributes.patternLevel * weights[i], 0) / total;
  const textureRichness = defs.reduce((s, d, i) => s + d.attributes.textureRichness * weights[i], 0) / total;

  const primaryPalettes    = defs[0]?.attributes.colorPalette ?? [];
  const primarySilhouettes = defs[0]?.attributes.silhouette ?? [];
  const primaryMoods       = defs[0]?.attributes.mood ?? [];
  const primaryPaletteSet    = new Set(primaryPalettes);
  const primarySilhouetteSet = new Set(primarySilhouettes);
  const primaryMoodSet       = new Set(primaryMoods);

  return {
    formality, patternLevel, textureRichness,
    colorPalette: [...new Set([...primaryPalettes, ...(defs[1]?.attributes.colorPalette.filter(v => primaryPaletteSet.has(v)) ?? [])])] as ColorPalette[],
    silhouette:   [...new Set([...primarySilhouettes, ...(defs[1]?.attributes.silhouette.filter(v => primarySilhouetteSet.has(v)) ?? [])])] as Silhouette[],
    mood:         [...new Set([...primaryMoods, ...(defs[1]?.attributes.mood.filter(v => primaryMoodSet.has(v)) ?? [])])] as Mood[],
  };
}

export function scoreStyleCoherence(items: FitItem[], userProfile: StyleAttributes, userSelectedStyles?: string[]): number {
  const attrs = items.map(itemAttributes).filter((a): a is StyleAttributes => a !== null);
  if (attrs.length === 0) return 0.5;

  const baseSim = attrs.reduce((s, a) => s + attributeSimilarity(userProfile, a), 0) / attrs.length;

  if (userSelectedStyles && userSelectedStyles.length > 0) {
    const userSet = new Set(userSelectedStyles);
    let directMatches = 0;
    for (const item of items) {
      if (item.styleTags.some(tag => userSet.has(tag))) directMatches++;
    }
    return 0.70 * baseSim + 0.30 * (directMatches / items.length);
  }
  return baseSim;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. FIT MATCHER
// ═══════════════════════════════════════════════════════════════════════════

interface Thresholds { ideal: [number, number]; ok: [number, number] }

const FIT_THRESHOLDS: Record<string, Thresholds> = {
  chest:           { ideal: [2,  6],  ok: [0,  12] },
  shoulder_width:  { ideal: [0,  3],  ok: [-1,  5] },
  waist_top:       { ideal: [2,  6],  ok: [0,  10] },
  waist:           { ideal: [2,  6],  ok: [0,  10] },
  waist_outer:     { ideal: [4,  8],  ok: [0,  14] },
  hip:             { ideal: [4,  8],  ok: [0,  15] },
  upper_arm:       { ideal: [2,  5],  ok: [0,   8] },
  sleeves:         { ideal: [-1, 2],  ok: [-3,   4] },
  body_length:     { ideal: [0,  5],  ok: [-3,  10] },
  inseam:          { ideal: [-3, 2],  ok: [-6,   4] },
  thigh:           { ideal: [3,  8],  ok: [0,  14]  },
};

/** Girth keys where "too tight" is unwearable (near-0 score below ideal). */
const GIRTH_KEYS = new Set(['chest', 'shoulder_width', 'waist_top', 'waist', 'waist_outer', 'hip', 'upper_arm', 'thigh']);

/** Target ease as a fraction of the BODY girth, per declared garment fit.
 *  `regular` is the anchor (0 net shift) so the existing FIT_THRESHOLDS
 *  calibration for regular garments is preserved exactly. */
const FIT_EASE_PCT: Record<ItemFit, number> = {
  slim: 0.02, regular: 0.06, relaxed: 0.11, wide: 0.16, oversized: 0.22,
};

/** How much of the fit shift each measurement point absorbs — i.e. how a
 *  garment is actually CUT to deliver its declared fit, not how tolerant we
 *  are of misfit. Torso girths (chest/waist/hip) take the shift fully — they
 *  ARE the fit. A loose sleeve widens nearly in proportion with the body of
 *  the garment (upper_arm), and real oversized/drop-shoulder construction
 *  widens the shoulder by nearly as much (shoulder_width is exactly a widened
 *  shoulder in that cut) and genuinely lengthens the sleeve (sleeves) —
 *  recalibrated 2026-08-03 after Section E of body-shape-sim.ts showed the
 *  previous near-zero weights flooring a correctly-cut oversized garment's
 *  shoulder/arm/sleeve points at 0.20 regardless of how well it actually fit.
 *  inseam still does not move with fit — leg length is independent of cut. */
const KEY_EASE_WEIGHT: Record<string, number> = {
  chest: 1, waist_top: 1, waist: 1, waist_outer: 1, hip: 1,
  thigh: 0.9, upper_arm: 0.9, shoulder_width: 0.9,
  sleeves: 0.3, body_length: 0.4, inseam: 0,
};

function clampCm(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Slide a threshold window by how much ease the garment's declared `fit` is
 *  SUPPOSED to have, scaled proportionally to the body measurement (not a flat
 *  cm offset) so a limb point never overshoots past the garment's real ease.
 *  The base FIT_THRESHOLDS numbers and easeScore's curve are untouched — only
 *  the window's position (and, for a guessed fit, the `ok` band's width) move.
 *
 *  `fitIsReal` is false when the fit label is a guess (provenance.fit !== true,
 *  see deriveFitWithProvenance in enrichment.ts). A guessed label still gets
 *  the FULL shift — it is our best estimate of the garment's cut, and halving
 *  it (the previous approach) parked the window HALFWAY between the regular
 *  and the labelled-fit window, matching NEITHER — a correctly-cut guessed
 *  garment was scored as if it were mis-cut. What a guess actually buys is
 *  UNCERTAINTY about whether the label is right, not "half as loose", so
 *  instead the `ok` band is WIDENED by GUESS_WIDENING on both sides — a wrong
 *  guess then degrades gracefully instead of scoring near 0. `ideal` is left
 *  unwidened: a guessed label should not earn a perfect score over a wider
 *  range than a known one, only a wider "acceptable" one. */
const GUESS_WIDENING = 0.4; // fraction of the ok-band half-width added each side, guessed fit only

function shiftThresholds(t: Thresholds, thresholdKey: string, bodyVal: number, fit: ItemFit, fitIsReal: boolean): Thresholds {
  const weight = KEY_EASE_WEIGHT[thresholdKey] ?? 0;
  const shiftCm = clampCm((FIT_EASE_PCT[fit] - FIT_EASE_PCT.regular) * bodyVal * weight, -20, 20);
  // No shift (regular fit, the zero-shift anchor) → nothing to be UNCERTAIN
  // about, so return the base window untouched — matches the original
  // early-return and keeps 'regular' guessed items on the unperturbed base
  // FIT_THRESHOLDS curve, exactly as before this fix.
  if (shiftCm === 0) return t;
  const ideal: [number, number] = [t.ideal[0] + shiftCm, t.ideal[1] + shiftCm];
  let ok: [number, number] = [t.ok[0] + shiftCm, t.ok[1] + shiftCm];
  // Loose-side ceiling BEFORE guess-widening — see the LOOSE-SIDE CEILING
  // comment below where it's used to clamp a guessed item's widened ok[1].
  const shiftedOk1 = ok[1];
  if (!fitIsReal) {
    const okHalfWidth = (ok[1] - ok[0]) / 2;
    ok = [ok[0] - GUESS_WIDENING * okHalfWidth, ok[1] + GUESS_WIDENING * okHalfWidth];
  }
  // SAFETY FLOOR (2026-08-03): a girth window may legitimately RAISE its floor
  // (a loose garment should require more ease before it counts "ok" — see the
  // E4 mislabelled-oversized guard) but must never LOWER it below the
  // ORIGINAL, un-shifted table value. The physical truth an ease% shift can't
  // override: a body does not shrink to fit a smaller garment. `slim`
  // (FIT_EASE_PCT.slim=0.02) is BELOW the `regular` anchor (0.06), so it is
  // the one fit that produces a NEGATIVE shiftCm — without this clamp that
  // drags ok[0] below its original floor (and guess-widening pushes it lower
  // still), letting the engine accept a garment that measures LESS than the
  // wearer's body as "acceptable". Applied after guess-widening so a guessed
  // slim garment can't use the wider band to sneak under the floor either.
  // Only GIRTH_KEYS get this treatment — length keys (sleeves/body_length/
  // inseam) have no "unwearable too-tight" floor in the same sense, and their
  // 'ok[0]' is deliberately negative (a slightly short hem/sleeve still
  // wears). shoulder_width's original ok[0] is -1 ON PURPOSE (a seam 1cm
  // narrower than the body still wears) — clamping to the ORIGINAL value,
  // not to 0, preserves that.
  if (GIRTH_KEYS.has(thresholdKey)) {
    ok[0] = Math.max(ok[0], t.ok[0]);
    // Guard against an inverted/empty window: if the raised floor now sits
    // above ideal[0] (possible for a large negative shift), raise ideal[0]
    // to match rather than leave ok[0] > ideal[0].
    if (ok[0] > ideal[0]) ideal[0] = ok[0];
    // LOOSE-SIDE CEILING (2026-08-11, mirrors the floor above — backlog "Guess-
    // widening still lets a guessed-fit score exceed its real-fit counterpart
    // on the LOOSE side"). `shiftedOk1` is `ok[1]` as it stood right after the
    // declared-fit shift but BEFORE guess-widening — i.e. exactly the ceiling a
    // REAL label on this same garment/fit would have. Clamping to it makes the
    // clamp a no-op for real items (their `ok[1]` already equals shiftedOk1,
    // since they never enter the widening branch above) and only bites when
    // widening pushed a GUESSED item's ceiling past that. Uncertainty about the
    // label should widen tolerance for a garment that's genuinely too loose to
    // fail more gracefully — it must not manufacture a reward the real label
    // wouldn't also get. Deliberately does NOT touch the base per-fit shiftCm
    // itself: an honestly-declared oversized garment's `ok[1]` still legitimately
    // sits far above a slim garment's — only the EXTRA widening delta is capped,
    // restoring "a real fit label never scores below a guessed one" on both sides.
    ok[1] = Math.min(ok[1], shiftedOk1);
  }
  return { ideal, ok };
}

function easeScore(ease: number, t: Thresholds, isGirth = false): number {
  // Below acceptable range → always unwearable for both girth and length.
  if (ease < t.ok[0]) return 0.0;
  // Ideal range → perfect.
  if (ease >= t.ideal[0] && ease <= t.ideal[1]) return 1.0;
  // Too loose (above ok upper bound) → still visible but clearly too big.
  if (ease > t.ok[1]) return Math.max(0, Math.min(1, 0.2));
  // Between ok[0] and ideal[0] — below ideal.
  if (ease < t.ideal[0]) {
    const ratio = (ease - t.ok[0]) / (t.ideal[0] - t.ok[0] + 0.001);
    if (isGirth) {
      // Girth too tight: near 0 at ok[0], rises steeply to ~1 at ideal[0].
      return Math.max(0, Math.min(1, ratio * ratio));
    }
    // Length short: gentler curve — suboptimal but wearable.
    return Math.max(0, Math.min(1, 0.4 + 0.6 * ratio));
  }
  // Between ideal[1] and ok[1] — a bit loose.
  return Math.max(0, Math.min(1, 0.7 + 0.3 * (1 - (ease - t.ideal[1]) / (t.ok[1] - t.ideal[1] + 0.001))));
}

function fitCategory(ease: number): FitCategory {
  if (ease < 0) return 'tight';
  if (ease < 2) return 'snug';
  if (ease < 6) return 'standard';
  if (ease < 12) return 'roomy';
  return 'oversized';
}

interface MappingEntry { bodyKey: keyof BodyMeasurements; garmentKey: string; thresholdKey: string; label: string }

const TOP_MAPPINGS: MappingEntry[] = [
  { bodyKey: 'body_bust',              garmentKey: 'chest',          thresholdKey: 'chest',          label: 'Chest' },
  { bodyKey: 'body_shoulder_width',    garmentKey: 'shoulder_width', thresholdKey: 'shoulder_width', label: 'Shoulder' },
  { bodyKey: 'body_waist',             garmentKey: 'waist_top',      thresholdKey: 'waist_top',      label: 'Waist' },
  { bodyKey: 'body_upper_arm',         garmentKey: 'upper_arm',      thresholdKey: 'upper_arm',      label: 'Upper arm' },
  { bodyKey: 'body_sleeve_length',     garmentKey: 'sleeves',        thresholdKey: 'sleeves',        label: 'Sleeve length' },
  { bodyKey: 'body_upper_body_length', garmentKey: 'body_length',    thresholdKey: 'body_length',    label: 'Body length' },
];

const PANTS_MAPPINGS: MappingEntry[] = [
  { bodyKey: 'body_waist', garmentKey: 'waist',  thresholdKey: 'waist',  label: 'Waist' },
  { bodyKey: 'body_hip',   garmentKey: 'hip',    thresholdKey: 'hip',    label: 'Hip' },
  { bodyKey: 'body_inseam',garmentKey: 'inseam', thresholdKey: 'inseam', label: 'Inseam' },
  { bodyKey: 'body_thigh', garmentKey: 'thigh',  thresholdKey: 'thigh',  label: 'Thigh' },
];

const OUTER_MAPPINGS: MappingEntry[] = [
  { bodyKey: 'body_bust',            garmentKey: 'chest',          thresholdKey: 'chest',          label: 'Chest' },
  { bodyKey: 'body_shoulder_width',  garmentKey: 'shoulder_width', thresholdKey: 'shoulder_width', label: 'Shoulder' },
  { bodyKey: 'body_waist',           garmentKey: 'waist_outer',    thresholdKey: 'waist_outer',    label: 'Waist' },
  { bodyKey: 'body_upper_arm',       garmentKey: 'upper_arm',      thresholdKey: 'upper_arm',      label: 'Upper arm' },
  { bodyKey: 'body_sleeve_length',   garmentKey: 'sleeves',        thresholdKey: 'sleeves',        label: 'Sleeve length' },
];

function scoreMappings(
  body: BodyMeasurements,
  garment: Record<string, number | undefined>,
  mappings: MappingEntry[],
  fit: ItemFit,
  fitIsReal: boolean,
): FitPoint[] {
  const points: FitPoint[] = [];
  for (const m of mappings) {
    const bodyVal = body[m.bodyKey] as number | undefined;
    const garmentVal = garment[m.garmentKey];
    if (bodyVal == null || garmentVal == null) continue;
    const ease = garmentVal - bodyVal;
    const baseT = FIT_THRESHOLDS[m.thresholdKey];
    const t = shiftThresholds(baseT, m.thresholdKey, bodyVal, fit, fitIsReal);
    const isGirth = GIRTH_KEYS.has(m.thresholdKey);
    // fitCategory stays absolute — it labels how the garment physically sits
    // (roomy/oversized), independent of whether that was the design intent.
    points.push({ key: m.label, ease, category: fitCategory(ease), score: easeScore(ease, t, isGirth) });
  }
  return points;
}

export function scoreItemFit(item: FitItem, body: BodyMeasurements): ItemFitResult {
  if (!item.garmentMeasurements) return { itemId: item.id, points: [], score: 0.5, warnings: [], measured: false };

  const g = item.garmentMeasurements as Record<string, number | undefined>;
  const fit = item.fit;
  const fitIsReal = item.provenance.fit === true;
  let points: FitPoint[] = [];
  if (item.category === 'top')      points = scoreMappings(body, g, TOP_MAPPINGS, fit, fitIsReal);
  if (item.category === 'onepiece') points = scoreMappings(body, g, TOP_MAPPINGS, fit, fitIsReal);
  if (item.category === 'bottom')   points = scoreMappings(body, g, PANTS_MAPPINGS, fit, fitIsReal);
  if (item.category === 'outwear')  points = scoreMappings(body, g, OUTER_MAPPINGS, fit, fitIsReal);

  // No overlap between body measurements and garment keys → still unmeasured.
  if (points.length === 0) return { itemId: item.id, points: [], score: 0.5, warnings: [], measured: false };
  const score = points.reduce((sum, p) => sum + p.score, 0) / points.length;
  const warnings = points.filter(p => p.category === 'tight').map(p => `${p.key} may be tight`);
  return { itemId: item.id, points, score, warnings, measured: true };
}

// Per-body-shape flattering (top volume, bottom volume) targets, expressed on
// the same VOLUME scale (slim=1 … oversized=5) as garments. SINGLE SOURCE OF
// TRUTH (2026-08-03) — consumed by bodyShapeMultiplier below AND fromBodyShape
// (silhouette.ts), so the scoring delta can never contradict the silhouette
// target again (the old two-criteria setup — string-matched fit rules here vs.
// hard-coded volume literals there — disagreed for 'rectangle'; see
// scripts/sim/body-shape-sim.ts Section D "Direction contradictions"). Tuples/
// weights/labels are copied verbatim from the previous fromBodyShape literals
// — not retuned.
export interface ShapeVolumeTarget { topVol: number; bottomVol: number; weight: number; label: string }

export const SHAPE_VOLUME_TARGETS: Record<BodyShape, ShapeVolumeTarget[]> = {
  triangle: [
    { topVol: 4, bottomVol: 4, weight: 0.6, label: 'triangle_broad_top_wide_bottom' },
    { topVol: 3, bottomVol: 5, weight: 0.4, label: 'triangle_wide_bottom' },
  ],
  inverted_triangle: [
    { topVol: 2, bottomVol: 4, weight: 0.6, label: 'inverted_triangle_fitted_top_wide_bottom' },
    { topVol: 1, bottomVol: 3, weight: 0.4, label: 'inverted_triangle_slim_top' },
  ],
  hourglass: [
    { topVol: 2, bottomVol: 2, weight: 0.7, label: 'hourglass_tailored' },
    { topVol: 1, bottomVol: 2, weight: 0.3, label: 'hourglass_fitted' },
  ],
  apple: [
    { topVol: 4, bottomVol: 2, weight: 0.6, label: 'apple_loose_top' },
    { topVol: 3, bottomVol: 2, weight: 0.4, label: 'apple_relaxed_top' },
  ],
  rectangle: [
    { topVol: 3, bottomVol: 2, weight: 0.5, label: 'rectangle_top_led' },
    { topVol: 2, bottomVol: 3, weight: 0.5, label: 'rectangle_bottom_led' },
  ],
};

// Highest VOLUME among top/onepiece/outwear items — undefined when none present.
function resolveTopVolume(items: FitItem[]): number | undefined {
  const candidates = items.filter(i => i.category === 'top' || i.category === 'onepiece' || i.category === 'outwear');
  if (candidates.length === 0) return undefined;
  return Math.max(...candidates.map(i => VOLUME[i.fit]));
}

// VOLUME of the bottom (or onepiece) item — undefined when none present.
function resolveBottomVolume(items: FitItem[]): number | undefined {
  const bottomItem = items.find(i => i.category === 'bottom' || i.category === 'onepiece');
  return bottomItem ? VOLUME[bottomItem.fit] : undefined;
}

// Manhattan distance from a target, over ONLY the axes that are actually
// present — a missing axis (e.g. the single-item evaluate-item path, which
// has no bottom) contributes 0 distance, never a fake penalty.
function targetVolumeDistance(target: ShapeVolumeTarget, topVol: number | undefined, bottomVol: number | undefined): number {
  let dist = 0;
  if (topVol !== undefined) dist += Math.abs(topVol - target.topVol);
  if (bottomVol !== undefined) dist += Math.abs(bottomVol - target.bottomVol);
  return dist;
}

// Body shape signal: how closely this outfit's realized top/bottom volume
// matches this body shape's flattering SHAPE_VOLUME_TARGETS (the same table
// silhouette.ts's fromBodyShape targets, so the two can never contradict each
// other again). Returns a DELTA in [-0.10, +0.10] to be added to the base fit
// score. Positive = good shape match, negative = poor shape match. Additive
// (not multiplicative) so the delta never collapses to 0 via clamping — a
// well-fitting outfit's base score staying near 1.0 doesn't erase ranking
// separation the way base * multiplier would.
export function bodyShapeMultiplier(items: FitItem[], shape: BodyShape): number {
  const core = items.filter(i => i.category !== 'accessory' && i.category !== 'shoes');
  const topVol = resolveTopVolume(core);
  const bottomVol = resolveBottomVolume(core);
  if (topVol === undefined && bottomVol === undefined) return 0;

  const targets = SHAPE_VOLUME_TARGETS[shape];
  let bestDist = Infinity;
  for (const t of targets) {
    const dist = targetVolumeDistance(t, topVol, bottomVol);
    if (dist < bestDist) bestDist = dist;
  }

  // Exact match (dist 0) -> +0.10; distance 3 -> neutral 0; distance >= 6 -> floor -0.10.
  const delta = 0.10 * (1 - bestDist / 3);
  return Math.max(-0.10, Math.min(0.10, delta));
}

// How "body-specific" a garment fit is — how much its look depends on the wearer's
// body geometry. Per ViBE (Hsiao & Grauman, CVPR 2020, Fig. 8): body-shape-aware
// matching helps most for body-specific (fitted) garments and approaches zero for
// versatile (loose) ones. Loose garments are safe on any shape, so shape signals
// on them — bonus or penalty — carry little information.
const FIT_SPECIFICITY: Record<ItemFit, number> = {
  slim: 1.0, regular: 0.7, relaxed: 0.4, wide: 0.25, oversized: 0.15,
};

// Scale from the raw rule delta (±0.10) to the effective adjustment (±0.32).
// Calibrated per docs/research/body-shape-importance-FINAL.md (2026-07-06):
//   outfit composite: 0.32 × fit-weight 0.10 ≈ ±3 pts/100 (target band 2–4)
//   purchase verdict: 0.32 × fit-weight 0.25 ≈ ±8 pts/100 (target band 5–8)
// Both stay below the measurement-match influence (±9.5 and ±25 respectively).
const SHAPE_GAIN = 3.2;
const SHAPE_ADJ_MAX = 0.32;

/**
 * Body-shape adjustment, conditioned on how body-specific the outfit's garments
 * are: rawRuleDelta × SHAPE_GAIN × meanFitSpecificity, clamped to ±SHAPE_ADJ_MAX.
 * A fully fitted look feels the full adjustment; an oversized look barely any.
 * Accessories are excluded from the specificity mean (their fit is meaningless).
 */
export function bodyShapeAdjustment(items: FitItem[], shape: BodyShape): number {
  const raw = bodyShapeMultiplier(items, shape);
  const core = items.filter(i => i.category !== 'accessory');
  const specificity = core.length > 0
    ? core.reduce((s, i) => s + (FIT_SPECIFICITY[i.fit] ?? 0.6), 0) / core.length
    : 0.6;
  const adj = raw * SHAPE_GAIN * specificity;
  return Math.max(-SHAPE_ADJ_MAX, Math.min(SHAPE_ADJ_MAX, adj));
}

// ── Preferred-fit anchor (moved here from evaluate-item/scoring.ts, 2026-08-03) ──
// Once FIT_THRESHOLDS is fit-relative (above), a correctly-cut oversized piece
// scores ~1.0 just like a correctly-cut slim piece — the measurement term alone
// no longer expresses whether the user LIKES loose clothes. FIT_COMPAT + the
// preference-comparison table are the SAME data evaluate-item always used;
// they now live in the engine so generate-outfits can anchor the feed to it
// too. Import direction preserved: evaluate-item imports FROM the engine, not
// the reverse — evaluate-item/scoring.ts re-exports/imports these two names
// and its own behaviour (its separate `fit` criterion) is unchanged.

// Adjacent-fit table: how well each item fit satisfies a preferred fit.
// 1.0 = exact match or functionally identical, lower = less suitable.
export const FIT_COMPAT: Record<PreferredFit, Partial<Record<ItemFit, number>>> = {
  SLIM:     { slim: 1.0, regular: 0.6, relaxed: 0.3, wide: 0.1, oversized: 0.1 },
  REGULAR:  { slim: 0.6, regular: 1.0, relaxed: 0.7, wide: 0.4, oversized: 0.3 },
  RELAXED:  { slim: 0.2, regular: 0.7, relaxed: 1.0, wide: 0.8, oversized: 0.6 },
  OVERSIZED:{ slim: 0.1, regular: 0.4, relaxed: 0.7, wide: 0.8, oversized: 1.0 },
};

export function scoreFitPreference(itemFit: ItemFit, preferredFit: PreferredFit): number {
  return FIT_COMPAT[preferredFit][itemFit] ?? 0.5;
}

/** Soft nudge toward the fit silhouette the user says they prefer. Returns a
 *  DELTA in [-0.12, +0.12] — deliberately smaller than the body-shape delta so
 *  shape and style stay dominant. 0 when the user has no preferredFit. */
export function preferredFitDelta(items: FitItem[], preferredFit?: PreferredFit): number {
  if (!preferredFit) return 0;
  const core = items.filter(i => i.category !== 'accessory' && i.category !== 'shoes');
  if (core.length === 0) return 0;
  const mean = core.reduce((s, i) => s + scoreFitPreference(i.fit, preferredFit), 0) / core.length;
  return Math.max(-0.12, Math.min(0.12, (mean - 0.5) * 2 * 0.12));
}

// ── Soft-knee output shaping (2026-08-11) ──────────────────────────────────
// `scoreOutfitFit`'s raw sum (base + shapeDelta + prefDelta) routinely exceeds
// 1.0 — base alone can sit near 1.0 for a good match, and shapeDelta (±0.32)
// and prefDelta (±0.12) are ADDITIVE on top of it by design (see the comment
// on bodyShapeAdjustment above: additive, not multiplicative, specifically so
// a near-1.0 base doesn't erase the delta's ranking separation via clamping).
// A hard `Math.max(0, Math.min(1, raw))` defeats that same goal at the OTHER
// end: every raw score above 1.0 (or below 0.0) flattens to the identical
// clamped value and becomes unorderable — exactly the separation the
// additive redesign exists to preserve.
//
// Fix: a smooth, monotone "knee" at both ends instead of a hard clamp. Below
// the knee `K` (and above its mirror `1-K`) the score is untouched — the
// blast radius is confined to outfits that were actually overshooting.
// Beyond the knee, an exponential decay asymptotically compresses the raw
// value into (0,1) without ever reaching either bound, so the [0,1] output
// contract downstream consumers rely on still holds. Span `S` sets how much
// "give" the knee has: the curve's own derivative is s * exp(-(raw-K)/S) *
// (1/S)... i.e. exactly 1 at raw=K (matches the identity region's slope of 1
// on both sides, so there's no visible kink) and it decays smoothly beyond
// that. Because exp() is strictly monotone, the whole function stays
// strictly monotone across its entire domain — ordering (f(a) < f(b) for
// a < b) is never lost, only compressed, which is the actual property that
// matters for a ranking feed.
const SOFT_KNEE_K = 0.9;
const SOFT_KNEE_S = 0.1;

/** Soft-knee compression into (0,1): identity on [1-K, K], smooth asymptotic
 *  compression beyond it on both ends. See the block comment above for why
 *  this replaces a hard clamp for scoreOutfitFit's output. */
export function softKnee(raw: number, k: number = SOFT_KNEE_K, s: number = SOFT_KNEE_S): number {
  if (raw > k) return k + s * (1 - Math.exp(-(raw - k) / s));
  if (raw < 1 - k) return (1 - k) - s * (1 - Math.exp(-((1 - k) - raw) / s));
  return raw;
}

export function scoreOutfitFit(items: FitItem[], body: BodyMeasurements): number {
  if (items.length === 0) return 0.5;
  const results = items.map(item => scoreItemFit(item, body));
  // Average only items that produced a real measured fit score — items with no
  // garment measurements or no key overlap default to 0.5 and are excluded so
  // a single well-measured item is not diluted by flat-neutral non-measurements.
  const measured = results.filter(r => r.measured);
  const base = measured.length > 0
    ? measured.reduce((sum, r) => sum + r.score, 0) / measured.length
    : 0.5;
  // Shape delta only when body_shape is known (body_neutral mode nulls it out
  // upstream, before ctx.bodyMeasurements reaches this function).
  const shapeDelta = body.body_shape ? bodyShapeAdjustment(items, body.body_shape) : 0;
  // preferredFit is a STATED PREFERENCE, not body data — unlike body_shape it
  // must NOT be suppressed by body-neutral mode, so it is applied unconditionally
  // here (not gated behind the `body.body_shape` check above).
  const prefDelta = preferredFitDelta(items, body.preferredFit);
  return softKnee(base + shapeDelta + prefDelta);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. PROPORTION BALANCE
// ═══════════════════════════════════════════════════════════════════════════

// Canonical volume scale — the single source of truth reused by generation.ts
// (pairAffinity's proportion term) and silhouette.ts (target-silhouette match).
export const VOLUME: Record<ItemFit, number> = { slim: 1, regular: 2, relaxed: 3, wide: 4, oversized: 5 };

// Dominant colour of an outfit = the colour of its ANCHOR piece (the "loudest
// piece leads" rule generation.ts uses: highest statementStrength, id tie-break).
// Shoes/accessories excluded — the anchor is a top/bottom/outerwear garment.
// Display-only (2026-07-12) — not a scoring input.
export function outfitDominantColor(items: FitItem[]): PrimaryColor {
  const eligible = items.filter(i => i.category !== 'shoes' && i.category !== 'accessory');
  const pool = eligible.length > 0 ? eligible : items;
  if (pool.length === 0) return 'black';
  let anchor = pool[0];
  for (const i of pool) {
    if (i.statementStrength > anchor.statementStrength ||
        (i.statementStrength === anchor.statementStrength && i.id < anchor.id)) {
      anchor = i;
    }
  }
  return anchor.colorProfile.primaryColor;
}

// ── Gender-aware styling nudge (opt-in; backlog #3) ───────────────────────────
// A SOFT bias only — never filters items (the wardrobe is the user's own). Returns
// a DELTA in [-0.05, +0.05] added to totalScore, deliberately smaller than the
// body-shape delta so the user's style/colour signals stay dominant. Conventions
// are gentle silhouette/proportion leanings, not hard rules; only WOMAN/MAN reach
// here (NON-BINARY etc. never set ctx.gender, so this is never called for them).
export function genderStylingDelta(items: FitItem[], gender: 'WOMAN' | 'MAN'): number {
  const visible = items.filter(i => i.category !== 'accessory');
  if (visible.length === 0) return 0;
  const tops = items.filter(i => i.category === 'top' || i.category === 'outwear' || i.category === 'onepiece');
  const bottoms = items.filter(i => i.category === 'bottom' || i.category === 'onepiece');
  const topVol = tops.length ? Math.max(...tops.map(i => VOLUME[i.fit])) : undefined;
  const bottomVol = bottoms.length ? Math.max(...bottoms.map(i => VOLUME[i.fit])) : undefined;
  let delta = 0;

  if (gender === 'WOMAN') {
    // Reward a defined/tailored piece and deliberate proportion play (fitted vs
    // volume), plus the effortless one-piece option.
    if (visible.some(i => i.fit === 'slim' || i.fit === 'regular')) delta += 0.02;
    if (topVol !== undefined && bottomVol !== undefined && Math.abs(topVol - bottomVol) >= 1) delta += 0.03;
    if (items.some(i => i.category === 'onepiece')) delta += 0.02;
  } else {
    // MAN: reward a V-shaped read (top wider than bottom — broader shoulders/
    // chest tapering to a slimmer leg line), penalize the inverse (bottom-heavy),
    // and gently discourage an all-tight (bodycon) read. Fixed 2026-08-13: this
    // branch previously rewarded topVol≈bottomVol (a BALANCED read), which IS the
    // straight/rectangle silhouette — directly opposing the V/inverted-triangle
    // target the new auto shape-tier table (ranking.ts) rewards for menswear.
    // Equal volumes (neither >= 1 apart) earn neither bonus nor penalty.
    if (visible.every(i => VOLUME[i.fit] <= 3)) delta += 0.02;
    if (topVol !== undefined && bottomVol !== undefined) {
      if (topVol - bottomVol >= 1) delta += 0.03;
      else if (bottomVol - topVol >= 1) delta -= 0.03;
    }
    if (visible.filter(i => i.fit === 'slim').length >= 2) delta -= 0.02;
  }

  return Math.max(-0.05, Math.min(0.05, delta));
}

export function scoreProportionBalance(items: FitItem[]): number {
  const tops = items.filter(i => i.category === 'top' || i.category === 'outwear' || i.category === 'onepiece');
  const bottoms = items.filter(i => i.category === 'bottom' || i.category === 'onepiece');
  if (tops.length === 0 || bottoms.length === 0) return 0.7;

  const topVolume = Math.max(...tops.map(i => VOLUME[i.fit]));
  const bottomVolume = Math.max(...bottoms.map(i => VOLUME[i.fit]));

  if (topVolume >= 5 && bottomVolume >= 5) return 0.15;
  if (topVolume >= 4 && bottomVolume >= 4) return 0.35;

  const diff = Math.abs(topVolume - bottomVolume);
  if (diff >= 2) return 1.0;
  if (diff === 1) return 0.8;
  if (topVolume <= 2) return 0.65;
  return 0.4;
}

// Silhouette-first resolution (2026-07-12): how well this outfit's top/bottom
// volume realizes ctx.targetSilhouette — best (max) match across the target's
// candidate (topVol, bottomVol) pairs, distance-based in [0,1]. Blended into
// proportionBalance by ranking.ts, weighted by target.confidence, so a fully
// guessed wardrobe (confidence 0) is unaffected. Mirrors the per-pair distance
// math in silhouette.ts's pairSilhouetteMatch, but over the OUTFIT's resolved
// top/bottom volumes (same aggregation scoreProportionBalance uses) rather
// than two specific items.
const TARGET_MAX_VOLUME_DIST = 8; // |Δtop| + |Δbottom|, each axis spans 1..5

export function scoreTargetSilhouette(items: FitItem[], target: TargetSilhouette): number {
  const tops = items.filter(i => i.category === 'top' || i.category === 'outwear' || i.category === 'onepiece');
  const bottoms = items.filter(i => i.category === 'bottom' || i.category === 'onepiece');
  if (tops.length === 0 || bottoms.length === 0 || target.targets.length === 0) return 0.5;

  const topVolume = Math.max(...tops.map(i => VOLUME[i.fit]));
  const bottomVolume = Math.max(...bottoms.map(i => VOLUME[i.fit]));

  let best = 0;
  for (const t of target.targets) {
    const dist = Math.abs(topVolume - t.topVol) + Math.abs(bottomVolume - t.bottomVol);
    const match = Math.max(0, 1 - dist / TARGET_MAX_VOLUME_DIST);
    if (match > best) best = match;
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. FORMALITY CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════════

export function scoreFormalityConsistency(items: FitItem[], formula?: string): number {
  if (items.length <= 1) return 0.8;
  const formalities = items.map(i => i.formality);
  const gap = Math.max(...formalities) - Math.min(...formalities);

  // high_low candidates are BUILT on register contrast — for them a healthy gap
  // is the point, not a flaw. Reward the deliberate 1.5–3.0 window; a tiny gap
  // means the mix didn't actually happen, a huge one is still a costume.
  if (formula === 'high_low') {
    if (gap >= 1.5 && gap <= 3.0) return 1.0;
    if (gap >= 1.0 && gap < 1.5) return 0.8;
    if (gap > 3.0 && gap <= 3.5) return 0.7;
    if (gap < 1.0) return 0.6;
    return 0.3;
  }

  if (gap <= 1.0) return 1.0;
  if (gap <= 1.5) return 0.8;
  if (gap <= 2.0) return 0.55;
  if (gap <= 2.5) return 0.3;
  return 0.15;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. SEASON MATCH
// ═══════════════════════════════════════════════════════════════════════════

export const SEASON_COMPAT: Record<Season, Record<Season, number>> = {
  summer:    { summer: 1.0, spring: 0.8, fall: 0.3, winter: 0.0, allSeason: 0.9 },
  spring:    { summer: 0.8, spring: 1.0, fall: 0.7, winter: 0.3, allSeason: 0.9 },
  fall:      { summer: 0.3, spring: 0.7, fall: 1.0, winter: 0.8, allSeason: 0.9 },
  winter:    { summer: 0.0, spring: 0.3, fall: 0.8, winter: 1.0, allSeason: 0.9 },
  allSeason: { summer: 0.9, spring: 0.9, fall: 0.9, winter: 0.9, allSeason: 1.0 },
};

export function scoreSeasonMatch(items: FitItem[], targetSeason?: Season): number {
  const seasons = items.map(i => i.fabric.season);

  let internal = 0.8;
  if (seasons.length > 1) {
    let total = 0, pairs = 0;
    for (let i = 0; i < seasons.length; i++) {
      for (let j = i + 1; j < seasons.length; j++) {
        total += SEASON_COMPAT[seasons[i]][seasons[j]];
        pairs++;
      }
    }
    internal = pairs > 0 ? total / pairs : 0.8;
  }

  // With a target season (intent.seasonOverride / weather), matching the
  // actual conditions matters more than internal fabric consistency.
  if (targetSeason && seasons.length > 0) {
    const targetMatch = seasons.reduce((s, x) => s + SEASON_COMPAT[targetSeason][x], 0) / seasons.length;
    return 0.6 * targetMatch + 0.4 * internal;
  }
  return internal;
}

// Calendar month (0–11) + hemisphere → meteorological Season. Used to derive the
// current real-world season from the request date when the user hasn't set an
// explicit seasonOverride. Southern hemisphere is the opposite season.
const NORTH_SEASON: Season[] = [
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer', // Jan..Jun
  'summer', 'summer', 'fall',   'fall',   'fall',   'winter', // Jul..Dec
];
const OPPOSITE_SEASON: Record<Season, Season> = {
  winter: 'summer', summer: 'winter', spring: 'fall', fall: 'spring', allSeason: 'allSeason',
};

export function seasonForMonth(month: number, hemisphere: 'north' | 'south'): Season {
  const s = NORTH_SEASON[((month % 12) + 12) % 12];
  return hemisphere === 'south' ? OPPOSITE_SEASON[s] : s;
}

// Best-effort hemisphere from a free-text country name (we store no coordinates).
// Lists the countries that are wholly/predominantly (by population) Southern; every
// other name — including equatorial countries with weak seasons and the current VN
// user base — defaults to Northern, which is harmless. Substring match tolerates
// prefixes like "Republic of South Africa". Matched against a lowercased name.
const SOUTHERN_COUNTRIES = [
  // Oceania
  'australia', 'new zealand', 'fiji', 'papua new guinea', 'samoa', 'tonga',
  'vanuatu', 'solomon islands', 'new caledonia', 'timor',
  // South America (predominantly south)
  'argentina', 'chile', 'uruguay', 'paraguay', 'bolivia', 'peru', 'brazil',
  // Southern Africa
  'south africa', 'namibia', 'botswana', 'zimbabwe', 'mozambique', 'madagascar',
  'zambia', 'angola', 'malawi', 'lesotho', 'eswatini', 'swaziland', 'tanzania',
  'mauritius',
];

export function hemisphereForCountry(country?: string | null): 'north' | 'south' {
  const c = (country ?? '').trim().toLowerCase();
  if (!c) return 'north';
  return SOUTHERN_COUNTRIES.some(s => c.includes(s)) ? 'south' : 'north';
}

// ISO 3166-1 alpha-2 codes of Southern-hemisphere countries (locale-independent).
// Preferred over the name map when a code is stored — exact, never localised.
const SOUTHERN_COUNTRY_CODES = new Set([
  // Oceania
  'AU', 'NZ', 'FJ', 'PG', 'WS', 'TO', 'VU', 'SB', 'NC', 'PF', 'TL', 'CK', 'TV', 'NR',
  // South America
  'AR', 'CL', 'UY', 'PY', 'BO', 'PE', 'BR',
  // Southern Africa + Indian Ocean
  'ZA', 'NA', 'BW', 'ZW', 'MZ', 'MG', 'ZM', 'AO', 'MW', 'LS', 'SZ', 'TZ', 'MU', 'RE', 'KM',
]);

// Resolve hemisphere from the best signal available: the ISO country code is exact
// and locale-independent, so it wins; otherwise fall back to the country-name map.
export function resolveHemisphere(
  countryCode?: string | null,
  countryName?: string | null,
): 'north' | 'south' {
  const code = (countryCode ?? '').trim().toUpperCase();
  if (code) return SOUTHERN_COUNTRY_CODES.has(code) ? 'south' : 'north';
  return hemisphereForCountry(countryName);
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. TEXTURE HARMONY
// ═══════════════════════════════════════════════════════════════════════════

const WEIGHT_LEVEL: Record<FabricWeight, number> = { light: 0, medium: 1, heavy: 2 };

export function scoreTextureHarmony(items: FitItem[], formula?: string): number {
  const weights = items.filter(i => i.category !== 'accessory').map(i => WEIGHT_LEVEL[i.fabric.fabricWeight]);
  if (weights.length <= 1) return 0.7;

  const spread = Math.max(...weights) - Math.min(...weights);
  // Formula contract (texture_stack): stacking 3+ distinct textures IS the
  // concept — a full light→heavy spread is deliberate depth, not inconsistency.
  const stacking = formula === 'texture_stack';
  const consistencyScore = spread === 0 ? 0.6 : spread === 1 ? 1.0 : (stacking ? 0.8 : 0.4);

  const distinct = new Set(weights).size;
  const varietyScore = distinct === 1 ? 0.5 : distinct === 2 ? 1.0 : (stacking ? 1.0 : 0.7);

  const breathabilities = items.filter(i => i.category !== 'accessory').map(i => i.fabric.breathability);
  const breathScore = new Set(breathabilities).size <= 2 ? 1.0 : 0.7;

  return 0.40 * consistencyScore + 0.35 * varietyScore + 0.25 * breathScore;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANCHOR CLARITY
// ═══════════════════════════════════════════════════════════════════════════

const HERO_THRESHOLD = 1.5;
const SUPPORT_THRESHOLD = 1.0;

export function scoreAnchorClarity(items: FitItem[]): number {
  if (items.length <= 1) return 0.7;
  const strengths = items.map(i => i.statementStrength);
  const sorted = [...strengths].sort((a, b) => b - a);
  const loudest = sorted[0];
  const secondLoudest = sorted[1];

  if (loudest < HERO_THRESHOLD) return 0.5;

  const heroGap = loudest - secondLoudest;
  if (heroGap >= 1.5) {
    const supportItems = sorted.slice(1);
    const quietSupport = supportItems.filter(s => s <= SUPPORT_THRESHOLD).length;
    return 0.85 + 0.15 * (quietSupport / supportItems.length);
  }
  if (heroGap >= 0.8) return 0.75;

  const loudItems = strengths.filter(s => s >= HERO_THRESHOLD).length;
  if (loudItems >= 3) return 0.2;
  if (loudItems === 2) return heroGap >= 0.5 ? 0.55 : 0.35;
  return 0.6;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE POV — MIEN luxury minimalism (S4, 2026-07-02)
// ═══════════════════════════════════════════════════════════════════════════
// The house has taste. A NAMED aesthetic bias (the Celine / The Row register
// from CLAUDE.md's design philosophy): restraint, tonal dressing, natural
// fabrics, precise silhouettes — and distrust of loudness that doesn't earn
// its place. Deliberately SMALL (capped ±0.05): it breaks ties between
// equally-valid looks so the feed "sounds like MIEN", it never overrides the
// user's own signals — and it halves itself when the user's chosen styles pull
// the opposite way (streetwear/y2k live on loudness; the house yields).

const NATURAL_FABRICS = new Set(['wool', 'cashmere', 'cotton', 'linen', 'silk', 'leather', 'suede']);
// Expanded (010-wardrobe-critic follow-up, 2026-08-11 — APPROVED) beyond the
// original {streetwear, y2k} to cover styles whose defining identity fights
// the house's restraint/natural-fabric/precision bias the same way: artsy
// (patternLevel 4.0, deliberate pattern-mixing is the whole point) and
// retro70s (patternLevel 4.0, and explicitly bans several NATURAL_FABRICS —
// wool/cashmere/silk — so it can't earn the fabric-integrity bonus either);
// resort (tropical/novelty prints are core identity, likely to trip
// full_print/large_graphic in real photos); mobwife (loud LUXURY — its
// defining fabrics, fur/leather, would otherwise collect the natural-fabric
// bonus while its maximalist identity — highest textureRichness in the
// catalog — is philosophically the opposite of restraint; leaving it out
// would let it collect the fabric bonus AND the loudness penalty from a
// house POV that has no real opinion to apply to this style).
const HOUSE_OPPOSED_STYLES = new Set(['streetwear', 'y2k', 'artsy', 'retro70s', 'resort', 'mobwife']);

export function housePOVDelta(items: FitItem[], selectedStyles: string[] = []): number {
  const visible = items.filter(i => i.category !== 'accessory');
  if (visible.length === 0) return 0;
  let delta = 0;

  // Restraint — a tight palette reads intentional.
  const families = new Set(visible.map(i => i.colorProfile.primaryColor));
  if (families.size <= 2) delta += 0.02;
  if (visible.every(i => i.colorProfile.undertone === 'neutral')) delta += 0.01;

  // Material integrity — natural fabrics read expensive. Only judged when the
  // fabric is actually known (no reward for defaulted metadata).
  const known = visible.filter(i => i.fabricName);
  if (known.length >= 2 && known.every(i => NATURAL_FABRICS.has(i.fabricName!))) delta += 0.02;

  // Precision — controlled silhouettes over slouch.
  if (visible.every(i => i.fit === 'slim' || i.fit === 'regular' || i.fit === 'relaxed')) delta += 0.01;
  // Structured drape reads precise (đợt 2 — only when the image actually said so).
  if (visible.filter(i => i.drape === 'structured').length >= 2) delta += 0.01;

  // Distrust unearned loudness.
  if (visible.some(i => i.graphics.graphicWeight === 'large_graphic' || i.graphics.graphicWeight === 'full_print')) delta -= 0.03;
  if (visible.filter(i => i.colorProfile.colorSaturation === 'vivid').length >= 2) delta -= 0.02;

  delta = Math.max(-0.05, Math.min(0.05, delta));
  return selectedStyles.some(s => HOUSE_OPPOSED_STYLES.has(s)) ? delta * 0.5 : delta;
}

// ═══════════════════════════════════════════════════════════════════════════
// TASTE ADJUSTMENT — pair affinity + aesthetic vetoes
// ═══════════════════════════════════════════════════════════════════════════
// A stylist thinks in vetoes and classics, not weighted averages. This layer
// adds a flat bonus for recognized classic combinations and a multiplicative
// penalty for combinations that are "valid but off" — a single fatal flaw
// should sink an outfit, not be averaged away by six decent dimensions.
// The knowledge tables live in taste-data.ts (pure data, expanded 2026-07-02).

export interface TasteAdjustment {
  bonus: number;       // flat addition to totalScore (classic combos)
  multiplier: number;  // ≤1.0, multiplicative veto for aesthetic flaws
}

export function scoreTasteAdjustment(items: FitItem[]): TasteAdjustment {
  let bonus = 0;
  let multiplier = 1.0;

  const byCat = (cat: string) => items.find(i => i.category === cat);
  const top = byCat('top'), bottom = byCat('bottom'), shoes = byCat('shoes');
  const outwear = byCat('outwear');

  // Classic-combo bonus. Two lookups: the core top-led triple, and an
  // outwear-led triple (hoodie/blazer/jacket outfits are DEFINED by the layer,
  // not the base top — HOODIE+JEANS+SNEAKERS was dead data until this lookup
  // existed because HOODIE is category 'outwear'). Take the stronger signal.
  if (bottom && shoes) {
    const topKey = top ? CLASSIC_TRIPLES[`${top.typeName}+${bottom.typeName}+${shoes.typeName}`] ?? 0 : 0;
    const outerKey = outwear ? CLASSIC_TRIPLES[`${outwear.typeName}+${bottom.typeName}+${shoes.typeName}`] ?? 0 : 0;
    bonus += Math.max(topKey, outerKey);
  }

  // Clashing-pair vetoes
  const types = new Set(items.map(i => i.typeName));
  for (const [a, b, mult] of CLASHING_PAIRS) {
    if (types.has(a) && types.has(b)) multiplier *= mult;
  }

  const visible = items.filter(i => i.category !== 'accessory');
  const boldPatterns = visible.filter(i => i.fabric.pattern !== 'solid' && i.fabric.pattern !== 'checkered').length;

  // Flat look: every non-accessory item dark AND muted — visually dead, UNLESS
  // texture carries the look (the all-black rule: leather + wool + cotton in
  // one dark outfit reads intentional, one flat fabric reads lifeless) OR two
  // bold patterns already carry it (patterns ARE visual interest — stacking
  // this with the pattern-mix multiplier double-punished streetwear looks;
  // fixture finding 2026-07-03).
  if (visible.length >= 3 && boldPatterns < 2) {
    const allDarkMuted = visible.every(i => i.colorProfile.lum < 35 && i.colorProfile.sat < 30);
    if (allDarkMuted) multiplier *= textureVariety(items) >= 2 ? 0.85 : 0.6;
  }

  // Undertone clash: warm and cool fighting with no clear dominance.
  const tones = visible.map(i => i.colorProfile.undertone).filter(t => t !== 'neutral');
  if (tones.length >= 2) {
    const warm = tones.filter(t => t === 'warm').length;
    const dominant = Math.max(warm, tones.length - warm) / tones.length;
    if (dominant < 0.65) multiplier *= 0.65;
  }

  // Competing statements: three or more loud pieces is a costume, not an outfit.
  const loud = items.filter(i => i.statementStrength >= 2.5).length;
  if (loud >= 3) multiplier *= 0.5;

  // Pattern-on-pattern: only reachable for pattern-friendly styles (the hard
  // constraint caps everyone else at 1 bold pattern). Deliberate but risky —
  // a mild multiplier keeps single-pattern versions slightly ahead by default.
  if (boldPatterns >= 2) multiplier *= 0.85;

  return { bonus, multiplier };
}
