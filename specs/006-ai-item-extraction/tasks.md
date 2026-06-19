---

description: "Task list for AI Item Extraction from Outfit Photos"
---

# Tasks: AI Item Extraction from Outfit Photos

**Input**: Design documents from `specs/006-ai-item-extraction/` + the approved wizard design (`screens/True Clothes - Wardrobe add` → `outfit-import.jsx`).

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/generate-item-image.md

**Tests**: light OPTIONAL set (hook + service). Not full TDD.

**Organization**: by user story. Foundational delivers the AI pipeline + save path; US1 builds the wizard shell + AI method; US2 adds editable review; US3 the logo slice. The wizard's **"Extract by item"** method is a seam (stub) here — delivered by `specs/extract-by-item/`.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions (Expo Router)

`app/` screens · `src/` (services, features, types, design) · `supabase/functions/` · `supabase/migrations/` · `src/**/__tests__/`

---

## Phase 1: Setup

- [x] T001 [P] Verify the exact "nano banana 2" (Gemini 3 Pro Image) model id + image-resolution control vs current Google Generative Language API docs (research R2); record model-id/vision constants for `supabase/functions/generate-item-image/index.ts`; note the ~1K on-device downscale fallback (`itemPhotoService.optimizeImage`).
- [ ] T002 [P] Confirm `GOOGLE_API_KEY` secret is set on Supabase project `trtjcsxcowqecsebvyme` (deploy prerequisite).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: AI extraction pipeline + persistence shared by all stories.

**⚠️ CRITICAL**: no user story work begins until this completes.

- [x] T003 [P] Extend `src/types/fitEngine.ts`: add `LogoSignal`, `MKey`, and `WardrobeItem.fit`, `.measurements`, `.graphics`.
- [x] T004 [P] Create `supabase/functions/generate-item-image/prompt.ts`: controlled-vocab constants (type 40 / color 37 / material / fit aliases / pattern aliases / warmth_season 4); `EXTRACTION_SYSTEM` enforcing exact enums + required `type/name/color` + **type-aware measurement estimates**; injection-safe `buildUserPrompt(notes)`; `buildIsolationPrompt(metadata)` for white-bg isolation. (Logo fields added in T027.)
- [x] T005 Rewrite `supabase/functions/generate-item-image/index.ts`: Gemini vision → controlled-vocab JSON; **server-side validate/snap** every controlled field (case-normalise, alias-map, last-resort default); emit type-aware measurement **estimates** (cm); nano banana 2 image-gen per garment **in parallel**, preserving order/pairing; tolerate per-item image failure (`image_data:""`); accept `notes`; return `{ items }` per `contracts/generate-item-image.md`. (deps T001, T003, T004)
- [x] T006 Deploy `generate-item-image` to the project. (deps T005, T002)
- [x] T007 [P] Update `src/services/imageGenerationService.ts`: `GarmentMetadata` → controlled-vocab schema (+ `measurements`, `brand`, `graphics`, `tags`); keep base64→device-file save + index pairing; `localImageUri=null` when `image_data` empty. (deps T003)
- [x] T008 Update `src/services/wardrobeService.ts`: extend `AddItemInput`/`UpdateItemInput`/`ClothingItemRow` with `type`, `fit`, `measurements`, `brand`, `link`, `graphics`; `addItem` writes real `type` (skip `CATEGORY_TO_TYPE` when supplied), `color`, `fit`, parsed `m_*`, `brand`, `source_url`(=link), `source='ai'`; `rowToItem` maps `fit`/`measurements` back. (deps T003)
- [x] T009 [P] Create `src/services/extractByItemService.ts`: the on-device "item" method **seam** — typed interface + a stub returning a clear "not yet available" result; the AI method ignores it. (Implemented by `specs/extract-by-item/`.)

**Checkpoint**: AI pipeline returns engine-ready items with paired images; saving writes real `type/color/fit/m_*`.

---

## Phase 3: User Story 1 - Extract a whole outfit (Priority: P1) 🎯 MVP

**Goal**: The 4-step wizard (Upload → Analyse → Review → Done); AI method turns each photo into N reviewable, engine-ready items grouped by source photo; confirm saves them.

