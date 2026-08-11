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

// ─── Measured wardrobe (24 items) — added 2026-08-11 to close the eval
// harness's biggest blind spot: smartcasual is the ONLY fixture that carries
// any `measurements` at all, and every item everywhere declares an explicit
// `fit`, so scoreOutfitFit's real (non-0.5-default) path and the entire
// guessed-fit path (shiftThresholds's GUESS_WIDENING, enrichment.ts's
// deriveFitWithProvenance type-default fallback) were structurally
// unreachable by this harness. This fixture reuses the smartcasual style
// (STYLE_CONFIGS 'smartcasual' in filtering.ts) and BODY_MEASUREMENTS
// (body_shape 'rectangle') so it slots into the same style/body pairing
// already exercised elsewhere, but every item is dimensioned deliberately:
//
//   - Tops(8)/Bottoms(6)/Outerwear(4)/Shoes(4)/Accessories(2).
//   - Fits are kept to slim/regular/relaxed only (smartcasual's allowedFits
//     excludes wide/oversized — an item with either would be dropped by the
//     style filter before ever reaching scoring, defeating the point).
//   - A spread of GOOD (near-ideal ease → per-item score ~1.0), MEDIOCRE
//     (ease past ideal but inside the ok band → ~0.7-0.85), and BAD (ease
//     past the ok band on the tight or loose side → 0/0.2, including the
//     "mislabelled cut" case — e.g. a garment labelled 'relaxed' whose
//     actual measurements are barely looser than a regular cut) items, so
//     scoreOutfitFit's full [0,1] range is reachable, not just the neutral
//     0.5 default.
//   - 8 of the 24 items (a third) carry NO `fit` field at all, so
//     deriveFitWithProvenance must guess from TYPE_DEFAULT_FIT and
//     provenance.fit comes back false. Their names/ids are kept free of the
//     FIT_FROM_STRING keywords (slim/fitted/skinny/regular/standard/classic/
//     relaxed/comfort/loose/wide/oversized/boxy/...) that deriveFitWithProvenance
//     also scans the item NAME for — an unlabelled item whose name says
//     "Relaxed Knit" is not actually unlabelled. Verified empirically (not
//     just by inspection) in the eval run — see plan.md 2026-08-11 entry.
//     Several of these guessed items ALSO carry real measurements on a
//     type whose TYPE_DEFAULT_FIT is non-'regular' (KNIT/SWEATER/BLOUSE/
//     COAT → 'relaxed'), which is required for GUESS_WIDENING to do
//     anything at all: shiftThresholds only widens when the fit-derived
//     shiftCm is non-zero, and 'regular' is the zero-shift anchor — a
//     guessed-but-defaulted-to-regular item (e.g. TEE/SHIRT/JEANS) never
//     exercises GUESS_WIDENING no matter how unlabelled it is.
//   - Shoes carry a `shoe_size`/`shoe_width` labelled measurement and the
//     BELT accessory carries a `waist` one. LABEL_TO_KEY (enrichment.ts) has
//     no entry for 'shoe size'/'shoe width', and scoreItemFit never scores
//     'shoes'/'accessory' categories at all (only top/onepiece/bottom/
//     outwear) — so today this data is inert. It's included anyway, per
//     the known gap logged in plan.md, so the fixture is ready the day
//     someone adds that mapping/scoring without needing new fixture data.
//
// DO NOT edit the smartcasual/streetwear/resort wardrobes above to add this
// same coverage — see the file-level warning at the top of this file. This
// is a fourth, additive fixture, not a retrofit of the existing three.

