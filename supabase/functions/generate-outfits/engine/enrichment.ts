// Item classification — converts a DB ClothingItemRow into an engine FitItem.
// Maps are hardcoded for now; will move to DB lookups (garment_types, colors,
// fabric_types, color_style_boosts tables) when those are created.

import {
  ClothingItemRow, FitItem, ItemCategory, ColorProfile, PrimaryColor,
  ColorLightness, ColorSaturation, GraphicsProfile, FabricProfile,
  Pattern, ItemFit, FabricName, GarmentMeasurements, LogoSignal,
  BodyMeasurements, PreferredFit, BodyShape,
} from './types.ts';

// ─── Category mapping ─────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, ItemCategory> = {
  TEE: 'top', POLO: 'top', KNIT: 'top', SHIRT: 'top', BLOUSE: 'top', VEST: 'top',
  SWEATER: 'top', CARDIGAN: 'top', HENLEY: 'top',
  CAMISOLE: 'top', CROP: 'top', BODYSUIT: 'top', TUNIC: 'top', CORSET: 'top',
  JACKET: 'outwear', BLAZER: 'outwear', COAT: 'outwear', HOODIE: 'outwear', PARKA: 'outwear', OVERCOAT: 'outwear', CAPE: 'outwear', KIMONO: 'outwear',
  JEANS: 'bottom', TROUSERS: 'bottom', CHINOS: 'bottom', SHORTS: 'bottom', SKIRT: 'bottom', LEGGINGS: 'bottom',
  DRESS: 'onepiece', JUMPSUIT: 'onepiece', OVERALLS: 'onepiece', GOWN: 'onepiece',
  LOAFERS: 'shoes', SNEAKERS: 'shoes', BOOTS: 'shoes', HEELS: 'shoes', SANDALS: 'shoes', OXFORDS: 'shoes', MULES: 'shoes', FLATS: 'shoes', WEDGES: 'shoes',
  BAG: 'accessory', BELT: 'accessory', SCARF: 'accessory', WATCH: 'accessory', CAP: 'accessory',
  NECKLACE: 'accessory', SUNGLASSES: 'accessory', HAT: 'accessory', RING: 'accessory', BRACELET: 'accessory',
  EARRINGS: 'accessory', GLOVES: 'accessory', TIGHTS: 'accessory', TIE: 'accessory',
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
  // Mustard/Rust/Terracotta/Wine/Sage: previously collapsed into a nearby
  // bucket (yellow/orange/orange/burgundy/green) because the engine had no
  // dedicated PrimaryColor for them. Now repointed to their own vocabulary
  // entry (+11 expansion, 2026-07-06) — hue/sat/lum match the canonical
  // table in types.ts's PrimaryColor doc comment.
  Mustard:    ['mustard',   'medium', 'vivid',     48,        65,  55,  'warm'],
  Ochre:      ['yellow',    'medium', 'balanced',  42,        55,  50,  'warm'],
  Yellow:     ['yellow',    'light',  'vivid',     55,        90,  65,  'warm'],
  Orange:     ['orange',    'medium', 'vivid',     25,        85,  55,  'warm'],
  Coral:      ['coral',     'light',  'vivid',     12,        65,  70,  'warm'],
  Rust:       ['rust',      'medium', 'vivid',     18,        60,  45,  'warm'],
  Terracotta: ['terracotta','medium', 'balanced',  16,        55,  50,  'warm'],
  Burgundy:   ['burgundy',  'dark',   'muted',     345,       40,  30,  'warm'],
  Wine:       ['wine',      'dark',   'balanced',  345,       55,  30,  'cool'],
  Red:        ['red',       'medium', 'vivid',     0,         85,  50,  'warm'],
  Pink:       ['pink',      'light',  'balanced',  330,       60,  75,  'warm'],
  Fuchsia:    ['fuchsia',   'medium', 'vivid',     320,       85,  55,  'cool'],
  Purple:     ['purple',    'medium', 'balanced',  280,       50,  45,  'cool'],
  Lavender:   ['lavender',  'light',  'muted',     275,       30,  75,  'cool'],
  Mauve:      ['mauve',     'medium', 'muted',     315,       25,  60,  'cool'],
  Olive:      ['olive',     'medium', 'muted',     80,        35,  40,  'warm'],
  Green:      ['green',     'medium', 'balanced',  120,       50,  45,  'cool'],
  Sage:       ['sage',      'medium', 'muted',     110,       20,  60,  'neutral'],
  Mint:       ['mint',      'light',  'muted',     150,       35,  80,  'cool'],
  Forest:     ['green',     'dark',   'muted',     140,       40,  28,  'cool'],
  Emerald:    ['teal',      'medium', 'vivid',     160,       70,  45,  'cool'],
  Teal:       ['teal',      'medium', 'balanced',  175,       50,  40,  'cool'],
  Blue:       ['blue',      'medium', 'vivid',     210,       80,  50,  'cool'],
  Denim:      ['denim',     'medium', 'balanced',  215,       45,  45,  'cool'],
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

