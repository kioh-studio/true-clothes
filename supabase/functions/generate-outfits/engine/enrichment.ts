// Item classification — converts a DB ClothingItemRow into an engine FitItem.
// Maps are hardcoded for now; will move to DB lookups (garment_types, colors,
// fabric_types, color_style_boosts tables) when those are created.

import {
  ClothingItemRow, FitItem, ItemCategory, ColorProfile, PrimaryColor,
  ColorLightness, ColorSaturation, GraphicsProfile, FabricProfile,
  Pattern, ItemFit, FabricName, GarmentMeasurements,
} from './types.ts';

// ─── Category mapping ─────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, ItemCategory> = {
  TEE: 'top', POLO: 'top', KNIT: 'top', SHIRT: 'top', BLOUSE: 'top', VEST: 'top',
  SWEATER: 'top', CARDIGAN: 'top', HENLEY: 'top',
  JACKET: 'outwear', BLAZER: 'outwear', COAT: 'outwear', HOODIE: 'outwear', PARKA: 'outwear', OVERCOAT: 'outwear',
  JEANS: 'bottom', TROUSERS: 'bottom', CHINOS: 'bottom', SHORTS: 'bottom', SKIRT: 'bottom', DRESS: 'bottom',
  LOAFERS: 'shoes', SNEAKERS: 'shoes', BOOTS: 'shoes', HEELS: 'shoes', SANDALS: 'shoes', OXFORDS: 'shoes', MULES: 'shoes',
  BAG: 'accessory', BELT: 'accessory', SCARF: 'accessory', WATCH: 'accessory', CAP: 'accessory',
  NECKLACE: 'accessory', SUNGLASSES: 'accessory', HAT: 'accessory', RING: 'accessory', BRACELET: 'accessory',
};

export const categoryOf = (type: string): ItemCategory =>
  CATEGORY_MAP[type.toUpperCase()] ?? 'accessory';

// ─── Color normalization ──────────────────────────────────────────────────────

type Undertone = 'warm' | 'cool' | 'neutral';
type ColorEntry = [PrimaryColor, ColorLightness, ColorSaturation, number | undefined, number, number, Undertone];

const COLOR_MAP: Record<string, ColorEntry> = {
  White:      ['white',     'light',  'muted',     undefined, 0,   100, 'neutral'],
  Cream:      ['cream',     'light',  'muted',     45,        30,  93,  'warm'],
  Ivory:      ['ivory',     'light',  'muted',     50,        25,  95,  'warm'],
  Beige:      ['beige',     'light',  'muted',     40,        25,  80,  'warm'],
  Sand:       ['tan',       'light',  'muted',     35,        30,  75,  'warm'],
  Stone:      ['taupe',     'light',  'muted',     30,        12,  65,  'warm'],
  Dove:       ['gray',      'light',  'muted',     undefined, 5,   78,  'neutral'],
  Tan:        ['tan',       'light',  'muted',     30,        35,  70,  'warm'],
  Camel:      ['camel',     'medium', 'muted',     33,        40,  60,  'warm'],
  Gold:       ['metallic',  'medium', 'vivid',     45,        75,  55,  'warm'],
  Mustard:    ['yellow',    'medium', 'vivid',     48,        70,  50,  'warm'],
  Ochre:      ['yellow',    'medium', 'balanced',  42,        55,  50,  'warm'],
  Yellow:     ['yellow',    'light',  'vivid',     55,        90,  65,  'warm'],
  Orange:     ['orange',    'medium', 'vivid',     25,        85,  55,  'warm'],
  Rust:       ['orange',    'dark',   'balanced',  18,        55,  40,  'warm'],
  Terracotta: ['orange',    'medium', 'balanced',  15,        50,  50,  'warm'],
  Burgundy:   ['burgundy',  'dark',   'muted',     345,       40,  30,  'warm'],
  Wine:       ['burgundy',  'dark',   'muted',     340,       35,  28,  'warm'],
  Red:        ['red',       'medium', 'vivid',     0,         85,  50,  'warm'],
  Pink:       ['pink',      'light',  'balanced',  330,       60,  75,  'warm'],
  Purple:     ['purple',    'medium', 'balanced',  280,       50,  45,  'cool'],
  Olive:      ['olive',     'medium', 'muted',     80,        35,  40,  'warm'],
  Green:      ['green',     'medium', 'balanced',  120,       50,  45,  'cool'],
  Sage:       ['green',     'medium', 'muted',     110,       25,  55,  'cool'],
  Forest:     ['green',     'dark',   'muted',     140,       40,  28,  'cool'],
  Emerald:    ['teal',      'medium', 'vivid',     160,       70,  45,  'cool'],
  Teal:       ['teal',      'medium', 'balanced',  175,       50,  40,  'cool'],
  Blue:       ['blue',      'medium', 'vivid',     210,       80,  50,  'cool'],
  Indigo:     ['navy',      'dark',   'muted',     235,       45,  30,  'cool'],
  Navy:       ['navy',      'dark',   'muted',     225,       50,  25,  'cool'],
  Slate:      ['blue',      'medium', 'muted',     210,       20,  50,  'cool'],
  Grey:       ['gray',      'medium', 'muted',     undefined, 5,   50,  'neutral'],
  Gray:       ['gray',      'medium', 'muted',     undefined, 5,   50,  'neutral'],
  Charcoal:   ['charcoal',  'dark',   'muted',     undefined, 5,   28,  'neutral'],
  Black:      ['black',     'dark',   'muted',     undefined, 0,   5,   'neutral'],
  Brown:      ['brown',     'medium', 'muted',     25,        35,  35,  'warm'],
  Multicolor: ['multicolor','medium', 'vivid',     undefined, 50,  50,  'neutral'],
  Natural:    ['natural',   'light',  'muted',     45,        15,  82,  'warm'],
};

