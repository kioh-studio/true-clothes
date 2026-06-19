# Phase 1 Data Model: Try On

All types are transient (in-memory) unless noted. No new database tables or columns. Domain types are camelCase and live in `src/types/tryOn.ts`; snake_case appears only inside services and edge functions.

## Entities

### ScannedItem (transient)
The prospective garment under evaluation. Produced by extraction; not a wardrobe item until Add.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Synthetic session id (e.g. `"scanned"`); used as the pinned slot id in Mix & Match. |
| `localImageUri` | `string \| null` | Background-removed cut-out file URI; `null` only if image generation failed (placeholder shown). |
| `metadata` | `GarmentMetadata` | Reused as-is from `imageGenerationService` (type, name, color, material, fit, pattern, warmthSeason, measurements, brand, graphics, tags, confidence). |
| `method` | `'ai' \| 'item'` | Extraction path used; becomes `source` on Add. |
| `usedFallback` | `boolean` | On-device couldn't isolate cleanly (hint in UI). |

Lifecycle: `created (after scan)` → `evaluated (verdict attached)` → `added (committed to wardrobe)` OR `discarded (reset + temp file deleted)`.

### Verdict (transient)
Suitability assessment of a ScannedItem for the current user. Returned by `evaluate-item`.

| Field | Type | Notes |
|---|---|---|
| `overallScore` | `number` | 0–100 weighted composite over evaluable criteria. |
| `recommendation` | `'great' \| 'worth_it' \| 'maybe' \| 'skip'` | Label derived from `overallScore` bands (FR-006a). |
| `criteria` | `CriterionScore[]` | Exactly five entries: color, style, fit, measurement, fabric. |

### CriterionScore (value object)

| Field | Type | Notes |
|---|---|---|
| `key` | `'color' \| 'style' \| 'fit' \| 'measurement' \| 'fabric'` | |
| `available` | `boolean` | `false` → excluded from composite (FR-009a/FR-009b). |
| `score` | `number \| null` | 0–100 when `available`; `null` otherwise. |
| `explanation` | `string` | Plain-language reason (FR-009); when unavailable, what's missing + how to fix. |
| `weight` | `number` | Contribution weight (Fit/Measurement higher); informational for UI. |

### MixMatchOutfit (transient)
A complete outfit built around the ScannedItem from wardrobe items. Shape mirrors the engine's `ScoredOutfit` (slots + per-dimension scores + `totalScore`), with one slot occupied by `ScannedItem.id`. Never persisted.

### Reused existing entities (read-only inputs)
- **UserProfile inputs**: `bodyMeasurements` (`useFitEngineStore`), `colorSeason` + `personalPalette` (`useAuthStore`), `styleProfile.selectedStyles` (`useFitEngineStore`). Any may be empty → drives "Not enough info".
- **WardrobeItem**: candidate pool for Mix & Match; destination on Add (`appStore.addWardrobeItem` → `wardrobeService.addItem`).
- **GarmentMetadata / ExtractedItemWithImage**: reused verbatim from `src/services/imageGenerationService.ts`.

## Validation rules
- `criteria` always contains all five keys; unavailable ones carry `available:false, score:null` (never omitted, never fabricated).
- `overallScore` is computed only over `available` criteria, renormalizing their weights; if zero criteria are evaluable, `overallScore` is `null` and the UI shows a "complete your profile to get a verdict" state.
- Every `MixMatchOutfit` MUST contain `ScannedItem.id` in exactly one slot (server-enforced; client asserts on render).
- Nothing writes to `clothing_items` until the explicit Add action (FR-013).

## State transitions (tryOnStore)
```
idle → scanning → (extract ok) → evaluating → result
result → mixMatch (fetch pinned outfits) → result   (back)
result → added (addWardrobeItem) → done
result → discarded (reset) → idle
any error state → recoverable retry (FR-017); no partial save
```

## Contracts overview
- `contracts/evaluate-item.md` — new edge function: request (item attributes + user profile) → response (Verdict).
- `contracts/generate-outfits-pin.md` — backward-compatible extension of `generate-outfits` for the transient pinned item.
