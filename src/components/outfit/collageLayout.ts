// Collage layout — pure layering/positioning math for OutfitCollage.
// Deliberately has ZERO React Native runtime import (only type-only imports,
// erased at compile time) so it stays importable from plain Jest/node tests
// without the RN test env this repo doesn't set up (see jest.config.js —
// ts-jest + testEnvironment: 'node', no react-native preset). The RN
// rendering component lives in Collage.tsx and imports from here.

import { itemById } from '../../data';
import type { WardrobeItem } from '../../types/fitEngine';
import type { PhotoInput } from '../../features/wardrobe-photos/types';

// ─── Item role classification ────────────────────────────────────────────────
// Anchors: the tall/long bottom item that defines the outfit's scale
export const ANCHOR_PRIORITY = ['DRESS', 'OVERCOAT', 'COAT', 'TROUSERS', 'JEANS', 'CHINOS', 'SKIRT', 'LEGGINGS', 'SHORTS', 'BLAZER'];

// Visual z-order buckets for secondaries — outer shell → mid insulation layer
// → base/inner top → everything else. Mirrors engine LAYER_ROLE_BY_TYPE
// (supabase/functions/generate-outfits/engine/enrichment.ts, ~line 274) so a
// garment's z-order here agrees with the layerRole the scoring engine already
// assigned it when it built the `mid` slot (2026-08-10 — see OutfitSlots.mid
// in src/types/fitEngine.ts). Duplicated across runtimes INTENTIONALLY, same
// reason as TONE12_AVOID in supabase/functions/generate-outfits/engine/
// scoring.ts: this is a Deno Edge Function the RN client can't import, and
// this file can't import a Deno-only module. MUST be kept in sync by hand
// whenever LAYER_ROLE_BY_TYPE changes.
//
// KIMONO: the engine classifies it 'mid' (worn open, layered UNDER a true
// outer shell), not 'outer'. No visual reason to diverge — a kimono's
// silhouette (long, draped, ASPECT 0.68 below) sits fine among sweaters/
// cardigans in the mid slot, so it follows the engine here. (Previously
// grouped with OUTER_TOPS, before slot `mid` existed.)
export const OUTER_TOPS = new Set(['JACKET', 'BLAZER', 'COAT', 'OVERCOAT', 'CAPE']);
export const MID_TOPS = new Set(['HOODIE', 'SWEATER', 'CARDIGAN', 'VEST', 'KNIT', 'KIMONO']);
export const INNER_TOPS = new Set([
  'TEE', 'SHIRT', 'POLO', 'HENLEY',
  'BLOUSE', 'CAMISOLE', 'CROP', 'BODYSUIT', 'TUNIC', 'CORSET',
]);
export const ACCESSORY_TYPES = new Set([
  'LOAFERS', 'SNEAKERS', 'BOOTS', 'MULES', 'SANDALS', 'OXFORDS', 'HEELS', 'FLATS', 'WEDGES', 'SHOES',
  'BAG', 'WATCH', 'NECKLACE', 'SUNGLASSES', 'EARRINGS', 'GLOVES', 'TIGHTS',
  'BELT', 'SCARF', 'RING', 'BRACELET', 'HAT', 'CAP', 'TIE',
]);

// Natural width/height ratios — < 1 = taller than wide
export const ASPECT: Record<string, number> = {
  JEANS: 0.54,  TROUSERS: 0.50, CHINOS: 0.54, SHORTS: 0.80, SKIRT: 0.68, LEGGINGS: 0.48,
  DRESS: 0.44,  OVERCOAT: 0.50, COAT: 0.50,   CAPE: 0.70,    KIMONO: 0.68,
  TEE: 0.86,    SHIRT: 0.82,    KNIT: 0.88,   POLO: 0.84,    HENLEY: 0.84,
  BLOUSE: 0.82, CAMISOLE: 0.82, CROP: 0.92,   BODYSUIT: 0.80, TUNIC: 0.80, CORSET: 0.86,
  BLAZER: 0.80, JACKET: 0.82,
  LOAFERS: 1.35, SNEAKERS: 1.55, BOOTS: 1.2, MULES: 1.35, SHOES: 1.35, BELT: 2.8,
  HEELS: 1.25,  FLATS: 1.5,     WEDGES: 1.35, OXFORDS: 1.35, SANDALS: 1.45,
  BAG: 0.95,    WATCH: 1.0,     NECKLACE: 0.85, EARRINGS: 0.7, GLOVES: 0.9, TIGHTS: 0.5,
  SUNGLASSES: 1.9, SCARF: 1.6,  CAP: 1.25,    HAT: 1.2,     TIE: 0.3,
};

// Fallback granular type for DB items that only carry a coarse `category`.
// Also reused by src/features/wardrobe-build (WardrobeItem → builder adapter)
// so there is a single source of truth for the category→type fallback.
export const CATEGORY_TYPE: Record<WardrobeItem['category'], string> = {
  top: 'TEE', bottom: 'JEANS', outerwear: 'JACKET',
  footwear: 'SNEAKERS', accessory: 'BAG', dress: 'DRESS', headwear: 'CAP',
};

// ─── Normalized entry ─────────────────────────────────────────────────────────
// An outfit item drawn from EITHER the bundled mock catalog (png) OR a real
// DB-backed wardrobe item (resolved on-device via useItemPhoto). `type` drives
// layout; `photo` is fed to useItemPhoto (which handles png / local / cloud).
export type Entry = { id: string; type: string; photo: PhotoInput; hasImage: boolean };