const MEASURED_WARDROBE: ClothingItemRow[] = [
  // ── Tops (8) — 4 guessed (no `fit`): ms-top-shirt-poplin-gray,
  // ms-top-knit-crewneck-charcoal, ms-top-blouse-silk-cream, ms-top-sweater-cashmere-olive ──
  {
    id: 'ms-top-shirt-oxford-navy', type: 'SHIRT', name: 'Oxford Shirt Navy Measured', color: 'Navy',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
    // GOOD: every point lands inside FIT_THRESHOLDS' ideal band → ~1.0.
    measurements: [
      { label: 'chest', value: 100, unit: 'cm' },
      { label: 'shoulder', value: 47, unit: 'cm' },
      { label: 'sleeve', value: 61, unit: 'cm' },
      { label: 'length', value: 73, unit: 'cm' },
      { label: 'waist', value: 86, unit: 'cm' },
    ],
  },
  {
    id: 'ms-top-tee-essential-white', type: 'TEE', name: 'Essential Tee White Measured', color: 'White',
    material: 'Cotton', fit: 'slim', pattern: 'solid', warmthSeason: 'lightweight_summer',
    // GOOD (slim): ease sits inside the slim-shifted ideal band on every axis.
    measurements: [
      { label: 'chest', value: 97, unit: 'cm' },
      { label: 'shoulder', value: 45, unit: 'cm' },
      { label: 'waist', value: 83, unit: 'cm' },
      { label: 'length', value: 70, unit: 'cm' },
    ],
  },
  {
    id: 'ms-top-shirt-poplin-gray', type: 'SHIRT', name: 'Poplin Shirt Gray Measured', color: 'Gray',
    material: 'Cotton', pattern: 'striped', warmthSeason: 'all_season',
    // GUESSED (no `fit`) — SHIRT's TYPE_DEFAULT_FIT is 'regular' (zero-shift
    // anchor), so this one does NOT exercise GUESS_WIDENING, but it does
    // prove a guessed item can still land provenance.fit=false AND score
    // well (GOOD ease on every axis) — the guess isn't always a penalty.
    measurements: [
      { label: 'chest', value: 101, unit: 'cm' },
      { label: 'shoulder', value: 46, unit: 'cm' },
      { label: 'sleeve', value: 60, unit: 'cm' },
      { label: 'length', value: 72, unit: 'cm' },
      { label: 'waist', value: 85, unit: 'cm' },
    ],
  },
  {
    id: 'ms-top-polo-pique-beige', type: 'POLO', name: 'Pique Polo Beige Measured', color: 'Beige',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
    // MEDIOCRE: ease past ideal but still inside ok on every axis (~0.85).
    measurements: [
      { label: 'chest', value: 105, unit: 'cm' },
      { label: 'shoulder', value: 49, unit: 'cm' },
      { label: 'waist', value: 90, unit: 'cm' },
      { label: 'length', value: 76, unit: 'cm' },
    ],
  },
  {
    id: 'ms-top-tee-crewneck-charcoal', type: 'TEE', name: 'Crewneck Tee Charcoal Measured', color: 'Charcoal',
    material: 'Cotton', fit: 'slim', pattern: 'solid', warmthSeason: 'lightweight_summer',
    // BAD (too tight): every axis reads well below the slim-shifted floor.
    measurements: [
      { label: 'chest', value: 90, unit: 'cm' },
      { label: 'shoulder', value: 43, unit: 'cm' },
      { label: 'waist', value: 78, unit: 'cm' },
      { label: 'length', value: 66, unit: 'cm' },
    ],
  },
  {
    id: 'ms-top-knit-crewneck-charcoal', type: 'KNIT', name: 'Crewneck Knit Charcoal Measured', color: 'Charcoal',
    material: 'Wool', pattern: 'solid', warmthSeason: 'warm_winter',
    // GUESSED (no `fit`) — KNIT's TYPE_DEFAULT_FIT is 'relaxed' (non-zero
    // shift), so this DOES exercise GUESS_WIDENING: chest ease (4cm) sits
    // below the real-relaxed floor (would score 0.000 under a real
    // 'relaxed' label — floored, unwearable) but inside the WIDENED guessed
    // floor, so it scores ~0.13 instead — degrades gracefully rather than
    // hard-flooring. Verified empirically (not hand-derived) — see plan.md
    // 2026-08-11 entry / the throwaway verification script it references.
    measurements: [
      { label: 'chest', value: 100, unit: 'cm' },
      { label: 'shoulder', value: 48, unit: 'cm' },
      { label: 'waist', value: 90, unit: 'cm' },
      { label: 'length', value: 73, unit: 'cm' },
    ],
  },
  {
    id: 'ms-top-blouse-silk-cream', type: 'BLOUSE', name: 'Silk Blouse Cream Measured', color: 'Cream',
    material: 'Silk', pattern: 'solid', warmthSeason: 'all_season',
    // GUESSED (no `fit`), UNMEASURED — no `measurements` at all, so this
    // stays on the scoreItemFit 0.5-default/measured:false path regardless
    // of provenance. Included to keep that path represented too.
  },
  {
    id: 'ms-top-sweater-cashmere-olive', type: 'SWEATER', name: 'Cashmere Crewneck Olive Measured', color: 'Olive',
    material: 'Cashmere', pattern: 'solid', warmthSeason: 'warm_winter',
    // GUESSED (no `fit`) — SWEATER's TYPE_DEFAULT_FIT is 'relaxed'. GOOD:
    // every axis lands inside the relaxed-shifted ideal band, showing a
    // guessed item can also score perfectly when the cut really is what
    // the type-default assumes.
    measurements: [
      { label: 'chest', value: 105, unit: 'cm' },
      { label: 'shoulder', value: 48, unit: 'cm' },
      { label: 'waist', value: 90, unit: 'cm' },
      { label: 'length', value: 74, unit: 'cm' },
    ],
  },

  // ── Bottoms (6) — 1 guessed: ms-bottom-shorts-linen-natural ──
  {
    id: 'ms-bottom-trousers-cotton-charcoal', type: 'TROUSERS', name: 'Cotton Trousers Charcoal Measured', color: 'Charcoal',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
    // GOOD.
    measurements: [
      { label: 'waist', value: 86, unit: 'cm' },
      { label: 'hip', value: 104, unit: 'cm' },
      { label: 'inseam', value: 78, unit: 'cm' },
      { label: 'thigh', value: 61, unit: 'cm' },
    ],
  },
  {
    id: 'ms-bottom-jeans-denim-navy', type: 'JEANS', name: 'Straight Jeans Navy Measured', color: 'Navy',
    material: 'Denim', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
    // GOOD.
    measurements: [
      { label: 'waist', value: 85, unit: 'cm' },
      { label: 'hip', value: 103, unit: 'cm' },
      { label: 'inseam', value: 79, unit: 'cm' },
      { label: 'thigh', value: 60, unit: 'cm' },
    ],
  },
  {
    id: 'ms-bottom-jeans-denim-black', type: 'JEANS', name: 'Slim Jeans Black Measured', color: 'Black',
    material: 'Denim', fit: 'slim', pattern: 'solid', warmthSeason: 'all_season',
    // GOOD (slim).
    measurements: [
      { label: 'waist', value: 83, unit: 'cm' },
      { label: 'hip', value: 99, unit: 'cm' },
      { label: 'inseam', value: 79, unit: 'cm' },
      { label: 'thigh', value: 59, unit: 'cm' },
    ],
  },
  {
    id: 'ms-bottom-chinos-cotton-khaki', type: 'CHINOS', name: 'Chino Pants Khaki Measured', color: 'Khaki',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
    // MEDIOCRE: past ideal, inside ok on every axis (~0.7-0.8).
    measurements: [
      { label: 'waist', value: 92, unit: 'cm' },
      { label: 'hip', value: 112, unit: 'cm' },
      { label: 'inseam', value: 82, unit: 'cm' },
      { label: 'thigh', value: 68, unit: 'cm' },
    ],
  },
  {
    id: 'ms-bottom-skirt-wool-black', type: 'SKIRT', name: 'A-Line Skirt Black Measured', color: 'Black',
    material: 'Wool', fit: 'relaxed', pattern: 'solid', warmthSeason: 'midweight_transitional',
    // BAD (too tight for its 'relaxed' label — mislabelled-cut case): both
    // waist and hip ease sit below the relaxed-shifted floor.
    measurements: [
      { label: 'waist', value: 85, unit: 'cm' },
      { label: 'hip', value: 101, unit: 'cm' },
    ],
  },
  {
    id: 'ms-bottom-shorts-linen-natural', type: 'SHORTS', name: 'Linen Shorts Natural Measured', color: 'Natural',
    material: 'Linen', pattern: 'solid', warmthSeason: 'lightweight_summer',
    // GUESSED (no `fit`) — SHORTS defaults to 'regular' (no widening
    // effect), but still a real provenance.fit=false data point. GOOD ease.
    measurements: [
      { label: 'waist', value: 88, unit: 'cm' },
      { label: 'hip', value: 106, unit: 'cm' },
      { label: 'thigh', value: 60, unit: 'cm' },
    ],
  },

  // ── Shoes (4) — 1 guessed: ms-shoes-boots-leather-black. Shoe size/width
  // carried on every item per plan.md's known gap: scoreItemFit never scores
  // the 'shoes' category and LABEL_TO_KEY has no 'shoe size'/'shoe width'
  // entry, so this data is inert today — included so the fixture is ready
  // the day a mapping/scoring fix lands, without needing new fixture data. ──
  {
    id: 'ms-shoes-sneakers-leather-white', type: 'SNEAKERS', name: 'Minimal Sneakers White Measured', color: 'White',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
    measurements: [{ label: 'shoe_size', value: 39 }, { label: 'shoe_width', value: 95, unit: 'mm' }],
  },
  {
    id: 'ms-shoes-loafers-leather-brown', type: 'LOAFERS', name: 'Penny Loafers Brown Measured', color: 'Brown',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
    measurements: [{ label: 'shoe_size', value: 38.5 }],
  },
  {
    id: 'ms-shoes-boots-leather-black', type: 'BOOTS', name: 'Chelsea Boots Black Measured', color: 'Black',
    material: 'Leather', pattern: 'solid', warmthSeason: 'warm_winter',
    // GUESSED (no `fit`) — BOOTS defaults to 'regular'.
    measurements: [{ label: 'shoe_size', value: 39 }],
  },
  {
    id: 'ms-shoes-sandals-canvas-natural', type: 'SANDALS', name: 'Woven Sandals Natural Measured', color: 'Natural',
    material: 'Canvas', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
    measurements: [{ label: 'shoe_size', value: 38 }],
  },

  // ── Outerwear (4) — 1 guessed: ms-outer-coat-wool-charcoal ──
  {
    id: 'ms-outer-blazer-cotton-gray', type: 'BLAZER', name: 'Cotton Blazer Gray Measured', color: 'Gray',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
    // GOOD. (Navy/Wool would push formality to 5.0, past smartcasual's
    // formalityRange tolerance — see comment in run.ts verification.)
    measurements: [
      { label: 'chest', value: 101, unit: 'cm' },
      { label: 'shoulder', value: 47, unit: 'cm' },
      { label: 'waist', value: 90, unit: 'cm' },
      { label: 'upper arm', value: 33, unit: 'cm' },
      { label: 'sleeve', value: 61, unit: 'cm' },
    ],
  },
  {
    id: 'ms-outer-coat-wool-charcoal', type: 'COAT', name: 'Wool Overcoat Charcoal Measured', color: 'Charcoal',
    material: 'Wool', pattern: 'solid', warmthSeason: 'warm_winter',
    // GUESSED (no `fit`) — COAT's TYPE_DEFAULT_FIT is 'relaxed' (non-zero
    // shift). GOOD: every axis lands inside the relaxed-shifted ideal band.
    measurements: [
      { label: 'chest', value: 105, unit: 'cm' },
      { label: 'shoulder', value: 48, unit: 'cm' },
      { label: 'waist', value: 92, unit: 'cm' },
      { label: 'upper arm', value: 34, unit: 'cm' },
      { label: 'sleeve', value: 61, unit: 'cm' },
    ],
  },
  {
    id: 'ms-outer-jacket-cotton-olive', type: 'JACKET', name: 'Field Jacket Olive Measured', color: 'Olive',
    material: 'Cotton', fit: 'relaxed', pattern: 'solid', warmthSeason: 'midweight_transitional',
    // BAD (too tight for its 'relaxed' label): every girth axis reads below
    // the relaxed-shifted floor.
    measurements: [
      { label: 'chest', value: 99, unit: 'cm' },
      { label: 'shoulder', value: 46, unit: 'cm' },
      { label: 'waist', value: 85, unit: 'cm' },
      { label: 'upper arm', value: 31, unit: 'cm' },
      { label: 'sleeve', value: 60, unit: 'cm' },
    ],
  },
  {
    id: 'ms-outer-jacket-denim-blue', type: 'JACKET', name: 'Denim Jacket Blue Measured', color: 'Blue',
    material: 'Denim', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
    // GOOD.
    measurements: [
      { label: 'chest', value: 102, unit: 'cm' },
      { label: 'shoulder', value: 48, unit: 'cm' },
      { label: 'waist', value: 90, unit: 'cm' },
      { label: 'upper arm', value: 34, unit: 'cm' },
      { label: 'sleeve', value: 61, unit: 'cm' },
    ],
  },

  // ── Accessories (2) — 1 guessed: ms-acc-cap-cotton-navy. The BELT is also
  // what makes `measured-goal`'s shapeGoal 'hourglass' reachable/matchable —
  // outfitWaistDefinition (silhouette.ts) treats a BELT accessory as an
  // instant waist-defined signal. ──
  {
    id: 'ms-acc-belt-leather-brown', type: 'BELT', name: 'Leather Belt Brown Measured', color: 'Brown',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
    // Accessory with real dimensions (2026-08-11 known-gap fixture, see
    // block comment above): scoreItemFit never scores 'accessory' category,
    // so this is inert today too, present for the same future-readiness reason.
    measurements: [{ label: 'waist', value: 84, unit: 'cm' }],
  },
  {
    id: 'ms-acc-cap-cotton-navy', type: 'CAP', name: 'Cotton Cap Navy Measured', color: 'Navy',
    material: 'Cotton', pattern: 'solid', warmthSeason: 'all_season',
    // GUESSED (no `fit`) — CAP has no TYPE_DEFAULT_FIT entry, falls to the
    // 'regular' fallback.
  },
];

