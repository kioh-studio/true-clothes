# Phase 1 Data Model: On-Device "Extract by Item"

Reuses feature 006's domain types and `clothing_items` schema. This feature adds only a
native-result type and the on-device → controlled-vocab mapping. No DB changes.

---

## 1. `ItemExtractionResult` (native module → JS)

Returned by `modules/expo-item-extract` `extractItem(uri)`.

| Field | Type | Notes |
|-------|------|-------|
| `cutoutUri` | string | file uri of the transparent PNG cut-out (~1K). Falls back to the original photo uri if segmentation unavailable (R6a). |
| `usedFallback` | boolean | true when segmentation failed and keying/original was used (drives a UI hint). |
| `palette` | `{ r: number; g: number; b: number }[]` | dominant **foreground** colours (transparent pixels excluded), most-dominant first (1–3). |
| `labels` | `{ text: string; confidence: number }[]` | image labels, confidence 0–1, highest first. |
| `ocrText` | string[] | recognised text blocks on the cut-out ([] if none). |

All fields typed across the bridge; no `any`.

---

## 2. Mapping → `ExtractedItem` (006 shape, one entry)

The service produces exactly one `ExtractedItem` (see `specs/006-ai-item-extraction/data-model.md` §3) with `method: 'item'`:

| ExtractedItem field | Source | Rule |
|---------------------|--------|------|
| `localImageUri` | `cutoutUri` | the transparent cut-out (or original on fallback) |
| `color` | `palette[0]` | `colorMatch(palette[0])` → nearest of 37 controlled colours (LAB ΔE). Never empty. |
| `type` | `labels` | `labelToType(labels)` → controlled type if top label maps and `confidence ≥ 0.5`; else `''` (user picks) |
| `name` | derived | from chosen type (e.g. "Olive item") or first label; editable |
| `pattern` | constant | `'solid'` (MVP default) |
| `material` | default | type default (editable) or null |
| `fit` | default | type default (editable) or null |
| `warmthSeason` | default | type default (editable) or null |
| `measurements` | `measureDefaults(type)` | per-type editable estimates (R8); empty if type blank |
| `graphics` | `ocrText` | `{ present: ocrText.length>0, text: ocrText.join(' ')||null, size: null, kind: null }` |
| `brand` | `''` | user-entered |
| `link` | `''` | user-entered |
| `tags` | `[]` | UI only |
| `confidence` | `labels[0]?.confidence ?? 0.5` | low-confidence hint |
| `srcId` / `method` | photo | `method='item'` |

### `colorMatch` (`src/utils/colorMatch.ts`)

- Precompute LAB (`colorLab.rgb2lab`) of each `COLOR_SWATCH` hex (37, from `vocab.ts`).
- `colorMatch(rgb)` → controlled colour name with min ΔE (CIE76 sufficient). Returns a valid controlled colour always (no silent fallback).

### `labelToType` (`src/services/itemTypeMap.ts`)

- Keyword map from coarse labels → controlled type (e.g. `jean|denim → JEANS`, `sneaker|trainer → SNEAKERS`, `jacket → JACKET`, `shirt → SHIRT`, `dress → DRESS`, `bag|handbag → BAG`, `shoe → LOAFERS?`...). Ambiguous/low-confidence → `''`.

### `measureDefaults(type)` (in `measureSchema.ts`)

- Per measure-group default cm values (top/bottom/shoe), editable. Empty when type is blank.

---

## 3. Save mapping (reuses `wardrobeService.addItem`, 006)

The wizard's `confirm()` already maps `ExtractedItem` → `AddItemInput`. The only item-method specific:

- `source = 'item'` (provenance; `source` has no CHECK constraint — verified in 006).
- `localPhotoUri = cutoutUri` → stored via `itemPhotoService` (transparent PNG kept).
- `graphics` written to the existing `graphics jsonb` column.

No new columns, no migration.

---

## 4. Validation rules

- `color` always a valid controlled colour (ΔE nearest).
- `type` either a valid controlled type or empty (never free text / never a wild guess).
- `measurements` numeric cm; only mapped `m_*` keys persisted (006 rules).
- `graphics.size`/`kind` null in MVP.
- No `any`; native bridge result validated/narrowed before mapping.
