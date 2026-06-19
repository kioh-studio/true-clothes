# Contract: `generate-outfits` Pinned-Item Extension (MODIFY, backward-compatible)

Mix & Match reuses the existing `generate-outfits` engine, adding an optional transient pinned item so every returned outfit includes the scanned (not-yet-saved) garment.

## Endpoint
`POST /functions/v1/generate-outfits` (unchanged)

## New optional request fields
```jsonc
{
  // ...all existing fields (intent, exclude_ids, formula_id, locale, curate) unchanged...
  "pin_item": {
    "id": "scanned",                 // synthetic id; client maps back to the local cut-out image
    "type": "SHIRT",
    "color": "Olive",
    "material": "Cotton",
    "fit": "regular",
    "pattern": "solid",
    "warmth_season": "all_season",
    "measurements": { "m_chest": 54 }
  }
}
```
When `pin_item` is absent, behavior is exactly as today (no regression).

## Behavior when `pin_item` is present
1. Build a `FitItem` from `pin_item` (reuse `toFitItem` / enrichment) and inject it into `itemMap` under `pin_item.id`. It is NOT read from or written to the DB.
2. Determine its slot from its category (top | bottom | footwear | outerwear | accessory).
3. Generate candidates with that slot fixed to `pin_item.id` (pinned variant of `generateFromPool`), pairing only with the user's actual wardrobe items.
4. Score / filter / rank / (optional) curate exactly as normal.
5. Every returned `ScoredOutfit` has `pin_item.id` in its corresponding slot. `exclude_ids` pagination still works (full-slot key includes the pin).

## Response
Unchanged shape: `{ outfits: ScoredOutfit[], has_more: boolean, curated?: boolean }`. Each outfit is a **complete** outfit (top + bottom + footwear core; outerwear/accessory optional) per FR-012a.

## Edge cases
- Wardrobe cannot complete an outfit around the pin → `outfits: []` → client shows the sparse-wardrobe state (no incomplete outfits, FR-012a / Edge Cases).
- `pin_item` invalid/empty → 400.

## Client invocation
A new `fitEngineStore` action `fetchMixMatchOutfits(scannedItem)` builds `pin_item` from the `ScannedItem` and invokes `generate-outfits`. Returned outfits render with the pinned slot resolved to the scanned item's local cut-out image. No credit consumed.
