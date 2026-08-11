// Fixed fixture wardrobes + user profiles for the offline eval harness.
// DO NOT edit casually — these fixtures are the deterministic baselines that let
// two engine versions be compared apples-to-apples. If you must change one,
// regenerate the corresponding snapshot alongside it.

import type { ClothingItemRow, BodyMeasurements } from '../../supabase/functions/generate-outfits/engine/types.ts';

// ─── Shared body measurements ─────────────────────────────────────────────────

export const BODY_MEASUREMENTS: BodyMeasurements = {
  body_height: 172,
  body_weight: 68,
  body_bust: 96,
  body_waist: 82,
  body_hip: 98,
  body_shoulder_width: 45,
  body_sleeve_length: 60,
  body_upper_body_length: 70,
  body_upper_arm: 30,
  body_inseam: 78,
  body_thigh: 56,
  body_shape: 'rectangle',
};

// ─── Smartcasual / minimalist wardrobe (30 items) ─────────────────────────────
// Tops(10) / Bottoms(7) / Shoes(6) / Outerwear(4) / Accessories(3)
// Colors mostly neutral (black/white/navy/beige/gray/charcoal/cream/olive) with
// a few accents (burgundy/red/green/blue). Materials cover Cotton, Wool, Linen,
// Denim, Leather, Polyester, Cashmere, Silk (+ Suede). Fits cover slim/regular/
// relaxed/wide/oversized. Patterns: mostly solid + 2 striped, 1 plaid, 1 graphic.