**Independent Test**: quickstart Scenarios 1, 3, 4, 5 — multi-photo upload → analyse → grouped review with images + valid `type/color/fit` → confirm saves with images paired.

- [x] T010 [P] [US1] `src/features/wardrobe-add/types.ts`: `WizardStep`, `PhotoEntry{photoId,method,note}`, `ExtractedItem` (controlled vocab + brand/link/tags/measurements/graphics + srcId/method), `MeasureGroup`.
- [x] T011 [P] [US1] `src/features/wardrobe-add/vocab.ts`: UI label ↔ controlled-enum maps (type/color/material/pattern) for pickers + display.
- [x] T012 [P] [US1] `src/features/wardrobe-add/measureSchema.ts`: type-aware groups (top/bottom/shoe/bag), review-key → engine `m_*` column map, estimate plumbing.
- [x] T013 [US1] `src/features/wardrobe-add/useAddWizard.ts`: state machine `upload→analyse→review→done` (+ `error`/`upgrade`); per-photo method+notes; `analyse` dispatches each photo to `imageGenerationService` (AI) or `extractByItemService` (item stub); build `ExtractedItem[]` (srcId-tagged); `editItem`/`removeItem`; batch save via `appStore.addWardrobeItem`. (deps T007, T008, T009, T010, T011, T012)
- [x] T014 [US1] Add AI credit gating in `useAddWizard.ts`: `checkCredit`/`incrementCredit('ai_extraction')` per AI photo; premium unlimited (`usePremium`/`hasPremiumAccountType`); failure no credit + retry; out-of-credit → `upgrade`. Item method is free. (deps T013)
- [x] T015 [P] [US1] Shared primitives in `src/features/wardrobe-add/components/`: `Stepper.tsx`, `FieldRow.tsx`, `Picker.tsx`, `MeasureField.tsx`, `TagEditor.tsx` — design tokens only.
- [x] T016 [US1] `src/features/wardrobe-add/components/AddWizard.tsx` (shell: header + Stepper + step router) + `MethodChooser.tsx` (method AI/item → source camera/library → library multi-select; item shown as "coming soon" until extract-by-item lands). (deps T013, T015)
- [x] T017 [P] [US1] `src/features/wardrobe-add/components/UploadStep.tsx`: multi-photo rows (method badge + per-photo notes + remove) + add-photo affordance.
- [x] T018 [P] [US1] `src/features/wardrobe-add/components/ProcessingStep.tsx`: per-photo scan animation + progress strip + skeletons.
- [x] T019 [US1] `src/features/wardrobe-add/components/ReviewStep.tsx` (entries **grouped by source photo**, per-item REMOVE, CONFIRM batch) + `ItemCard.tsx` (image + display fields; editing in US2) + `DoneStep.tsx` (saved count). (deps T013, T016)
- [x] T020 [P] [US1] `src/design/wardrobe-add/design.md`: wizard visual spec (stepper, upload rows, scan state, review cards, done) — tokens, hairline, full-bleed, no shadow/gradient.
- [x] T021 [US1] Wire entry points: `app/add-item.tsx` renders the wizard full-screen; `app/(tabs)/wardrobe.tsx` add affordance + `app/(onboarding)/wardrobe-intro.tsx` "Add first item" open it; keep a manual single-item add fallback. (deps T016)
- [ ] T022 [P] [US1] (OPTIONAL) `src/features/wardrobe-add/__tests__/useAddWizard.test.ts`: analyse→review with N items, batch save, empty→message, error→recoverable.

**Checkpoint**: MVP — multi-photo AI import works end-to-end; items engine-ready.

---

## Phase 4: User Story 2 - Review, edit, delete before saving (Priority: P2)

**Goal**: Every field editable (vocab-constrained) and unwanted entries removable before save.

**Independent Test**: quickstart Scenario 2 — edit color/type (pickers offer only controlled values), edit measurements/brand/tags, delete an entry, confirm → only kept+edited items saved.

