---

description: "Task list for On-Device Extract by Item"
---

# Tasks: On-Device "Extract by Item" Wardrobe Import

**Input**: Design documents from `specs/007-extract-by-item/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/extract-by-item.md

**Tests**: light OPTIONAL set (pure helpers + service). Not full TDD.

**Organization**: by user story. Foundational delivers the native on-device primitives + mapping helpers; US1 = cut-out + save (free/offline); US2 = attribute enrichment; US3 = logo OCR. Reuses the 006 wizard/review/save path via the `extractByItemService` seam.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

`modules/` (local Expo native module) · `src/` (services, utils, features) · `app.json`/`app.config` · `src/**/__tests__/`

---

## Phase 1: Setup

- [x] T001 [P] Scaffold local Expo module `modules/expo-item-extract/` (`expo-module.config.json`, `index.ts` skeleton with typed `extractItem(uri): Promise<ItemExtractionResult>`); register its config plugin in `app.json`/`app.config`.
- [x] T002 [P] Add an EAS **development** build profile (`eas.json`) for a custom dev client; document that ML Kit/Vision require a hardware device (not Expo Go / not iOS simulator). Add Android ML Kit + iOS Vision native deps in the module's `android/`/`ios/` config.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: on-device native primitives + controlled-vocab mapping helpers shared by all stories.

**⚠️ CRITICAL**: no user story work begins until this completes.

- [x] T003 [P] iOS native (Swift) in `modules/expo-item-extract/ios/`: `VNGenerateForegroundInstanceMaskRequest` → transparent PNG cut-out (~1K); `VNClassifyImageRequest` → labels; `VNRecognizeTextRequest` → ocrText; foreground-palette (masked pixels); iOS<17 → solid-bg keying / original fallback (`usedFallback=true`). Return `ItemExtractionResult`.
- [x] T004 [P] Android native (Kotlin) in `modules/expo-item-extract/android/`: ML Kit Subject Segmentation → transparent PNG cut-out (~1K); Image Labeling → labels; Text Recognition → ocrText; foreground-palette; keying/original fallback. Return `ItemExtractionResult`.
- [x] T005 JS bindings `modules/expo-item-extract/index.ts`: typed `extractItem(uri) → ItemExtractionResult` (`{ cutoutUri, usedFallback, palette[], labels[], ocrText[] }`), narrowing the native result (no `any`). (deps T003, T004)
- [x] T006 [P] `src/utils/colorMatch.ts`: precompute LAB (`colorLab.rgb2lab`) of the 37 `COLOR_SWATCH` hexes (`vocab.ts`); `colorMatch(rgb)` → nearest controlled colour by ΔE (always returns a valid colour).
- [x] T007 [P] `src/services/itemTypeMap.ts`: `labelToType(labels)` keyword map (on-device labels → controlled `type`) + confidence gate (< 0.5 or no match → empty string).
- [x] T008 [P] `src/features/wardrobe-add/measureSchema.ts`: add `measureDefaults(type)` returning per-group editable default cm values (top/bottom/shoe); empty for accessories/blank type.

**Checkpoint**: native module returns cut-out + palette + labels + OCR; helpers ready.

---

## Phase 3: User Story 1 - Add one item, free & offline (Priority: P1) 🎯 MVP

**Goal**: One single-item photo → a transparent cut-out + one review entry (at least colour pre-filled) → save, fully on-device, no credit.

**Independent Test**: quickstart Scenario 1 — airplane mode, "Extract by item" → transparent cut-out entry → confirm saves with `source='item'`, no AI credit consumed.

- [x] T009 [US1] Implement `src/services/extractByItemService.ts` (replace stub): `extractItemOnDevice(uri)` calls `extractItem`, builds **one** `ExtractedItemWithImage` — `localImageUri=cutoutUri`, `color=colorMatch(palette[0])`, sensible `name`, defaults for the rest; **no network, no `ai_extraction` credit**; set `isExtractByItemAvailable = true`; typed recoverable error on native failure. (deps T005, T006)
- [x] T010 [US1] Enable "Extract by item" in `src/features/wardrobe-add/components/MethodChooser.tsx` (remove "coming soon"); verify `useAddWizard.analyse` routes `method==='item'` photos to the service and applies **no** credit gate. (deps T009)
- [x] T011 [P] [US1] (OPTIONAL) `src/services/__tests__/extractByItemService.test.ts`: returns exactly one item, valid controlled `color`, no credit/network; `src/utils/__tests__/colorMatch.test.ts`: nearest-colour correctness.

**Checkpoint**: MVP — free/offline single-item add with transparent cut-out works end-to-end.

---

## Phase 4: User Story 2 - On-device attribute enrichment (Priority: P2)

**Goal**: Pre-fill `type` (best-effort, blank on low confidence), `pattern` (solid), and type-aware editable measurement defaults — all editable in the shared review card.

**Independent Test**: quickstart Scenario 2 — solid item → `color` + `pattern=solid`; recognised garment → `type` pre-filled, weak guess → `type` blank; all editable via controlled pickers.

- [x] T012 [US2] Extend `extractByItemService` to set `type = labelToType(labels)` (blank on low confidence), `pattern = 'solid'`, and `measurements = measureDefaults(type)`; derive `name` from type when available. (deps T009, T007, T008)
- [x] T013 [P] [US2] (OPTIONAL) `src/services/__tests__/itemTypeMap.test.ts`: label→type mapping + low-confidence → blank; measureDefaults per type.

**Checkpoint**: US1 + US2 — fast, editable, engine-valid attributes.

---

## Phase 5: User Story 3 - Logo / statement capture (Priority: P3)

**Goal**: Capture on-device OCR text as a logo signal; stored, not scored.

**Independent Test**: quickstart Scenario 3 — item with brand text → `clothing_items.graphics = {present:true,text:…}`; suggestions unaffected.

- [x] T014 [US3] Extend `extractByItemService` to set `graphics = { present: ocrText.length>0, text: ocrText.join(' ')||null, size: null, kind: null }`; persisted via the existing save path (`graphics jsonb`). (deps T009)
- [ ] T015 [US3] Verify logo data does NOT affect outfit suggestions (engine ignores `graphics`) — quickstart Scenario 3.

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting

- [x] T016 [P] Add brief "plain background" guidance + On-device·Free badge copy in `MethodChooser`/`UploadStep` (design tokens only).
- [x] T017 Graceful degradation UX: when `usedFallback` is true or native fails, show a recoverable hint ("couldn't isolate cleanly — proceed/retry/edit") in the wizard; never hard-fail (FR-015).
- [x] T018 [P] Document the on-device pipeline + EAS dev-client requirement + simulator caveat in `plan.md` (project root) per the documentation policy.
- [ ] T019 Run `specs/007-extract-by-item/quickstart.md` Scenarios 1–6 + regression (AI method still works; demo account) on a hardware dev client.
- [x] T020 [P] `tsc --noEmit` + lint across changed JS/TS files; confirm no `any` (typed native bridge).

---

## Dependencies & Execution Order

- **Setup (1)** → **Foundational (2, BLOCKS stories)** → **US1 (3)** → **US2 (4, extends US1 service)**; **US3 (5)** independent after Foundational. **Polish (6)** last.
- Key: T005→T003/T004 · T009→T005/T006 · T010/T012/T014→T009 · T012→T007/T008.

### Parallel Opportunities

- Setup: T001 ∥ T002.
- Foundational: T003 ∥ T004 (then T005); T006 ∥ T007 ∥ T008 alongside.
- US1: T011 in parallel with T009/T010.
- US3 can run in parallel with US1/US2 after Foundational.
- Polish: T016 ∥ T018 ∥ T020.

---

## Implementation Strategy

**MVP** = Setup → Foundational → US1, then validate quickstart Scenario 1 (free/offline cut-out + save). **Incremental**: + US2 (enrichment) → + US3 (logo). The native module (T003/T004) is the heaviest item and is the gate for everything; build and verify it on a hardware EAS dev client early.

## Notes

- On-device only — no Supabase, no Edge Function, no `ai_extraction` credit (free path).
- Controlled-vocab snapping (colour ΔE, label→type) is mandatory — never emit free text; `type` may be blank but never a wild guess.
- Requires an EAS dev client; ML Kit/Vision do not run on the iOS simulator — test on device.
- No DB migration (reuses `source`, `graphics`, `m_*`); does not change the AI method.
