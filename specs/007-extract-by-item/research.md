# Phase 0 Research: On-Device "Extract by Item"

Decisions resolving the Technical Context. Each: **Decision / Rationale / Alternatives**.

---

## R1 — One cohesive custom Expo native module

**Decision**: Build a single local Expo module `modules/expo-item-extract` exposing one typed API `extractItem(uri) → ItemExtractionResult` that performs all three on-device primitives per platform: background segmentation → transparent cut-out, image labeling, and text recognition. The TS `extractByItemService` consumes it and does all controlled-vocabulary snapping.

**Rationale**: The feature needs segment + label + OCR together on both platforms. No single off-the-shelf lib covers all three cross-platform (see R2). One module keeps the native surface cohesive, returns exactly what the service needs (cut-out uri + colour palette + labels + OCR text), and is testable behind a clean JS boundary. Matches the `extractByItemService` seam 006 defined.

**Alternatives**: Stitch `react-native-remove-background` (iOS only) + `@infinitered/react-native-mlkit` (labeling/OCR) — partial coverage, two dependencies, Android segmentation gap, less control over the transparent composite. Rejected; kept as references/fallbacks.

---

## R2 — iOS segmentation (Vision)

**Decision**: iOS 17+ uses `VNGenerateForegroundInstanceMaskRequest` to get the foreground instance mask, composited to a transparent PNG. `VNClassifyImageRequest` for labels and `VNRecognizeTextRequest` for OCR.

**Rationale**: First-party, fast, on-device, no model bundling. Foreground instance mask is purpose-built for subject cut-outs.

**Alternatives**: Core ML custom seg model (U2Net/MODNet) — bundling + size, unnecessary given Vision. iOS <17 lacks the foreground request → **fallback R6a**.

---

## R3 — Android segmentation (ML Kit)

**Decision**: Android uses ML Kit **Subject Segmentation** for the mask → transparent PNG, ML Kit **Image Labeling** for labels, ML Kit **Text Recognition** for OCR.

**Rationale**: First-party, on-device, free; Subject Segmentation is the Android counterpart to Vision's foreground mask.

**Alternatives**: Selfie Segmentation (people only) — wrong domain (garments). TF Lite custom — heavier. Rejected.

---

## R4 — Colour matching: dominant foreground RGB → nearest controlled colour via LAB ΔE

**Decision**: The native module returns a small dominant-colour palette of the **foreground (masked) pixels only** (e.g. top 1–3 average RGBs, transparent pixels excluded). The service converts each to LAB via `colorLab.rgb2lab` and picks the nearest of the **37 controlled colours** by ΔE, using a precomputed LAB table of the `COLOR_SWATCH` hexes (`src/features/wardrobe-add/vocab.ts`). New helper `src/utils/colorMatch.ts`.

**Rationale**: Reuses existing, unit-tested LAB math (personal-color). Computing the palette on native avoids JS pixel decoding (RN can't read raw pixels without another lib). ΔE nearest-match guarantees a valid controlled colour (no silent fallback).

**Alternatives**: JS pixel sampling via an image lib — extra dep + slow. Map by raw RGB distance — perceptually worse than LAB. Rejected.

---

## R5 — Type inference: labels → controlled type, blank on low confidence

**Decision**: Map on-device image labels (generic, e.g. "Jacket", "Jeans", "Shoe", "Bag") to the nearest of the 40 controlled `type`s via a keyword map (`src/services/itemTypeMap.ts`). If the top label's confidence is below a threshold or maps to nothing, leave `type` **blank** for the user (do not guess). Per clarify (best-effort).

**Rationale**: On-device labelers are coarse and not garment-taxonomy-aware; a conservative keyword map + confidence gate avoids wrong-but-confident types that would mis-drive the engine.

**Alternatives**: Custom 40-class on-device classifier — large effort/model for modest gain. Always-blank type — worse UX; rejected (clarify chose best-effort).

---

## R6 — Pattern (MVP) and segmentation fallback

**Decision (R6 pattern)**: Default `pattern = 'solid'`, user-editable. No auto pattern detection in MVP.

**Rationale**: Reliable on-device pattern detection (stripe/plaid/floral) needs real texture classification; low ROI for MVP. Spec FR-008 allows default-solid + edit.

**Decision (R6a fallback)**: When the foreground mask is unavailable (iOS <17) or low-confidence, fall back to **solid-background keying** (sample corner pixels, remove near-matching background) since the input is a plain background; if that also fails, return the **original photo** as the item image and let the user proceed/edit. Never hard-fail (FR-015).

**Alternatives**: Block on unsupported devices — violates graceful-degradation. Rejected.

---

## R7 — Logo via on-device OCR

**Decision**: Run text recognition on the cut-out; if text is found, set `graphics = { present: true, text: <joined>, size: null, kind: null }`; else `{ present: false, ... }`. Stored in `clothing_items.graphics` (exists). Not fed to the engine (same as 006).

**Rationale**: OCR is the reliable on-device logo signal; `size`/`kind` need more than OCR, left null in MVP. Mirrors 006's capture-not-score stance (FR-009).

**Alternatives**: On-device logo/brand classification — unreliable, out of scope. Rejected.

---

## R8 — Measurement defaults (type-aware, editable)

**Decision**: Pre-fill `measurements` from a small per-type default table (e.g. top: chest/shoulder/length/sleeve; bottom: waist/hip/inseam; shoe: EU size), surfaced via `measureSchema.ts`, all editable. Consistent with 006's editable-estimate behaviour; never from body measurements.

**Rationale**: On-device single-photo metric estimation isn't reliable; sensible type defaults + edit match 006 and FR-010.

**Alternatives**: Leave measurements empty — inconsistent with 006's filled-and-editable UX. Rejected.

---

## R9 — Free, offline, no credit; enable the method

**Decision**: `extractByItemService.extractItemOnDevice` makes **no network call** and does **not** touch `usageCreditService`. `isExtractByItemAvailable = true`. `MethodChooser` enables "Extract by item" (removes the "coming soon" state). `useAddWizard` already routes item photos here and skips credit gating for them (006).

**Rationale**: Free/private/offline is the feature's value (FR-004/005, SC-004).

**Alternatives**: none.

---

## R10 — Output: transparent PNG, ~1K, on device

**Decision**: The native module writes the cut-out as a transparent PNG sized to ~1K long edge, returning a file uri; the service passes it as `localImageUri` (same as 006's saved item images). `expo-image-manipulator` used only if an extra downscale is needed.

**Rationale**: Transparent composites cleanly on cards/collage (clarify); ~1K matches 006 and the card scale.

**Alternatives**: White background — rejected by clarify. Full-res — larger files, no benefit.

---

## R11 — Packaging: EAS dev client + config plugin; simulator caveat

**Decision**: Ship the native module via a config plugin; develop/test on a **custom dev client built with EAS Build** (cloud; no Mac). Document that ML Kit / Vision do **not** run on the iOS simulator — verify on a hardware device.

**Rationale**: Clarified build decision; EAS cloud removes the Mac requirement; the simulator limitation is a known ML Kit/Vision constraint to flag for QA.

**Alternatives**: Expo Go — impossible for native ML. Local Mac build — unnecessary with EAS cloud.