const MEASURED_PROFILE = {
  selectedStyles: ['smartcasual'],
  colorPreferences: ['navy', 'charcoal', 'gray', 'white'],
  colorSeason: 'autumn',
  weatherSeason: 'summer',
  bodyMeasurements: BODY_MEASUREMENTS,
};

// `measured-goal` reuses MEASURED_WARDROBE unchanged — only the profile
// differs, by setting shapeGoal. BODY_MEASUREMENTS.body_shape is 'rectangle';
// isShapeGoalReachable(silhouette.ts) confirms 'hourglass' IS reachable for a
// rectangle baseline (waist-defined + balanced top/bottom volume both stay
// under the avg>=5 'oval' cutoff) — and MEASURED_WARDROBE's BELT accessory
// (ms-acc-belt-leather-brown) makes it directly earnable: outfitWaistDefinition
// treats any belt as an instant waist-defined signal, so an outfit that
// includes the belt alongside balanced-volume top/bottom items resolves to
// resultingBodySilhouette === 'hourglass', matching the goal and earning
// shapeGoalDelta's SHAPE_GOAL_MATCH_BONUS instead of the miss penalty.
const MEASURED_GOAL_PROFILE = {
  ...MEASURED_PROFILE,
  shapeGoal: 'hourglass' as const,
};

