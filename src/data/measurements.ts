// Real garment measurements sourced from cross-platform branch asset MEASUREMENT.md files
// and Flutter demo data (home_outfit_models.dart).
//
// Convention (matches fit-engine.md §3.2):
//   - Top / Outerwear: chest, waist_top, waist_outer = full circumference
//     (laid-flat values from MEASUREMENT.md are doubled here)
//   - Pants: waist, hip = full circumference (tape around garment);
//     thigh = full circumference (laid-flat × 2)
//   - All values in cm.

import {
  TopMeasurements,
  OuterwearMeasurements,
  BottomPantsMeasurements,
} from '../types/fitEngine';

// ─── Body measurements (real person — MY-MEASUREMENT.md) ─────────────────────

export const REAL_BODY_MEASUREMENTS = {
  body_height:           175,
  body_weight:           76,
  body_bust:             96,   // Chest: 96
  body_shoulder_width:   47,   // Shoulder: 47
  body_sleeve_length:    56,   // Sleeve: 56 (shoulder socket → wrist)
  body_upper_arm:        32,   // Bicep: 32
  body_upper_body_length:42,   // Body length: 42 (nape → natural waist)
  // Lower body — needed for pants fit scoring (was missing → all pants scored 0.5)
  body_waist:            78,   // Natural waist circumference
  body_hip:              94,   // Hip circumference at widest point
  body_thigh:            56,   // Mid-thigh circumference
  body_inseam:           78,   // Crotch to ankle
  body_rise:             25,   // Waist to crotch
} as const;

// ─── Garment measurements lookup (item ID → measurements) ─────────────────────

type GarmentMeasurementsMap = Record<string, TopMeasurements | OuterwearMeasurements | BottomPantsMeasurements>;

