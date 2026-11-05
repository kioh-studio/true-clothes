// ScannedItem → AddItemInput mapping. Shared by Try-On's Add action and the
// wishlist "bought" flow so both commit identical wardrobe rows.

import type { ScannedItem } from '../../types/tryOn';
import type { AddItemInput } from '../../services/wardrobeService';
import { categoryForType } from '../wardrobe-add/vocab';

export function scannedItemToAddInput(scannedItem: ScannedItem): AddItemInput {
  const meta = scannedItem.metadata;
  return {
    localPhotoUri: scannedItem.localImageUri,
    category: categoryForType(meta.type),
    colors: meta.color ? [meta.color] : [],
    name: meta.name || undefined,
    type: meta.type,
    primaryColor: meta.color || undefined,
    material: meta.material ?? undefined,
    fit: meta.fit ?? undefined,
    pattern: meta.pattern ?? undefined,
    warmthSeason: meta.warmthSeason ? [meta.warmthSeason] : undefined,
    measurements:
      meta.measurements && Object.keys(meta.measurements).length
        ? meta.measurements
        : undefined,
    brand: meta.brand || undefined,
    graphics: meta.graphics,
    // Reuse the existing extraction provenance ('ai' | 'item') so we don't have
    // to touch the possibly-constrained clothing_items.source column (plan/R).
    source: scannedItem.method,
    // Measured-hex color layer (2026-07-06): carried from the scan metadata
    // (server-computed for keyed images; recomputed/nulled in scan() otherwise).
    primaryHex: meta.primaryHex ?? null,
    secondaryHex: meta.secondaryHex ?? null,
    // Distressed finish + dual-role layering + visual enrichment đợt 2
    // (2026-08-11 threading fix): this path was the odd one out — the AI
    // add-wizard already carried these into its AddItemInput, but Try-On's
    // addToWardrobe built its own object from scratch and simply never
    // copied them over, so an item saved via Try-On silently lost data the
    // same scan already extracted. Try-On always uses the AI method
    // (scan()'s comment above), so `meta` here is the same GarmentMetadata
    // shape the add-wizard gets — no on-device "no source" case to worry
    // about on this path.
    distressed: meta.distressed ?? null,
    canLayer: meta.canLayer ?? null,
    printScale: meta.printScale ?? null,
    drape: meta.drape ?? null,
    visualInterest: meta.visualInterest ?? null,
  };
}
