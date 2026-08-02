// Style hard constraint filtering — deletes non-matching items before generation.
// Style configs are hardcoded for now; will move to style_configs DB table.

import {
  FitItem, StyleConfig, PrimaryColor, ColorGrade, BannedFeature,
  ScoringWeights, FabricName, ItemFit,
} from './types.ts';

// ─── Palette helper ──────────────────────────────────────────────────────────

function palette(
  perfect: PrimaryColor[],
  allowed: PrimaryColor[],
  accent: PrimaryColor[],
  banned: PrimaryColor[],
): Partial<Record<PrimaryColor, ColorGrade>> {
  const map: Partial<Record<PrimaryColor, ColorGrade>> = {};
  for (const c of perfect) map[c] = 'perfect';
  for (const c of allowed) map[c] = 'allowed';
  for (const c of accent)  map[c] = 'accent';
  for (const c of banned)  map[c] = 'banned';
  return map;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  style: 0.25, color: 0.25, fit: 0.10,
  proportion: 0.10, formality: 0.10, season: 0.10, texture: 0.05,
};

// ─── Style Config Data ──────────────────────────────────────────────────────

export const STYLE_CONFIGS: StyleConfig[] = [
  {
    id: 'oldmoney', name: 'Old Money',
    palette: palette(
      ['navy', 'cream', 'camel', 'beige', 'white', 'gray', 'charcoal', 'ivory', 'taupe'],
      ['brown', 'tan', 'khaki', 'black', 'natural'],
      ['burgundy', 'olive', 'teal'],
      ['red', 'yellow', 'orange', 'pink', 'purple', 'metallic', 'multicolor'],
    ),
    fabricsAllowed: ['wool', 'cashmere', 'cotton', 'linen', 'silk', 'suede', 'leather', 'tweed', 'flannel', 'corduroy'],
    fabricsBanned: ['polyester', 'nylon', 'fleece'],
    allowedFits: ['regular', 'relaxed'],
    formalityRange: [2.5, 5.0],
    bannedFeatures: ['loud_logo', 'macro_print', 'full_print', 'neon_color', 'distressed'],
    overrides: ['favorite_color', 'preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.10, formality: 0.15, color: 0.20, proportion: 0.05, fit: 0.05 },
    attributes: { formality: 4.5, colorPalette: ['neutral', 'earth', 'monochrome'], silhouette: ['tailored', 'structured'], patternLevel: 1.5, textureRichness: 3.0, mood: ['serious', 'clean'] },
    neighbors: [{ styleId: 'minimalist', weight: 0.8 }, { styleId: 'preppy', weight: 0.8 }, { styleId: 'smartcasual', weight: 0.6 }],
    popularity: 0.748,
  },
  {
    id: 'minimalist', name: 'Minimalist',
    palette: palette(
      ['black', 'white', 'gray', 'charcoal', 'navy', 'cream', 'beige'],
      ['ivory', 'taupe', 'olive', 'camel', 'khaki', 'brown', 'tan', 'natural'],
      ['burgundy', 'teal'],
      ['red', 'yellow', 'orange', 'pink', 'purple', 'metallic', 'multicolor'],
    ),
    fabricsAllowed: ['cotton', 'wool', 'linen', 'cashmere', 'silk', 'denim', 'leather', 'jersey', 'canvas'],
    fabricsBanned: ['fleece', 'velvet'],
    allowedFits: ['slim', 'regular', 'relaxed'],
    formalityRange: [2.0, 4.5],
    bannedFeatures: ['loud_logo', 'macro_print', 'full_print', 'neon_color'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, color: 0.30, style: 0.20, proportion: 0.15, texture: 0.05, formality: 0.05, fit: 0.05 },
    attributes: { formality: 3.5, colorPalette: ['neutral', 'monochrome', 'dark'], silhouette: ['tailored', 'relaxed'], patternLevel: 1.0, textureRichness: 1.5, mood: ['clean', 'serious'] },
    neighbors: [{ styleId: 'oldmoney', weight: 0.8 }, { styleId: 'smartcasual', weight: 0.7 }],
    popularity: 0.568,
  },
  {
    id: 'streetwear', name: 'Streetwear',
    palette: palette(
      ['black', 'white', 'gray', 'charcoal', 'navy'],
      ['olive', 'beige', 'cream', 'brown', 'khaki', 'tan', 'red', 'orange', 'green', 'blue', 'purple', 'burgundy', 'teal', 'camel'],
      ['yellow', 'pink', 'metallic', 'multicolor'],
      [],
    ),
    fabricsAllowed: [], fabricsBanned: [],
    allowedFits: ['regular', 'relaxed', 'wide', 'oversized'],
    formalityRange: [1.0, 3.0],
    bannedFeatures: [],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, proportion: 0.15, style: 0.20, color: 0.20, texture: 0.10, formality: 0.05, fit: 0.05 },
    attributes: { formality: 2.0, colorPalette: ['bold', 'dark'], silhouette: ['oversized', 'relaxed'], patternLevel: 2.5, textureRichness: 1.5, mood: ['playful', 'edgy'] },
    neighbors: [{ styleId: 'athleisure', weight: 0.7 }, { styleId: 'y2k', weight: 0.6 }],
    popularity: 0.504,
  },
  {
    id: 'smartcasual', name: 'Smart Casual',
    palette: palette(
      ['navy', 'white', 'beige', 'gray', 'charcoal', 'cream', 'black', 'olive'],
      ['brown', 'tan', 'camel', 'khaki', 'ivory', 'taupe', 'blue', 'burgundy', 'teal', 'natural'],
      ['green', 'red', 'pink'],
      ['yellow', 'orange', 'purple', 'metallic', 'multicolor'],
    ),
    fabricsAllowed: ['cotton', 'wool', 'linen', 'denim', 'leather', 'silk', 'cashmere', 'canvas', 'suede', 'jersey', 'flannel', 'corduroy'],
    fabricsBanned: ['nylon', 'fleece'],
    allowedFits: ['slim', 'regular', 'relaxed'],
    formalityRange: [2.0, 4.0],
    bannedFeatures: ['loud_logo', 'full_print', 'neon_color', 'distressed'],
    overrides: [],
    weights: DEFAULT_WEIGHTS,
    attributes: { formality: 3.0, colorPalette: ['neutral', 'earth'], silhouette: ['structured', 'relaxed'], patternLevel: 1.5, textureRichness: 2.0, mood: ['clean', 'serious'] },
    neighbors: [{ styleId: 'oldmoney', weight: 0.6 }, { styleId: 'minimalist', weight: 0.7 }, { styleId: 'preppy', weight: 0.8 }],
    popularity: 0.750,
  },
  {
    id: 'preppy', name: 'Preppy',
    palette: palette(
      ['navy', 'white', 'cream', 'beige', 'khaki', 'green', 'blue'],
      ['gray', 'charcoal', 'tan', 'camel', 'brown', 'ivory', 'red', 'pink', 'burgundy', 'olive'],
      ['yellow', 'orange', 'teal'],
      ['purple', 'metallic', 'multicolor'],
    ),
    fabricsAllowed: ['cotton', 'wool', 'linen', 'cashmere', 'denim', 'leather', 'suede', 'canvas', 'tweed', 'flannel', 'corduroy'],
    fabricsBanned: ['nylon', 'polyester', 'fleece'],
    allowedFits: ['slim', 'regular'],
    formalityRange: [2.5, 4.5],
    bannedFeatures: ['loud_logo', 'full_print', 'neon_color', 'distressed'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, formality: 0.15, color: 0.20, proportion: 0.10, texture: 0.05, fit: 0.10 },
    attributes: { formality: 3.5, colorPalette: ['neutral', 'pastel'], silhouette: ['structured', 'tailored'], patternLevel: 2.5, textureRichness: 2.0, mood: ['clean', 'playful'] },
    neighbors: [{ styleId: 'oldmoney', weight: 0.8 }, { styleId: 'smartcasual', weight: 0.8 }],
    popularity: 0.500,
  },
  {
    id: 'athleisure', name: 'Athleisure',
    palette: palette(
      ['black', 'white', 'gray', 'charcoal', 'navy'],
      ['olive', 'beige', 'cream', 'khaki', 'green', 'blue', 'red', 'orange', 'teal'],
      ['yellow', 'pink', 'purple', 'multicolor'],
      [],
    ),
    fabricsAllowed: ['cotton', 'nylon', 'polyester', 'jersey', 'fleece', 'canvas', 'denim'],
    fabricsBanned: ['wool', 'cashmere', 'silk', 'suede', 'tweed', 'velvet'],
    allowedFits: ['regular', 'relaxed', 'oversized'],
    formalityRange: [1.0, 2.5],
    bannedFeatures: [],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, proportion: 0.15, style: 0.20, fit: 0.15, color: 0.15, formality: 0.05, season: 0.10, texture: 0.05 },
    attributes: { formality: 1.5, colorPalette: ['bold', 'neutral'], silhouette: ['relaxed', 'oversized'], patternLevel: 1.5, textureRichness: 1.0, mood: ['playful'] },
    neighbors: [{ styleId: 'streetwear', weight: 0.7 }, { styleId: 'y2k', weight: 0.4 }],
    popularity: 0.724,
  },
  {
    id: 'y2k', name: 'Y2K',
    palette: palette(
      ['pink', 'purple', 'blue', 'white', 'black'],
      ['red', 'orange', 'yellow', 'green', 'teal', 'cream', 'gray', 'metallic', 'multicolor'],
      ['navy', 'olive', 'beige', 'brown'],
      [],
    ),
    fabricsAllowed: [], fabricsBanned: ['tweed'],
    allowedFits: ['slim', 'regular', 'wide', 'oversized'],
    formalityRange: [1.0, 3.0],
    bannedFeatures: [],
    overrides: [],
    weights: { ...DEFAULT_WEIGHTS, style: 0.30, color: 0.20, proportion: 0.10, texture: 0.10, formality: 0.05, fit: 0.05, season: 0.05 },
    attributes: { formality: 1.5, colorPalette: ['bold', 'pastel'], silhouette: ['bodycon', 'oversized'], patternLevel: 4.0, textureRichness: 2.0, mood: ['playful', 'edgy'] },
    neighbors: [{ styleId: 'streetwear', weight: 0.6 }, { styleId: 'athleisure', weight: 0.4 }],
    popularity: 0.400,
  },
  {
    id: 'bohemian', name: 'Bohemian',
    palette: palette(
      ['beige', 'cream', 'brown', 'tan', 'olive', 'natural', 'ivory', 'taupe', 'khaki'],
      ['burgundy', 'teal', 'green', 'orange', 'red', 'camel', 'white', 'blue'],
      ['pink', 'yellow', 'purple', 'multicolor'],
      ['black', 'charcoal', 'metallic'],
    ),
    fabricsAllowed: ['cotton', 'linen', 'silk', 'wool', 'denim', 'leather', 'suede', 'canvas', 'velvet', 'jersey'],
    fabricsBanned: ['nylon', 'polyester', 'fleece'],
    allowedFits: ['regular', 'relaxed', 'wide', 'oversized'],
    formalityRange: [1.0, 3.0],
    bannedFeatures: ['loud_logo'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.15, color: 0.20, style: 0.20, proportion: 0.10, formality: 0.05, fit: 0.05, season: 0.10 },
    attributes: { formality: 2.0, colorPalette: ['earth', 'bold'], silhouette: ['relaxed', 'oversized'], patternLevel: 3.5, textureRichness: 4.0, mood: ['romantic', 'artistic'] },
    neighbors: [{ styleId: 'y2k', weight: 0.3 }, { styleId: 'athleisure', weight: 0.2 }],
    popularity: 0.402,
  },
];