export function toEntry(id: string, wardrobeById: Map<string, WardrobeItem>): Entry | null {
  const mock = itemById(id);
  if (mock) {
    return {
      id,
      type: mock.type.toUpperCase(),
      photo: { id, photoStorage: 'none', photoPath: null, png: mock.png },
      hasImage: mock.png != null,
    };
  }
  const w = wardrobeById.get(id);
  if (w) {
    return {
      id: w.id,
      type: (w.type ?? CATEGORY_TYPE[w.category] ?? 'TEE').toUpperCase(),
      photo: { id: w.id, photoStorage: w.photoStorage, photoPath: w.photoPath },
      hasImage: w.photoStorage !== 'none' || w.photoPath != null,
    };
  }
  return null;
}

// ─── Zone definitions (% of the items-area View) ────────────────────────────
export type Zone = { left: number; top: number; maxW: number; maxH: number };

export const ANCHOR_ZONE: Zone = { left: 2, top: 0, maxW: 40, maxH: 78 };

export const SEC_ZONES: Record<number, Zone[]> = {
  1: [
    { left: 44, top: 0,  maxW: 52, maxH: 76 },
  ],
  2: [
    { left: 44, top: 0,  maxW: 52, maxH: 37 },
    { left: 44, top: 40, maxW: 52, maxH: 37 },
  ],
  3: [
    { left: 44, top: 0,  maxW: 52, maxH: 24 },
    { left: 44, top: 27, maxW: 52, maxH: 24 },
    { left: 44, top: 54, maxW: 52, maxH: 24 },
  ],
  4: [
    { left: 44, top: 0,  maxW: 26, maxH: 37 },
    { left: 71, top: 0,  maxW: 26, maxH: 37 },
    { left: 44, top: 40, maxW: 26, maxH: 37 },
    { left: 71, top: 40, maxW: 26, maxH: 37 },
  ],
};

export const ACC_ZONES: Record<number, Zone[]> = {
  1: [
    { left: 30, top: 80, maxW: 40, maxH: 20 },
  ],
  2: [
    { left: 5,  top: 80, maxW: 36, maxH: 20 },
    { left: 59, top: 80, maxW: 36, maxH: 20 },
  ],
  3: [
    { left: 2,  top: 80, maxW: 28, maxH: 20 },
    { left: 36, top: 80, maxW: 28, maxH: 20 },
    { left: 70, top: 80, maxW: 28, maxH: 20 },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function fitInZone(zone: Zone, aspect: number) {
  let w = zone.maxW;
  let h = w / aspect;
  if (h > zone.maxH) {
    h = zone.maxH;
    w = h * aspect;
  }
  const left = zone.left + (zone.maxW - w) / 2;
  const top  = zone.top  + (zone.maxH - h) / 2;
  return { left, top, w, h };
}

export function resolveRoles(items: Entry[]) {
  let anchor: Entry | undefined;
  for (const t of ANCHOR_PRIORITY) {
    anchor = items.find(i => i.type === t);
    if (anchor) break;
  }
  if (!anchor) anchor = items.find(i => !ACCESSORY_TYPES.has(i.type)) ?? items[0];

  const accessories = items.filter(i => ACCESSORY_TYPES.has(i.type));
  const rest = items.filter(i => i !== anchor && !ACCESSORY_TYPES.has(i.type));
  // outer → mid → inner → anything unclassified (e.g. bottoms, dresses that
  // aren't the anchor for some reason).
  const secondaries = [
    ...rest.filter(i => OUTER_TOPS.has(i.type)),
    ...rest.filter(i => MID_TOPS.has(i.type)),
    ...rest.filter(i => INNER_TOPS.has(i.type)),
    ...rest.filter(i => !OUTER_TOPS.has(i.type) && !MID_TOPS.has(i.type) && !INNER_TOPS.has(i.type)),
  ];
  return { anchor, secondaries, accessories };
}

export type Slot = { left: number; top: number; w: number; h: number; z: number };
export type PositionedEntry = Entry & { slot: Slot };

export function buildLayout(rawItems: Entry[]): PositionedEntry[] {
  const items = rawItems.filter(i => i.hasImage);
  const { anchor, secondaries, accessories } = resolveRoles(items);
  const out: PositionedEntry[] = [];

  if (anchor) {
    const fit = fitInZone(ANCHOR_ZONE, ASPECT[anchor.type] ?? 0.58);
    out.push({ ...anchor, slot: { ...fit, z: 1 } });
  }

  const secCount = Math.min(secondaries.length, 4) as 1 | 2 | 3 | 4;
  const secZones = SEC_ZONES[secCount] ?? SEC_ZONES[1];
  secondaries.slice(0, 4).forEach((item, i) => {
    const zone = secZones[i];
    if (!zone) return;
    const fit = fitInZone(zone, ASPECT[item.type] ?? 0.85);
    out.push({ ...item, slot: { ...fit, z: 2 + i } });
  });

  const accCount = Math.min(accessories.length, 3) as 1 | 2 | 3;
  const accZones = ACC_ZONES[accCount] ?? ACC_ZONES[1];
  accessories.slice(0, 3).forEach((item, i) => {
    const zone = accZones[i];
    if (!zone) return;
    const fit = fitInZone(zone, ASPECT[item.type] ?? 1.3);
    out.push({ ...item, slot: { ...fit, z: 6 + i } });
  });

  return out;
}
