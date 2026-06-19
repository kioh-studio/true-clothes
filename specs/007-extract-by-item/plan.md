# Implementation Plan: On-Device "Extract by Item" Wardrobe Import

**Branch**: `007-extract-by-item` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-extract-by-item/spec.md`

## Summary

Implement the wizard's second method — **"Extract by item"** — fully on-device, free, offline, private. The user photographs one garment on a plain background; a native module removes the background (iOS Vision foreground mask / Android ML Kit Subject Segmentation) to a **transparent PNG (~1K)**, and best-effort on-device analysis pre-fills attributes: **colour** (dominant foreground colour → nearest of the 37 controlled colours via LAB ΔE, reusing `colorLab.ts`), **type** (on-device image labels → nearest of 40 controlled types; blank when low-confidence), **pattern** (default `solid`), and **logo** (on-device text recognition → graphics signal). Material/fit/warmth/measurements are pre-filled as type-aware editable defaults consistent with feature 006.

The result is one `ExtractedItem` (the same shape, review card, and save path as 006), flowing through the wizard's `extractByItemService` seam that 006 stubbed. No network call, no `ai_extraction` credit. This plan changes nothing in the AI method.

Confirmed via `/speckit-clarify` (2026-06-20): native on-device ML is delivered through a **custom Expo dev client built with EAS Build** (cloud; no Mac required); cut-out is **transparent**; `type` auto-fill is **best-effort, blank on low confidence**.

## Technical Context

| Key | Value |
|-----|-------|
| Language | TypeScript strict (JS layer) + Swift (iOS) + Kotlin (Android) for the native module |
| UI | React Native 0.81 + Expo SDK 54 (expo-router) — reuses the 006 wizard/review |
| On-device ML — iOS | Vision: `VNGenerateForegroundInstanceMaskRequest` (mask), `VNClassifyImageRequest` (labels), `VNRecognizeTextRequest` (OCR). iOS 17+ for foreground mask |
| On-device ML — Android | ML Kit: Subject Segmentation (mask), Image Labeling (labels), Text Recognition (OCR) |
| Native packaging | A local **Expo Module** + config plugin (`modules/expo-item-extract/`); requires a custom dev client via **EAS Build** (not Expo Go) |
| Colour matching | `src/utils/colorLab.ts` (`rgb2lab`) — map dominant foreground RGB → nearest controlled colour by ΔE (precomputed LAB of the 37 `COLOR_SWATCH` hexes) |
| Image handling | Native produces the transparent cut-out (~1K) saved to a file uri; `expo-image-manipulator` only if extra downscale needed |
| Persistence | Reuses `wardrobeService` (`source='item'`); `graphics` column already exists (006). **No DB migration.** |
| Cost/offline | Zero network, zero `ai_extraction` credit; works in airplane mode |
| Testing | Jest for the JS service (label→type map, colour snap, metadata build) + RN Testing Library; native module verified on a hardware device (ML Kit/Vision not on iOS simulator) |
| Performance | Single-item extraction target ≤ ~3 s on a mid device; cut-out ~1K |
| Constraints | Controlled-vocab snapping on-device; transparent output; graceful degradation when ML unavailable/low-confidence; one item per photo |
| Scale/Scope | One garment per photo; plugs into the existing wizard; no server |

**Unknowns**: resolved in research (R-items). Android subject-segmentation packaging (existing lib vs custom module) and iOS<17 fallback are decided there, not blocking.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Applies? | Resolution |
|---|------|----------|------------|
| I | Luxury Minimalist Design (NON-NEGOTIABLE) | **Yes** — enable the "Extract by item" option (remove "coming soon"); brief "plain background" guidance | Reuses the 006 wizard/review (tokens already). New copy/guidance uses `src/design/tokens.ts`; no inline hex. **PASS (design-time)** |
| II | Thin Screens / Logic Separation (NON-NEGOTIABLE) | **Yes** | All extraction logic in `extractByItemService` + the native module; `useAddWizard` already dispatches to the seam. Screens unchanged except enabling the method. **PASS** |
| III | Service Abstraction Layer (NON-NEGOTIABLE) | **Yes** (no Supabase) | On-device only; the boundary is `extractByItemService` wrapping the native module. No `sb` usage. Saving still via `wardrobeService`. **PASS** |
| IV | Type Safety & Domain Integrity (NON-NEGOTIABLE) | **Yes** | Reuses `ExtractedItem`/`GarmentMetadata`/`LogoSignal`/`MKey`; vocab snapping in TS; colours = named strings; measurements metric; no `any` (typed native bridge). **PASS** |
| V | Dual-Persistence Architecture | **No scoring change** | No engine/ranking change; estimated measurements feed the engine as data (same accepted stance as 006). Local-first save unchanged. **PASS** |
| VI | Feature Self-Containment | **Yes** | Item-method logic lives with the wardrobe-add feature + `extractByItemService` + the native module; converges on shared services. No feature-to-feature imports. **PASS** |
| WF | Schema change → migration | **No** | Reuses existing `clothing_items` columns (`source`, `graphics`, `m_*`). No migration. |
| WF | Demo account functional | **Yes** | Demo items static; unaffected. **PASS** |
| TS | Tech-stack constraint (Expo SDK) | **Yes — new capability** | Adds a local Expo native module + config plugin (within Expo's model) and requires an EAS dev client instead of Expo Go. Justified: on-device segmentation/labeling/OCR can't be done in pure JS at acceptable quality (clarified, owner-approved). Logged in Complexity Tracking. |

**Initial gate result: PASS** — one justified platform addition (native module / dev client).

## Project Structure

### Documentation (this feature)

```text
specs/007-extract-by-item/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/extract-by-item.md   # native module + service interface contract
├── checklists/requirements.md
└── tasks.md   # (/speckit-tasks)
```

### Source Code (repository root)

```text
# ── Native module (NEW) ───────────────────────────────────────────────────────
modules/expo-item-extract/
├── expo-module.config.json
├── index.ts                 # JS bindings: extractItem(uri) → ItemExtractionResult
├── ios/                     # Swift: Vision foreground mask + classify + OCR → transparent PNG
└── android/                 # Kotlin: ML Kit Subject Segmentation + Image Labeling + Text Recognition
app.json / app.config        # MODIFIED — register the config plugin (camera/photos perms already present)

