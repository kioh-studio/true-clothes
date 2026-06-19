# Contract: On-Device "Extract by Item"

Two boundaries: the **native module** API and the **service** API. No network, no Supabase.

---

## A. Native module — `modules/expo-item-extract`

```ts
extractItem(uri: string): Promise<ItemExtractionResult>
```

- `uri`: local file uri of ONE single-item photo on a plain background.
- Returns `ItemExtractionResult` (see data-model §1): `{ cutoutUri, usedFallback, palette[], labels[], ocrText[] }`.

**Behaviour:**

| ID | Rule |
|----|------|
| N1 | Produces a **transparent PNG** cut-out (~1K long edge) at `cutoutUri` when segmentation succeeds. |
| N2 | `palette` reflects FOREGROUND pixels only (transparent/background excluded), most-dominant first. |
| N3 | On segmentation failure (iOS <17 / low confidence): attempt solid-background keying; if that fails, set `cutoutUri` = original photo and `usedFallback = true`. Never throws for "no subject". |
| N4 | Runs entirely on-device; makes no network request. |
| N5 | iOS: Vision (`VNGenerateForegroundInstanceMaskRequest`, `VNClassifyImageRequest`, `VNRecognizeTextRequest`). Android: ML Kit (Subject Segmentation, Image Labeling, Text Recognition). |
| N6 | Throws only on unrecoverable input errors (e.g. unreadable file); the service maps that to a recoverable UI error. |

> Note: ML Kit / Vision are unavailable on the iOS simulator — verify on a hardware device (EAS dev client).

---

## B. Service — `src/services/extractByItemService.ts`

```ts
export const isExtractByItemAvailable: boolean // → true
export function extractItemOnDevice(photoUri: string, notes?: string): Promise<ExtractedItemWithImage[]>
```

Returns the SAME `ExtractedItemWithImage[]` shape as the AI method (`imageGenerationService`), with **exactly one** element, so the wizard's Review/save path is identical.

**Behaviour:**

| ID | Rule |
|----|------|
| C1 | Calls `extractItem`, then snaps to controlled vocab: `color` via LAB ΔE (always valid), `type` via label map (valid type or empty), `pattern='solid'`, `graphics` from OCR, type-aware measurement defaults. |
| C2 | Returns exactly one entry; `localImageUri = cutoutUri`. |
| C3 | Makes **no** network call and does **not** consume an `ai_extraction` credit (free). |
| C4 | Controlled fields never contain free text; `type` is either a controlled value or empty (user picks). |
| C5 | On native failure, throws a typed error the wizard shows as recoverable (retry / add manually); never a silent/partial save. |
| C6 | `notes` is currently unused by on-device extraction (reserved); accepting it keeps the seam signature uniform with the AI path. |

---

## C. Wizard integration (reuses 006)

| ID | Rule |
|----|------|
| W1 | `MethodChooser` enables "Extract by item" (no "coming soon"); badge: On-device · Free. |
| W2 | `useAddWizard.analyse` dispatches `method==='item'` photos to `extractItemOnDevice` (already wired in 006) and applies **no** credit gate to them. |
| W3 | Item entries appear in the same Review grouped-by-photo UI, fully editable, and save via `wardrobeService` with `source='item'`. |
| W4 | One "item" photo → exactly one review entry. |

---

## Controlled Vocabulary

Identical to 006 (`type` 40, `color` 37, `material`, `fit`, `pattern`, `warmth_season`, `m_*`). On-device output MUST snap to these exact values (source of truth: `engine/enrichment.ts`).