// Case-insensitive lookup — DB values are Title Case today, but AI extraction
// or future imports may store lowercase. Falling through to the default profile
// silently destroys the color signal, so normalize instead.
const COLOR_MAP_LC: Record<string, ColorEntry> = Object.fromEntries(
  Object.entries(COLOR_MAP).map(([k, v]) => [k.toLowerCase(), v]),
);

// Colors the AI extracted that aren't in the curated COLOR_MAP are persisted to
// the `colors` table (by generate-item-image). The engine loads them per request
// via registerColors() so such colors score from their real attributes (hue/
// undertone/lightness) instead of collapsing to the neutral fallback. Keyed
// lowercase; the curated COLOR_MAP still wins for the base palette.
export interface DbColorRow {
  name: string;
  primary_color: string;
  lightness: string;
  saturation: string;
  hue: number | null;
  sat_pct: number;
  lum_pct: number;
  undertone: string;
}

const DB_COLORS: Record<string, ColorProfile> = {};

export function registerColors(rows: DbColorRow[]): void {
  for (const r of rows) {
    if (!r?.name) continue;
    DB_COLORS[r.name.trim().toLowerCase()] = {
      primaryColor:   r.primary_color as PrimaryColor,
      colorLightness: r.lightness as ColorLightness,
      colorSaturation: r.saturation as ColorSaturation,
      hue: typeof r.hue === 'number' ? r.hue : undefined,
      sat: r.sat_pct,
      lum: r.lum_pct,
      undertone: (r.undertone as Undertone) ?? 'neutral',
    };
  }
}

// ─── Measured-hex color layer (2026-07-06) ──────────────────────────────────
// Converts a raw '#RRGGBB' hex into HSL-equivalent (hue 0-360, sat/lum 0-100 —
// same scale as ColorEntry/DB_COLORS) and the nearest named canonical colour.
// Used for (a) an item's stored primary_hex/secondary_hex (toFitItem below —
// refines hue/sat/lum only, the categorical name stays from the `color`
// field), and (b) colorPreferences entries that are hex strings rather than
// names (personal_palette stores TONE12_PALETTES hexes, not colour names —
// see src/features/personal-color/tone12.ts) — previously these silently
// fell through colorProfileOf to the 'natural' default.

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function hexToHsl(hex: string): { hue: number; sat: number; lum: number } {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const lum = (max + min) / 2;
  let hue = 0, sat = 0;
  const d = max - min;
  if (d !== 0) {
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue: Math.round(hue), sat: Math.round(sat * 100), lum: Math.round(lum * 100) };
}

// CALIBRATION-PENDING: coarse hue-band undertone heuristic — only used as a
// fallback when no curated COLOR_MAP name applies (raw hex input). Reds/
// oranges/yellows read warm, blues/purples/magentas read cool, the green/
// yellow-green band is treated as neutral (mirrors how the curated table
// splits e.g. Olive 'warm' vs Sage 'neutral' vs Forest 'cool' — an
// approximation, not a re-derivation of those curated exceptions).
export function undertoneFromHue(hue: number): Undertone {
  if (hue >= 330 || hue < 70) return 'warm';
  if (hue < 170) return 'neutral';
  return 'cool';
}

function lightnessBucket(lum: number): ColorLightness {
  return lum >= 60 ? 'light' : lum >= 30 ? 'medium' : 'dark';
}

