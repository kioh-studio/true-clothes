// Collage layout — pure layering/positioning math for OutfitCollage.
// Deliberately has ZERO React Native runtime import (only type-only imports,
// erased at compile time) so it stays importable from plain Jest/node tests
// without the RN test env this repo doesn't set up (see jest.config.js —
// ts-jest + testEnvironment: 'node', no react-native preset). The RN
// rendering component lives in Collage.tsx and imports from here.
//
// Layout model (flow, not static zones, since 2026-08-12): three priority
// tiers. #1 the anchor (bottom/one-piece) is the biggest item, placed at the
// left, top-aligned — unless there are zero secondaries, in which case the
// anchor is horizontally centered on the card instead (no column to share
// the row with). #2 secondaries (tops/outerwear) form a column to its
// right, smaller than the anchor, stacked downward starting at the anchor's
// top Y. #3 accessories/shoes are the smallest, laid out in row(s) below the
// lowest bottom edge of the anchor+secondaries, each row centered on the
// anchor's horizontal centerline (clamped into the frame) and packed
// left→right within itself, wrapping onto a new row when items don't fit on
// one line. The whole composition is then scaled down to fit the items
// area if it overflows, and
// vertically centered if it underflows. See `buildLayout` below.

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
  'LOAFERS', 'SNEAKERS', 'BOOTS', 'MULES', 'SANDALS', 'OXFORDS', 'HEELS', 'FLATS', 'WEDGES', 'SLIDES', 'SHOES',
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
  HEELS: 1.25,  FLATS: 1.5,     WEDGES: 1.35, OXFORDS: 1.35, SANDALS: 1.45, SLIDES: 1.45,
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
// `aspect` is the garment's MEASURED w/h ratio (contentBounds.ts, on-device
// content-bounds crop — real photos carry background margins the static
// ASPECT table below can't know about), injected by the render layer after
// measurement lands; undefined until then, or for photos that skip
// measurement (bundled catalog art). Falls back to ASPECT[type] in
// buildLayout when absent, exactly like before this existed.
export type Entry = { id: string; type: string; photo: PhotoInput; hasImage: boolean; aspect?: number };

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

// ─── Flow layout constants (all in "width units" — 1 wu = 1% of the items
// area width) ─────────────────────────────────────────────────────────────
// Sized to deliberately UNDER-fill the frame — luxury minimalism ("Breathe.
// Oversized padding, never crowded", CLAUDE.md) means edge-to-edge items
// read as crowded, not confident. Margins/gaps are generous on purpose;
// scale-to-fit still guards against real overflow (a heavy outfit), and the
// vertical-centering pass is what turns the resulting slack into breathing
// room above/below rather than an off-center composition.
//
// Retuned down a second time 2026-08-12: items still read too large and too
// tightly packed. Every size cap dropped ~15–17% (anchor 36→30 wu / 0.60→0.52
// H, secondaries 0.33→0.28 H, accessories 0.12→0.10 H and 22→18 wu) while
// every gap grew ~40% (GAP/ACC_GAP 5→7, ACC_ROW_TOP_GAP 6→9). Side margins
// went 5→9 wu on BOTH columns and on accessory rows together, so the
// composition stays symmetrically inset instead of drifting left as the
// items shrink. Shrinking sizes and growing gaps at once is the point:
// shrinking alone would just add slack at the frame edge, not between items.
export const COLLAGE = {
  GAP: 7,                    // vertical gap between stacked secondaries (wu)
  ACC_GAP: 7,                // gap between accessory rows and min horizontal gap (wu)
  ACC_ROW_TOP_GAP: 9,        // gap between clothes bottom and first accessory row (wu)
  ANCHOR_LEFT: 9,            // anchor column left edge (wu)
  ANCHOR_MAX_W: 30,          // anchor max width (wu)
  ANCHOR_MAX_H_FRAC: 0.52,   // anchor max height as fraction of H
  SEC_LEFT: 47,              // secondary column left edge (wu)
  SEC_MAX_W: 44,             // secondary column width (wu) — right margin 9, matches ANCHOR_LEFT
  SEC_MAX_H_FRAC: 0.28,      // per-secondary max height as fraction of H
  ACC_H_FRAC: 0.10,          // accessory height as fraction of H
  ACC_MAX_W: 18,             // accessory max width (wu)
  ACC_MARGIN: 9,             // left/right margin for accessory rows (wu)
} as const;