const SMARTCASUAL_WARDROBE: ClothingItemRow[] = [
  // ── Tops ──
  {
    id: 'top-tee-black', type: 'TEE', name: 'Classic Black Tee', color: 'Black',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
    measurements: [
      { label: 'chest', value: 104, unit: 'cm' },
      { label: 'shoulder', value: 44, unit: 'cm' },
      { label: 'sleeve', value: 21, unit: 'cm' },
      { label: 'length', value: 70, unit: 'cm' },
    ],
  },
  {
    id: 'top-tee-white', type: 'TEE', name: 'Essential White Tee', color: 'White',
    material: 'Cotton', fit: 'slim', pattern: 'solid', warmthSeason: 'lightweight_summer',
    measurements: [
      { label: 'chest', value: 100, unit: 'cm' },
      { label: 'shoulder', value: 43, unit: 'cm' },
      { label: 'sleeve', value: 20, unit: 'cm' },
      { label: 'length', value: 68, unit: 'cm' },
    ],
  },
  {
    id: 'top-shirt-navy', type: 'SHIRT', name: 'Oxford Shirt Navy', color: 'Navy',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
    measurements: [
      { label: 'chest', value: 108, unit: 'cm' },
      { label: 'shoulder', value: 46, unit: 'cm' },
      { label: 'sleeve', value: 62, unit: 'cm' },
      { label: 'length', value: 74, unit: 'cm' },
    ],
  },
  {
    id: 'top-shirt-white-stripe', type: 'SHIRT', name: 'Poplin Shirt White Stripe', color: 'White',
    material: 'Cotton', fit: 'slim', pattern: 'striped', warmthSeason: 'all_season',
    measurements: [
      { label: 'chest', value: 104, unit: 'cm' },
      { label: 'shoulder', value: 45, unit: 'cm' },
      { label: 'sleeve', value: 61, unit: 'cm' },
      { label: 'length', value: 73, unit: 'cm' },
    ],
  },
  {
    id: 'top-polo-beige', type: 'POLO', name: 'Pique Polo Beige', color: 'Beige',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'top-knit-charcoal', type: 'KNIT', name: 'Merino Knit Charcoal', color: 'Charcoal',
    material: 'Wool', fit: 'relaxed', pattern: 'solid', warmthSeason: 'warm_winter',
    measurements: [
      { label: 'chest', value: 110, unit: 'cm' },
      { label: 'shoulder', value: 47, unit: 'cm' },
      { label: 'sleeve', value: 63, unit: 'cm' },
      { label: 'length', value: 68, unit: 'cm' },
    ],
  },
  {
    id: 'top-sweater-cream', type: 'SWEATER', name: 'Cashmere Sweater Cream', color: 'Cream',
    material: 'Cashmere', fit: 'relaxed', pattern: 'solid', warmthSeason: 'warm_winter',
    measurements: [
      { label: 'chest', value: 112, unit: 'cm' },
      { label: 'shoulder', value: 48, unit: 'cm' },
      { label: 'sleeve', value: 64, unit: 'cm' },
      { label: 'length', value: 67, unit: 'cm' },
    ],
  },
  {
    id: 'top-blouse-olive', type: 'BLOUSE', name: 'Silk Blouse Olive', color: 'Olive',
    material: 'Silk', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'top-blouse-burgundy', type: 'BLOUSE', name: 'Wrap Blouse Burgundy', color: 'Burgundy',
    material: 'Polyester', fit: 'relaxed', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'top-tee-graphic-gray', type: 'TEE', name: 'Graphic Print Tee Gray', color: 'Gray',
    material: 'Cotton', fit: 'oversized', pattern: 'graphic', warmthSeason: 'lightweight_summer',
  },

  // ── Bottoms ──
  {
    id: 'bottom-jeans-navy', type: 'JEANS', name: 'Slim Jeans Navy', color: 'Navy',
    material: 'Denim', fit: 'slim', pattern: 'solid', warmthSeason: 'all_season',
    measurements: [
      { label: 'waist', value: 84, unit: 'cm' },
      { label: 'hip', value: 100, unit: 'cm' },
      { label: 'inseam', value: 78, unit: 'cm' },
      { label: 'thigh', value: 58, unit: 'cm' },
      { label: 'rise', value: 26, unit: 'cm' },
    ],
  },
  {
    id: 'bottom-jeans-black', type: 'JEANS', name: 'Straight Jeans Black', color: 'Black',
    material: 'Denim', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
    measurements: [
      { label: 'waist', value: 88, unit: 'cm' },
      { label: 'hip', value: 104, unit: 'cm' },
      { label: 'inseam', value: 80, unit: 'cm' },
      { label: 'thigh', value: 60, unit: 'cm' },
      { label: 'rise', value: 27, unit: 'cm' },
    ],
  },
  {
    id: 'bottom-trousers-charcoal', type: 'TROUSERS', name: 'Wool Trousers Charcoal', color: 'Charcoal',
    material: 'Wool', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
    measurements: [
      { label: 'waist', value: 86, unit: 'cm' },
      { label: 'hip', value: 102, unit: 'cm' },
      { label: 'inseam', value: 79, unit: 'cm' },
      { label: 'thigh', value: 59, unit: 'cm' },
      { label: 'rise', value: 27, unit: 'cm' },
    ],
  },
  {
    id: 'bottom-trousers-beige-stripe', type: 'TROUSERS', name: 'Pinstripe Trousers Beige', color: 'Beige',
    material: 'Cotton', fit: 'slim', pattern: 'striped', warmthSeason: 'all_season',
    measurements: [
      { label: 'waist', value: 83, unit: 'cm' },
      { label: 'hip', value: 99, unit: 'cm' },
      { label: 'inseam', value: 78, unit: 'cm' },
      { label: 'thigh', value: 57, unit: 'cm' },
      { label: 'rise', value: 26, unit: 'cm' },
    ],
  },
  {
    id: 'bottom-chinos-olive', type: 'CHINOS', name: 'Chino Pants Olive', color: 'Olive',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
    measurements: [
      { label: 'waist', value: 85, unit: 'cm' },
      { label: 'hip', value: 101, unit: 'cm' },
      { label: 'inseam', value: 79, unit: 'cm' },
      { label: 'thigh', value: 58, unit: 'cm' },
      { label: 'rise', value: 26, unit: 'cm' },
    ],
  },
  {
    id: 'bottom-shorts-beige', type: 'SHORTS', name: 'Linen Shorts Beige', color: 'Beige',
    material: 'Linen', fit: 'relaxed', pattern: 'solid', warmthSeason: 'lightweight_summer',
    measurements: [
      { label: 'waist', value: 84, unit: 'cm' },
      { label: 'hip', value: 100, unit: 'cm' },
      { label: 'inseam', value: 22, unit: 'cm' },
      { label: 'rise', value: 27, unit: 'cm' },
    ],
  },
  {
    id: 'bottom-skirt-black-plaid', type: 'SKIRT', name: 'Plaid Mini Skirt Black', color: 'Black',
    material: 'Wool', fit: 'regular', pattern: 'plaid', warmthSeason: 'midweight_transitional',
  },

  // ── Shoes ──
  {
    id: 'shoes-sneakers-white', type: 'SNEAKERS', name: 'Minimal Sneakers White', color: 'White',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'shoes-loafers-brown', type: 'LOAFERS', name: 'Penny Loafers Brown', color: 'Brown',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'shoes-loafers-black-suede', type: 'LOAFERS', name: 'Suede Loafers Black', color: 'Black',
    material: 'Suede', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'shoes-boots-charcoal', type: 'BOOTS', name: 'Chelsea Boots Charcoal', color: 'Charcoal',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'warm_winter',
  },
  {
    id: 'shoes-heels-black', type: 'HEELS', name: 'Pointed Heels Black', color: 'Black',
    material: 'Leather', fit: 'slim', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'shoes-sandals-black', type: 'SANDALS', name: 'Strappy Sandals Black', color: 'Black',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },

  // ── Outerwear ──
  {
    id: 'outer-blazer-navy', type: 'BLAZER', name: 'Wool Blazer Navy', color: 'Navy',
    material: 'Wool', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
    measurements: [
      { label: 'chest', value: 106, unit: 'cm' },
      { label: 'shoulder', value: 47, unit: 'cm' },
      { label: 'sleeve', value: 63, unit: 'cm' },
      { label: 'length', value: 72, unit: 'cm' },
    ],
  },
  {
    id: 'outer-jacket-olive', type: 'JACKET', name: 'Field Jacket Olive', color: 'Olive',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
    measurements: [
      { label: 'chest', value: 112, unit: 'cm' },
      { label: 'shoulder', value: 49, unit: 'cm' },
      { label: 'sleeve', value: 64, unit: 'cm' },
      { label: 'length', value: 71, unit: 'cm' },
    ],
  },
  {
    id: 'outer-coat-charcoal', type: 'COAT', name: 'Overcoat Charcoal', color: 'Charcoal',
    material: 'Wool', fit: 'relaxed', pattern: 'solid', warmthSeason: 'warm_winter',
    measurements: [
      { label: 'chest', value: 116, unit: 'cm' },
      { label: 'shoulder', value: 50, unit: 'cm' },
      { label: 'sleeve', value: 66, unit: 'cm' },
      { label: 'length', value: 95, unit: 'cm' },
    ],
  },
  {
    id: 'outer-hoodie-gray', type: 'HOODIE', name: 'Fleece Hoodie Gray', color: 'Gray',
    material: 'Polyester', fit: 'wide', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },

  // ── Accessories ──
  {
    id: 'acc-bag-black', type: 'BAG', name: 'Leather Tote Black', color: 'Black',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'acc-belt-brown', type: 'BELT', name: 'Leather Belt Brown', color: 'Brown',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'acc-cap-navy', type: 'CAP', name: 'Cotton Cap Navy', color: 'Navy',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
];

const SMARTCASUAL_PROFILE = {
  selectedStyles: ['smartcasual', 'minimalist'],
  colorPreferences: ['navy', 'beige', 'white', 'charcoal'],
  colorSeason: 'autumn',
  weatherSeason: 'summer',
  bodyMeasurements: BODY_MEASUREMENTS,
};

// ─── Streetwear wardrobe (25 items) ────────────────────────────────────────────
// Tops(7) / Bottoms(6) / Shoes(4) / Outerwear(4, incl. 2 HOODIEs) / Accessories(4)
// Exercises pattern-mixing (graphic + striped + plaid can co-occur — the engine
// allows up to 2 "bold" patterns, i.e. not solid/checkered, for streetwear/y2k/
// bohemian users) and the HOODIE outwear-slot path, which the smartcasual/
// minimalist fixture above cannot reach (its only HOODIE is the sole outerwear
// item styleTagged for smartcasual there, and its style filter bans wide/
// oversized-only silhouettes from ever pattern-mixing).
// Colors: black/white/gray core + red/green/blue accents (all allowed in the
// streetwear palette — nothing is banned there). Fits: regular/relaxed/wide/
// oversized only (streetwear's allowedFits excludes 'slim'). Formality mostly
// in [1.0, 3.0] (streetwear's formalityRange, ±0.5 filter tolerance).

const STREETWEAR_WARDROBE: ClothingItemRow[] = [
  // ── Tops ──
  {
    id: 'sw-top-tee-graphic-black', type: 'TEE', name: 'Graphic Skull Tee Black', color: 'Black',
    material: 'Cotton', fit: 'oversized', pattern: 'graphic', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'sw-top-tee-graphic-white', type: 'TEE', name: 'Graphic Logo Tee White', color: 'White',
    material: 'Cotton', fit: 'regular', pattern: 'graphic', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'sw-top-tee-striped-gray', type: 'TEE', name: 'Striped Tee Gray', color: 'Gray',
    material: 'Cotton', fit: 'regular', pattern: 'striped', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'sw-top-shirt-plaid-red', type: 'SHIRT', name: 'Flannel Shirt Plaid Red', color: 'Red',
    material: 'Cotton', fit: 'relaxed', pattern: 'plaid', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'sw-top-tee-white', type: 'TEE', name: 'Essential Tee White', color: 'White',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'sw-top-tee-black', type: 'TEE', name: 'Essential Tee Black', color: 'Black',
    material: 'Cotton', fit: 'relaxed', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'sw-top-tee-blue', type: 'TEE', name: 'Court Tee Blue', color: 'Blue',
    material: 'Cotton', fit: 'oversized', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },

  // ── Bottoms ──
  {
    id: 'sw-bottom-jeans-black-wide', type: 'JEANS', name: 'Baggy Jeans Black', color: 'Black',
    material: 'Denim', fit: 'wide', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'sw-bottom-jeans-navy', type: 'JEANS', name: 'Straight Jeans Navy', color: 'Navy',
    material: 'Denim', fit: 'relaxed', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'sw-bottom-jeans-gray', type: 'JEANS', name: 'Relaxed Jeans Gray', color: 'Gray',
    material: 'Denim', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'sw-bottom-shorts-camo-black', type: 'SHORTS', name: 'Digital Camo Cargo Shorts Black', color: 'Black',
    material: 'Cotton', fit: 'relaxed', pattern: 'camo', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'sw-bottom-shorts-black', type: 'SHORTS', name: 'Basketball Shorts Black', color: 'Black',
    material: 'Polyester', fit: 'wide', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'sw-bottom-shorts-green', type: 'SHORTS', name: 'Cargo Shorts Green', color: 'Green',
    material: 'Cotton', fit: 'relaxed', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },

  // ── Shoes ──
  {
    id: 'sw-shoes-sneakers-white', type: 'SNEAKERS', name: 'Chunky Sneakers White', color: 'White',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'sw-shoes-sneakers-black', type: 'SNEAKERS', name: 'High-Top Sneakers Black', color: 'Black',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'sw-shoes-sneakers-red', type: 'SNEAKERS', name: 'Court Sneakers Red', color: 'Red',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'sw-shoes-boots-brown', type: 'BOOTS', name: 'Combat Boots Brown', color: 'Brown',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },

  // ── Outerwear ──
  {
    id: 'sw-outer-hoodie-black', type: 'HOODIE', name: 'Pullover Hoodie Black', color: 'Black',
    material: 'Fleece', fit: 'oversized', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'sw-outer-hoodie-gray', type: 'HOODIE', name: 'Zip Hoodie Gray', color: 'Gray',
    material: 'Fleece', fit: 'wide', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'sw-outer-jacket-green', type: 'JACKET', name: 'Striped Windbreaker Jacket Green', color: 'Green',
    material: 'Nylon', fit: 'relaxed', pattern: 'striped', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'sw-outer-jacket-blue', type: 'JACKET', name: 'Denim Jacket Blue', color: 'Blue',
    material: 'Denim', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },

  // ── Accessories ──
  {
    id: 'sw-acc-cap-black', type: 'CAP', name: 'Snapback Cap Black', color: 'Black',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'sw-acc-cap-red', type: 'CAP', name: 'Trucker Cap Red', color: 'Red',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'sw-acc-bag-black', type: 'BAG', name: 'Crossbody Bag Black', color: 'Black',
    material: 'Nylon', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'sw-acc-bag-gray', type: 'BAG', name: 'Sling Bag Gray', color: 'Gray',
    material: 'Polyester', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
];

const STREETWEAR_PROFILE = {
  selectedStyles: ['streetwear'],
  colorPreferences: ['black', 'white', 'gray', 'red'],
  colorSeason: 'autumn',
  weatherSeason: 'summer',
  bodyMeasurements: BODY_MEASUREMENTS,
};

// ─── Resort wardrobe (20 items) ────────────────────────────────────────────────
// Tops(6) / Bottoms(5) / Shoes(3) / Outerwear(2) / Accessories(2)
// Added (010-wardrobe-critic follow-up, 2026-08-11) to measure the
// PATTERN_FRIENDLY_STYLES expansion in ranking.ts — 'resort' is one of the 9
// newly-added print-led styles (floral/tropical prints define the style).
// 4 items carry a bold (non-solid/checkered) pattern — floral or striped —
// spread across tops/bottoms so 2-bold-pattern combos are reachable. Colors
// and fabrics drawn from the resort STYLE_CONFIGS entry (filtering.ts):
// palette perfect/allowed tiers only (white/cream/beige/natural/blue/tan/
// khaki/coral/terracotta), fabricsAllowed linen/cotton/canvas only (resort
// bans wool/leather/suede/cashmere/velvet/fleece — shoes/bag use canvas, not
// leather, to actually pass the style filter).

const RESORT_WARDROBE: ClothingItemRow[] = [
  // ── Tops ──
  {
    id: 'rs-top-shirt-floral-white', type: 'SHIRT', name: 'Floral Linen Shirt White', color: 'White',
    material: 'Linen', fit: 'relaxed', pattern: 'floral', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-top-blouse-floral-coral', type: 'BLOUSE', name: 'Floral Blouse Coral', color: 'Coral',
    material: 'Cotton', fit: 'relaxed', pattern: 'floral', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-top-shirt-striped-blue', type: 'SHIRT', name: 'Striped Linen Shirt Blue', color: 'Blue',
    material: 'Linen', fit: 'regular', pattern: 'striped', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-top-tee-white', type: 'TEE', name: 'Essential Tee White', color: 'White',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-top-tee-tan', type: 'TEE', name: 'Essential Tee Tan', color: 'Tan',
    material: 'Cotton', fit: 'relaxed', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-top-blouse-cream', type: 'BLOUSE', name: 'Linen Blouse Cream', color: 'Cream',
    material: 'Linen', fit: 'relaxed', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },

  // ── Bottoms ──
  {
    id: 'rs-bottom-skirt-floral-cream', type: 'SKIRT', name: 'Floral Midi Skirt Cream', color: 'Cream',
    material: 'Cotton', fit: 'relaxed', pattern: 'floral', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-bottom-shorts-khaki', type: 'SHORTS', name: 'Linen Shorts Khaki', color: 'Khaki',
    material: 'Linen', fit: 'relaxed', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-bottom-shorts-terracotta', type: 'SHORTS', name: 'Cotton Shorts Terracotta', color: 'Terracotta',
    material: 'Cotton', fit: 'relaxed', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-bottom-trousers-white', type: 'TROUSERS', name: 'Wide Linen Trousers White', color: 'White',
    material: 'Linen', fit: 'wide', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-bottom-skirt-striped-natural', type: 'SKIRT', name: 'Striped Skirt Natural', color: 'Natural',
    material: 'Cotton', fit: 'relaxed', pattern: 'striped', warmthSeason: 'lightweight_summer',
  },

  // ── Shoes ── (canvas, not leather — resort's fabricsAllowed excludes leather)
  {
    id: 'rs-shoes-sandals-tan', type: 'SANDALS', name: 'Canvas Sandals Tan', color: 'Tan',
    material: 'Canvas', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-shoes-sneakers-white', type: 'SNEAKERS', name: 'Canvas Sneakers White', color: 'White',
    material: 'Canvas', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-shoes-sandals-natural', type: 'SANDALS', name: 'Woven Sandals Natural', color: 'Natural',
    material: 'Canvas', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },

  // ── Outerwear ──
  {
    id: 'rs-outer-overshirt-beige', type: 'JACKET', name: 'Linen Overshirt Beige', color: 'Beige',
    material: 'Linen', fit: 'relaxed', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'rs-outer-overshirt-floral-olive', type: 'JACKET', name: 'Floral Linen Overshirt Olive', color: 'Olive',
    material: 'Linen', fit: 'relaxed', pattern: 'floral', warmthSeason: 'lightweight_summer',
  },

  // ── Accessories ──
  {
    id: 'rs-acc-bag-natural', type: 'BAG', name: 'Woven Straw Bag Natural', color: 'Natural',
    material: 'Canvas', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'rs-acc-cap-tan', type: 'CAP', name: 'Canvas Sun Hat Tan', color: 'Tan',
    material: 'Canvas', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
];

const RESORT_PROFILE = {
  selectedStyles: ['resort'],
  colorPreferences: ['white', 'cream', 'beige', 'blue'],
  colorSeason: 'spring',
  weatherSeason: 'summer',
  bodyMeasurements: BODY_MEASUREMENTS,
};

// ─── Named profiles ────────────────────────────────────────────────────────────

export const PROFILES = {
  smartcasual: { wardrobe: SMARTCASUAL_WARDROBE, profile: SMARTCASUAL_PROFILE },
  streetwear: { wardrobe: STREETWEAR_WARDROBE, profile: STREETWEAR_PROFILE },
  resort: { wardrobe: RESORT_WARDROBE, profile: RESORT_PROFILE },
} as const;

export type ProfileName = keyof typeof PROFILES;

// ─── Backward-compatible default exports (smartcasual) ────────────────────────
// run.ts imports these by default so it works unchanged unless --profile is
// passed. Do not repurpose these names for anything other than the smartcasual
// fixture — external snapshots (baseline.json etc.) were generated against it.

export const WARDROBE: ClothingItemRow[] = SMARTCASUAL_WARDROBE;
export const PROFILE = SMARTCASUAL_PROFILE;