export const colorProfileOf = (colorName: string): ColorProfile => {
  const entry = COLOR_MAP[colorName];
  if (entry) {
    return {
      primaryColor: entry[0], colorLightness: entry[1], colorSaturation: entry[2],
      hue: entry[3], sat: entry[4], lum: entry[5], undertone: entry[6],
    };
  }
  return {
    primaryColor: 'natural', colorLightness: 'medium', colorSaturation: 'muted',
    hue: undefined, sat: 10, lum: 60, undertone: 'neutral',
  };
};

// ─── Fabric profile ──────────────────────────────────────────────────────────

type FabricDefaults = Pick<FabricProfile, 'fabricWeight' | 'breathability'>;

const FABRIC_DEFAULTS: Record<string, FabricDefaults> = {
  Cotton:  { fabricWeight: 'light',  breathability: 'high'   },
  Wool:    { fabricWeight: 'heavy',  breathability: 'low'    },
  Linen:   { fabricWeight: 'light',  breathability: 'high'   },
  Denim:   { fabricWeight: 'medium', breathability: 'medium' },
  Leather: { fabricWeight: 'heavy',  breathability: 'low'    },
  Nylon:   { fabricWeight: 'light',  breathability: 'medium' },
  Canvas:  { fabricWeight: 'medium', breathability: 'medium' },
  Silk:    { fabricWeight: 'light',  breathability: 'high'   },
  Plated:  { fabricWeight: 'medium', breathability: 'low'    },
  Steel:   { fabricWeight: 'heavy',  breathability: 'low'    },
  Acetate: { fabricWeight: 'light',  breathability: 'low'    },
};

type SeasonType = FabricProfile['season'];

const SEASON_BY_WEIGHT: Record<FabricProfile['fabricWeight'], SeasonType> = {
  light: 'summer', medium: 'allSeason', heavy: 'winter',
};

const LAYER_BY_CATEGORY: Record<ItemCategory, FabricProfile['layerRole']> = {
  top: 'base', bottom: 'base', shoes: 'base', accessory: 'base', outwear: 'outer',
};