// Internal mutable box used while building the layout, before the final
// wu → percentage conversion.
type Box = { left: number; top: number; w: number; h: number };

// Fit `aspect` (w/h) into a top-left-anchored box no larger than
// maxW × maxH, shrinking to whichever constraint binds. No centering — the
// caller decides placement.
function fitTopLeft(aspect: number, maxW: number, maxH: number): { w: number; h: number } {
  const w = Math.min(maxW, maxH * aspect);
  const h = w / aspect;
  return { w, h };
}

export function buildLayout(rawItems: Entry[], areaAspect = 0.9): PositionedEntry[] {
  const items = rawItems.filter(i => i.hasImage);
  const { anchor, secondaries: allSecondaries, accessories: allAccessories } = resolveRoles(items);

  const H = 100 / areaAspect;

  type Placed = { entry: Entry; box: Box; z: number };
  const clothes: Placed[] = [];

  // #2 (computed first, needed to decide anchor placement) — secondaries:
  // smaller column to the right, stacked down from the anchor's top Y.
  const secondaries = allSecondaries.slice(0, 4);

  // #1 — anchor: biggest item, top-aligned. Left column when there are
  // secondaries to share the row with; horizontally centered on the card
  // when the anchor is the only clothing item (no secondary column to
  // balance against).
  let anchorBox: Box | null = null;
  if (anchor) {
    const { w, h } = fitTopLeft(anchor.aspect ?? ASPECT[anchor.type] ?? 0.58, COLLAGE.ANCHOR_MAX_W, COLLAGE.ANCHOR_MAX_H_FRAC * H);
    const left = secondaries.length === 0 ? 50 - w / 2 : COLLAGE.ANCHOR_LEFT;
    anchorBox = { left, top: 0, w, h };
    clothes.push({ entry: anchor, box: anchorBox, z: 1 });
  }

  const n = secondaries.length;
  let secTop = 0;
  secondaries.forEach((item, i) => {
    const secMaxH = anchorBox
      ? Math.min(COLLAGE.SEC_MAX_H_FRAC * H, (anchorBox.h - (n - 1) * COLLAGE.GAP) / n)
      : COLLAGE.SEC_MAX_H_FRAC * H;
    const { w, h } = fitTopLeft(item.aspect ?? ASPECT[item.type] ?? 0.85, COLLAGE.SEC_MAX_W, secMaxH);
    const left = COLLAGE.SEC_LEFT + (COLLAGE.SEC_MAX_W - w) / 2;
    const box: Box = { left, top: secTop, w, h };
    clothes.push({ entry: item, box, z: 2 + i });
    secTop = secTop + h + COLLAGE.GAP;
  });

  // #3 — accessories/shoes: smallest, in row(s) below the lowest clothing
  // bottom edge, each row centered on the anchor's horizontal centerline
  // (clamped into the frame), items packed left→right within the row,
  // wrapping when a row overflows.
  const accEntries = allAccessories.slice(0, 8);
  const accH = COLLAGE.ACC_H_FRAC * H;
  const accBoxesRaw = accEntries.map((item, i) => {
    const aspect = item.aspect ?? ASPECT[item.type] ?? 1.3;
    const unclampedW = accH * aspect;
    let w = Math.min(unclampedW, COLLAGE.ACC_MAX_W);
    let h = accH;
    if (unclampedW > COLLAGE.ACC_MAX_W) {
      h = w / aspect;
    }
    return { entry: item, w, h, index: i };
  });

  const clothesBottom = clothes.length > 0
    ? Math.max(...clothes.map(c => c.box.top + c.box.h))
    : 0;
  let rowY = clothes.length > 0 ? clothesBottom + COLLAGE.ACC_ROW_TOP_GAP : 0;

  const accPlaced: Placed[] = [];
  // Every row centers on the anchor's horizontal centerline (works for both
  // the left-column anchor and the centered no-secondary anchor alike).
  // Falls back to the frame's own center when there's no anchor at all.
  const centerX = anchorBox ? anchorBox.left + anchorBox.w / 2 : 50;
  // Row capacity is independent of the anchor position — the full usable
  // width, same as before rows were positioned relative to the anchor.
  const SPAN = 100 - 2 * COLLAGE.ACC_MARGIN; // usable horizontal span (wu)
  let i = 0;
  while (i < accBoxesRaw.length) {
    const row: typeof accBoxesRaw = [];
    let sumW = 0;
    let j = i;
    while (j < accBoxesRaw.length) {
      const candidateSum = sumW + accBoxesRaw[j].w;
      const k = row.length + 1;
      if (candidateSum + (k - 1) * COLLAGE.ACC_GAP <= SPAN) {
        row.push(accBoxesRaw[j]);
        sumW = candidateSum;
        j++;
      } else {
        break;
      }
    }
    if (row.length === 0) {
      // A single item wider than the whole row — place it alone rather than
      // looping forever.
      row.push(accBoxesRaw[j]);
      sumW = accBoxesRaw[j].w;
      j++;
    }

    // Centered on the anchor's centerline, clamped so the row never spills
    // past the frame margins — packed left→right within the row with a
    // fixed gap (no space-evenly distribution: a lone accessory used to end
    // up centered mid-row, reading detached from the anchor above it).
    const k = row.length;
    const rowWidth = sumW + (k - 1) * COLLAGE.ACC_GAP;
    const rowStartX = Math.min(
      Math.max(centerX - rowWidth / 2, COLLAGE.ACC_MARGIN),
      100 - COLLAGE.ACC_MARGIN - rowWidth,
    );
    let left = rowStartX;
    for (const b of row) {
      const top = rowY + (accH - b.h) / 2;
      accPlaced.push({ entry: b.entry, box: { left, top, w: b.w, h: b.h }, z: 6 + b.index });
      left = left + b.w + COLLAGE.ACC_GAP;
    }

    rowY = rowY + accH + COLLAGE.ACC_GAP;
    i = j;
  }

  const all: Placed[] = [...clothes, ...accPlaced];

  // Scale-to-fit: shrink the whole composition about the horizontal center
  // line if it overflows the items area's height.
  if (all.length > 0) {
    const totalBottom = Math.max(...all.map(p => p.box.top + p.box.h));
    if (totalBottom > H) {
      const s = H / totalBottom;
      for (const p of all) {
        const oldCenterX = p.box.left + p.box.w / 2;
        p.box.w *= s;
        p.box.h *= s;
        p.box.top *= s;
        p.box.left = 50 + (oldCenterX - 50) * s - p.box.w / 2;
      }
    }

    // Vertical centering: if the composition underflows, center it.
    const newTotalBottom = Math.max(...all.map(p => p.box.top + p.box.h));
    if (newTotalBottom < H) {
      const offset = (H - newTotalBottom) / 2;
      for (const p of all) {
        p.box.top += offset;
      }
    }
  }

  // Convert wu → output percentages: left/w are already % of width; top/h
  // convert from the H-normalized vertical axis to % of height.
  return all.map(p => ({
    ...p.entry,
    slot: {
      left: p.box.left,
      top: p.box.top / H * 100,
      w: p.box.w,
      h: p.box.h / H * 100,
      z: p.z,
    },
  }));
}