# ── Client service (REPLACE STUB) ─────────────────────────────────────────────
src/services/extractByItemService.ts   # implement extractItemOnDevice(): call native module;
                                        #   snap colour (LAB → 37), type (labels → 40, blank low-conf),
                                        #   pattern (solid default), logo (OCR → graphics), measurement
                                        #   defaults; build ExtractedItemWithImage[] (one); flip
                                        #   isExtractByItemAvailable = true
src/services/itemTypeMap.ts             # NEW — on-device label → controlled type keyword map
src/utils/colorMatch.ts                 # NEW — nearest controlled colour via LAB ΔE (reuses colorLab.rgb2lab)

# ── Feature wiring (MODIFIED) ─────────────────────────────────────────────────
src/features/wardrobe-add/components/MethodChooser.tsx   # enable "Extract by item" (drop "coming soon")
src/features/wardrobe-add/measureSchema.ts               # add per-type default measurement estimates (item method)
# useAddWizard already dispatches item photos to extractByItemService (006) — no change expected

# ── Tests ─────────────────────────────────────────────────────────────────────
src/services/__tests__/extractByItemService.test.ts   # colour snap, label→type, low-conf blank, metadata build
src/utils/__tests__/colorMatch.test.ts
```

**Structure Decision**: One local Expo native module (`modules/expo-item-extract`) provides the three on-device primitives (segment → cut-out, label, OCR) behind a single typed JS API; the TypeScript `extractByItemService` does all vocabulary snapping and metadata assembly and fulfils the `extractByItemService` seam 006 defined. Colour math reuses `src/utils/colorLab.ts`. No new screens, no DB changes; the wizard/review/save path is reused.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| Custom native Expo module + EAS dev client (not Expo Go) | On-device subject segmentation, image labeling, and OCR require platform ML frameworks (Vision / ML Kit) unavailable to pure JS at usable quality/speed | Pure-JS background removal (corner keying / TF.js) gives poor cut-outs except on perfectly flat backgrounds and is slow (rejected per clarified product decision). Existing libs (`react-native-remove-background`, `@infinitered/react-native-mlkit`) cover parts but not all three primitives across both platforms — a thin custom module is more cohesive (research R1/R2). |