const fabricProfileOf = (material: string | undefined, category: ItemCategory): FabricProfile => {
  const mat = material?.split(/[\/,]/)[0]?.trim();
  const def: Partial<FabricDefaults> = mat ? (FABRIC_DEFAULTS[mat] ?? {}) : {};
  const weight: FabricProfile['fabricWeight'] = def.fabricWeight ?? 'medium';
  return {
    pattern: 'solid',
    fabricWeight: weight,
    breathability: def.breathability ?? 'medium',
    season: SEASON_BY_WEIGHT[weight],
    layerRole: LAYER_BY_CATEGORY[category],
  };
};

// ─── Style affinities ────────────────────────────────────────────────────────

const STYLE_AFFINITIES: Record<string, string[]> = {
  TEE:        ['streetwear', 'athleisure', 'smartcasual', 'minimalist'],
  POLO:       ['preppy', 'smartcasual', 'oldmoney'],
  KNIT:       ['oldmoney', 'minimalist', 'smartcasual', 'preppy'],
  SHIRT:      ['oldmoney', 'smartcasual', 'preppy', 'minimalist'],
  BLOUSE:     ['bohemian', 'minimalist', 'smartcasual'],
  JACKET:     ['streetwear', 'smartcasual', 'oldmoney'],
  BLAZER:     ['oldmoney', 'smartcasual', 'preppy', 'minimalist'],
  COAT:       ['oldmoney', 'minimalist', 'smartcasual'],
  OVERCOAT:   ['oldmoney', 'minimalist'],
  HOODIE:     ['streetwear', 'athleisure'],
  JEANS:      ['streetwear', 'smartcasual', 'preppy', 'athleisure'],
  TROUSERS:   ['oldmoney', 'smartcasual', 'minimalist', 'preppy'],
  CHINOS:     ['preppy', 'smartcasual', 'oldmoney'],
  SHORTS:     ['athleisure', 'streetwear', 'preppy'],
  SKIRT:      ['bohemian', 'minimalist', 'y2k'],
  DRESS:      ['bohemian', 'minimalist', 'y2k', 'smartcasual'],
  LOAFERS:    ['oldmoney', 'minimalist', 'smartcasual', 'preppy'],
  SNEAKERS:   ['athleisure', 'streetwear', 'smartcasual'],
  BOOTS:      ['streetwear', 'bohemian', 'oldmoney'],
  BAG:        ['minimalist', 'oldmoney', 'streetwear'],
  BELT:       ['oldmoney', 'preppy', 'smartcasual'],
  SCARF:      ['oldmoney', 'bohemian', 'preppy'],
  WATCH:      ['oldmoney', 'preppy', 'smartcasual', 'minimalist'],
  NECKLACE:   ['bohemian', 'y2k', 'minimalist'],
  SUNGLASSES: ['streetwear', 'y2k', 'minimalist'],
};

const COLOR_STYLE_BOOSTS: Record<string, string[]> = {
  Black:     ['minimalist', 'streetwear'],
  White:     ['minimalist', 'preppy'],
  Navy:      ['oldmoney', 'preppy'],
  Charcoal:  ['minimalist', 'smartcasual'],
  Olive:     ['smartcasual', 'streetwear'],
  Cream:     ['oldmoney', 'minimalist'],
  Beige:     ['oldmoney', 'minimalist'],
  Red:       ['streetwear', 'y2k'],
  Yellow:    ['y2k', 'streetwear'],
  Pink:      ['y2k', 'bohemian'],
  Orange:    ['streetwear', 'y2k'],
  Burgundy:  ['oldmoney', 'smartcasual'],
  Brown:     ['oldmoney', 'bohemian'],
};

const MATERIAL_STYLE_BOOSTS: Record<string, string[]> = {
  Leather:  ['streetwear', 'oldmoney'],
  Wool:     ['oldmoney', 'preppy'],
  Linen:    ['minimalist', 'bohemian'],
  Denim:    ['streetwear', 'smartcasual'],
  Silk:     ['oldmoney', 'minimalist'],
  Nylon:    ['athleisure', 'streetwear'],
};