function saturationBucket(sat: number): ColorSaturation {
  return sat >= 60 ? 'vivid' : sat >= 45 ? 'balanced' : 'muted';
}

// Nearest named COLOR_MAP entry by weighted distance over hue/sat/lum — used
// only to pick a categorical primaryColor for a raw hex (colorPreferences).
// Achromatic entries (undefined hue) are compared on sat/lum alone; a
// mismatch between one chromatic and one achromatic input carries a fixed
// penalty so a saturated hex never nearest-matches to black/white/gray.
function nearestNamedColor(hue: number, sat: number, lum: number): ColorEntry {
  let best: ColorEntry | undefined;
  let bestDist = Infinity;
  for (const entry of Object.values(COLOR_MAP)) {
    const [, , , eHue, eSat, eLum] = entry;
    let dist = ((sat - eSat) / 100) ** 2 * 1.0 + ((lum - eLum) / 100) ** 2 * 1.0;
    if (eHue === undefined) {
      dist += 0.5; // achromatic candidate — mild penalty vs a chromatic input
    } else {
      const hueDiff = Math.min(Math.abs(hue - eHue), 360 - Math.abs(hue - eHue));
      dist += (hueDiff / 180) ** 2 * 2.0; // hue is the strongest perceptual signal
    }
    if (dist < bestDist) { bestDist = dist; best = entry; }
  }
  // COLOR_MAP is a non-empty static table, so `best` is always assigned.
  return best!;
}

function colorProfileFromHex(hex: string): ColorProfile {
  const { hue, sat, lum } = hexToHsl(hex);
  const nearest = nearestNamedColor(hue, sat, lum);
  return {
    primaryColor: nearest[0],
    colorLightness: lightnessBucket(lum),
    colorSaturation: saturationBucket(sat),
    hue, sat, lum, // measured values, not the nearest entry's canonical ones
    undertone: undertoneFromHue(hue),
  };
}

export const colorProfileOf = (colorName: string): ColorProfile => {
  const trimmed = colorName ? colorName.trim() : '';
  if (HEX_RE.test(trimmed)) return colorProfileFromHex(trimmed);

  const key = trimmed.toLowerCase();
  const entry = key ? COLOR_MAP_LC[key] : undefined;
  if (entry) {
    return {
      primaryColor: entry[0], colorLightness: entry[1], colorSaturation: entry[2],
      hue: entry[3], sat: entry[4], lum: entry[5], undertone: entry[6],
    };
  }
  // Fall back to a DB-registered color (auto-added, richer than COLOR_MAP).
  const dbProfile = key ? DB_COLORS[key] : undefined;
  if (dbProfile) return dbProfile;

  return {
    primaryColor: 'natural', colorLightness: 'medium', colorSaturation: 'muted',
    hue: undefined, sat: 10, lum: 60, undertone: 'neutral',
  };
};

// ─── Fabric profile ──────────────────────────────────────────────────────────

// First material segment, normalized to Title Case so map lookups survive
// lowercase or uppercase DB values ('cotton/wool' → 'Cotton').
function primaryMaterial(material: string | undefined): string | undefined {
  const mat = material?.split(/[\/,]/)[0]?.trim();
  if (!mat) return undefined;
  return mat.charAt(0).toUpperCase() + mat.slice(1).toLowerCase();
}

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
  // Fur (2026-08-11, unlocks 'mobwife') — heaviest/least breathable fabric in
  // the catalog, real or faux.
  Fur:     { fabricWeight: 'heavy',  breathability: 'low'    },
};

type SeasonType = FabricProfile['season'];

const SEASON_BY_WEIGHT: Record<FabricProfile['fabricWeight'], SeasonType> = {
  light: 'summer', medium: 'allSeason', heavy: 'winter',
};

const LAYER_BY_CATEGORY: Record<ItemCategory, FabricProfile['layerRole']> = {
  top: 'base', bottom: 'base', shoes: 'base', accessory: 'base', outwear: 'outer', onepiece: 'base',
};