export const GARMENT_MEASUREMENTS: GarmentMeasurementsMap = {

  // ── Outerwear ──────────────────────────────────────────────────────────────

  // Beige Harrington jacket (assets/jacket/harrington/MEASUREMENT.md)
  // chest from Flutter demo (104 cm); MEASUREMENT.md body-width 68 laid-flat × 2 = 136
  // which appears to include lining bulk — Flutter demo value (104) is more realistic.
  i_jkt_harr: {
    chest:          104,  // Flutter demo: full circumference
    shoulder_width:  48,  // Flutter demo
    sleeves:         65,  // Flutter demo (shoulder seam → cuff)
    body_length:     68,  // MEASUREMENT.md: Length 68
  } satisfies OuterwearMeasurements,

  // ── Tops ───────────────────────────────────────────────────────────────────

  // Beige Milano knit (assets/milano/MEASUREMENT.md)
  // Body width: 58.5 laid flat × 2 = 117
  i_tee_beige: {
    chest:          117,  // 58.5 × 2
    shoulder_width:  45,
    sleeves:         51,
    body_length:     71,
  } satisfies TopMeasurements,

  // Black crewneck sweater (assets/sweater/MEASUREMENT.md)
  // Body width: 57 laid flat × 2 = 114
  i_swt_black: {
    chest:          114,  // 57 × 2
    shoulder_width:  51,
    sleeves:         77.5,
    body_length:     65,
  } satisfies TopMeasurements,

  // Olive knit polo (assets/polo/sknit-polo/MEASUREMENT.md — Uniqlo polo)
  // Body width: 55 laid flat × 2 = 110
  i_polo_olive: {
    chest:          110,  // 55 × 2
    shoulder_width:  43.5,
    sleeves:         48.5,
    body_length:     68,
  } satisfies TopMeasurements,

  // ── Bottoms ────────────────────────────────────────────────────────────────

  // Light wash jeans (Flutter demo — demo-item-jeans)
  // thigh: 58 cm = full circumference as recorded in Flutter demo
  i_jeans_blue: {
    waist:   81,
    thigh:   58,   // full circumference (Flutter demo)
    rise:    26,
    inseam:  81,
  } satisfies BottomPantsMeasurements,

  // Dark wash jeans → Navy smart pants (assets/pants/smart/MEASUREMENT.md)
  // thigh: 33 laid flat × 2 = 66; waist/hip already full circumference
  i_jeans_dark: {
    waist:   84,
    hip:     102,
    thigh:   66,   // 33 × 2
    rise:    26,
    inseam:  68.5,
  } satisfies BottomPantsMeasurements,

  // Stone chinos → Linen pants (assets/pants/linen/MEASUREMENT.md)
  // thigh: 36.5 laid flat × 2 = 73; waist/hip already full circumference
  i12: {
    waist:   88,
    hip:     113.5,
    thigh:   73,   // 36.5 × 2
    rise:    27.5,
    inseam:  78,
  } satisfies BottomPantsMeasurements,

  // ── Fetched items ─────────────────────────────────────────────────────────
  // Measurements sourced from Uniqlo / Levi's / Everlane size charts for size M
  // (tops/outwear) and 32/29–30 (bottoms). All values in cm.

  // Uniqlo MA-1 Blouson Jacket — size M
  // Uniqlo chart: chest 51 laid-flat × 2 = 102; shoulder 46; sleeve 63; length 62
  jkt_ma1_blk: {
    chest:          102,
    shoulder_width:  46,
    sleeves:         63,
    body_length:     62,
  } satisfies OuterwearMeasurements,
  jkt_ma1_olv: {
    chest:          102,
    shoulder_width:  46,
    sleeves:         63,
    body_length:     62,
  } satisfies OuterwearMeasurements,
  jkt_ma1_nvy: {
    chest:          102,
    shoulder_width:  46,
    sleeves:         63,
    body_length:     62,
  } satisfies OuterwearMeasurements,

  // Uniqlo Cotton Utility Jacket — size M
  // Uniqlo chart: chest 53 laid-flat × 2 = 106; shoulder 47; sleeve 63; length 68
  jkt_utl_olv: {
    chest:          106,
    shoulder_width:  47,
    sleeves:         63,
    body_length:     68,
  } satisfies OuterwearMeasurements,
  jkt_utl_brn: {
    chest:          106,
    shoulder_width:  47,
    sleeves:         63,
    body_length:     68,
  } satisfies OuterwearMeasurements,

  // Uniqlo Slim Fit Chino Pants — size 32/29
  // waist: 32" = 81 cm; hip ~100; thigh 30 laid-flat × 2 = 60; rise 27; inseam 29" = 74
  chino_beige: {
    waist:    81,
    hip:     100,
    thigh:    60,
    rise:     27,
    inseam:   74,
  } satisfies BottomPantsMeasurements,
  chino_black: {
    waist:    81,
    hip:     100,
    thigh:    60,
    rise:     27,
    inseam:   74,
  } satisfies BottomPantsMeasurements,
  chino_olive: {
    waist:    81,
    hip:     100,
    thigh:    60,
    rise:     27,
    inseam:   74,
  } satisfies BottomPantsMeasurements,
  chino_navy: {
    waist:    81,
    hip:     100,
    thigh:    60,
    rise:     27,
    inseam:   74,
  } satisfies BottomPantsMeasurements,

  // Levi's 511 Slim Fit Jeans — size 32/30
  // waist: 32" = 81 cm; hip ~98; thigh 29 laid-flat × 2 = 58; rise 26; inseam 30" = 76
  jns_lv_blk: {
    waist:    81,
    hip:      98,
    thigh:    58,
    rise:     26,
    inseam:   76,
  } satisfies BottomPantsMeasurements,

  // Uniqlo DRY Piqué Polo Shirt — size M (short sleeve)
  // Uniqlo chart: chest 51 laid-flat × 2 = 102; shoulder 44; sleeve 22 (short); length 68
  polo_white: {
    chest:          102,
    shoulder_width:  44,
    sleeves:         22,
    body_length:     68,
  } satisfies TopMeasurements,
  polo_black: {
    chest:          102,
    shoulder_width:  44,
    sleeves:         22,
    body_length:     68,
  } satisfies TopMeasurements,

  // Uniqlo SUPIMA Cotton Crew Neck T-Shirt — size M (short sleeve)
  // Uniqlo chart: chest 49 laid-flat × 2 = 98; shoulder 43; sleeve 21 (short); length 69
  tee_sup_blk: {
    chest:          98,
    shoulder_width:  43,
    sleeves:         21,
    body_length:     69,
  } satisfies TopMeasurements,
  tee_sup_gry: {
    chest:          98,
    shoulder_width:  43,
    sleeves:         21,
    body_length:     69,
  } satisfies TopMeasurements,

  // Everlane Waffle-Knit Henley — size M (long sleeve)
  // Everlane chart: chest 50 laid-flat × 2 = 100; shoulder 44; sleeve 65; length 70
  henley_navy: {
    chest:          100,
    shoulder_width:  44,
    sleeves:         65,
    body_length:     70,
  } satisfies TopMeasurements,

  // ── De Basé Vietnam ────────────────────────────────────────────────────────
  // De Basé RAW Denim Shirt — size L (brand-recommended for 175cm/76kg)
  // Product page L: front 70 / back 74.5 / chest 112 / shoulder 58
  debase_shirt_denim: {
    chest:          112,
    shoulder_width:  58,
    sleeves:         65,   // estimated long sleeve
    body_length:     74,   // back length
  } satisfies TopMeasurements,

  // De Basé Lucas Shirt — size L (brand-recommended for 175cm/76kg)
  // Product page L: length 74 / chest 112
  debase_shirt_lucas: {
    chest:          112,
    shoulder_width:  52,   // estimated
    sleeves:         23,   // short sleeve
    body_length:     74,
  } satisfies TopMeasurements,

  // De Basé Linen Premium Shirt — size L (brand-recommended, oversize fit)
  // Product page L: length 75 / chest 112
  debase_shirt_linen: {
    chest:          112,
    shoulder_width:  52,   // estimated
    sleeves:         63,   // long sleeve
    body_length:     75,
  } satisfies TopMeasurements,

  // De Basé basé TROUSERS 01 — size L (brand-recommended for 175cm/76kg)
  // Product page L: length 103 / waist 77-83 (mid 80) / thigh max 72 / hem 27
  debase_trousers: {
    waist:    80,
    hip:      95,   // estimated
    thigh:    72,
    rise:     28,   // estimated
    inseam:   75,   // length 103 - rise 28 ≈ 75
  } satisfies BottomPantsMeasurements,

  // De Basé Daddy Pants Ver 2 — size L (brand-recommended for 175cm/76kg)
  // Product page L: length 101 / waist 78-83 (mid 80) / thigh 65 / hem 22
  debase_pants_kaki: {
    waist:    80,
    hip:      95,   // estimated
    thigh:    65,
    rise:     26,   // estimated
    inseam:   75,   // length 101 - rise 26 ≈ 75
  } satisfies BottomPantsMeasurements,
};
