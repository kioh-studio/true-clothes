import { StyleConfig, PrimaryColor, ColorGrade, ScoringWeights } from '../../types/fitEngine';

// ─── Style Configs ──────────────────────────────────────────────────────────
// Each config is a prescriptive "recipe" with:
//   1. Hard constraints — DELETE items that violate the style
//   2. Override power — which user preferences the style clobbers
//   3. Scoring weights — per-style tuning of the ranking formula
//   4. Attribute vector — for similarity scoring (kept from StyleDef)

// Helper to build palette maps
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

export const STYLE_CONFIGS: StyleConfig[] = [
  // ── Old Money ─────────────────────────────────────────────────────────────
  {
    id: 'oldmoney',
    name: 'Old Money',
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
    attributes: {
      formality: 4.5,
      colorPalette: ['neutral', 'earth', 'monochrome'],
      silhouette: ['tailored', 'structured'],
      patternLevel: 1.5,
      textureRichness: 3.0,
      mood: ['serious', 'clean'],
    },
    neighbors: [
      { styleId: 'minimalist', weight: 0.8 },
      { styleId: 'preppy', weight: 0.8 },
      { styleId: 'smartcasual', weight: 0.6 },
    ],
    popularity: 0.748,
  },

  // ── Minimalist ────────────────────────────────────────────────────────────
  {
    id: 'minimalist',
    name: 'Minimalist',
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
    attributes: {
      formality: 3.5,
      colorPalette: ['neutral', 'monochrome', 'dark'],
      silhouette: ['tailored', 'relaxed'],
      patternLevel: 1.0,
      textureRichness: 1.5,
      mood: ['clean', 'serious'],
    },
    neighbors: [
      { styleId: 'oldmoney', weight: 0.8 },
      { styleId: 'smartcasual', weight: 0.7 },
    ],
    popularity: 0.568,
  },

  // ── Streetwear ────────────────────────────────────────────────────────────
  {
    id: 'streetwear',
    name: 'Streetwear',
    palette: palette(
      ['black', 'white', 'gray', 'charcoal', 'navy'],
      ['olive', 'beige', 'cream', 'brown', 'khaki', 'tan', 'red', 'orange', 'green', 'blue', 'purple', 'burgundy', 'teal', 'camel'],
      ['yellow', 'pink', 'metallic', 'multicolor'],
      [],
    ),
    fabricsAllowed: [], // open
    fabricsBanned: [],
    allowedFits: ['regular', 'relaxed', 'wide', 'oversized'],
    formalityRange: [1.0, 3.0],
    bannedFeatures: [],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, proportion: 0.15, style: 0.20, color: 0.20, texture: 0.10, formality: 0.05, fit: 0.05 },
    attributes: {
      formality: 2.0,
      colorPalette: ['bold', 'dark'],
      silhouette: ['oversized', 'relaxed'],
      patternLevel: 2.5,
      textureRichness: 1.5,
      mood: ['playful', 'edgy'],
    },
    neighbors: [
      { styleId: 'athleisure', weight: 0.7 },
      { styleId: 'y2k', weight: 0.6 },
    ],
    popularity: 0.504,
  },

  // ── Smart Casual ──────────────────────────────────────────────────────────
  {
    id: 'smartcasual',
    name: 'Smart Casual',
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
    attributes: {
      formality: 3.0,
      colorPalette: ['neutral', 'earth'],
      silhouette: ['structured', 'relaxed'],
      patternLevel: 1.5,
      textureRichness: 2.0,
      mood: ['clean', 'serious'],
    },
    neighbors: [
      { styleId: 'oldmoney', weight: 0.6 },
      { styleId: 'minimalist', weight: 0.7 },
      { styleId: 'preppy', weight: 0.8 },
    ],
    popularity: 0.750,
  },

  // ── Preppy ────────────────────────────────────────────────────────────────
  {
    id: 'preppy',
    name: 'Preppy',
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
    attributes: {
      formality: 3.5,
      colorPalette: ['neutral', 'pastel'],
      silhouette: ['structured', 'tailored'],
      patternLevel: 2.5,
      textureRichness: 2.0,
      mood: ['clean', 'playful'],
    },
    neighbors: [
      { styleId: 'oldmoney', weight: 0.8 },
      { styleId: 'smartcasual', weight: 0.8 },
    ],
    popularity: 0.500,
  },

  // ── Athleisure ────────────────────────────────────────────────────────────
  {
    id: 'athleisure',
    name: 'Athleisure',
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
    attributes: {
      formality: 1.5,
      colorPalette: ['bold', 'neutral'],
      silhouette: ['relaxed', 'oversized'],
      patternLevel: 1.5,
      textureRichness: 1.0,
      mood: ['playful'],
    },
    neighbors: [
      { styleId: 'streetwear', weight: 0.7 },
      { styleId: 'y2k', weight: 0.4 },
    ],
    popularity: 0.724,
  },

  // ── Y2K ───────────────────────────────────────────────────────────────────
  {
    id: 'y2k',
    name: 'Y2K',
    palette: palette(
      ['pink', 'purple', 'blue', 'white', 'black'],
      ['red', 'orange', 'yellow', 'green', 'teal', 'cream', 'gray', 'metallic', 'multicolor'],
      ['navy', 'olive', 'beige', 'brown'],
      [],
    ),
    fabricsAllowed: [], // open
    fabricsBanned: ['tweed'],
    allowedFits: ['slim', 'regular', 'wide', 'oversized'],
    formalityRange: [1.0, 3.0],
    bannedFeatures: [],
    overrides: [],
    weights: { ...DEFAULT_WEIGHTS, style: 0.30, color: 0.20, proportion: 0.10, texture: 0.10, formality: 0.05, fit: 0.05, season: 0.05 },
    attributes: {
      formality: 1.5,
      colorPalette: ['bold', 'pastel'],
      silhouette: ['bodycon', 'oversized'],
      patternLevel: 4.0,
      textureRichness: 2.0,
      mood: ['playful', 'edgy'],
    },
    neighbors: [
      { styleId: 'streetwear', weight: 0.6 },
      { styleId: 'athleisure', weight: 0.4 },
    ],
    popularity: 0.400,
  },

  // ── Bohemian ──────────────────────────────────────────────────────────────
  {
    id: 'bohemian',
    name: 'Bohemian',
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
    attributes: {
      formality: 2.0,
      colorPalette: ['earth', 'bold'],
      silhouette: ['relaxed', 'oversized'],
      patternLevel: 3.5,
      textureRichness: 4.0,
      mood: ['romantic', 'artistic'],
    },
    neighbors: [
      { styleId: 'y2k', weight: 0.3 },
      { styleId: 'athleisure', weight: 0.2 },
    ],
    popularity: 0.402,
  },
];

export const styleConfigById = (id: string): StyleConfig | undefined =>
  STYLE_CONFIGS.find(s => s.id === id);

export const allStyleConfigIds = (): string[] =>
  STYLE_CONFIGS.map(s => s.id);