export const styleConfigById = (id: string): StyleConfig | undefined =>
  STYLE_CONFIGS.find(s => s.id === id);

// ─── Filter checks ──────────────────────────────────────────────────────────

function colorPasses(item: FitItem, config: StyleConfig): string | null {
  const grade = config.palette[item.colorProfile.primaryColor];
  if (!grade) return null;
  if (grade === 'banned') return `${item.colorProfile.primaryColor} is not in the ${config.name} palette`;
  return null;
}

function fabricPasses(item: FitItem, config: StyleConfig): string | null {
  if (!item.fabricName) return null;
  if (config.fabricsBanned.length > 0 && config.fabricsBanned.includes(item.fabricName))
    return `${item.fabricName} fabric is banned in ${config.name}`;
  if (config.fabricsAllowed.length > 0 && !config.fabricsAllowed.includes(item.fabricName))
    return `${item.fabricName} fabric is not in the ${config.name} allowed list`;
  return null;
}

function fitPasses(item: FitItem, config: StyleConfig): string | null {
  if (config.allowedFits.length === 0) return null;
  if (!config.allowedFits.includes(item.fit))
    return `${item.fit} fit is not allowed in ${config.name} (requires ${config.allowedFits.join('/')})`;
  return null;
}

function formalityPasses(item: FitItem, config: StyleConfig): string | null {
  const [min, max] = config.formalityRange;
  if (item.formality < min - 0.5 || item.formality > max + 0.5)
    return `formality ${item.formality.toFixed(1)} is outside ${config.name} range [${min}–${max}]`;
  return null;
}

