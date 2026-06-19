# Phase 1 Data Model: AI Item Extraction

Entities, the controlled-vocabulary extraction schema, and how it maps to the live
`clothing_items` table. Implementation spans the edge function, `imageGenerationService`,
`wardrobeService`, `src/types/fitEngine.ts`, and the `src/features/wardrobe-add/` types.

---

## 1. `GarmentMetadata` (edge function output, per garment)

Controlled fields MUST match `enrichment.ts` (full vocab in
[contracts/generate-item-image.md](contracts/generate-item-image.md)).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | string (UPPERCASE enum, 40) | ✅ | Primary engine signal. |
| `name` | string | ✅ | Short human label. |
| `description` | string | ✅ | Image-gen prompt only; not persisted, not scored. |
| `color` | string (Title Case, 37) | ✅ | Dominant controlled colour (engine reads `color`). |
| `material` | string (Title Case) \| null | – | Controlled `material`; nearest match or null. |
| `fit` | string (5 groups) \| null | – | slim/regular/relaxed/wide/oversized (via aliases). |
| `pattern` | string (alias set) \| null | – | solid/striped/plaid/checked/floral/graphic/print… |
| `warmth_season` | 4-value enum \| null | – | lightweight_summer / midweight_transitional / warm_winter / all_season. |
| `measurements` | object `{ <group key>: number }` | – | **Type-aware AI estimates** in cm (R6); pre-filled, editable; never from body. |
| `brand` | string \| null | – | Only if a logo/wordmark is clearly legible; else null (user may add). |
| `graphics` | `LogoSignal` \| null | – | Logo signals; captured, not scored (MVP). |
| `tags` | string[] | – | UI/filter only; never scored. |
| `confidence` | number 0–1 | – | Detection confidence. |

`link` is **not** extracted (user-entered in Review).

### `LogoSignal`

| Field | Type | Notes |
|-------|------|-------|
| `present` | boolean | logo/slogan/graphic visible. |
| `size` | small\|medium\|large \| null | prominence; null if not present. |
| `kind` | brand_logo\|slogan_text\|graphic \| null | mark kind. |
| `text` | string \| null | OCR text if legible. |

---

## 2. `ExtractedItemWithImage` (edge → client transport)

One element of `items`. **Data and image are paired by array position** (FR-010).

| Field | Type | Notes |
|-------|------|-------|
| `image_data` | string (base64) | Isolated garment on white bg (~1K). **`""`** if this item's image gen failed (FR-019). |
| `mime_type` | string | image/png or image/jpeg. |
| `metadata` | `GarmentMetadata` | the garment's attributes. |

`imageGenerationService.extractItemsWithImages` converts each to `{ localImageUri: string|null, metadata }` (writes base64 to a device file; `null` → placeholder).

---

## 3. `ExtractedItem` (wizard review/edit view model — `src/features/wardrobe-add/types.ts`)

Editable, controlled-vocab shape held in Review state; one per garment; carries its source photo + method for grouping.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | review-local id |
| `srcId` | string | source photo id (Review groups by this) |
| `method` | `'ai' \| 'item'` | extraction method of its photo |
| `type` | string (controlled) | picker (vocab-constrained) |
| `name` | string | editable text |
| `color` | string (controlled) | picker + swatch |
| `material` | string \| null | picker |
| `fit` | string \| null | picker |
| `pattern` | string \| null | picker |
| `warmthSeason` | string \| null | picker |
| `measurements` | `{ <groupKey>: string }` | type-aware, pre-filled estimates, editable (string with unit in UI; parsed to number on save) |
| `brand` | string | editable text |
| `link` | string | editable text (product URL) |
| `tags` | string[] | add/remove chips (UI only) |
| `graphics` | `LogoSignal` \| null | captured; no edit UI in MVP |
| `localImageUri` | string \| null | generated item image (or placeholder) |
| `confidence` | number | low-confidence hint |

Wizard state: `upload → analyse → review → done` (+ recoverable `error`, `upgrade` when out of AI credits). Each upload entry: `{ libId/photoId, method: 'ai'|'item', note }`.

---

## 4. `WardrobeItem` additions (`src/types/fitEngine.ts`)

Add to existing: `fit: string | null`, `measurements: Partial<Record<MKey, number>> | null`, `graphics: LogoSignal | null`.

`MKey = 'm_chest'|'m_shoulder_width'|'m_sleeves'|'m_body_length'|'m_waist'|'m_hip'|'m_inseam'|'m_thigh'|'m_rise'|'m_skirt_length'|'m_shoe_size'`.

---

## 5. `clothing_items` mapping (live schema — verified)

Present (no migration): `type, name, color, primary_color, material, fit, fit_note, pattern, warmth_season, brand, size, source, source_url, occasion_tags, photo_url, photo_storage, m_chest, m_shoulder_width, m_sleeves, m_body_length, m_upper_arm, m_waist_top, m_waist, m_waist_outer, m_hip, m_inseam, m_thigh, m_rise, m_skirt_length, m_shoe_size, m_shoe_width`.

**New column** (migration `20260620000001_clothing_items_graphics.sql`): `graphics jsonb` nullable, default null — engine does not read it yet.

### Measurement group key → engine column

| Group | Review key → column |
|-------|---------------------|
| top | chest→`m_chest`, shoulder→`m_shoulder_width`, length→`m_body_length`, sleeve→`m_sleeves` |
| bottom | waist→`m_waist`, hip→`m_hip`, inseam→`m_inseam`, length→`m_skirt_length` |
| shoe | size→`m_shoe_size` (insole → UI-only, no column) |
| bag | width/height/depth → UI-only (no column; not persisted in MVP) |

### Write mapping (`wardrobeService.addItem`, per saved item)

| DB column | Source | Rule |
|-----------|--------|------|
| `type` | `ExtractedItem.type` | Real controlled type; stop `CATEGORY_TO_TYPE` override when a controlled `type` is supplied. NOT NULL. |
| `name` | `name` | NOT NULL — fallback label if empty. |
| `color` | `color` | controlled Title Case. NOT NULL. |
| `primary_color` | `color` | mirror (legacy). |
| `material` | `material` | nullable |
| `fit` | `fit` | nullable — newly persisted |
| `pattern` | `pattern` | nullable |
| `warmth_season` | `warmthSeason` | text; single value (engine reads first token) |
| `brand` | `brand` | nullable |
| `source_url` | `link` | nullable (the design's LINK field) |
| `m_*` | parsed `measurements[groupKey]` | numeric cm; only mapped keys; invalid/empty dropped |
| `graphics` | `graphics` | jsonb or null |
| `source` | constant | `'ai'` for the AI method (`source` has no CHECK constraint — verified) |
| `photo_url`/`photo_storage` | generated item image via `itemPhotoService` | per tier (free=local, premium=cloud) — 003 path unchanged |

`occasion_tags` keeps its default (`'{}'`). `description` and UI-only `tags` are **not** persisted (tags are UI/filter; reserved for a future column).

### Validation rules

- Controlled fields validated/snapped at the edge (R3) before reaching the client.
- `measurements`: parse "54 cm" → `54`; numeric, cm; out-of-range/non-numeric dropped.
- `graphics.size`/`kind` constrained to their enums or null.
- No `any`; edge JSON parsed as `unknown`, narrowed with guards.