export function styleTagsOf(type: string, color?: string, material?: string): string[] {
  const baseTags = STYLE_AFFINITIES[type.toUpperCase()] ?? [];
  if (!color && !material) return baseTags;

  const boosts = new Set<string>();
  if (color && COLOR_STYLE_BOOSTS[color]) {
    COLOR_STYLE_BOOSTS[color].forEach(t => boosts.add(t));
  }
  if (material) {
    const mat = material.split(/[\/,]/)[0]?.trim();
    if (mat && MATERIAL_STYLE_BOOSTS[mat]) {
      MATERIAL_STYLE_BOOSTS[mat].forEach(t => boosts.add(t));
    }
  }

  const reinforced = baseTags.filter(t => boosts.has(t));
  const baseOnly   = baseTags.filter(t => !boosts.has(t));
  const boostOnly  = [...boosts].filter(t => !baseTags.includes(t));

  return [...reinforced, ...baseOnly, ...boostOnly];
}

// ─── Pattern inference ───────────────────────────────────────────────────────

const PATTERN_KEYWORDS: Array<[string, Pattern]> = [
  ['plaid', 'plaid'], ['check', 'checkered'], ['stripe', 'striped'],
  ['floral', 'floral'], ['graphic', 'graphic'], ['print', 'abstract'],
  ['abstract', 'abstract'],
];

const GRAPHIC_KEYWORDS: Array<[string, GraphicsProfile]> = [
  ['graphic', { graphicWeight: 'large_graphic', artworkType: 'graphic_illustration' }],
  ['print',   { graphicWeight: 'full_print', artworkType: 'all_over_print' }],
  ['logo',    { graphicWeight: 'medium_logo', artworkType: 'brand_logo' }],
];

function inferPattern(name: string): Pattern {
  const lower = name.toLowerCase();
  for (const [keyword, pattern] of PATTERN_KEYWORDS) {
    if (lower.includes(keyword)) return pattern;
  }
  return 'solid';
}

function inferGraphics(name: string): GraphicsProfile {
  const lower = name.toLowerCase();
  for (const [keyword, profile] of GRAPHIC_KEYWORDS) {
    if (lower.includes(keyword)) return profile;
  }
  return { graphicWeight: 'none', artworkType: 'none' };
}

// ─── Fit derivation ──────────────────────────────────────────────────────────

const FIT_FROM_STRING: Record<string, ItemFit> = {
  slim: 'slim', fitted: 'slim', skinny: 'slim',
  regular: 'regular', standard: 'regular', classic: 'regular',
  relaxed: 'relaxed', comfort: 'relaxed', loose: 'relaxed',
  wide: 'wide', 'wide-leg': 'wide', 'wide leg': 'wide',
  oversized: 'oversized', oversize: 'oversized', boxy: 'oversized',
};

const TYPE_DEFAULT_FIT: Record<string, ItemFit> = {
  TEE: 'regular', POLO: 'regular', KNIT: 'relaxed', SHIRT: 'regular',
  BLOUSE: 'relaxed', HENLEY: 'regular', SWEATER: 'relaxed', CARDIGAN: 'relaxed', VEST: 'regular',
  JACKET: 'regular', BLAZER: 'regular', COAT: 'relaxed', HOODIE: 'oversized',
  PARKA: 'oversized', OVERCOAT: 'relaxed',
  JEANS: 'regular', TROUSERS: 'regular', CHINOS: 'regular',
  SHORTS: 'regular', SKIRT: 'regular', DRESS: 'regular',
  LOAFERS: 'regular', SNEAKERS: 'regular', BOOTS: 'regular',
  HEELS: 'slim', SANDALS: 'regular', OXFORDS: 'regular', MULES: 'regular',
};

function deriveFit(item: ClothingItemRow): ItemFit {
  if (item.fit) {
    const normalized = FIT_FROM_STRING[item.fit.toLowerCase()];
    if (normalized) return normalized;
  }
  const lower = item.name.toLowerCase();
  for (const [keyword, fit] of Object.entries(FIT_FROM_STRING)) {
    if (lower.includes(keyword)) return fit;
  }
  return TYPE_DEFAULT_FIT[item.type.toUpperCase()] ?? 'regular';
}

