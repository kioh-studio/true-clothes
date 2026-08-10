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
    // slogan_text/graphic_illustration (2026-08-10): artworkType is a signal
    // independent of fabric.pattern, so a solid-pattern piece carrying a
    // slogan/graphic wasn't caught by macro_print — old money never wears one.
    bannedFeatures: ['loud_logo', 'macro_print', 'full_print', 'neon_color', 'slogan_text', 'graphic_illustration'],
    // HOODIE (2026-08-10): a wool/cashmere hoodie in navy/black/charcoal can
    // reach formality ~2.5 and pass this style's fabric/color/fit checks
    // outright (verified against deriveFormality/TYPE_FORMALITY in
    // enrichment.ts) — the streetwear silhouette itself is what's wrong, not
    // any scoreable attribute, hence a type-level exclusion.
    typesBanned: ['HOODIE'],
    overrides: ['favorite_color', 'preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.10, formality: 0.15, color: 0.20, proportion: 0.05, fit: 0.05 },
    attributes: { formality: 4.5, colorPalette: ['neutral', 'earth', 'monochrome'], silhouette: ['tailored', 'structured'], patternLevel: 1.5, textureRichness: 3.0, mood: ['serious', 'clean'] },
    neighbors: [
      { styleId: 'minimalist', weight: 0.8 }, { styleId: 'preppy', weight: 0.8 }, { styleId: 'smartcasual', weight: 0.6 },
      // Style catalog expansion (2026-08-10) — added bidirectionally with each new style's own entry.
      { styleId: 'officechic', weight: 0.5 }, { styleId: 'parisian', weight: 0.5 },
      { styleId: 'darkacademia', weight: 0.6 }, { styleId: 'elegant', weight: 0.5 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'businessformal', weight: 0.4 },
    ],
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
    // floral_print (2026-08-10): already redundant with macro_print here
    // (floral fabric.pattern always trips macro_print too) — kept explicit
    // for a clearer rejection reason on the style most defined by NOT having
    // it.
    bannedFeatures: ['loud_logo', 'macro_print', 'full_print', 'neon_color', 'floral_print'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, color: 0.30, style: 0.20, proportion: 0.15, texture: 0.05, formality: 0.05, fit: 0.05 },
    attributes: { formality: 3.5, colorPalette: ['neutral', 'monochrome', 'dark'], silhouette: ['tailored', 'relaxed'], patternLevel: 1.0, textureRichness: 1.5, mood: ['clean', 'serious'] },
    neighbors: [
      { styleId: 'oldmoney', weight: 0.8 }, { styleId: 'smartcasual', weight: 0.7 },
      // Style catalog expansion (2026-08-10)
      { styleId: 'officechic', weight: 0.4 }, { styleId: 'parisian', weight: 0.6 },
      { styleId: 'cleangirl', weight: 0.8 }, { styleId: 'kfashion', weight: 0.4 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'normcore', weight: 0.3 },
    ],
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
    neighbors: [
      { styleId: 'athleisure', weight: 0.7 }, { styleId: 'y2k', weight: 0.6 },
      // Style catalog expansion (2026-08-10)
      { styleId: 'grunge', weight: 0.5 }, { styleId: 'kfashion', weight: 0.3 }, { styleId: 'artsy', weight: 0.3 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'utility', weight: 0.4 }, { styleId: 'sporty', weight: 0.3 },
    ],
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
    bannedFeatures: ['loud_logo', 'full_print', 'neon_color'],
    overrides: [],
    weights: DEFAULT_WEIGHTS,
    attributes: { formality: 3.0, colorPalette: ['neutral', 'earth'], silhouette: ['structured', 'relaxed'], patternLevel: 1.5, textureRichness: 2.0, mood: ['clean', 'serious'] },
    neighbors: [
      { styleId: 'oldmoney', weight: 0.6 }, { styleId: 'minimalist', weight: 0.7 }, { styleId: 'preppy', weight: 0.8 },
      // Style catalog expansion (2026-08-10)
      { styleId: 'officechic', weight: 0.8 }, { styleId: 'parisian', weight: 0.5 },
      { styleId: 'cleangirl', weight: 0.5 }, { styleId: 'resort', weight: 0.3 },
    ],
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
    bannedFeatures: ['loud_logo', 'full_print', 'neon_color'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, formality: 0.15, color: 0.20, proportion: 0.10, texture: 0.05, fit: 0.10 },
    attributes: { formality: 3.5, colorPalette: ['neutral', 'pastel'], silhouette: ['structured', 'tailored'], patternLevel: 2.5, textureRichness: 2.0, mood: ['clean', 'playful'] },
    neighbors: [
      { styleId: 'oldmoney', weight: 0.8 }, { styleId: 'smartcasual', weight: 0.8 },
      // Style catalog expansion (2026-08-10)
      { styleId: 'darkacademia', weight: 0.5 },
    ],
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
    neighbors: [
      { styleId: 'streetwear', weight: 0.7 }, { styleId: 'y2k', weight: 0.4 },
      // Style catalog expansion (2026-08-10)
      { styleId: 'athflow', weight: 0.8 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'sporty', weight: 0.5 },
    ],
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
    neighbors: [
      { styleId: 'streetwear', weight: 0.6 }, { styleId: 'athleisure', weight: 0.4 },
      // Style catalog expansion (2026-08-10)
      { styleId: 'coquette', weight: 0.3 }, { styleId: 'grunge', weight: 0.3 }, { styleId: 'artsy', weight: 0.3 },
    ],
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
    neighbors: [
      { styleId: 'y2k', weight: 0.3 }, { styleId: 'athleisure', weight: 0.2 },
      // Style catalog expansion (2026-08-10)
      { styleId: 'feminine', weight: 0.4 }, { styleId: 'cottagecore', weight: 0.6 },
      { styleId: 'darkacademia', weight: 0.3 }, { styleId: 'vintage', weight: 0.4 }, { styleId: 'resort', weight: 0.5 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'retro70s', weight: 0.3 }, { styleId: 'whimsigoth', weight: 0.4 },
    ],
    popularity: 0.402,
  },
  // ─── Style catalog expansion (2026-08-10) ──────────────────────────────────
  // 14 new styles — 12 feminine-leaning, 2 gender-neutral — added to balance a
  // catalog that skewed masculine/unisex (see gender_lean backfill below and
  // public.styles migration 20260810000003). Vocabulary (colors/fabrics/fits/
  // banned features/attributes) is drawn EXCLUSIVELY from the unions already
  // declared in types.ts/enrichment.ts — no new values invented.
  {
    id: 'feminine', name: 'Feminine',
    palette: palette(
      ['pink', 'lavender', 'cream', 'white', 'ivory', 'mauve'],
      ['beige', 'coral', 'mint', 'taupe', 'burgundy', 'red', 'sage', 'black'],
      ['purple', 'fuchsia', 'wine'],
      ['olive', 'khaki', 'metallic', 'multicolor'],
    ),
    fabricsAllowed: ['cotton', 'silk', 'linen', 'cashmere', 'velvet', 'jersey', 'denim'],
    fabricsBanned: ['fleece', 'nylon', 'tweed'],
    allowedFits: ['slim', 'regular', 'relaxed'],
    formalityRange: [2.0, 4.0],
    bannedFeatures: ['loud_logo', 'neon_color'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, color: 0.32, texture: 0.15, style: 0.20, proportion: 0.08, formality: 0.05, fit: 0.05, season: 0.05 },
    attributes: { formality: 3.0, colorPalette: ['pastel', 'neutral'], silhouette: ['relaxed', 'bodycon'], patternLevel: 3.0, textureRichness: 3.5, mood: ['romantic', 'playful'] },
    neighbors: [
      { styleId: 'coquette', weight: 0.8 }, { styleId: 'cottagecore', weight: 0.5 },
      { styleId: 'bohemian', weight: 0.4 }, { styleId: 'elegant', weight: 0.5 },
    ],
    popularity: 0.620,
  },
  {
    id: 'officechic', name: 'Office Chic',
    palette: palette(
      ['navy', 'white', 'black', 'gray', 'charcoal', 'cream'],
      ['beige', 'camel', 'taupe', 'burgundy', 'blue'],
      ['teal', 'pink'],
      ['yellow', 'orange', 'multicolor', 'fuchsia'],
    ),
    fabricsAllowed: ['cotton', 'wool', 'linen', 'silk', 'cashmere', 'polyester'],
    fabricsBanned: ['fleece', 'denim', 'corduroy'],
    allowedFits: ['slim', 'regular'],
    formalityRange: [3.0, 4.5],
    bannedFeatures: ['loud_logo', 'full_print', 'neon_color', 'macro_print', 'slogan_text', 'graphic_illustration'],
    // HOODIE (2026-08-10): a cashmere navy/black hoodie can reach formality
    // ~2.5, right at this style's tolerance floor, and pass fabric/fit
    // otherwise — the type itself doesn't belong in "Office Chic".
    typesBanned: ['HOODIE'],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, formality: 0.18, fit: 0.15, proportion: 0.12, style: 0.20, color: 0.15, texture: 0.05, season: 0.05 },
    attributes: { formality: 4.0, colorPalette: ['neutral', 'monochrome'], silhouette: ['tailored', 'structured'], patternLevel: 1.5, textureRichness: 2.0, mood: ['serious', 'clean'] },
    neighbors: [
      { styleId: 'smartcasual', weight: 0.8 }, { styleId: 'oldmoney', weight: 0.5 },
      { styleId: 'minimalist', weight: 0.4 }, { styleId: 'elegant', weight: 0.5 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'businessformal', weight: 0.7 },
    ],
    popularity: 0.700,
  },
  {
    id: 'parisian', name: 'Parisian Chic',
    palette: palette(
      ['navy', 'white', 'black', 'cream', 'beige'],
      ['red', 'camel', 'gray', 'charcoal', 'natural', 'denim'],
      ['burgundy'],
      ['metallic', 'multicolor', 'fuchsia', 'mustard'],
    ),
    fabricsAllowed: ['cotton', 'linen', 'wool', 'silk', 'denim', 'cashmere'],
    fabricsBanned: ['fleece', 'nylon', 'velvet'],
    allowedFits: ['slim', 'regular', 'relaxed'],
    formalityRange: [2.5, 4.0],
    bannedFeatures: ['loud_logo', 'full_print', 'neon_color', 'macro_print'],
    // HOODIE (2026-08-10): a cashmere black/navy hoodie can reach formality
    // ~2.5, at this style's tolerance floor, and pass color/fabric/fit
    // otherwise — a hoodie breaks the tailored trench/breton-stripe
    // silhouette this style is built on regardless of its fabric.
    typesBanned: ['HOODIE'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, proportion: 0.15, color: 0.20, style: 0.25, texture: 0.05, formality: 0.10, fit: 0.10, season: 0.05 },
    attributes: { formality: 3.5, colorPalette: ['neutral', 'monochrome'], silhouette: ['tailored', 'relaxed'], patternLevel: 2.0, textureRichness: 2.0, mood: ['clean', 'serious'] },
    neighbors: [
      { styleId: 'minimalist', weight: 0.6 }, { styleId: 'oldmoney', weight: 0.5 },
      { styleId: 'elegant', weight: 0.6 }, { styleId: 'smartcasual', weight: 0.5 },
      { styleId: 'cleangirl', weight: 0.5 },
    ],
    popularity: 0.450,
  },
  {
    id: 'coquette', name: 'Coquette',
    palette: palette(
      ['pink', 'white', 'cream', 'ivory', 'lavender'],
      ['beige', 'mauve', 'red', 'fuchsia'],
      ['burgundy', 'purple'],
      ['olive', 'khaki', 'metallic', 'multicolor', 'charcoal'],
    ),
    fabricsAllowed: ['cotton', 'silk', 'jersey', 'velvet', 'cashmere'],
    fabricsBanned: ['leather', 'denim', 'tweed', 'canvas', 'nylon', 'fleece'],
    allowedFits: ['slim', 'regular'],
    formalityRange: [1.5, 3.5],
    bannedFeatures: ['loud_logo', 'neon_color', 'macro_print'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, color: 0.32, texture: 0.18, style: 0.20, proportion: 0.05, formality: 0.05, fit: 0.05, season: 0.05 },
    attributes: { formality: 2.0, colorPalette: ['pastel'], silhouette: ['bodycon', 'relaxed'], patternLevel: 3.5, textureRichness: 4.0, mood: ['romantic', 'playful'] },
    neighbors: [
      { styleId: 'feminine', weight: 0.8 }, { styleId: 'y2k', weight: 0.3 }, { styleId: 'cottagecore', weight: 0.4 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'pinup', weight: 0.3 },
    ],
    popularity: 0.400,
  },
  {
    id: 'cleangirl', name: 'Clean Girl',
    palette: palette(
      ['white', 'beige', 'cream', 'black', 'gray'],
      ['tan', 'camel', 'ivory', 'taupe', 'natural'],
      ['pink', 'sage'],
      ['multicolor', 'metallic', 'orange', 'yellow', 'fuchsia'],
    ),
    fabricsAllowed: ['cotton', 'linen', 'jersey', 'silk', 'cashmere'],
    fabricsBanned: ['fleece', 'velvet', 'tweed', 'corduroy'],
    allowedFits: ['slim', 'regular'],
    formalityRange: [2.0, 3.5],
    // floral_print (2026-08-10): already redundant with macro_print here —
    // kept explicit for a clearer rejection reason on the "quiet basics"
    // aesthetic this style is built on.
    bannedFeatures: ['loud_logo', 'macro_print', 'full_print', 'neon_color', 'floral_print'],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, color: 0.28, style: 0.20, proportion: 0.15, fit: 0.12, texture: 0.05, formality: 0.05, season: 0.05 },
    attributes: { formality: 2.5, colorPalette: ['neutral', 'monochrome'], silhouette: ['tailored', 'relaxed'], patternLevel: 1.0, textureRichness: 1.5, mood: ['clean'] },
    neighbors: [
      { styleId: 'minimalist', weight: 0.8 }, { styleId: 'smartcasual', weight: 0.5 },
      { styleId: 'parisian', weight: 0.5 }, { styleId: 'athflow', weight: 0.4 },
      { styleId: 'kfashion', weight: 0.4 },
    ],
    popularity: 0.580,
  },
  {
    id: 'darkacademia', name: 'Dark Academia',
    palette: palette(
      ['brown', 'burgundy', 'charcoal', 'olive', 'camel'],
      ['navy', 'black', 'tan', 'khaki', 'wine', 'gray'],
      ['mustard', 'rust'],
      ['pink', 'fuchsia', 'yellow', 'metallic', 'multicolor'],
    ),
    fabricsAllowed: ['wool', 'tweed', 'cashmere', 'cotton', 'corduroy', 'flannel', 'leather', 'suede'],
    fabricsBanned: ['nylon', 'polyester', 'fleece'],
    allowedFits: ['regular', 'relaxed'],
    formalityRange: [2.5, 4.0],
    bannedFeatures: ['neon_color', 'full_print', 'macro_print'],
    // HOODIE (2026-08-10): a cotton hoodie in navy/black/charcoal (all
    // allowed here) can reach formality ~2.0, at this style's tolerance
    // floor, and pass fabric/fit otherwise — a hoodie breaks the
    // tweed-blazer literary silhouette regardless of its fabric/color.
    typesBanned: ['HOODIE'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.18, color: 0.20, style: 0.22, formality: 0.12, proportion: 0.08, fit: 0.05, season: 0.05 },
    attributes: { formality: 3.5, colorPalette: ['earth', 'dark'], silhouette: ['structured', 'relaxed'], patternLevel: 2.0, textureRichness: 4.0, mood: ['serious', 'artistic'] },
    neighbors: [
      { styleId: 'oldmoney', weight: 0.6 }, { styleId: 'preppy', weight: 0.5 }, { styleId: 'bohemian', weight: 0.3 },
      { styleId: 'vintage', weight: 0.5 }, { styleId: 'grunge', weight: 0.3 }, { styleId: 'artsy', weight: 0.2 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'gothic', weight: 0.2 }, { styleId: 'whimsigoth', weight: 0.3 },
    ],
    popularity: 0.420,
  },
  {
    id: 'cottagecore', name: 'Cottagecore',
    palette: palette(
      ['cream', 'white', 'beige', 'sage', 'natural'],
      ['brown', 'tan', 'olive', 'mint', 'terracotta', 'ivory'],
      ['pink', 'yellow', 'coral'],
      ['black', 'charcoal', 'metallic'],
    ),
    fabricsAllowed: ['cotton', 'linen', 'wool', 'canvas', 'cashmere'],
    fabricsBanned: ['leather', 'nylon', 'polyester', 'velvet'],
    allowedFits: ['regular', 'relaxed', 'wide'],
    formalityRange: [1.0, 3.0],
    bannedFeatures: ['loud_logo', 'neon_color'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.15, color: 0.22, style: 0.20, season: 0.12, proportion: 0.10, formality: 0.05, fit: 0.06 },
    attributes: { formality: 1.5, colorPalette: ['earth', 'pastel'], silhouette: ['relaxed', 'oversized'], patternLevel: 3.5, textureRichness: 3.5, mood: ['romantic', 'artistic'] },
    neighbors: [
      { styleId: 'feminine', weight: 0.5 }, { styleId: 'bohemian', weight: 0.6 }, { styleId: 'coquette', weight: 0.4 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'utility', weight: 0.3 },
    ],
    popularity: 0.350,
  },
  {
    id: 'grunge', name: 'Grunge',
    palette: palette(
      ['black', 'charcoal', 'gray', 'denim', 'burgundy'],
      ['white', 'navy', 'brown', 'wine'],
      ['red', 'purple'],
      ['pink', 'mint', 'lavender', 'cream', 'ivory'],
    ),
    fabricsAllowed: ['denim', 'leather', 'cotton', 'wool', 'flannel'],
    fabricsBanned: ['silk', 'linen', 'velvet'],
    allowedFits: ['slim', 'regular', 'oversized', 'wide'],
    formalityRange: [1.0, 2.5],
    bannedFeatures: ['neon_color'],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.15, style: 0.28, proportion: 0.12, color: 0.18, formality: 0.05, fit: 0.07, season: 0.05 },
    attributes: { formality: 1.5, colorPalette: ['dark', 'bold'], silhouette: ['oversized', 'relaxed'], patternLevel: 3.0, textureRichness: 3.0, mood: ['edgy'] },
    neighbors: [
      { styleId: 'streetwear', weight: 0.5 }, { styleId: 'y2k', weight: 0.3 }, { styleId: 'darkacademia', weight: 0.3 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'gothic', weight: 0.4 },
    ],
    popularity: 0.380,
  },
  {
    id: 'athflow', name: 'Athflow',
    palette: palette(
      ['black', 'white', 'gray', 'sage', 'beige'],
      ['navy', 'olive', 'mint', 'lavender', 'taupe'],
      ['coral', 'teal'],
      ['metallic', 'multicolor'],
    ),
    fabricsAllowed: ['cotton', 'jersey', 'nylon', 'polyester', 'fleece', 'linen'],
    fabricsBanned: ['wool', 'tweed', 'leather', 'suede', 'velvet'],
    allowedFits: ['relaxed', 'regular', 'oversized'],
    formalityRange: [1.0, 2.5],
    bannedFeatures: ['loud_logo'],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, fit: 0.18, proportion: 0.15, style: 0.20, color: 0.18, formality: 0.05, season: 0.10, texture: 0.04 },
    attributes: { formality: 1.5, colorPalette: ['neutral', 'pastel'], silhouette: ['relaxed', 'oversized'], patternLevel: 1.0, textureRichness: 1.5, mood: ['clean', 'playful'] },
    neighbors: [
      { styleId: 'athleisure', weight: 0.8 }, { styleId: 'cleangirl', weight: 0.4 },
    ],
    popularity: 0.500,
  },
  {
    id: 'elegant', name: 'Elegant',
    palette: palette(
      ['black', 'navy', 'white', 'burgundy', 'charcoal'],
      ['cream', 'gray', 'camel', 'wine', 'taupe'],
      ['red', 'purple', 'metallic'],
      ['yellow', 'orange', 'multicolor'],
    ),
    fabricsAllowed: ['silk', 'wool', 'cashmere', 'velvet', 'cotton', 'leather'],
    fabricsBanned: ['fleece', 'nylon', 'canvas', 'denim'],
    allowedFits: ['slim', 'regular'],
    formalityRange: [3.0, 5.0],
    bannedFeatures: ['loud_logo', 'full_print', 'neon_color', 'macro_print', 'slogan_text', 'graphic_illustration'],
    // HOODIE (2026-08-10): a cashmere black hoodie can reach formality 2.5,
    // right at this style's tolerance floor, and pass fabric/color/fit
    // otherwise — the type itself doesn't belong in an evening-serious
    // wardrobe.
    typesBanned: ['HOODIE'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, formality: 0.20, color: 0.20, style: 0.22, texture: 0.12, proportion: 0.08, fit: 0.05, season: 0.03 },
    attributes: { formality: 4.5, colorPalette: ['dark', 'monochrome'], silhouette: ['tailored', 'bodycon'], patternLevel: 1.0, textureRichness: 3.0, mood: ['serious', 'romantic'] },
    neighbors: [
      { styleId: 'oldmoney', weight: 0.5 }, { styleId: 'parisian', weight: 0.6 },
      { styleId: 'officechic', weight: 0.5 }, { styleId: 'feminine', weight: 0.5 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'glam', weight: 0.5 }, { styleId: 'businessformal', weight: 0.3 },
      // Style catalog expansion batch 3 (2026-08-11)
      { styleId: 'mobwife', weight: 0.4 },
    ],
    popularity: 0.480,
  },
  {
    id: 'kfashion', name: 'K-Fashion',
    palette: palette(
      ['white', 'black', 'gray', 'beige', 'cream'],
      ['navy', 'brown', 'lavender', 'mint', 'sage', 'pink'],
      ['blue', 'mauve'],
      ['multicolor', 'metallic'],
    ),
    fabricsAllowed: ['cotton', 'wool', 'denim', 'jersey', 'linen', 'cashmere'],
    fabricsBanned: ['velvet', 'tweed'],
    allowedFits: ['regular', 'relaxed', 'oversized', 'wide'],
    formalityRange: [1.5, 3.5],
    bannedFeatures: ['loud_logo', 'neon_color'],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, proportion: 0.18, style: 0.25, color: 0.18, fit: 0.10, formality: 0.05, texture: 0.05, season: 0.09 },
    attributes: { formality: 2.5, colorPalette: ['neutral', 'pastel'], silhouette: ['oversized', 'relaxed'], patternLevel: 1.5, textureRichness: 2.0, mood: ['clean', 'playful'] },
    neighbors: [
      { styleId: 'minimalist', weight: 0.4 }, { styleId: 'streetwear', weight: 0.3 }, { styleId: 'cleangirl', weight: 0.4 },
    ],
    popularity: 0.650,
  },
  {
    id: 'vintage', name: 'Vintage',
    palette: palette(
      ['brown', 'camel', 'mustard', 'olive', 'cream'],
      ['rust', 'burgundy', 'tan', 'khaki', 'terracotta'],
      ['orange', 'teal'],
      ['metallic', 'multicolor'],
    ),
    fabricsAllowed: ['wool', 'cotton', 'corduroy', 'tweed', 'denim', 'leather', 'velvet'],
    fabricsBanned: ['nylon', 'polyester', 'fleece'],
    allowedFits: ['regular', 'relaxed', 'wide'],
    formalityRange: [1.5, 3.5],
    bannedFeatures: ['neon_color'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.18, color: 0.22, style: 0.22, formality: 0.08, proportion: 0.10, fit: 0.05, season: 0.05 },
    attributes: { formality: 2.5, colorPalette: ['earth', 'bold'], silhouette: ['relaxed', 'structured'], patternLevel: 3.0, textureRichness: 3.0, mood: ['artistic', 'romantic'] },
    neighbors: [
      { styleId: 'bohemian', weight: 0.4 }, { styleId: 'darkacademia', weight: 0.5 },
      // Style catalog expansion batch 2 (2026-08-10)
      { styleId: 'retro70s', weight: 0.6 }, { styleId: 'pinup', weight: 0.5 },
    ],
    popularity: 0.400,
  },
  {
    id: 'resort', name: 'Resort',
    palette: palette(
      ['white', 'cream', 'beige', 'natural', 'blue'],
      ['tan', 'khaki', 'coral', 'mint', 'terracotta', 'olive'],
      ['yellow', 'orange', 'teal'],
      ['black', 'charcoal', 'metallic', 'multicolor'],
    ),
    fabricsAllowed: ['linen', 'cotton', 'canvas'],
    fabricsBanned: ['wool', 'tweed', 'leather', 'suede', 'cashmere', 'velvet', 'fleece'],
    allowedFits: ['relaxed', 'regular', 'wide'],
    formalityRange: [1.0, 2.5],
    bannedFeatures: [],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, season: 0.18, color: 0.25, style: 0.20, texture: 0.10, proportion: 0.10, formality: 0.05, fit: 0.02 },
    attributes: { formality: 1.5, colorPalette: ['pastel', 'earth'], silhouette: ['relaxed', 'oversized'], patternLevel: 3.0, textureRichness: 2.5, mood: ['playful'] },
    neighbors: [
      { styleId: 'bohemian', weight: 0.5 }, { styleId: 'smartcasual', weight: 0.3 },
    ],
    popularity: 0.420,
  },
  {
    id: 'artsy', name: 'Artsy',
    palette: palette(
      ['black', 'white', 'gray', 'charcoal'],
      ['red', 'multicolor', 'purple', 'mustard', 'teal'],
      ['fuchsia', 'metallic'],
      [],
    ),
    fabricsAllowed: [], fabricsBanned: [],
    allowedFits: ['oversized', 'wide', 'relaxed', 'regular'],
    // Narrower than a typical avant-garde range might suggest (not [1.0,4.0]):
    // an empty fabricsAllowed/bannedFeatures makes this config very permissive
    // on color/fabric/features already, so formalityRange is the only real
    // discriminator left. Capping at 3.5 keeps Artsy from naturally covering
    // tailored-formal wardrobes (trousers/loafers register ~4.5) that belong
    // to Old Money/Elegant/Dark Academia — verified against
    // resolveFallbackStyles' existing fixtures in style-fallback.test.ts.
    formalityRange: [1.0, 3.5],
    bannedFeatures: [],
    overrides: [],
    weights: { ...DEFAULT_WEIGHTS, style: 0.32, proportion: 0.18, texture: 0.15, color: 0.15, formality: 0.03, fit: 0.05, season: 0.02 },
    attributes: { formality: 2.5, colorPalette: ['bold', 'monochrome'], silhouette: ['oversized', 'structured'], patternLevel: 4.0, textureRichness: 4.0, mood: ['artistic', 'edgy'] },
    neighbors: [
      { styleId: 'streetwear', weight: 0.3 }, { styleId: 'y2k', weight: 0.3 }, { styleId: 'darkacademia', weight: 0.2 },
    ],
    popularity: 0.300,
  },
  // ─── Style catalog expansion batch 2 (2026-08-10) ──────────────────────────
  // 9 new styles (22 → 31; 2 of the 11 requested — mobwife, modest — were
  // stopped, not shipped: see plan.md "Style catalog expansion batch 2" for
  // the vocabulary-gap reasoning). All gender_lean = 'feminine' except
  // businessformal/utility (both 'neutral', per instruction). Vocabulary
  // (colors/fabrics/fits/banned features/attributes) drawn EXCLUSIVELY from
  // the unions in types.ts/enrichment.ts — nothing new invented.
  {
    id: 'glam', name: 'Glam',
    palette: palette(
      ['black', 'metallic', 'burgundy', 'wine'],
      ['navy', 'charcoal', 'purple', 'red'],
      ['fuchsia', 'teal'],
      ['olive', 'khaki', 'beige', 'brown', 'camel', 'tan', 'natural', 'mustard', 'terracotta', 'coral', 'mint', 'sage', 'lavender', 'mauve', 'multicolor', 'yellow', 'orange'],
    ),
    fabricsAllowed: ['silk', 'velvet', 'cashmere'],
    fabricsBanned: ['cotton', 'denim', 'canvas', 'corduroy', 'flannel', 'fleece', 'nylon', 'polyester', 'linen', 'tweed', 'jersey', 'wool', 'suede', 'leather'],
    allowedFits: ['slim', 'regular'],
    // Highest formality band in the catalog — deliberately narrow/high, occupying
    // the [4.5,5.0] register no other style claims (elegant tops out at 5.0 but
    // starts at 3.0 — glam is evening-only, elegant covers day-formal too).
    formalityRange: [4.5, 5.0],
    // plaid_check (2026-08-10): checkered is exempt from macro_print (see
    // featuresPasses), so a gingham/houndstooth piece wasn't caught before —
    // no check pattern belongs in a silk/velvet evening wardrobe.
    // slogan_text/graphic_illustration: artworkType is independent of
    // fabric.pattern, so a solid-pattern piece carrying one wasn't caught.
    bannedFeatures: ['loud_logo', 'full_print', 'neon_color', 'macro_print', 'plaid_check', 'slogan_text', 'graphic_illustration'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, formality: 0.22, color: 0.22, texture: 0.16, style: 0.18, proportion: 0.08, fit: 0.08, season: 0.02 },
    attributes: { formality: 5.0, colorPalette: ['dark', 'bold'], silhouette: ['bodycon', 'tailored'], patternLevel: 1.5, textureRichness: 4.5, mood: ['romantic', 'edgy'] },
    neighbors: [
      { styleId: 'elegant', weight: 0.5 },
      // Style catalog expansion batch 3 (2026-08-11)
      { styleId: 'mobwife', weight: 0.5 },
    ],
    popularity: 0.320,
  },
  {
    id: 'businessformal', name: 'Business Formal',
    palette: palette(
      ['navy', 'charcoal', 'black', 'gray'],
      ['white', 'cream'],
      ['burgundy'],
      ['pink', 'fuchsia', 'yellow', 'orange', 'olive', 'khaki', 'camel', 'tan', 'natural', 'mustard', 'terracotta', 'coral', 'mint', 'lavender', 'sage', 'mauve', 'wine', 'multicolor', 'metallic', 'purple', 'red', 'green', 'teal', 'blue', 'brown', 'beige', 'taupe'],
    ),
    // Narrower than officechic (which allows the cotton/polyester "daily office"
    // register): suit-only fabrics, nothing casual.
    fabricsAllowed: ['wool', 'silk', 'cashmere'],
    fabricsBanned: ['cotton', 'linen', 'denim', 'leather', 'suede', 'nylon', 'polyester', 'canvas', 'corduroy', 'tweed', 'flannel', 'jersey', 'fleece', 'velvet'],
    allowedFits: ['slim', 'regular'],
    formalityRange: [4.0, 5.0],
    // slogan_text/graphic_illustration (2026-08-10): artworkType is
    // independent of fabric.pattern, so a solid-pattern piece carrying a
    // slogan/graphic wasn't caught by macro_print — never appropriate in a
    // suit-only wardrobe.
    bannedFeatures: ['loud_logo', 'full_print', 'neon_color', 'macro_print', 'slogan_text', 'graphic_illustration'],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, formality: 0.24, fit: 0.16, color: 0.16, style: 0.18, proportion: 0.10, texture: 0.04, season: 0.04 },
    attributes: { formality: 5.0, colorPalette: ['neutral', 'monochrome'], silhouette: ['tailored', 'structured'], patternLevel: 1.0, textureRichness: 1.5, mood: ['serious'] },
    neighbors: [
      { styleId: 'officechic', weight: 0.7 }, { styleId: 'oldmoney', weight: 0.4 }, { styleId: 'elegant', weight: 0.3 },
    ],
    popularity: 0.460,
  },
  {
    id: 'gothic', name: 'Gothic',
    palette: palette(
      ['black'],
      ['charcoal', 'burgundy', 'wine', 'purple'],
      ['metallic', 'fuchsia'],
      ['white', 'cream', 'beige', 'tan', 'camel', 'khaki', 'natural', 'ivory', 'taupe', 'olive', 'yellow', 'orange', 'coral', 'mint', 'sage', 'mustard', 'terracotta', 'pink', 'lavender', 'mauve', 'multicolor', 'green', 'blue', 'navy'],
    ),
    // Inverts grunge's fabric split on purpose: grunge is denim/flannel-core and
    // bans silk/velvet; gothic is velvet/silk-core and bans denim/flannel — the
    // two "dark" styles read as opposite wardrobes, not the same one twice.
    fabricsAllowed: ['velvet', 'silk', 'leather', 'cotton', 'cashmere'],
    fabricsBanned: ['denim', 'flannel', 'fleece', 'nylon', 'polyester', 'canvas', 'corduroy', 'tweed'],
    allowedFits: ['slim', 'regular'],
    formalityRange: [1.5, 3.5],
    // floral_print (2026-08-10): gothic doesn't ban macro_print, so this is a
    // genuinely new restriction (not redundant) — floral directly
    // contradicts the dark velvet/silk palette this style is built on.
    bannedFeatures: ['loud_logo', 'neon_color', 'full_print', 'floral_print'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, color: 0.24, texture: 0.20, style: 0.22, formality: 0.08, proportion: 0.08, fit: 0.10, season: 0.03 },
    attributes: { formality: 2.5, colorPalette: ['dark', 'monochrome'], silhouette: ['bodycon', 'structured'], patternLevel: 2.0, textureRichness: 4.0, mood: ['edgy', 'romantic'] },
    neighbors: [
      { styleId: 'grunge', weight: 0.4 }, { styleId: 'whimsigoth', weight: 0.6 }, { styleId: 'darkacademia', weight: 0.2 },
      // Style catalog expansion batch 3 (2026-08-11)
      { styleId: 'mobwife', weight: 0.4 },
    ],
    popularity: 0.220,
  },
  {
    id: 'utility', name: 'Utility',
    palette: palette(
      ['khaki', 'olive', 'tan'],
      ['beige', 'brown', 'gray', 'black', 'natural'],
      ['orange', 'rust'],
      ['pink', 'fuchsia', 'lavender', 'mauve', 'purple', 'metallic', 'multicolor', 'coral', 'mint', 'sage', 'yellow'],
    ),
    fabricsAllowed: ['canvas', 'cotton', 'denim', 'nylon'],
    fabricsBanned: ['silk', 'velvet', 'cashmere', 'tweed', 'flannel'],
    allowedFits: ['relaxed', 'wide', 'oversized'],
    formalityRange: [1.0, 2.5],
    bannedFeatures: [],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, style: 0.25, proportion: 0.16, fit: 0.14, color: 0.18, formality: 0.05, texture: 0.10, season: 0.10 },
    attributes: { formality: 2.0, colorPalette: ['earth', 'neutral'], silhouette: ['oversized', 'relaxed'], patternLevel: 1.5, textureRichness: 2.0, mood: ['clean', 'edgy'] },
    neighbors: [
      { styleId: 'streetwear', weight: 0.4 }, { styleId: 'cottagecore', weight: 0.3 }, { styleId: 'normcore', weight: 0.2 },
    ],
    popularity: 0.520,
  },
  {
    id: 'sporty', name: 'Sporty',
    palette: palette(
      ['white', 'navy', 'red', 'black'],
      ['gray', 'green', 'blue', 'cream', 'charcoal'],
      ['yellow', 'burgundy'],
      ['pink', 'purple', 'lavender', 'fuchsia', 'mauve', 'coral', 'mint', 'multicolor', 'metallic'],
    ),
    // Inverts athleisure's fabric ban on purpose: varsity/letterman pieces are
    // wool-body + leather-sleeve, exactly what athleisure's stretch/loungewear
    // wardrobe bans; athleisure's fleece staple is banned here instead.
    fabricsAllowed: ['cotton', 'jersey', 'denim', 'canvas', 'wool', 'leather'],
    fabricsBanned: ['silk', 'cashmere', 'velvet', 'tweed', 'fleece'],
    allowedFits: ['slim', 'regular', 'relaxed'],
    formalityRange: [1.0, 3.0],
    bannedFeatures: [],
    overrides: ['preferred_fit'],
    weights: { ...DEFAULT_WEIGHTS, proportion: 0.14, style: 0.22, fit: 0.14, color: 0.16, formality: 0.08, season: 0.10, texture: 0.08 },
    attributes: { formality: 2.0, colorPalette: ['bold', 'neutral'], silhouette: ['structured', 'relaxed'], patternLevel: 2.0, textureRichness: 2.0, mood: ['playful', 'clean'] },
    neighbors: [
      { styleId: 'athleisure', weight: 0.5 }, { styleId: 'streetwear', weight: 0.3 },
    ],
    popularity: 0.400,
  },
  {
    id: 'normcore', name: 'Normcore',
    palette: palette(
      ['gray', 'beige', 'white', 'black'],
      ['navy', 'charcoal', 'cream', 'khaki', 'brown', 'tan'],
      [],
      ['burgundy', 'teal', 'olive', 'camel', 'taupe', 'natural', 'ivory', 'purple', 'red', 'yellow', 'orange', 'pink', 'metallic', 'multicolor', 'mustard', 'rust', 'coral', 'mint', 'lavender', 'sage', 'terracotta', 'mauve', 'wine', 'fuchsia', 'denim'],
    ),
    // Inverts minimalist's fabric split on purpose ("cố ý tầm thường" vs
    // minimalist's "cố ý tinh tế"): mall-basic fleece/polyester/nylon allowed
    // here and banned there; minimalist's refined silk/cashmere/leather/linen
    // banned here. No accent color tier at all — deliberately unremarkable.
    fabricsAllowed: ['cotton', 'denim', 'jersey', 'fleece', 'polyester', 'nylon', 'canvas'],
    fabricsBanned: ['silk', 'cashmere', 'leather', 'linen', 'velvet', 'tweed', 'suede'],
    allowedFits: ['regular', 'relaxed', 'oversized'],
    formalityRange: [1.0, 2.5],
    // floral_print (2026-08-10): already redundant with macro_print here —
    // kept explicit for a clearer rejection reason on the "deliberately
    // unremarkable" mall-basic aesthetic this style is built on.
    bannedFeatures: ['loud_logo', 'macro_print', 'full_print', 'neon_color', 'floral_print'],
    overrides: [],
    weights: { ...DEFAULT_WEIGHTS, style: 0.14, color: 0.14, fit: 0.14, proportion: 0.14, formality: 0.10, season: 0.20, texture: 0.10 },
    attributes: { formality: 1.5, colorPalette: ['neutral'], silhouette: ['relaxed', 'oversized'], patternLevel: 1.0, textureRichness: 1.0, mood: ['clean'] },
    neighbors: [
      { styleId: 'minimalist', weight: 0.3 }, { styleId: 'utility', weight: 0.2 },
    ],
    popularity: 0.260,
  },
  {
    id: 'retro70s', name: 'Retro 70s',
    palette: palette(
      ['brown', 'orange', 'mustard', 'rust', 'olive'],
      ['camel', 'tan', 'terracotta', 'cream', 'khaki'],
      ['teal', 'yellow'],
      ['black', 'pink', 'fuchsia', 'lavender', 'metallic', 'multicolor', 'navy'],
    ),
    // Vintage allows tweed/wool/velvet (heritage-adjacent) and no jersey/suede;
    // retro70s swaps that for corduroy/suede/jersey and bans tweed/wool/velvet —
    // a real materials shift, not just a relabeled palette.
    fabricsAllowed: ['corduroy', 'denim', 'cotton', 'suede', 'jersey', 'leather'],
    fabricsBanned: ['tweed', 'wool', 'cashmere', 'silk', 'velvet', 'fleece', 'nylon', 'polyester', 'flannel', 'linen', 'canvas'],
    allowedFits: ['relaxed', 'wide', 'oversized'],
    formalityRange: [1.0, 3.0],
    bannedFeatures: ['neon_color'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.14, color: 0.22, style: 0.24, formality: 0.06, proportion: 0.12, fit: 0.06, season: 0.06 },
    attributes: { formality: 2.0, colorPalette: ['earth', 'bold'], silhouette: ['relaxed', 'oversized'], patternLevel: 4.0, textureRichness: 2.5, mood: ['playful', 'artistic'] },
    neighbors: [
      { styleId: 'vintage', weight: 0.6 }, { styleId: 'bohemian', weight: 0.3 },
    ],
    popularity: 0.300,
  },
  {
    id: 'pinup', name: 'Pinup',
    palette: palette(
      ['red', 'white', 'black'],
      ['navy', 'cream', 'burgundy'],
      ['pink', 'yellow'],
      ['olive', 'khaki', 'brown', 'tan', 'camel', 'natural', 'mustard', 'terracotta', 'metallic', 'multicolor'],
    ),
    // Bans the heavy/heritage fabrics vintage allows (wool/tweed/corduroy/
    // leather) in favor of fitted cotton/silk/denim/jersey — fit-and-flare
    // dresses, not thrifted outerwear.
    fabricsAllowed: ['cotton', 'silk', 'denim', 'jersey'],
    fabricsBanned: ['wool', 'tweed', 'corduroy', 'leather', 'flannel', 'fleece', 'nylon', 'polyester', 'canvas', 'suede', 'cashmere', 'velvet'],
    allowedFits: ['slim', 'regular'],
    formalityRange: [2.0, 4.0],
    bannedFeatures: ['neon_color'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, color: 0.24, texture: 0.14, style: 0.22, proportion: 0.10, formality: 0.10, fit: 0.12, season: 0.05 },
    attributes: { formality: 3.0, colorPalette: ['bold', 'neutral'], silhouette: ['bodycon', 'structured'], patternLevel: 3.5, textureRichness: 2.5, mood: ['playful', 'romantic'] },
    neighbors: [
      { styleId: 'vintage', weight: 0.5 }, { styleId: 'coquette', weight: 0.3 },
    ],
    popularity: 0.200,
  },
  {
    id: 'whimsigoth', name: 'Whimsigoth',
    palette: palette(
      ['black', 'burgundy', 'purple', 'wine'],
      ['charcoal', 'navy', 'olive', 'brown'],
      ['metallic', 'fuchsia'],
      ['pink', 'beige', 'cream', 'ivory', 'khaki', 'tan', 'natural', 'yellow', 'orange', 'coral', 'mint', 'sage', 'white'],
    ),
    // Inverts bohemian's palette on purpose: black is bohemian's one banned
    // color and whimsigoth's dominant one — "dark bohemian", not bohemian
    // restated. Fabric list drops bohemian's denim/leather/suede/canvas in
    // favor of a velvet/silk-led register.
    fabricsAllowed: ['velvet', 'silk', 'cotton', 'wool'],
    fabricsBanned: ['denim', 'canvas', 'leather', 'suede', 'nylon', 'polyester', 'fleece', 'tweed', 'corduroy', 'flannel', 'cashmere'],
    allowedFits: ['regular', 'relaxed', 'wide'],
    formalityRange: [1.5, 3.5],
    bannedFeatures: ['loud_logo', 'neon_color'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.18, color: 0.22, style: 0.22, formality: 0.06, proportion: 0.10, fit: 0.06, season: 0.08 },
    attributes: { formality: 2.5, colorPalette: ['dark', 'bold'], silhouette: ['relaxed', 'bodycon'], patternLevel: 3.0, textureRichness: 4.0, mood: ['romantic', 'edgy'] },
    neighbors: [
      { styleId: 'bohemian', weight: 0.4 }, { styleId: 'gothic', weight: 0.6 }, { styleId: 'darkacademia', weight: 0.3 },
    ],
    popularity: 0.230,
  },
  // ─── Style catalog expansion batch 3 (2026-08-11) — mobwife unblocked ─────
  // Batch 2 (2026-08-10) stopped 'mobwife' for a real vocabulary gap: its
  // defining material is fur, and FabricName had no fur/faux-fur entry (see
  // plan.md "Style catalog expansion batch 2"). The 'fur' FabricName value
  // added above (types.ts) + its FABRIC_DEFAULTS/MATERIAL_WARMTH/
  // FABRIC_NAME_MAP entries (enrichment.ts) close that gap — 'mobwife' ships
  // here. Vocabulary is otherwise drawn EXCLUSIVELY from the existing unions,
  // same discipline as batch 1/2.
  {
    id: 'mobwife', name: 'Mob Wife',
    palette: palette(
      ['black', 'brown', 'metallic', 'camel'],
      ['charcoal', 'burgundy', 'wine', 'tan', 'natural', 'khaki'],
      ['red', 'purple', 'rust'],
      ['white', 'navy', 'beige', 'gray', 'olive', 'blue', 'green', 'yellow', 'pink', 'orange',
       'cream', 'ivory', 'taupe', 'teal', 'multicolor', 'mustard', 'coral', 'mint', 'lavender',
       'sage', 'terracotta', 'mauve', 'fuchsia', 'denim'],
    ),
    fabricsAllowed: ['fur', 'leather', 'suede', 'cashmere', 'velvet'],
    fabricsBanned: ['cotton', 'wool', 'linen', 'silk', 'denim', 'nylon', 'polyester', 'canvas', 'corduroy', 'tweed', 'flannel', 'jersey', 'fleece'],
    // slim/relaxed/oversized (not glam/gothic's slim/regular): the oversized
    // fur coat over a fitted bodycon underlayer is the silhouette contrast
    // that defines this style — a single-fit-band config can't express it.
    allowedFits: ['slim', 'relaxed', 'oversized'],
    formalityRange: [2.0, 4.0],
    // No macro_print/floral_print/abstract_print/plaid_check ban (unlike
    // glam/gothic): animal/leopard print reads as fabric.pattern 'abstract'
    // (inferPattern/STORED_PATTERN_MAP have no dedicated 'animal' value) and
    // is core to this style's identity, not a violation of it.
    bannedFeatures: ['loud_logo', 'neon_color'],
    // HOODIE (2026-08-11): same rationale as oldmoney/officechic/parisian/
    // darkacademia/elegant above — a fur-trimmed hoodie could reach this
    // style's formality/fabric/fit tolerances (formality ~1.5 base + 0.5
    // color + 0.5 fur material = 2.5, within [2.0,4.0]), but the type itself
    // breaks the fur-coat-over-bodycon silhouette regardless of fabric.
    typesBanned: ['HOODIE'],
    overrides: ['favorite_color'],
    weights: { ...DEFAULT_WEIGHTS, texture: 0.24, color: 0.22, style: 0.20, formality: 0.10, proportion: 0.08, fit: 0.10, season: 0.03 },
    // textureRichness 5.0 — highest in the catalog (glam's 4.5 was the prior
    // max), per the fur/leather/gold-heavy identity this style is built on.
    attributes: { formality: 3.0, colorPalette: ['dark', 'earth'], silhouette: ['oversized', 'bodycon'], patternLevel: 3.5, textureRichness: 5.0, mood: ['edgy', 'romantic'] },
    neighbors: [
      { styleId: 'glam', weight: 0.5 }, { styleId: 'gothic', weight: 0.4 }, { styleId: 'elegant', weight: 0.4 },
    ],
    popularity: 0.280,
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

  // Pattern/artwork-derived features (2026-08-10). Narrower than macro_print
  // (which already fires for these fabric.pattern values, EXCEPT checkered,
  // whenever a config bans macro_print) — these let a style ban ONE specific
  // pattern/artwork without banning every non-solid/checkered/striped print.
  // artworkType is a separate signal from fabric.pattern (a solid-pattern tee
  // can still carry a slogan/graphic per LogoSignal), so these two checks are
  // never redundant with macro_print or with each other.
  if (item.fabric.pattern === 'floral' && config.bannedFeatures.includes('floral_print'))
    features.push('floral_print');
  if ((item.fabric.pattern === 'plaid' || item.fabric.pattern === 'checkered')
      && config.bannedFeatures.includes('plaid_check'))
    features.push('plaid_check');
  if (item.fabric.pattern === 'abstract' && config.bannedFeatures.includes('abstract_print'))
    features.push('abstract_print');
  if (item.graphics.artworkType === 'slogan_text' && config.bannedFeatures.includes('slogan_text'))
    features.push('slogan_text');
  if (item.graphics.artworkType === 'graphic_illustration' && config.bannedFeatures.includes('graphic_illustration'))
    features.push('graphic_illustration');

  if (features.length > 0) return `has banned features for ${config.name}: ${features.join(', ')}`;
  return null;
}

// Hard type exclusion (2026-08-10) — see StyleConfig.typesBanned in types.ts
// for the hand-curated-not-derived rationale.
function typePasses(item: FitItem, config: StyleConfig): string | null {
  const banned = config.typesBanned;
  if (!banned || banned.length === 0) return null;
  if (banned.includes(item.typeName))
    return `${item.typeName} is never worn in ${config.name}`;
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
    && featuresPasses(item, config) === null
    && typePasses(item, config) === null;
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
    const typeResult = typePasses(item, config);
    if (typeResult) reasons.push(typeResult);

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