// ─── One-piece wardrobe (23 items) — added 2026-08-12 to close the eval
// harness's other blind spot: none of the five fixtures above contains a
// single onepiece (DRESS/JUMPSUIT/OVERALLS/GOWN) item, so the entire
// generateOnepieceCandidates path in generation.ts was unreachable by this
// harness. Deliberately NO top/bottom items — every formula pool in
// getFormulaPools requires both, and generateFallback requires both too, so
// with none present generateCandidates' output is EXACTLY
// generateOnepieceCandidates' output. That isolates the one-piece path
// completely: any outerwear-bearing outfit in a run against this fixture can
// only have come from there, making before/after counts unambiguous.
//
// Dresses(8) × Shoes(8) = 64 pairs, deliberately chosen to EXCEED
// ONEPIECE_CAP (60) in the bare cross product alone — the exact precondition
// that starved the pre-fix outerwear loop (it sat AFTER the bare double loop
// and that loop's own `return` on hitting the cap meant the outerwear loop
// never ran). Outerwear(5) and Accessories(2) are included so both optional
// variant classes are reachable. Colors/materials/fits are drawn from the
// smartcasual STYLE_CONFIGS entry (filtering.ts) — perfect/allowed palette
// tiers only (navy/charcoal/black/beige/cream/olive/burgundy/taupe/brown/
// natural/white), fabricsAllowed only (cotton/wool/linen/silk/cashmere/
// jersey/leather/suede — no polyester/nylon/fleece), fits slim/regular/
// relaxed only, pattern solid throughout (avoids the full_print/loud_logo
// bannedFeatures) — so every item actually clears the style filter instead
// of leaning on the top/bottom/shoes-only safety net (which doesn't cover
// the 'onepiece' category at all).