// ─── Warmth (1–5) ────────────────────────────────────────────────────────────

const MATERIAL_WARMTH: Record<string, number> = {
  Cotton: 2, Linen: 1, Silk: 1, Nylon: 2, Denim: 3,
  Wool: 4, Leather: 4, Canvas: 3, Fleece: 5, Cashmere: 5,
};
const CATEGORY_WARMTH: Record<string, number> = {
  top: 2, bottom: 3, outwear: 4, shoes: 2, accessory: 1,
};

function deriveWarmth(material: string | undefined, category: ItemCategory): number {
  const mat = material?.split(/[\/,]/)[0]?.trim();
  if (mat && MATERIAL_WARMTH[mat] !== undefined) return MATERIAL_WARMTH[mat];
  return CATEGORY_WARMTH[category] ?? 2;
}

// ─── Formality (1–5) ─────────────────────────────────────────────────────────

const TYPE_FORMALITY: Record<string, number> = {
  TEE: 1.5, POLO: 2.5, KNIT: 3.0, SHIRT: 3.5, BLOUSE: 3.0,
  HENLEY: 2.0, SWEATER: 2.5, CARDIGAN: 2.5, VEST: 3.0,
  JACKET: 3.0, BLAZER: 4.5, COAT: 3.5, HOODIE: 1.5,
  PARKA: 2.0, OVERCOAT: 4.0,
  JEANS: 2.0, TROUSERS: 4.0, CHINOS: 3.0, SHORTS: 1.5, SKIRT: 3.0, DRESS: 3.5,
  LOAFERS: 4.0, SNEAKERS: 1.5, BOOTS: 3.0, HEELS: 4.5, SANDALS: 1.0,
  OXFORDS: 4.5, MULES: 3.0,
  BAG: 2.5, BELT: 3.5, SCARF: 3.0, WATCH: 3.5, CAP: 1.5,
  NECKLACE: 3.0, SUNGLASSES: 2.0, HAT: 2.5,
};

const COLOR_FORMALITY_SHIFT: Partial<Record<PrimaryColor, number>> = {
  black: 0.5, charcoal: 0.5, navy: 0.5,
  white: 0, cream: 0, beige: 0,
  red: -0.5, yellow: -0.5, orange: -0.5, pink: -0.5,
};

function deriveFormality(type: string, color: PrimaryColor, material?: string): number {
  let base = TYPE_FORMALITY[type.toUpperCase()] ?? 2.5;
  base += COLOR_FORMALITY_SHIFT[color] ?? 0;
  const mat = material?.split(/[\/,]/)[0]?.trim();
  if (mat === 'Wool' || mat === 'Cashmere' || mat === 'Silk') base += 0.5;
  if (mat === 'Nylon' || mat === 'Fleece') base -= 0.5;
  if (mat === 'Denim') base -= 0.3;
  return Math.max(1, Math.min(5, base));
}

// ─── Statement strength (0–5) ───────────────────────────────────────────────

function deriveStatementStrength(
  pattern: Pattern, graphics: GraphicsProfile, colorProfile: ColorProfile, type: string,
): number {
  let score = 0;
  const PATTERN_SCORES: Record<Pattern, number> = {
    solid: 0, striped: 0.5, checkered: 0.5, plaid: 1.0,
    floral: 1.5, graphic: 2.0, abstract: 1.5,
  };
  score += PATTERN_SCORES[pattern] ?? 0;

  const GRAPHIC_SCORES: Record<string, number> = {
    none: 0, small_logo: 0.2, medium_logo: 0.5, large_graphic: 1.5, full_print: 2.0,
  };
  score += GRAPHIC_SCORES[graphics.graphicWeight] ?? 0;

  if (colorProfile.colorSaturation === 'vivid') score += 1.0;
  else if (colorProfile.colorSaturation === 'balanced') score += 0.3;

  const NEUTRALS = new Set(['black', 'white', 'gray', 'charcoal', 'beige', 'cream', 'ivory', 'tan', 'taupe', 'camel', 'brown', 'khaki', 'natural', 'navy']);
  if (!NEUTRALS.has(colorProfile.primaryColor)) score += 0.5;

  const LOUD_TYPES = new Set(['BLAZER', 'COAT', 'OVERCOAT', 'DRESS']);
  const QUIET_TYPES = new Set(['TEE', 'BELT', 'WATCH', 'SOCKS']);
  if (LOUD_TYPES.has(type.toUpperCase())) score += 0.5;
  if (QUIET_TYPES.has(type.toUpperCase())) score -= 0.3;

  return Math.max(0, Math.min(5, score));
}