function featuresPasses(item: FitItem, config: StyleConfig): string | null {
  if (config.bannedFeatures.length === 0) return null;
  const features: BannedFeature[] = [];

  if (item.graphics.graphicWeight === 'large_graphic' || item.graphics.graphicWeight === 'full_print') {
    if (config.bannedFeatures.includes('loud_logo')) features.push('loud_logo');
    if (config.bannedFeatures.includes('full_print') && item.graphics.graphicWeight === 'full_print')
      features.push('full_print');
  }
  if (item.graphics.artworkType === 'brand_logo' && item.graphics.graphicWeight !== 'none' &&
      item.graphics.graphicWeight !== 'small_logo' && config.bannedFeatures.includes('loud_logo'))
    features.push('loud_logo');

  if (item.fabric.pattern !== 'solid' && item.fabric.pattern !== 'checkered' && item.fabric.pattern !== 'striped') {
    if (config.bannedFeatures.includes('macro_print')) features.push('macro_print');
  }

  if (item.colorProfile.colorSaturation === 'vivid' && config.bannedFeatures.includes('neon_color')) {
    const neonColors = new Set(['yellow', 'orange', 'green', 'pink']);
    if (neonColors.has(item.colorProfile.primaryColor)) features.push('neon_color');
  }

  if (features.length > 0) return `has banned features for ${config.name}: ${features.join(', ')}`;
  return null;
}

