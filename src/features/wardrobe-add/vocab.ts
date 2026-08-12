// Controlled-vocabulary picker options + display helpers (feature 006).
// The edge function already returns controlled values; pickers offer the SAME sets
// so user edits also stay engine-valid (no silent fallback).

import { WardrobeItem } from '../../types/fitEngine';

export const TYPE_OPTIONS = [
  'TEE', 'POLO', 'KNIT', 'SHIRT', 'BLOUSE', 'CAMISOLE', 'CROP', 'BODYSUIT', 'TUNIC', 'CORSET',
  'VEST', 'SWEATER', 'CARDIGAN', 'HENLEY',
  'JACKET', 'BLAZER', 'COAT', 'HOODIE', 'PARKA', 'OVERCOAT', 'CAPE', 'KIMONO',
  'JEANS', 'TROUSERS', 'CHINOS', 'SHORTS', 'SKIRT', 'LEGGINGS',
  'DRESS', 'JUMPSUIT', 'OVERALLS', 'GOWN',
  'LOAFERS', 'SNEAKERS', 'BOOTS', 'HEELS', 'SANDALS', 'OXFORDS', 'MULES', 'FLATS', 'WEDGES', 'SLIDES',
  'BAG', 'BELT', 'SCARF', 'WATCH', 'CAP', 'NECKLACE', 'SUNGLASSES', 'HAT', 'RING', 'BRACELET',
  'EARRINGS', 'GLOVES', 'TIGHTS', 'TIE',
];

export const COLOR_OPTIONS = [
  'White', 'Cream', 'Ivory', 'Beige', 'Sand', 'Stone', 'Dove', 'Tan', 'Camel', 'Gold',
  'Mustard', 'Ochre', 'Yellow', 'Orange', 'Rust', 'Terracotta', 'Burgundy', 'Wine', 'Red',
  'Pink', 'Purple', 'Olive', 'Green', 'Sage', 'Forest', 'Emerald', 'Teal', 'Blue', 'Indigo',
  'Navy', 'Slate', 'Grey', 'Charcoal', 'Black', 'Brown', 'Multicolor', 'Natural',
];

export const MATERIAL_OPTIONS = [
  'Cotton', 'Wool', 'Linen', 'Silk', 'Cashmere', 'Denim', 'Leather', 'Suede', 'Nylon',
  'Polyester', 'Canvas', 'Corduroy', 'Tweed', 'Flannel', 'Jersey', 'Fleece', 'Velvet',
];

export const FIT_OPTIONS = ['slim', 'regular', 'relaxed', 'wide', 'oversized'];
export const PATTERN_OPTIONS = ['solid', 'striped', 'plaid', 'checked', 'floral', 'graphic', 'print'];
export const WARMTH_OPTIONS = [
  'lightweight_summer', 'midweight_transitional', 'warm_winter', 'all_season',
];

// Approximate swatch hex per controlled colour (display only; never persisted).
export const COLOR_SWATCH: Record<string, string> = {
  White: '#F4F1EA', Cream: '#E8DFCC', Ivory: '#EFE9DA', Beige: '#D9C9A8', Sand: '#D2BE97',
  Stone: '#B8AE9C', Dove: '#C7C3BA', Tan: '#C9A877', Camel: '#C49B6E', Gold: '#B8923E',
  Mustard: '#C9962E', Ochre: '#B07D2B', Yellow: '#D9C24A', Orange: '#CC6B2C', Rust: '#9C4A22',
  Terracotta: '#B5623F', Burgundy: '#5A1F23', Wine: '#4A1A20', Red: '#A8322C', Pink: '#D9A3AE',
  Purple: '#5E4A7E', Olive: '#5A5A30', Green: '#4A7A4E', Sage: '#7E8F73', Forest: '#2E4A30',
  Emerald: '#1F7A5A', Teal: '#2E6E6A', Blue: '#3D6A99', Indigo: '#35476B', Navy: '#22304B',
  Slate: '#5A6B7B', Grey: '#9C988F', Charcoal: '#3A3631', Black: '#1A1815', Brown: '#6E4A2E',
  Multicolor: '#9C7B54', Natural: '#D9D2C5',
};

export const swatchFor = (color: string): string => COLOR_SWATCH[color] ?? '#D9D2C5';

// Title-case display for UPPERCASE types and lowercase fit/pattern/warmth values.
export const titleCase = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

export const warmthLabel = (w: string): string =>
  ({
    lightweight_summer: 'Summer',
    midweight_transitional: 'Transitional',
    warm_winter: 'Winter',
    all_season: 'All season',
  } as Record<string, string>)[w] ?? w;

// Garment type → wardrobe category (for AddItemInput.category).
const CATEGORY_BY_TYPE: Record<string, WardrobeItem['category']> = {
  TEE: 'top', POLO: 'top', KNIT: 'top', SHIRT: 'top', BLOUSE: 'top', VEST: 'top',
  SWEATER: 'top', CARDIGAN: 'top', HENLEY: 'top',
  CAMISOLE: 'top', CROP: 'top', BODYSUIT: 'top', TUNIC: 'top', CORSET: 'top',
  JACKET: 'outerwear', BLAZER: 'outerwear', COAT: 'outerwear', HOODIE: 'outerwear',
  PARKA: 'outerwear', OVERCOAT: 'outerwear', CAPE: 'outerwear', KIMONO: 'outerwear',
  JEANS: 'bottom', TROUSERS: 'bottom', CHINOS: 'bottom', SHORTS: 'bottom', SKIRT: 'bottom', LEGGINGS: 'bottom',
  DRESS: 'dress', JUMPSUIT: 'dress', OVERALLS: 'dress', GOWN: 'dress',
  LOAFERS: 'footwear', SNEAKERS: 'footwear', BOOTS: 'footwear', HEELS: 'footwear',
  SANDALS: 'footwear', OXFORDS: 'footwear', MULES: 'footwear', FLATS: 'footwear', WEDGES: 'footwear', SLIDES: 'footwear',
  CAP: 'headwear', HAT: 'headwear',
  BAG: 'accessory', BELT: 'accessory', SCARF: 'accessory', WATCH: 'accessory',
  NECKLACE: 'accessory', SUNGLASSES: 'accessory', RING: 'accessory', BRACELET: 'accessory',
  EARRINGS: 'accessory', GLOVES: 'accessory', TIGHTS: 'accessory', TIE: 'accessory',
};

export const categoryForType = (type: string): WardrobeItem['category'] =>
  CATEGORY_BY_TYPE[(type ?? '').toUpperCase()] ?? 'accessory';

// Garment types the "wear as a layer" control applies to (feature 008 dual-role
// layering) — inner/mid tops only. Bottoms/shoes/accessories/outerwear never show it.
const LAYERABLE_TOP_TYPES = new Set([
  'TEE', 'SHIRT', 'KNIT', 'SWEATER', 'CARDIGAN', 'VEST', 'BLOUSE', 'HENLEY',
  'POLO', 'CAMISOLE', 'CROP', 'BODYSUIT', 'TUNIC', 'CORSET',
]);

export const isLayerableTopType = (type: string): boolean =>
  LAYERABLE_TOP_TYPES.has((type ?? '').toUpperCase());

// AUTO / YES / NO ↔ null / true / false for the layering picker.
export const CAN_LAYER_OPTIONS = ['Auto', 'Yes', 'No'];

export const canLayerToLabel = (v: boolean | null | undefined): string =>
  v === true ? 'Yes' : v === false ? 'No' : 'Auto';

export const labelToCanLayer = (label: string): boolean | null =>
  label === 'Yes' ? true : label === 'No' ? false : null;
