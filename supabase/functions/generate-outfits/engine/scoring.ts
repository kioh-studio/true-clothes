// All 7 scoring dimensions + anchor clarity + style catalog.
// Merges: colorHarmony, styleCoherence, fitMatcher, proportionBalance,
//         formalityConsistency, seasonMatch, textureHarmony, anchorClarity,
//         styleCatalog (for styleCoherence lookups).

import {
  FitItem, ColorProfile, PrimaryColor, BodyMeasurements, BodyShape,
  StyleAttributes, StyleDef, Mood, ColorPalette, Silhouette,
  FabricWeight, ItemFit, Season, FitPoint, FitCategory, ItemFitResult,
} from './types.ts';
import { colorProfileOf } from './enrichment.ts';
import { STYLE_CONFIGS } from './filtering.ts';

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

function lightnessContrast(profiles: ColorProfile[]): number {
  const lums = profiles.map(p => p.lum);
  const range = Math.max(...lums) - Math.min(...lums);
  if (range < 15) return 0.5;
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

function paletteAlignment(profiles: ColorProfile[], userPrimaries: Set<PrimaryColor>): number {
  if (userPrimaries.size === 0) return 0.5;
  const matches = profiles.filter(p => userPrimaries.has(p.primaryColor)).length;
  return matches / profiles.length;
}

function graphicDensityPenalty(items: FitItem[]): number {
  const heavy = items.filter(i => i.graphics.graphicWeight === 'large_graphic' || i.graphics.graphicWeight === 'full_print').length;
  return heavy > 1 ? 0.5 : 1.0;
}

function seasonCompatibilityBonus(profiles: ColorProfile[], colorSeason: string): number {
  const rule = SEASON_FLATTERING[colorSeason];
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

export function scoreColorHarmony(
  items: FitItem[],
  userColorPreferences: string[],
  colorSeason?: string,
): number {
  if (items.length === 0) return 0.5;
  const profiles = items.map(i => i.colorProfile);
  const userPrimaries = new Set<PrimaryColor>(userColorPreferences.map(name => colorProfileOf(name).primaryColor));
  const base = (
    0.20 * paletteAlignment(profiles, userPrimaries) +
    0.20 * colorRelationshipScore(profiles) +
    0.15 * undertoneConsistency(profiles) +
    0.15 * lightnessContrast(profiles) +
    0.10 * saturationConsistency(profiles) +
    0.10 * colorCountScore(profiles) +
    0.10 * graphicDensityPenalty(items)
  );
  if (!colorSeason) return base;
  return Math.max(0, Math.min(1, base + seasonCompatibilityBonus(profiles, colorSeason)));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. STYLE COHERENCE
// ═══════════════════════════════════════════════════════════════════════════

function numericSim(a: number, b: number): number { return 1 - Math.abs(a - b) / 4; }

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

function easeScore(ease: number, t: Thresholds): number {
  if (ease < t.ok[0]) return 0.0;
  if (ease >= t.ideal[0] && ease <= t.ideal[1]) return 1.0;
  if (ease > t.ok[1]) return 0.2;
  if (ease < t.ideal[0]) return 0.4 + 0.6 * ((ease - t.ok[0]) / (t.ideal[0] - t.ok[0] + 0.001));
  return 0.7 + 0.3 * (1 - (ease - t.ideal[1]) / (t.ok[1] - t.ideal[1] + 0.001));
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

function scoreMappings(body: BodyMeasurements, garment: Record<string, number | undefined>, mappings: MappingEntry[]): FitPoint[] {
  const points: FitPoint[] = [];
  for (const m of mappings) {
    const bodyVal = body[m.bodyKey] as number | undefined;
    const garmentVal = garment[m.garmentKey];
    if (bodyVal == null || garmentVal == null) continue;
    const ease = garmentVal - bodyVal;
    const t = FIT_THRESHOLDS[m.thresholdKey];
    points.push({ key: m.label, ease, category: fitCategory(ease), score: easeScore(ease, t) });
  }
  return points;
}

export function scoreItemFit(item: FitItem, body: BodyMeasurements): ItemFitResult {
  if (!item.garmentMeasurements) return { itemId: item.id, points: [], score: 0.5, warnings: [] };

  const g = item.garmentMeasurements as Record<string, number | undefined>;
  let points: FitPoint[] = [];
  if (item.category === 'top')      points = scoreMappings(body, g, TOP_MAPPINGS);
  if (item.category === 'onepiece') points = scoreMappings(body, g, TOP_MAPPINGS);
  if (item.category === 'bottom')   points = scoreMappings(body, g, PANTS_MAPPINGS);
  if (item.category === 'outwear')  points = scoreMappings(body, g, OUTER_MAPPINGS);

  if (points.length === 0) return { itemId: item.id, points: [], score: 0.5, warnings: [] };
  const score = points.reduce((sum, p) => sum + p.score, 0) / points.length;
  const warnings = points.filter(p => p.category === 'tight').map(p => `${p.key} may be tight`);
  return { itemId: item.id, points, score, warnings };
}

// Body shape bonus: certain silhouettes suit certain shapes better.
// Returns a multiplier [0.85, 1.15] applied to the base fit score.
function bodyShapeMultiplier(items: FitItem[], shape: BodyShape): number {
  const tops = items.filter(i => i.category === 'top' || i.category === 'outwear');
  const bottoms = items.filter(i => i.category === 'bottom');
  let bonus = 1.0;
  switch (shape) {
    case 'triangle': {
      // Pear — score up A-line / wide-leg bottoms (relaxed/oversized), score down fitted bottoms
      const wideBottom = bottoms.some(i => i.fit === 'relaxed' || i.fit === 'wide' || i.fit === 'oversized');
      const broadTop = tops.some(i => i.fit === 'oversized' || i.fit === 'wide');
      if (wideBottom) bonus += 0.10;
      if (broadTop) bonus += 0.05;
      break;
    }
    case 'inverted_triangle': {
      // Wide shoulders — score down wide-shoulder tops, score up A-line bottoms
      const wideTops = tops.filter(i => i.fit === 'oversized' || i.fit === 'wide').length;
      if (wideTops > 0) bonus -= 0.10;
      const wideBtm = bottoms.some(i => i.fit === 'relaxed' || i.fit === 'wide');
      if (wideBtm) bonus += 0.08;
      break;
    }
    case 'hourglass': {
      // Defined waist — reward tailored/structured silhouettes
      const tailored = items.some(i => i.fit === 'slim' || i.fit === 'regular');
      if (tailored) bonus += 0.08;
      break;
    }
    case 'apple': {
      // Score up loose/flowy tops, straight-leg bottoms
      const looseTops = tops.some(i => i.fit === 'relaxed' || i.fit === 'oversized');
      if (looseTops) bonus += 0.08;
      break;
    }
    case 'rectangle': {
      // Score up structured/layered looks
      const layered = items.length >= 3;
      if (layered) bonus += 0.05;
      break;
    }
  }
  return Math.max(0.85, Math.min(1.15, bonus));
}

export function scoreOutfitFit(items: FitItem[], body: BodyMeasurements): number {
  if (items.length === 0) return 0.5;
  const results = items.map(item => scoreItemFit(item, body));
  const base = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  if (!body.body_shape) return base;
  return Math.min(1.0, base * bodyShapeMultiplier(items, body.body_shape));
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. PROPORTION BALANCE
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME: Record<ItemFit, number> = { slim: 1, regular: 2, relaxed: 3, wide: 4, oversized: 5 };

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

// ═══════════════════════════════════════════════════════════════════════════
// 5. FORMALITY CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════════

export function scoreFormalityConsistency(items: FitItem[]): number {
  if (items.length <= 1) return 0.8;
  const formalities = items.map(i => i.formality);
  const gap = Math.max(...formalities) - Math.min(...formalities);
  if (gap <= 1.0) return 1.0;
  if (gap <= 1.5) return 0.8;
  if (gap <= 2.0) return 0.55;
  if (gap <= 2.5) return 0.3;
  return 0.15;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. SEASON MATCH
// ═══════════════════════════════════════════════════════════════════════════

const SEASON_COMPAT: Record<Season, Record<Season, number>> = {
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

// ═══════════════════════════════════════════════════════════════════════════
// 7. TEXTURE HARMONY
// ═══════════════════════════════════════════════════════════════════════════

const WEIGHT_LEVEL: Record<FabricWeight, number> = { light: 0, medium: 1, heavy: 2 };

export function scoreTextureHarmony(items: FitItem[]): number {
  const weights = items.filter(i => i.category !== 'accessory').map(i => WEIGHT_LEVEL[i.fabric.fabricWeight]);
  if (weights.length <= 1) return 0.7;

  const spread = Math.max(...weights) - Math.min(...weights);
  const consistencyScore = spread === 0 ? 0.6 : spread === 1 ? 1.0 : 0.4;

  const distinct = new Set(weights).size;
  const varietyScore = distinct === 1 ? 0.5 : distinct === 2 ? 1.0 : 0.7;

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
// TASTE ADJUSTMENT — pair affinity + aesthetic vetoes
// ═══════════════════════════════════════════════════════════════════════════
// A stylist thinks in vetoes and classics, not weighted averages. This layer
// adds a flat bonus for recognized classic combinations and a multiplicative
// penalty for combinations that are "valid but off" — a single fatal flaw
// should sink an outfit, not be averaged away by six decent dimensions.

// Classic core combos (top × bottom × shoes), keyed by garment type.
const CLASSIC_TRIPLES: Record<string, number> = {
  'SHIRT+TROUSERS+LOAFERS': 0.08,
  'SHIRT+TROUSERS+OXFORDS': 0.08,
  'SHIRT+CHINOS+LOAFERS': 0.06,
  'KNIT+TROUSERS+LOAFERS': 0.07,
  'SWEATER+TROUSERS+LOAFERS': 0.07,
  'SWEATER+CHINOS+SNEAKERS': 0.05,
  'TEE+JEANS+SNEAKERS': 0.06,
  'TEE+CHINOS+SNEAKERS': 0.04,
  'HOODIE+JEANS+SNEAKERS': 0.05,
  'POLO+CHINOS+LOAFERS': 0.06,
  'POLO+TROUSERS+LOAFERS': 0.05,
  'SHIRT+JEANS+SNEAKERS': 0.04,
  'KNIT+JEANS+BOOTS': 0.05,
  'TEE+SHORTS+SANDALS': 0.04,
  'TEE+SHORTS+SNEAKERS': 0.04,
  'BLOUSE+SKIRT+HEELS': 0.06,
  'BLOUSE+TROUSERS+HEELS': 0.06,
};

// Pairs that clash in dressiness or register, regardless of color/season.
const CLASHING_PAIRS: Array<[string, string, number]> = [
  ['SANDALS', 'TROUSERS', 0.45],
  ['SANDALS', 'BLAZER', 0.5],
  ['OXFORDS', 'SHORTS', 0.4],
  ['HEELS', 'SHORTS', 0.55],
  ['LOAFERS', 'SHORTS', 0.7],
  ['PARKA', 'TROUSERS', 0.75],
  ['HOODIE', 'TROUSERS', 0.7],
];

export interface TasteAdjustment {
  bonus: number;       // flat addition to totalScore (classic combos)
  multiplier: number;  // ≤1.0, multiplicative veto for aesthetic flaws
}

export function scoreTasteAdjustment(items: FitItem[]): TasteAdjustment {
  let bonus = 0;
  let multiplier = 1.0;

  const byCat = (cat: string) => items.find(i => i.category === cat);
  const top = byCat('top'), bottom = byCat('bottom'), shoes = byCat('shoes');

  // Classic-combo bonus
  if (top && bottom && shoes) {
    const key = `${top.typeName}+${bottom.typeName}+${shoes.typeName}`;
    bonus += CLASSIC_TRIPLES[key] ?? 0;
  }

  // Clashing-pair vetoes
  const types = new Set(items.map(i => i.typeName));
  for (const [a, b, mult] of CLASHING_PAIRS) {
    if (types.has(a) && types.has(b)) multiplier *= mult;
  }

  // Flat look: every non-accessory item dark AND muted — visually dead.
  const visible = items.filter(i => i.category !== 'accessory');
  if (visible.length >= 3) {
    const allDarkMuted = visible.every(i => i.colorProfile.lum < 35 && i.colorProfile.sat < 30);
    if (allDarkMuted) multiplier *= 0.6;
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

  return { bonus, multiplier };
}