// Layer role by garment TYPE (2026-07-03) — the category-level map above
// collapsed layering to a binary (every top 'base', outerwear 'outer') so
// 'mid' was dead vocabulary: a sweater carried the same label as a tee.
// Types absent here fall back to the category map.
const LAYER_ROLE_BY_TYPE: Record<string, FabricProfile['layerRole']> = {
  // base — worn next to skin
  TEE: 'base', CAMISOLE: 'base', HENLEY: 'base', BLOUSE: 'base', POLO: 'base',
  BODYSUIT: 'base', CROP: 'base', TUNIC: 'base', CORSET: 'base', SHIRT: 'base',
  // mid — insulation / depth between base and shell
  SWEATER: 'mid', KNIT: 'mid', CARDIGAN: 'mid', VEST: 'mid', HOODIE: 'mid', KIMONO: 'mid',
  // outer — the shell
  JACKET: 'outer', BLAZER: 'outer', COAT: 'outer', PARKA: 'outer', OVERCOAT: 'outer', CAPE: 'outer',
};

// Can this piece be worn OPEN/OVER another top as a layer? Rule-derived from
// metadata the wardrobe already stores (type × fabric × fit) — no new column,
// applies retroactively. AI-extracted `can_layer` + a user toggle can override
// later (backlog: dual-role layering, tầng 2–3).
const LAYER_FABRICS = new Set(['flannel', 'denim', 'corduroy', 'wool', 'tweed']);

function deriveCanLayer(
  type: string,
  fabricName: string | undefined,
  fabricWeight: FabricProfile['fabricWeight'],
  fit: ItemFit,
): boolean {
  const t = type.toUpperCase();
  if (t === 'CARDIGAN' || t === 'VEST') return true;               // born to be worn open
  if (t === 'SHIRT' || t === 'HENLEY') {
    if (fabricName && LAYER_FABRICS.has(fabricName)) return true;  // shacket/overshirt fabrics
    if (fabricWeight === 'heavy') return true;
    return fit === 'relaxed' || fit === 'oversized';               // overshirt-read silhouette
  }
  if (t === 'SWEATER' || t === 'KNIT') return fit !== 'slim';      // knit-over-tee/oxford
  return false;
}

