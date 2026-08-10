// WardrobeItem → BuilderItem adapter (2026-08-10).
//
// app/build.tsx (the manual "Build an Outfit" screen) used to read straight
// from appStore.items, which is seeded with the 32 bundled mock items
// (ClothingItem, src/data/index.ts) and never updated after that — so the
// builder let users compose outfits out of demo clothes that weren't theirs.
// The user's real wardrobe lives in appStore.wardrobeItems (WardrobeItem,
// src/types/fitEngine.ts). The two types don't line up 1:1 — ClothingItem has
// a non-null `type`/`name`/`color` and a local `png` require() asset;
// WardrobeItem has nullable `type`/`name`, `colors`/`primaryColor`, and a
// photoStorage/photoPath pair resolved via useItemPhoto — so this module
// adapts WardrobeItem into a small builder-local shape instead of forcing it
// into ClothingItem.
//
// Pure (no React Native import) so it's plain-Jest testable.

import type { WardrobeItem } from '../../types/fitEngine';
import type { PhotoInput } from '../wardrobe-photos/types';
import { CATEGORY_TYPE } from '../../components/outfit/collageLayout';

export interface BuilderItem {
  id: string;
  /** Uppercase granular type (TEE/JEANS/JACKET/…) — drives bucket assignment
   *  and Collage layout, same vocabulary as ClothingItem.type. Derived from
   *  `category` when the AI extractor never set a granular type. */
  type: string;
  /** Display name — falls back to brand, then a title-cased type, so a tile
   *  never renders blank. */
  name: string;
  /** Display/match color — never hex (project convention). */
  color: string;
  /** Fed directly into useItemPhoto (src/features/wardrobe-photos) — the
   *  existing resolver for local/cloud/bundled item photos. This module does
   *  NOT resolve images itself; it only shapes the input for that hook. */
  photo: PhotoInput;
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** Granular type, falling back to the category→type map (same map Collage.tsx
 *  uses for the same reason: DB items that only carry a coarse `category`). */
export function builderTypeOf(type: string | null, category: WardrobeItem['category']): string {
  return (type ?? CATEGORY_TYPE[category]).toUpperCase();
}

/** Display name, falling back to brand, then a title-cased type. */
export function builderNameOf(name: string | null, brand: string | null, type: string): string {
  return name ?? brand ?? titleCase(type);
}

/** Display color — primaryColor wins over the first of `colors`. */
export function builderColorOf(primaryColor: string | null, colors: string[]): string {
  return primaryColor ?? colors[0] ?? '';
}

export function toBuilderItem(item: WardrobeItem): BuilderItem {
  const type = builderTypeOf(item.type, item.category);
  return {
    id: item.id,
    type,
    name: builderNameOf(item.name, item.brand, type),
    color: builderColorOf(item.primaryColor, item.colors),
    photo: { id: item.id, photoStorage: item.photoStorage, photoPath: item.photoPath },
  };
}

/** Total, non-lossy bucket assignment: every item lands in exactly one of
 *  `buckets`, even when its type isn't listed in any of them — falls back to
 *  `fallbackKey` instead of silently dropping the item from the builder UI.
 *  (Real wardrobe items can carry types/categories — e.g. headwear — the
 *  hand-authored BUILDER_BUCKETS catalog in app/build.tsx was never built to
 *  cover, since the old mock catalog never had any.) */
export function assignBucketKey<K extends string>(
  type: string,
  buckets: ReadonlyArray<{ key: K; types: readonly string[] }>,
  fallbackKey: K,
): K {
  const t = type.toUpperCase();
  for (const b of buckets) {
    if (b.types.includes(t)) return b.key;
  }
  return fallbackKey;
}