// ─── Fabric name normalization ──────────────────────────────────────────────

const FABRIC_NAME_MAP: Record<string, FabricName> = {
  Cotton: 'cotton', Wool: 'wool', Linen: 'linen', Cashmere: 'cashmere',
  Silk: 'silk', Denim: 'denim', Leather: 'leather', Suede: 'suede',
  Nylon: 'nylon', Polyester: 'polyester', Canvas: 'canvas', Corduroy: 'corduroy',
  Tweed: 'tweed', Flannel: 'flannel', Jersey: 'jersey', Fleece: 'fleece',
  Velvet: 'velvet',
};

function deriveFabricName(material: string | undefined): FabricName | undefined {
  if (!material) return undefined;
  const mat = material.split(/[\/,]/)[0]?.trim();
  return mat ? FABRIC_NAME_MAP[mat] : undefined;
}

// ─── Measurement conversion ─────────────────────────────────────────────────
// Converts the label/value array from ClothingItemRow into a GarmentMeasurements object.

const LABEL_TO_KEY: Record<string, keyof GarmentMeasurements> = {
  'chest': 'chest', 'length': 'body_length', 'sleeve': 'sleeves',
  'shoulder': 'shoulder_width', 'waist': 'waist', 'hip': 'hip',
  'inseam': 'inseam', 'rise': 'rise', 'thigh': 'thigh',
  'upper arm': 'upper_arm', 'leg opening': 'waist', // ignored in scoring
};

function parseMeasurements(
  raw: Array<{ label: string; value: string | number; unit?: string }> | undefined,
  category: ItemCategory,
): GarmentMeasurements | undefined {
  if (!raw || raw.length === 0) return undefined;

  const result: GarmentMeasurements = {};
  for (const { label, value } of raw) {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numValue)) continue;

    const key = LABEL_TO_KEY[label.toLowerCase()];
    if (key) {
      // Route 'waist' to the correct key based on category
      if (label.toLowerCase() === 'waist') {
        if (category === 'top') (result as Record<string, number>)['waist_top'] = numValue;
        else if (category === 'outwear') (result as Record<string, number>)['waist_outer'] = numValue;
        else (result as Record<string, number>)['waist'] = numValue;
      } else {
        (result as Record<string, number>)[key] = numValue;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ─── Build FitItem from ClothingItemRow ─────────────────────────────────────

export function toFitItem(item: ClothingItemRow): FitItem {
  const category = categoryOf(item.type);
  const pattern = inferPattern(item.name);
  const graphics = inferGraphics(item.name);
  const fabric = fabricProfileOf(item.material, category);
  const colorProfile = colorProfileOf(item.color);

  return {
    id: item.id,
    category,
    colorProfile,
    graphics,
    fabric: { ...fabric, pattern },
    garmentMeasurements: parseMeasurements(item.measurements, category),
    styleTags: styleTagsOf(item.type, item.color, item.material),
    fit: deriveFit(item),
    warmth: deriveWarmth(item.material, category),
    formality: deriveFormality(item.type, colorProfile.primaryColor, item.material),
    statementStrength: deriveStatementStrength(pattern, graphics, colorProfile, item.type),
    fabricName: deriveFabricName(item.material),
  };
}