const fabricProfileOf = (material: string | undefined, category: ItemCategory): FabricProfile => {
  const mat = primaryMaterial(material);
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
  CAMISOLE:   ['minimalist', 'y2k', 'smartcasual'],
  CROP:       ['y2k', 'streetwear', 'athleisure'],
  BODYSUIT:   ['minimalist', 'y2k', 'athleisure'],
  TUNIC:      ['bohemian', 'minimalist', 'smartcasual'],
  CORSET:     ['y2k', 'bohemian', 'smartcasual'],
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
  LEGGINGS:   ['athleisure', 'streetwear'],
  CAPE:       ['bohemian', 'oldmoney', 'minimalist'],
  KIMONO:     ['bohemian', 'minimalist', 'oldmoney'],
  DRESS:      ['bohemian', 'minimalist', 'y2k', 'smartcasual'],
  LOAFERS:    ['oldmoney', 'minimalist', 'smartcasual', 'preppy'],
  SNEAKERS:   ['athleisure', 'streetwear', 'smartcasual'],
  BOOTS:      ['streetwear', 'bohemian', 'oldmoney'],
  FLATS:      ['minimalist', 'oldmoney', 'preppy', 'smartcasual'],
  WEDGES:     ['bohemian', 'smartcasual', 'preppy'],
  BAG:        ['minimalist', 'oldmoney', 'streetwear'],
  BELT:       ['oldmoney', 'preppy', 'smartcasual'],
  SCARF:      ['oldmoney', 'bohemian', 'preppy'],
  WATCH:      ['oldmoney', 'preppy', 'smartcasual', 'minimalist'],
  NECKLACE:   ['bohemian', 'y2k', 'minimalist'],
  EARRINGS:   ['minimalist', 'oldmoney', 'y2k'],
  GLOVES:     ['oldmoney', 'minimalist'],
  TIGHTS:     ['minimalist', 'y2k', 'preppy'],
  SUNGLASSES: ['streetwear', 'y2k', 'minimalist'],
  TIE:        ['oldmoney', 'preppy', 'smartcasual'],
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

const COLOR_KEY_LC: Record<string, string> = Object.fromEntries(
  Object.keys(COLOR_STYLE_BOOSTS).map(k => [k.toLowerCase(), k]),
);

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
  const colorKey = color ? COLOR_KEY_LC[color.trim().toLowerCase()] : undefined;
  if (colorKey && COLOR_STYLE_BOOSTS[colorKey]) {
    COLOR_STYLE_BOOSTS[colorKey].forEach(t => boosts.add(t));
  }
  const mat = primaryMaterial(material);
  if (mat && MATERIAL_STYLE_BOOSTS[mat]) {
    MATERIAL_STYLE_BOOSTS[mat].forEach(t => boosts.add(t));
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

// ─── Structured graphics (clothing_items.graphics jsonb, wired 2026-08-06) ──
// backfill-item-metadata / generate-item-image populate a structured
// {present,size,kind,text} signal (LogoSignal) that's strictly more reliable
// than guessing from the item NAME — prefer it when present. A LogoSignal
// with `kind` present but no size still carries real information (something
// IS there), so it lands on 'medium_logo' rather than silently degrading to
// 'none'. There is no LogoSignal kind for an all-over print, so a structured
// signal can never yield 'full_print'/'all_over_print' — only the name-
// keyword fallback ('print' in the name) can.
function graphicsFromLogoSignal(sig: LogoSignal): GraphicsProfile {
  if (!sig.present) return { graphicWeight: 'none', artworkType: 'none' };
  const artworkType: GraphicsProfile['artworkType'] =
    sig.kind === 'brand_logo'   ? 'brand_logo' :
    sig.kind === 'slogan_text'  ? 'slogan_text' :
    'graphic_illustration'; // kind === 'graphic', or present but unclassified
  const graphicWeight: GraphicsProfile['graphicWeight'] =
    sig.size === 'large'  ? 'large_graphic' :
    sig.size === 'small'  ? 'small_logo' :
    'medium_logo'; // 'medium' or unrecorded-but-present
  return { graphicWeight, artworkType };
}

// Prefer the structured jsonb signal; fall back to the name-keyword scan when
// the column is null/absent (most rows, until backfill/re-ingest catches up).
function resolveGraphics(item: ClothingItemRow): GraphicsProfile {
  if (item.graphics) return graphicsFromLogoSignal(item.graphics);
  return inferGraphics(item.name);
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
  CAMISOLE: 'slim', CROP: 'slim', BODYSUIT: 'slim', TUNIC: 'relaxed', CORSET: 'slim',
  JACKET: 'regular', BLAZER: 'regular', COAT: 'relaxed', HOODIE: 'oversized',
  PARKA: 'oversized', OVERCOAT: 'relaxed', CAPE: 'oversized', KIMONO: 'relaxed',
  JEANS: 'regular', TROUSERS: 'regular', CHINOS: 'regular',
  SHORTS: 'regular', SKIRT: 'regular', LEGGINGS: 'slim', DRESS: 'regular',
  LOAFERS: 'regular', SNEAKERS: 'regular', BOOTS: 'regular',
  HEELS: 'slim', SANDALS: 'regular', OXFORDS: 'regular', MULES: 'regular',
  FLATS: 'regular', WEDGES: 'regular',
};

// Returns the derived fit AND whether it came from a real signal (stored `fit`
// column or a fit keyword in the name) vs a type-default guess. The `real` flag
// feeds proportion-balance confidence weighting in ranking.ts.
function deriveFitWithProvenance(item: ClothingItemRow): { fit: ItemFit; real: boolean } {
  if (item.fit) {
    const normalized = FIT_FROM_STRING[item.fit.toLowerCase()];
    if (normalized) return { fit: normalized, real: true };
  }
  const lower = item.name.toLowerCase();
  for (const [keyword, fit] of Object.entries(FIT_FROM_STRING)) {
    if (lower.includes(keyword)) return { fit, real: true };
  }
  return { fit: TYPE_DEFAULT_FIT[item.type.toUpperCase()] ?? 'regular', real: false };
}

// ─── Warmth (1–5) ────────────────────────────────────────────────────────────

const MATERIAL_WARMTH: Record<string, number> = {
  Cotton: 2, Linen: 1, Silk: 1, Nylon: 2, Denim: 3,
  Wool: 4, Leather: 4, Canvas: 3, Fleece: 5, Cashmere: 5,
  // Fur (2026-08-11) — as warm as fleece/cashmere, the catalog max.
  Fur: 5,
};
const CATEGORY_WARMTH: Record<string, number> = {
  top: 2, bottom: 3, outwear: 4, shoes: 2, accessory: 1, onepiece: 3,
};

function deriveWarmth(material: string | undefined, category: ItemCategory): number {
  const mat = primaryMaterial(material);
  if (mat && MATERIAL_WARMTH[mat] !== undefined) return MATERIAL_WARMTH[mat];
  return CATEGORY_WARMTH[category] ?? 2;
}

// ─── Formality (1–5) ─────────────────────────────────────────────────────────

const TYPE_FORMALITY: Record<string, number> = {
  TEE: 1.5, POLO: 2.5, KNIT: 3.0, SHIRT: 3.5, BLOUSE: 3.0,
  HENLEY: 2.0, SWEATER: 2.5, CARDIGAN: 2.5, VEST: 3.0,
  CAMISOLE: 2.5, CROP: 1.5, BODYSUIT: 2.5, TUNIC: 2.5, CORSET: 3.0,
  JACKET: 3.0, BLAZER: 4.5, COAT: 3.5, HOODIE: 1.5,
  PARKA: 2.0, OVERCOAT: 4.0, CAPE: 3.5, KIMONO: 3.0,
  JEANS: 2.0, TROUSERS: 4.0, CHINOS: 3.0, SHORTS: 1.5, SKIRT: 3.0, LEGGINGS: 1.5, DRESS: 3.5,
  LOAFERS: 4.0, SNEAKERS: 1.5, BOOTS: 3.0, HEELS: 4.5, SANDALS: 1.0,
  OXFORDS: 4.5, MULES: 3.0, FLATS: 3.0, WEDGES: 3.0,
  BAG: 2.5, BELT: 3.5, SCARF: 3.0, WATCH: 3.5, CAP: 1.5,
  NECKLACE: 3.0, SUNGLASSES: 2.0, HAT: 2.5,
  EARRINGS: 3.0, GLOVES: 3.0, TIGHTS: 3.0, TIE: 3.5,
};

const COLOR_FORMALITY_SHIFT: Partial<Record<PrimaryColor, number>> = {
  black: 0.5, charcoal: 0.5, navy: 0.5,
  white: 0, cream: 0, beige: 0,
  red: -0.5, yellow: -0.5, orange: -0.5, pink: -0.5,
};

function deriveFormality(type: string, color: PrimaryColor, material?: string): number {
  let base = TYPE_FORMALITY[type.toUpperCase()] ?? 2.5;
  base += COLOR_FORMALITY_SHIFT[color] ?? 0;
  const mat = primaryMaterial(material);
  // Fur (2026-08-11) grouped with wool/cashmere/silk — reads as an elevated,
  // luxury material the same way those do.
  if (mat === 'Wool' || mat === 'Cashmere' || mat === 'Silk' || mat === 'Fur') base += 0.5;
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

  const LOUD_TYPES = new Set(['BLAZER', 'COAT', 'OVERCOAT', 'DRESS', 'CAPE', 'GOWN', 'KIMONO', 'CORSET']);
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
  // Fur (2026-08-11) — real or faux, see FabricName doc comment in types.ts.
  Fur: 'fur',
};

function deriveFabricName(material: string | undefined): FabricName | undefined {
  const mat = primaryMaterial(material);
  return mat ? FABRIC_NAME_MAP[mat] : undefined;
}

// ─── Measurement conversion ─────────────────────────────────────────────────
// Converts the label/value array from ClothingItemRow into a GarmentMeasurements object.

const LABEL_TO_KEY: Record<string, keyof GarmentMeasurements> = {
  'chest': 'chest', 'length': 'body_length', 'sleeve': 'sleeves',
  'shoulder': 'shoulder_width', 'waist': 'waist', 'hip': 'hip',
  'inseam': 'inseam', 'rise': 'rise', 'thigh': 'thigh',
  'upper arm': 'upper_arm',
  // 'leg opening' removed: it measures the hem circumference at the bottom of
  // a pant leg — not the waist. Routing it to 'waist' corrupted waist-ease
  // calculations. No valid fit-model key exists for leg opening, so it is
  // intentionally ignored (not mapped) rather than misrouted.
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

// ─── Stored ingest-time attributes ───────────────────────────────────────────
// AI extraction (extract-garments) and manual entry persist `pattern` and
// `warmth_season` on clothing_items. Stored values beat name-keyword guessing.

const STORED_PATTERN_MAP: Record<string, Pattern> = {
  solid: 'solid', striped: 'striped', stripe: 'striped',
  plaid: 'plaid', houndstooth: 'plaid', tartan: 'plaid',
  checked: 'checkered', checkered: 'checkered', check: 'checkered', gingham: 'checkered',
  floral: 'floral', graphic: 'graphic',
  print: 'abstract', abstract: 'abstract', camo: 'abstract', 'polka dot': 'abstract',
};

const WARMTH_SEASON_MAP: Record<string, Pick<FabricProfile, 'fabricWeight' | 'season'>> = {
  lightweight_summer:     { fabricWeight: 'light',  season: 'summer' },
  midweight_transitional: { fabricWeight: 'medium', season: 'allSeason' },
  warm_winter:            { fabricWeight: 'heavy',  season: 'winter' },
  all_season:             { fabricWeight: 'medium', season: 'allSeason' },
};

function resolvePattern(item: ClothingItemRow): Pattern {
  const stored = item.pattern?.trim().toLowerCase();
  if (stored && STORED_PATTERN_MAP[stored]) return STORED_PATTERN_MAP[stored];
  return inferPattern(item.name);
}

// Pattern is a "real" signal when it came from a stored `pattern` column (incl. an
// explicit 'solid') or a pattern keyword in the name — NOT when it silently
// defaulted to 'solid' for an unlabelled item. Drives texture/statement confidence.
function patternIsReal(item: ClothingItemRow): boolean {
  const stored = item.pattern?.trim().toLowerCase();
  if (stored && STORED_PATTERN_MAP[stored]) return true;
  return inferPattern(item.name) !== 'solid';
}

function warmthSeasonIsReal(item: ClothingItemRow): boolean {
  const stored = item.warmthSeason?.split(',')[0]?.trim().toLowerCase();
  return Boolean(stored && WARMTH_SEASON_MAP[stored]);
}

function applyStoredWarmth(fabric: FabricProfile, item: ClothingItemRow): FabricProfile {
  const stored = item.warmthSeason?.split(',')[0]?.trim().toLowerCase();
  const override = stored ? WARMTH_SEASON_MAP[stored] : undefined;
  return override ? { ...fabric, ...override } : fabric;
}

// ─── Build FitItem from ClothingItemRow ─────────────────────────────────────

export function toFitItem(item: ClothingItemRow): FitItem {
  const category = categoryOf(item.type);
  const pattern = resolvePattern(item);
  const graphics = resolveGraphics(item);
  const fabric = applyStoredWarmth(fabricProfileOf(item.material, category), item);
  // Measured-hex color layer (2026-07-06): when the item's isolated photo has
  // yielded a measured primary_hex, refine hue/sat/lum with the ACTUAL pixel
  // reading instead of the coarse named-category values — sharper colour-
  // harmony/lightness-contrast scoring. The categorical primaryColor NAME
  // stays from the `color` field (avoid-lists / style palettes match by
  // name, not by measured hue) — a bad/absent hex simply skips this refinement.
  let colorProfile = colorProfileOf(item.color);
  if (item.primary_hex && /^#[0-9A-Fa-f]{6}$/.test(item.primary_hex)) {
    const { hue, sat, lum } = hexToHsl(item.primary_hex);
    colorProfile = {
      ...colorProfile,
      hue, sat, lum,
      undertone: undertoneFromHue(hue),
      colorLightness: lightnessBucket(lum),
      colorSaturation: saturationBucket(sat),
    };
  }
  const { fit, real: fitReal } = deriveFitWithProvenance(item);
  const layerRole = LAYER_ROLE_BY_TYPE[item.type.toUpperCase()] ?? fabric.layerRole;
  const fabricName = deriveFabricName(item.material);

  // Visual enrichment đợt 2: stored image-derived signals refine the derived
  // statement strength — print scale changes how loud a pattern actually reads,
  // and visual interest captures striking-ness no categorical field can.
  let statementStrength = deriveStatementStrength(pattern, graphics, colorProfile, item.type);
  if (item.printScale === 'micro') statementStrength = Math.max(0, statementStrength - 0.5);
  if (item.printScale === 'large') statementStrength = Math.min(5, statementStrength + 0.5);
  if (typeof item.visualInterest === 'number') {
    statementStrength = Math.max(0, Math.min(5, statementStrength + (item.visualInterest - 0.5) * 0.6));
  }
  const drape = item.drape === 'structured' || item.drape === 'regular' || item.drape === 'fluid'
    ? item.drape : undefined;

  return {
    id: item.id,
    category,
    typeName: item.type.toUpperCase(),
    colorProfile,
    graphics,
    fabric: { ...fabric, pattern, layerRole },
    // Stored can_layer (AI-extracted or user-set) wins over the rule derivation.
    canLayer: item.canLayer ?? deriveCanLayer(item.type, fabricName, fabric.fabricWeight, fit),
    garmentMeasurements: parseMeasurements(item.measurements, category),
    styleTags: styleTagsOf(item.type, item.color, item.material),
    fit,
    warmth: deriveWarmth(item.material, category),
    formality: deriveFormality(item.type, colorProfile.primaryColor, item.material),
    statementStrength,
    fabricName,
    drape,
    visualInterest: typeof item.visualInterest === 'number' ? item.visualInterest : undefined,
    provenance: {
      fit: fitReal,
      material: Boolean(primaryMaterial(item.material)),
      pattern: patternIsReal(item),
      warmthSeason: warmthSeasonIsReal(item),
    },
  };
}

// ─── Build BodyMeasurements from a public.body_measurements row (Fix 1, 2026-08-06) ──
// The row's numeric body_* columns already share the exact same name as the
// engine's BodyMeasurements fields (verified against
// src/services/measurementService.ts's MeasurementRow — the client's own
// source of truth for the live schema, since supabase/migrations/** is known
// to drift from prod), so those pass straight through. `body_shape` also
// keeps its name on both sides. `preferred_fit` (DB, snake_case) was the real
// mismatch: the raw row was previously assigned directly to the camelCase
// `BodyMeasurements` type (`measurementsRes.data ?? {}`), so `preferredFit`
// was always undefined and `preferredFitDelta` (scoring.ts) silently
// contributed 0 to every score. Unrecognized enum values (stale/dirty rows)
// map to undefined instead of being passed through and later crashing
// FIT_COMPAT/bodyShapeAdjustment's exhaustive lookups.
const PREFERRED_FIT_VALUES: ReadonlySet<string> = new Set(['SLIM', 'REGULAR', 'RELAXED', 'OVERSIZED']);
const BODY_SHAPE_VALUES: ReadonlySet<string> = new Set(['hourglass', 'rectangle', 'triangle', 'inverted_triangle', 'apple']);

const num = (v: unknown): number | undefined => typeof v === 'number' ? v : undefined;

export function toBodyMeasurements(row: Record<string, unknown> | null | undefined): BodyMeasurements {
  if (!row) return {};
  const rawFit = typeof row.preferred_fit === 'string' ? row.preferred_fit : undefined;
  const rawShape = typeof row.body_shape === 'string' ? row.body_shape : undefined;
  return {
    body_height:            num(row.body_height),
    body_weight:            num(row.body_weight),
    body_bust:              num(row.body_bust),
    body_waist:             num(row.body_waist),
    body_shoulder_width:    num(row.body_shoulder_width),
    body_sleeve_length:     num(row.body_sleeve_length),
    body_upper_body_length: num(row.body_upper_body_length),
    body_upper_arm:         num(row.body_upper_arm),
    body_neck:              num(row.body_neck),
    body_hip:               num(row.body_hip),
    body_inseam:            num(row.body_inseam),
    body_thigh:             num(row.body_thigh),
    body_rise:              num(row.body_rise),
    body_foot_length:       num(row.body_foot_length),
    body_foot_width:        num(row.body_foot_width),
    preferredFit: rawFit && PREFERRED_FIT_VALUES.has(rawFit) ? (rawFit as PreferredFit) : undefined,
    body_shape:   rawShape && BODY_SHAPE_VALUES.has(rawShape) ? (rawShape as BodyShape) : undefined,
  };
}