// ─── Main filter ────────────────────────────────────────────────────────────

export interface FilterResult {
  passed: FitItem[];
  rejected: Array<{ item: FitItem; reasons: string[] }>;
}

// The same five checks filterByStyle uses, exposed as a single true/false
// predicate — no reasons, no safety-net restoration. Used by the wardrobe-
// affinity fallback (below) to ask "does the wardrobe genuinely suit this
// style" without the safety net's "force something in so a category isn't
// empty" behavior leaking into that judgment.
export function passesStyleNaturally(item: FitItem, config: StyleConfig): boolean {
  return colorPasses(item, config) === null
    && fabricPasses(item, config) === null
    && fitPasses(item, config) === null
    && formalityPasses(item, config) === null
    && featuresPasses(item, config) === null;
}

export function filterByStyle(items: FitItem[], config: StyleConfig): FilterResult {
  const passed: FitItem[] = [];
  const rejected: FilterResult['rejected'] = [];

  for (const item of items) {
    const reasons: string[] = [];
    const colorResult = colorPasses(item, config);
    if (colorResult) reasons.push(colorResult);
    const fabricResult = fabricPasses(item, config);
    if (fabricResult) reasons.push(fabricResult);
    const fitResult = fitPasses(item, config);
    if (fitResult) reasons.push(fitResult);
    const formalityResult = formalityPasses(item, config);
    if (formalityResult) reasons.push(formalityResult);
    const featuresResult = featuresPasses(item, config);
    if (featuresResult) reasons.push(featuresResult);

    if (reasons.length === 0) passed.push(item);
    else rejected.push({ item, reasons });
  }

  // Safety: restore least-bad items for empty required categories
  const categories = ['top', 'bottom', 'shoes'] as const;
  for (const cat of categories) {
    if (passed.filter(i => i.category === cat).length === 0) {
      const rejectedInCat = rejected
        .filter(r => r.item.category === cat)
        .sort((a, b) => a.reasons.length - b.reasons.length);
      const toRestore = rejectedInCat.slice(0, 3);
      for (const r of toRestore) {
        passed.push(r.item);
        const idx = rejected.indexOf(r);
        if (idx >= 0) rejected.splice(idx, 1);
      }
    }
  }

  return { passed, rejected };
}

// ─── Wardrobe-affinity style fallback (2026-08-02) ─────────────────────────
// When the user has selected no styles, index.ts used to skip the style
// filter entirely — no style identity in the feed, and styleCoherence
// dropped out of scoring. Instead, pick up to `maxStyles` styles the
// wardrobe can ACTUALLY express naturally (passesStyleNaturally, not the
// safety-net-padded filterByStyle result) so the fallback reflects real
// coverage, not a forced restoration.

// A style only "covers" a wardrobe if it can build a complete outfit from it:
// a top + bottom + shoes, or a onepiece + shoes.
function hasOutfitCoverage(natural: FitItem[]): boolean {
  const hasTopBottomShoes = natural.some(i => i.category === 'top')
    && natural.some(i => i.category === 'bottom')
    && natural.some(i => i.category === 'shoes');
  const hasOnepieceShoes = natural.some(i => i.category === 'onepiece')
    && natural.some(i => i.category === 'shoes');
  return hasTopBottomShoes || hasOnepieceShoes;
}

export function resolveFallbackStyles(items: FitItem[], maxStyles = 3): StyleConfig[] {
  if (items.length === 0) return [];

  const scored = STYLE_CONFIGS
    .map(config => {
      const natural = items.filter(i => passesStyleNaturally(i, config));
      return { config, score: natural.length / items.length, eligible: hasOutfitCoverage(natural) };
    })
    .filter(s => s.eligible);

  scored.sort((a, b) =>
    b.score - a.score
    || b.config.popularity - a.config.popularity
    || a.config.id.localeCompare(b.config.id));

  return scored.slice(0, maxStyles).map(s => s.config);
}