- [x] T023 [US2] Make `ItemCard.tsx` fields editable: `FieldRow`+`Picker` for category/colour(swatch)/fabric, text inputs for name/brand/link, type-aware `MeasureField` grid, `TagEditor` — all wired to `useAddWizard.editItem`; pickers constrained to controlled vocab (`vocab.ts`). (deps T019)
- [x] T024 [US2] Per-item REMOVE → `useAddWizard.removeItem`; ReviewStep "nothing to save" empty state; CONFIRM disabled when empty. (deps T019)
- [ ] T025 [P] [US2] (OPTIONAL) Extend `useAddWizard.test.ts`: `editItem` stays vocab-constrained; `removeItem` excludes from save.

**Checkpoint**: US1 + US2 — trustworthy, user-controlled wardrobe data.

---

## Phase 5: User Story 3 - Capture logo / statement signals (Priority: P3)

**Goal**: Per-garment logo signals stored; not consumed by the engine.

**Independent Test**: quickstart Scenario 6 — logo garment → `clothing_items.graphics` has `{present,size,kind,text}`; suggestions unchanged.

- [x] T026 [US3] Add migration `supabase/migrations/20260620000001_clothing_items_graphics.sql` (`graphics jsonb null`); apply it.
- [x] T027 [US3] Extend `prompt.ts` + `index.ts` to emit `graphics: LogoSignal` (present/size/kind/text, enum-validated); **redeploy** `generate-item-image`. (deps T005, T006, T026)
- [x] T028 [US3] Persist logo: `imageGenerationService` passthrough; `wardrobeService.addItem` writes `graphics` jsonb; `rowToItem` maps it. (deps T007, T008, T026)
- [ ] T029 [US3] Verify logo does NOT alter outfit suggestions (engine ignores `graphics`) — quickstart Scenario 6.

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting

- [x] T030 [P] Remove dead Claude duplicate: delete `supabase/functions/extract-garments/`, `src/services/aiExtractionService.ts`; delete/fold `src/features/ai-extraction/useItemExtraction.ts` into `useAddWizard`; clear references.
- [ ] T031 [P] Document non-UI logic changes in `plan.md` (project root): extraction pipeline, `graphics` column, measurement estimates, credit gating.
- [ ] T032 Run `specs/006-ai-item-extraction/quickstart.md` Scenarios 1–8 + regression (manual add, demo account, wardrobe/detail/collage rendering).
- [x] T033 [P] `tsc --noEmit` + lint across changed files; confirm no `any`.

---

## Dependencies & Execution Order

- **Setup (1)** → **Foundational (2, BLOCKS stories)** → **US1 (3)** → **US2 (4, builds on US1 review)**; **US3 (5)** is independent of US1/US2 after Foundational. **Polish (6)** last.
- Key: T005→T001/T003/T004 · T006→T005/T002 · T007/T008→T003 · T013→T007/T008/T009/T010/T011/T012 · T014/T016→T013 · T019→T013/T016 · T021→T016 · T023/T024→T019 · T027→T005/T006/T026 · T028→T007/T008/T026.

### Parallel Opportunities

- Setup: T001 ∥ T002.
- Foundational: T003 ∥ T004 ∥ T009 (then T005); T007 ∥ T008 after T003.
- US1: T010 ∥ T011 ∥ T012 (then T013); T015 ∥ T017 ∥ T018 ∥ T020 alongside; T022 in parallel.
- US3 can run in parallel with US1/US2 after Foundational.
- Polish: T030 ∥ T031 ∥ T033.

---

## Cross-feature note

The wizard's **"Extract by item"** method is stubbed here (`extractByItemService`, T009) and shown as "coming soon" in `MethodChooser` (T016). It is fully delivered by **`specs/extract-by-item/`**, which plugs into the same seam and the shared Review/save path — no rework of 006 required.

---

## Implementation Strategy

**MVP** = Setup → Foundational → US1, then validate quickstart 1/3/4/5 (multi-photo AI import). **Incremental**: + US2 (edit/delete) → + US3 (logo). Each adds value without breaking prior stories.

## Notes

- Controlled-vocab validate/snap (T005) is non-negotiable (silent engine fallback otherwise).
- (Re)deploy the Edge Function after T005 (T006) and T027 — extraction doesn't work in production until deployed.
- Apply migration T026 before T028 writes `graphics`.
- Translate the prototype's inline styles to `src/design/tokens.ts` — do not copy hex (Principle I).
