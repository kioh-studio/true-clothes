## Feature

- Help user add a SINGLE clothing item to the wardrobe quickly and **for free**, fully **on-device** (no server, no AI credit, private).
- This is the second method of the "Add to Wardrobe" wizard built in `specs/006-ai-item-extraction/` — the **"Extract by item"** option, next to "Extract by AI".
- Input: one photo of **one item** on a **plain / solid-colour background** (flat-lay or hanging), not a worn full outfit.

## Why separate from extract-by-ai

- Different tech stack: **on-device ML** (iOS Vision / Android ML Kit) — no Gemini, no Edge Function, no `GOOGLE_API_KEY`, no usage credit.
- Different input contract: ONE item on a solid background (vs a person wearing a full outfit).
- Shares the **same wizard shell, Review step, controlled vocabulary, and save path** as 006 (plugs into the `extractByItemService` seam 006 defines).

## Flow

1. In the wizard's method chooser the user picks **"Extract by item"** for a photo (badge: On-device · Free).
2. On-device **subject segmentation** removes the solid background → an isolated cutout of the item (transparent or white background), mirroring the look of the AI method's isolated product image.
   - iOS: Vision `VNGenerateForegroundInstanceMaskRequest` (foreground/subject mask).
   - Android: ML Kit **Subject Segmentation**.
   - Fallback when subject masking is unavailable/low-confidence: simple solid-background keying (sample corner pixels → remove near-matching background), since the input is a plain background.
3. **On-device enrichment** (best-effort; everything stays editable in Review):
   - **Colour** ⭐ — dominant colour of the cutout via LAB-space clustering on the masked pixels → snap to the nearest controlled `color` (37). Reuse the existing on-device LAB colour math (see personal-color detection).
   - **Type / category** — coarse garment label via on-device image classification (iOS `VNClassifyImageRequest` / ML Kit Image Labeling) → map to the nearest controlled `type` (40). Low confidence ⇒ leave for the user to pick (do NOT guess wildly).
   - **Pattern** — solid vs patterned heuristic (texture/edge density on the cutout) → `solid` vs `graphic/striped/...`; default `solid`, user-editable.
   - **Logo / graphics** — optional on-device text detection (iOS `VNRecognizeTextRequest` / ML Kit Text Recognition) on the cutout → `present`, OCR `text`, coarse `size`; `kind` left generic. Stored in `graphics` (same as 006), not fed to engine in MVP.
   - **Material / fit / warmth_season / measurements** — not reliably derivable on-device from one photo; pre-fill sensible type defaults (editable). Measurements follow 006's type-aware editable-estimate behaviour.
4. The cutout + enriched attributes become a normal **Review** entry (same `ExtractedItem` shape and `ItemCard` as 006), grouped under its source photo. One "item" photo yields exactly **one** entry.
5. User edits/removes, then batch-saves through the **same `wardrobeService` path** (real `type/color/fit/m_*/graphics`, `source='item'`).

## Note

- **Free & private**: no network call, no `ai_extraction` credit. This is the value vs the AI method.
- **Enrichment research goal**: match as many of the AI method's fields as on-device ML reasonably allows (colour + type + pattern + logo text); the rest default + user-edits. Document what each platform can/can't do.
- Output cutout fixed at ~1K to scale into outfit cards, consistent with the AI method.
- Items missing measurements follow 006's behaviour (editable estimates).
- **Integration contract**: implement the `extractByItemService` interface that 006 stubs; converge on the shared wizard Review/save path. No changes to the AI method.

## Controlled Vocabulary

Identical to `specs/extract-by-ai/reference.md` / `specs/006-ai-item-extraction/contracts/generate-item-image.md` — source of truth `supabase/functions/generate-outfits/engine/enrichment.ts` (`type` 40, `color` 37, `material`, `fit` 5 groups, `pattern` aliases, `warmth_season` 4, `m_*` measurements). On-device output MUST snap to these exact values (silent engine fallback otherwise).