const ONEPIECE_WARDROBE: ClothingItemRow[] = [
  // ── Dresses (8) ──
  {
    id: 'op-dress-navy', type: 'DRESS', name: 'Silk Wrap Dress Navy', color: 'Navy',
    material: 'Silk', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'op-dress-charcoal', type: 'DRESS', name: 'Wool Shift Dress Charcoal', color: 'Charcoal',
    material: 'Wool', fit: 'slim', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'op-dress-black', type: 'DRESS', name: 'Cotton Slip Dress Black', color: 'Black',
    material: 'Cotton', fit: 'slim', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'op-dress-beige', type: 'DRESS', name: 'Linen Shirt Dress Beige', color: 'Beige',
    material: 'Linen', fit: 'relaxed', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'op-dress-cream', type: 'DRESS', name: 'Silk Slip Dress Cream', color: 'Cream',
    material: 'Silk', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'op-dress-olive', type: 'DRESS', name: 'Cotton Midi Dress Olive', color: 'Olive',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'op-dress-burgundy', type: 'DRESS', name: 'Jersey Wrap Dress Burgundy', color: 'Burgundy',
    material: 'Jersey', fit: 'slim', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'op-dress-taupe', type: 'DRESS', name: 'Cashmere Sweater Dress Taupe', color: 'Taupe',
    material: 'Cashmere', fit: 'relaxed', pattern: 'solid', warmthSeason: 'warm_winter',
  },

  // ── Shoes (8) ──
  {
    id: 'op-shoes-flats-black', type: 'FLATS', name: 'Ballet Flats Black', color: 'Black',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'op-shoes-loafers-brown', type: 'LOAFERS', name: 'Penny Loafers Brown', color: 'Brown',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    // Taupe (2026-08-12): HEELS' base formality (4.5) plus black's +0.5
    // color shift (enrichment.ts COLOR_FORMALITY_SHIFT) pushed this to 5.0,
    // outside smartcasual's [2–4] ±0.5 filter tolerance — taupe carries no
    // shift, landing exactly on the 4.5 boundary (passes).
    id: 'op-shoes-heels-taupe', type: 'HEELS', name: 'Pointed Heels Taupe', color: 'Taupe',
    material: 'Leather', fit: 'slim', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    // Black (2026-08-12): SANDALS' base formality (1.0) needs the +0.5
    // black/charcoal/navy color shift to clear the [1.5, 4.5] filter
    // tolerance — natural carries no shift and landed at 1.0 (rejected).
    id: 'op-shoes-sandals-black', type: 'SANDALS', name: 'Strappy Sandals Black', color: 'Black',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'lightweight_summer',
  },
  {
    id: 'op-shoes-mules-taupe', type: 'MULES', name: 'Suede Mules Taupe', color: 'Taupe',
    material: 'Suede', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'op-shoes-boots-charcoal', type: 'BOOTS', name: 'Chelsea Boots Charcoal', color: 'Charcoal',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'warm_winter',
  },
  {
    // Taupe (2026-08-12): same OXFORDS boundary issue as the heels above —
    // base 4.5 + navy's +0.5 shift = 5.0 (rejected); taupe has no shift.
    id: 'op-shoes-oxfords-taupe', type: 'OXFORDS', name: 'Oxford Flats Taupe', color: 'Taupe',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'op-shoes-sneakers-white', type: 'SNEAKERS', name: 'Minimal Sneakers White', color: 'White',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },

  // ── Outerwear (5) ──
  {
    // Gray + Cotton (2026-08-12): BLAZER's base formality (4.5) already sits
    // at smartcasual's ceiling, so navy's +0.5 color shift AND wool's +0.5
    // material bonus each independently push it to 5.0 (rejected); gray
    // carries no color shift and cotton carries no material bonus, landing
    // exactly on the 4.5 boundary (passes).
    id: 'op-outer-blazer-gray', type: 'BLAZER', name: 'Cotton Blazer Gray', color: 'Gray',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'op-outer-coat-charcoal', type: 'COAT', name: 'Overcoat Charcoal', color: 'Charcoal',
    material: 'Wool', fit: 'relaxed', pattern: 'solid', warmthSeason: 'warm_winter',
  },
  {
    id: 'op-outer-jacket-beige', type: 'JACKET', name: 'Cotton Jacket Beige', color: 'Beige',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'op-outer-jacket-olive', type: 'JACKET', name: 'Field Jacket Olive', color: 'Olive',
    material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'midweight_transitional',
  },
  {
    id: 'op-outer-coat-black', type: 'COAT', name: 'Wool Coat Black', color: 'Black',
    material: 'Wool', fit: 'relaxed', pattern: 'solid', warmthSeason: 'warm_winter',
  },

  // ── Accessories (2) ──
  {
    id: 'op-acc-bag-black', type: 'BAG', name: 'Leather Tote Black', color: 'Black',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
  {
    id: 'op-acc-belt-brown', type: 'BELT', name: 'Leather Belt Brown', color: 'Brown',
    material: 'Leather', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  },
];

const ONEPIECE_PROFILE = {
  selectedStyles: ['smartcasual'],
  colorPreferences: ['navy', 'charcoal', 'black', 'beige'],
  colorSeason: 'autumn',
  weatherSeason: 'allSeason',
  bodyMeasurements: BODY_MEASUREMENTS,
};

// ─── Named profiles ────────────────────────────────────────────────────────────

export const PROFILES = {
  smartcasual: { wardrobe: SMARTCASUAL_WARDROBE, profile: SMARTCASUAL_PROFILE },
  streetwear: { wardrobe: STREETWEAR_WARDROBE, profile: STREETWEAR_PROFILE },
  resort: { wardrobe: RESORT_WARDROBE, profile: RESORT_PROFILE },
  measured: { wardrobe: MEASURED_WARDROBE, profile: MEASURED_PROFILE },
  'measured-goal': { wardrobe: MEASURED_WARDROBE, profile: MEASURED_GOAL_PROFILE },
  onepiece: { wardrobe: ONEPIECE_WARDROBE, profile: ONEPIECE_PROFILE },
} as const;

export type ProfileName = keyof typeof PROFILES;

// ─── Backward-compatible default exports (smartcasual) ────────────────────────
// run.ts imports these by default so it works unchanged unless --profile is
// passed. Do not repurpose these names for anything other than the smartcasual
// fixture — external snapshots (baseline.json etc.) were generated against it.

export const WARDROBE: ClothingItemRow[] = SMARTCASUAL_WARDROBE;
export const PROFILE = SMARTCASUAL_PROFILE;
