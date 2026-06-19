---
description: "Task list for Try On — Pre-Purchase Fit Check & Mix-and-Match"
---

# Tasks: Try On — Pre-Purchase Fit Check & Mix-and-Match

**Input**: Design documents from `/specs/008-try-on/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (all present)

**Tests**: Included — `quickstart.md` specifies Jest + Deno checks, and the scoring/pin-invariant logic is correctness-critical. Test tasks are scoped to high-value behaviors, not blanket coverage.

**Organization**: Tasks grouped by user story (US1 P1 → US2 P2 → US3 P3) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish carry no story label)

## Path Conventions (Mobile + Expo Router, per plan.md)

`app/` = screens; `src/` = stores/services/features/components/types; `supabase/functions/` = Deno Edge Functions; `src/**/__tests__/` = Jest unit tests.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding and shared types for the whole feature.

- [X] T001 Create feature directories and barrels: `src/features/try-on/components/index.ts`, `app/try-on/` folder, and empty stubs so imports resolve.
- [X] T002 [P] Define shared domain types in `src/types/tryOn.ts`: `ScannedItem`, `Verdict`, `CriterionScore`, `CriterionKey` (`'color'|'style'|'fit'|'measurement'|'fabric'`), `Recommendation` (`'great'|'worth_it'|'maybe'|'skip'`) — per `data-model.md` (camelCase, no `any`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The transient store, hook, navigation shell, and service seam that ALL stories depend on.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [X] T003 Create transient `src/stores/tryOnStore.ts` (Zustand): state `{ status, scannedItem, verdict, mixMatchOutfits, error }` + `reset()` action. Exclude this store from AsyncStorage persistence (no persist middleware / not in any partialize) — transient by design (research R7).
- [X] T004 Create `src/features/try-on/useTryOn.ts` hook exposing store state + actions to screens (keeps screens thin, Constitution II).
- [X] T005 Create Expo Router shell: `app/try-on/_layout.tsx` (Stack: `index` → `result` → `mix-match`) and thin route files `app/try-on/index.tsx`, `app/try-on/result.tsx`, `app/try-on/mix-match.tsx` that each render the matching `src/features/try-on/components/*` screen.
- [X] T006 Create `src/services/tryOnService.ts` skeleton with a typed `evaluateItem(...)` signature returning `Promise<Verdict>` (implementation in US1); ensure it wraps `supabase` access (Constitution III).
- [X] T007 Add the launch entry "Try on before you buy" to `app/(tabs)/menu.tsx` that routes to `/try-on` (research R8); use design tokens / large-typography list style already in the menu.

**Checkpoint**: Navigation shell opens an empty Try On flow; store resets cleanly.

---

## Phase 3: User Story 1 - Scan a prospective purchase and get a suitability verdict (Priority: P1) 🎯 MVP

**Goal**: User scans one garment and sees the cut-out image, extracted attributes, and a 0–100 Verdict (overall + label + 5 criteria with explanations; "Not enough info" where data is missing).

**Independent Test**: Pick a single-garment photo → see isolated image + attributes + Verdict with five criterion rows; clear measurements and re-scan to confirm Measurement/Fit show "Not enough info" and are excluded from the composite; confirm nothing is saved.

### Backend (Verdict scoring)

- [X] T008 [US1] Factor the item-level scoring helpers (per-item fit ease, `colorProfileOf`, style-config lookups, fabric/season) into a shared module under `supabase/functions/generate-outfits/engine/itemScoring.ts`, re-exported so `generate-outfits` keeps working unchanged (single source of truth, Constitution V). No behavior change to existing outfit scoring.
- [X] T009 [US1] Implement `supabase/functions/evaluate-item/scoring.ts`: map the five criteria to the shared helpers from T008, compute per-criterion 0–100, weighted composite (Fit/Measurement higher), recommendation bands, and the availability/exclusion rules (FR-009a/FR-009b) — per `contracts/evaluate-item.md`.
- [X] T010 [US1] Implement `supabase/functions/evaluate-item/index.ts`: auth from JWT, load user profile server-side (`body_measurements`, `style_profiles.selected_styles`, `profiles.color_season`/`personal_palette`), validate `item`, call `scoring.ts`, return the snake_case Verdict; errors per contract.
- [X] T011 [US1] Deno test `supabase/functions/evaluate-item/scoring.test.ts`: deterministic outputs; criterion excluded when item attr OR profile data missing; Fit/Measurement weighting; composite renormalizes over evaluable criteria; recommendation-band thresholds.
- [ ] T012 [US1] Deploy via Supabase CLI: `supabase functions deploy evaluate-item` (prefer CLI over MCP inline deploy).

### Client (scan → result)

- [X] T013 [US1] Implement `tryOnStore` action `scan(photoUri, method)`: choose path — prefer `extractItemOnDevice` when `isExtractByItemAvailable`, else `extractItemsWithImages` with the `ai_extraction` credit gate (`checkCredit`/`incrementCredit`); store the single `ScannedItem` (synthetic id `"scanned"`); set progress/error states (FR-017). File: `src/stores/tryOnStore.ts`.
- [X] T014 [US1] Implement `tryOnService.evaluateItem(scannedItem, locale)`: invoke `evaluate-item`, map snake_case → domain `Verdict` (camelCase, criteria order fixed). File: `src/services/tryOnService.ts`.
- [X] T015 [US1] Implement `tryOnStore` action `evaluate()` calling `tryOnService.evaluateItem` and storing the `Verdict`; recoverable retry on failure (FR-017). File: `src/stores/tryOnStore.ts`.
- [X] T016 [P] [US1] Build `src/features/try-on/components/ScanScreen.tsx`: camera/library capture (reuse `expo-image-picker` pattern from wardrobe-add), progress state; dispatches `scan()` then navigates to result. Thin; tokens only.
- [X] T017 [P] [US1] Build `src/features/try-on/components/ItemOnWhite.tsx`: render the cut-out `localImageUri` on white (placeholder when null), per the v2 reference.
- [X] T018 [P] [US1] Build `src/features/try-on/components/DimScore.tsx`: one criterion row — score bar + explanation, OR "Not enough info" + a prompt linking to the relevant profile edit screen when `available:false`.
- [X] T019 [US1] Build `src/features/try-on/components/VerdictPanel.tsx`: overall score + recommendation label + five `DimScore` rows; handles the all-unavailable "complete your profile" state. Depends on T018.
- [X] T020 [US1] Build `src/features/try-on/components/ResultScreen.tsx`: compose `ItemOnWhite` + extracted attributes + `VerdictPanel`; trigger `evaluate()` on mount; wire into `app/try-on/result.tsx`. (Add/No/Mix&Match buttons added in US2/US3.) Depends on T017, T019.
- [X] T021 [US1] Jest test `src/services/__tests__/tryOnService.test.ts`: response→`Verdict` mapping including unavailable criteria (`score:null`) and recommendation-band mapping.
- [X] T022 [US1] Jest test `src/stores/__tests__/tryOnStore.test.ts`: `scan()` populates `scannedItem`; `evaluate()` attaches `Verdict`; store holds nothing in persistence (transient).

**Checkpoint**: US1 fully functional — scan yields a verdict; nothing persists. Shippable MVP.

---

## Phase 4: User Story 2 - Mix and match with the existing wardrobe (Priority: P2)

**Goal**: From the result, a Home-style swipe feed of complete outfits, each including the scanned item, paired only with owned wardrobe items.

**Independent Test**: Given a scanned item + a wardrobe with top/bottom/footwear, tap Mix & Match → every outfit contains the scanned item and is complete; empty/uncompletable wardrobe shows the sparse state; back returns to result with item still unsaved.

### Backend (pinned-item extension)

- [ ] T023 [US2] Extend `supabase/functions/generate-outfits/index.ts`: parse optional `pin_item`, build a `FitItem` via existing enrichment, inject into `itemMap` under `pin_item.id` (not DB-backed); 400 on invalid `pin_item`. Absent `pin_item` ⇒ unchanged behavior. Per `contracts/generate-outfits-pin.md`.
- [ ] T024 [US2] Add pinned candidate generation in `supabase/functions/generate-outfits/engine/generation.ts`: a variant of `generateFromPool` that fixes the pinned item's slot so every candidate includes it; reuse all existing scoring/ranking/filtering unchanged.
- [ ] T025 [US2] Deno test `supabase/functions/generate-outfits/engine/pin.test.ts`: with `pin_item`, 100% of returned outfits contain the pin and are complete (top+bottom+footwear); without `pin_item`, output is identical to baseline (regression guard); uncompletable wardrobe → `outfits: []`.
- [ ] T026 [US2] Deploy via Supabase CLI: `supabase functions deploy generate-outfits` (backward-compatible redeploy).

### Client (mix & match feed)

- [ ] T027 [US2] Add action `fetchMixMatchOutfits(scannedItem)` to `src/stores/fitEngineStore.ts`: build `pin_item` from the `ScannedItem`, invoke `generate-outfits`, return `ScoredOutfit[]`; no credit consumed. (Shared store action, not a cross-feature import — Constitution III/VI.)
- [ ] T028 [US2] Wire `tryOnStore` to call `fetchMixMatchOutfits` and store `mixMatchOutfits`; expose via `useTryOn`. File: `src/stores/tryOnStore.ts`.
- [ ] T029 [P] [US2] Build `src/features/try-on/components/MatchFeedCard.tsx`: one full-bleed outfit card — collage (scanned item framed as "considering" + wardrobe pieces), match score, title/rationale, thumbnail strip; resolve the pinned slot id `"scanned"` back to the scanned item's local cut-out image. Reuse shared collage from `src/components/outfit/` if available; otherwise local.
- [ ] T030 [US2] Build `src/features/try-on/components/MixMatchFeed.tsx`: vertical swipe `FlatList` pager of `MatchFeedCard`, page dots, "Back to result"; sparse-wardrobe empty state when `mixMatchOutfits` is empty. Wire into `app/try-on/mix-match.tsx`. Depends on T029.
- [ ] T031 [US2] Add the "Mix & match with closet" CTA (with outfit count) to `ResultScreen.tsx` navigating to mix-match. Depends on T020.
- [ ] T032 [US2] Jest test `src/stores/__tests__/fitEngineStore.mixmatch.test.ts`: `fetchMixMatchOutfits` builds a correct `pin_item` and the pinned slot maps to the scanned item's local image on render.

**Checkpoint**: US1 + US2 work; Mix & Match always includes the scanned item; item still unsaved.

---

## Phase 5: User Story 3 - Decide whether to keep the item (Priority: P3)

**Goal**: Add commits the item to the wardrobe (attributes + isolated image); No discards it (with temp cleanup) and returns to scan.

**Independent Test**: From result, Add → item appears in wardrobe and is usable in suggestions; scan another, No → nothing saved, temp image deleted, back to scan.

- [ ] T033 [US3] Implement `tryOnStore` action `addToWardrobe()`: map `ScannedItem` → `AddItemInput` (category via `categoryForType`, `source` = the extraction method `'ai'|'item'` to avoid a DB constraint change — research/plan), call `appStore.addWardrobeItem`, then clean up the temp cut-out file; surface success. File: `src/stores/tryOnStore.ts`.
- [ ] T034 [US3] Implement discard in `reset()` (extend T003): delete the temporary cut-out image via `expo-file-system` and clear all transient state (FR-013/FR-015, SC-004). File: `src/stores/tryOnStore.ts`.
- [ ] T035 [US3] Add the sticky "Decide · Buy or Pass" controls to `ResultScreen.tsx`: **Add** (`PrimaryButton` → `addToWardrobe`, then confirmation/navigate to wardrobe) and **No** (`SecondaryButton` → discard → back to `app/try-on/index.tsx`). Depends on T020.
- [ ] T036 [P] [US3] Build `src/features/try-on/components/` success/confirmation affordance (inline or `BottomSheet`) shown after Add, then route to wardrobe.
- [ ] T037 [US3] Jest test `src/stores/__tests__/tryOnStore.decide.test.ts`: `addToWardrobe` produces a correct `AddItemInput` and calls `addWardrobeItem` once; `reset()` clears state and requests temp-file deletion; no save occurs before Add.

**Checkpoint**: Full loop scan → verdict → mix & match → Add/No works end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T038 [P] Audit all Try On screens for design-token compliance (no inline hex, hairline icons, full-bleed image, `T.s` spacing) per Constitution I.
- [ ] T039 Unify progress + recoverable-error states across scan/evaluate/mix-match (FR-017); ensure no half-saved state on failure.
- [ ] T040 [P] Document the Verdict scoring + pin extension in `plan.md` changelog and add a UI spec note under `src/design/**/design.md` per the Documentation Policy.
- [ ] T041 Run `quickstart.md` validation scenarios (US1/US2/US3) on device; confirm SC-001 (scan→verdict < 30s) and SC-003 (100% outfits include the item).

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup; BLOCKS all user stories.
- **US1 (P3)**: depends on Foundational. MVP.
- **US2 (P4)**: depends on Foundational; consumes a `ScannedItem` (from US1 in the real flow, but independently testable with a fixture).
- **US3 (P5)**: depends on Foundational; acts on a `ScannedItem`; independently testable with a fixture.
- **Polish (P6)**: after the desired stories.

### Within Each User Story
- Backend scoring/contract before client wiring; store actions before screens; tests alongside the behavior they cover.
- T008 (shared scoring factor) precedes T009/T010. T023 precedes T024. T020 (ResultScreen base) precedes T031/T035.

### Parallel Opportunities
- T002 ‖ (after T001).
- US1: T016 ‖ T017 ‖ T018 (different component files); backend T008→T009→T010→T011→T012 is sequential; client tests T021 ‖ T022.
- US2: T029 is [P]; backend T023→T024→T025→T026 sequential.
- US3: T036 [P] alongside store work.
- Polish: T038 ‖ T040.
- With capacity, once Foundational is done, US1/US2/US3 can be staffed in parallel (each independently testable).

---

## Parallel Example: User Story 1

```bash
# UI components (different files, no inter-dependency):
Task: "Build ScanScreen.tsx (T016)"
Task: "Build ItemOnWhite.tsx (T017)"
Task: "Build DimScore.tsx (T018)"

# Client tests together:
Task: "tryOnService mapping test (T021)"
Task: "tryOnStore scan/evaluate test (T022)"
```

---

## Implementation Strategy

### MVP First (US1 only)
1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & VALIDATE** (scan → verdict, nothing saved) → demo.

### Incremental Delivery
US1 (verdict) → US2 (mix & match) → US3 (decide/commit). Each adds value without breaking the previous.

---

## Notes
- [P] = different files, no dependency. [Story] label maps to spec user stories.
- Keep scoring server-side; never duplicate the engine math on the client (Constitution V).
- No new DB tables/columns; verify the live `clothing_items.source` constraint before introducing a `'try-on'` provenance (schema-drift caution).
- Commit after each task or logical group.
