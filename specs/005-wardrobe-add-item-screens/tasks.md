# Tasks: Wardrobe Add-Item Screens

**Input**: Design documents from `specs/005-wardrobe-add-item-screens/`

**Prerequisites**: plan.md ✓ · spec.md ✓ · research.md ✓ · data-model.md ✓ · contracts/ ✓ · quickstart.md ✓

**Tests**: Not requested — no test tasks generated. Logic hooks (`useAddItemFlow`, `useAIWizard`) are structured for testability.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same phase)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions (Expo Router project)

- `app/` — screens (Expo Router file-based navigation)
- `src/features/wardrobe-add/` — new feature module
- `src/services/` — service modules (Supabase access)
- `src/types/` — shared domain types
- `supabase/functions/` — Edge Functions (Deno)
- `supabase/migrations/` — SQL migration files

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new directories and files; delete the old add-item screen.

- [ ] T001 Create feature directory `src/features/wardrobe-add/` with subdirectories `components/` and `__tests__/`
- [ ] T002 Create migration file `supabase/migrations/20260617000001_clothing_items_measurements.sql` with `ALTER TABLE public.clothing_items ADD COLUMN IF NOT EXISTS measurements jsonb, ADD COLUMN IF NOT EXISTS link text` and column comments per data-model.md
- [ ] T003 [P] Create Edge Function stub directory and empty entry point `supabase/functions/analyse-outfit-photos/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type, service, and DB changes that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Apply migration `20260617000001_clothing_items_measurements.sql` to the Supabase project and verify `measurements` and `link` columns exist on `clothing_items`
- [ ] T005 [P] Add `measurements?: Record<string, string>` and `link?: string` to the `WardrobeItem` interface in `src/types/fitEngine.ts`
- [ ] T006 [P] Extend `src/services/wardrobeService.ts`: add `measurements` and `link` to `ClothingItemRow` (internal row type), `AddItemInput`, `UpdateItemInput`; update `rowToItem()` to map both fields; update `addItem()` INSERT and `updateItem()` UPDATE to include both fields
- [ ] T007 Create `src/features/wardrobe-add/types.ts` with: `AddItemMethod = 'item' | 'ai'`; `PhotoEntry` (id, localUri, method, note?); `PhotoAnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed'`; `ExtractedItem` (all fields per data-model.md including `removed: boolean`)
- [ ] T008 [P] Create `src/features/wardrobe-add/components/MethodSheet.tsx`: bottom sheet using the existing `BottomSheet` component from `src/components/ui/BottomSheet.tsx`; renders two option rows ("Extract by item" FREE / "Extract by AI" AI) with hairline icons and design token styles; accepts `open`, `onClose`, `onSelectMethod: (m: AddItemMethod) => void` props
- [ ] T009 Create barrel `src/features/wardrobe-add/index.ts` exporting `MethodSheet`, `useAddItemFlow`, `useAIWizard` (other exports added as phases complete)

**Checkpoint**: Foundation ready — user story work can begin.

---

## Phase 3: User Story 1 — Single-Item Capture (Priority: P1) 🎯 MVP

**Goal**: A user can photograph or pick a single clothing item, watch on-device processing, review and correct AI-detected attributes, then save. The method sheet is accessible from the wardrobe tab. The old `/add-item` route is removed.

**Independent Test**: Tap "+" in the wardrobe tab → method sheet appears → "Extract by item" → guide screen → pick library photo → processing animation → review form → "ADD TO WARDROBE" → new item visible in wardrobe grid. No reference to `/add-item` remains in any screen.

- [ ] T010 [P] [US1] Create `src/features/wardrobe-add/components/ItemGuide.tsx`: full-height bottom sheet step showing photo do/don't tips (two-column grid) and two action buttons ("TAKE A PHOTO" camera / "CHOOSE FROM LIBRARY"); handles camera permission denial by showing an inline message and hiding the camera button; accepts `onCamera`, `onLibrary` props
- [ ] T011 [P] [US1] Create `src/features/wardrobe-add/components/ItemProcessing.tsx`: bottom sheet step with the captured photo (full-width, 3:4 aspect ratio), an animated progress indicator (Animated.loop on opacity), and a status text "ANALYSING…"; accepts `imageUri: string` prop
- [ ] T012 [US1] Create `src/features/wardrobe-add/components/ItemReview.tsx`: scrollable review form showing photo, editable name input, four tappable attribute rows (TYPE / COLOR / MATERIAL / PATTERN) that expand inline chip pickers, OCCASION and SEASON multi-select chip groups, optional detail rows (BRAND, SIZE buttons, PURCHASE PRICE, PURCHASE DATE, PURCHASED AT), CARE chips, NOTES textarea, and a sticky "ADD TO WARDROBE" bar; accepts `imageUri`, `defaults` (AI-detected attrs), `onSave(input: AddItemInput)`, `onDiscard` props; uses `T.color.*` and `T.font.*` tokens throughout (depends on T010, T011)
- [ ] T013 [US1] Create `src/features/wardrobe-add/useAddItemFlow.ts`: state machine with steps `idle | guide | capture | processing | review`; actions: `openSingleItem()`, `handleCamera()`, `handleLibrary()`, `handleProcessingComplete(uri)`, `handleSave(input)`, `handleDiscard()`, `reset()`; delegates camera/library to `expo-image-picker`; delegates save to `useAppStore().addWardrobeItem()`; handles camera permission denial by staying on guide with `cameraBlocked: true` state flag
- [ ] T014 [US1] Wire the single-item path in `MethodSheet.tsx`: when "Extract by item" is selected, call `onSelectMethod('item')`; the parent renders `ItemGuide` → `ItemProcessing` → `ItemReview` as the hook step changes (using the existing `BottomSheet` with `maxHeight` adjusted per step: guide 70%, processing 60%, review 92%)
- [ ] T015 [US1] Update `app/(tabs)/wardrobe.tsx`: (a) remove the entire inline `AddItemSheet` component and its local state; (b) import `MethodSheet` and `useAddItemFlow` from `src/features/wardrobe-add`; (c) change the FAB `onPress` from `router.push('/add-item')` to opening the method sheet state; (d) wire the nav-bar "+" `onPress` to the same method sheet open; (e) render `MethodSheet` and the single-item flow steps controlled by `useAddItemFlow`
- [ ] T016 [US1] Delete `app/add-item.tsx` and remove `<Stack.Screen name="add-item" ... />` from `app/_layout.tsx`
- [ ] T017 [US1] Update `app/collections/[id].tsx`: replace the `TextLink` that navigates to `/add-item` with navigation to `/(tabs)/wardrobe` (the wardrobe tab, not the deleted route)
- [ ] T018 [US1] Verify that after `useAppStore().addWardrobeItem()` resolves, the new item appears immediately in the wardrobe grid in `app/(tabs)/wardrobe.tsx` without requiring a pull-to-refresh or route change (the store already prepends to `wardrobeItems` — confirm the wardrobe grid reads from `wardrobeItems` directly)

**Checkpoint**: User Story 1 fully functional. No `/add-item` references remain. Single-item flow works from wardrobe tab.

---

## Phase 4: User Story 2 — AI Outfit Import Wizard (Priority: P2)

**Goal**: A user can select multiple outfit photos, trigger AI analysis (with per-photo status tracking and retry for failures only), review and edit extracted items grouped by source photo, remove unwanted items, and confirm — reaching a Done screen with the saved count.

**Independent Test**: "Extract by AI" from method sheet → upload 2 photos → tap "ANALYSE 2 PHOTOS" → scanning animation per photo → review step shows items grouped by photo → remove one item → "CONFIRM ALL · N" → Done step → "VIEW MY WARDROBE" → wardrobe shows saved items. Free-tier user sees upgrade prompt at Analyse step instead.

- [ ] T019 [P] [US2] Implement `src/services/aiAnalysisService.ts`: export `analysePhotos(photos: PhotoEntry[], cache: Map<string, ExtractedItem[] | null>): Promise<AnalysisResult>`; filters `photos` to only those not in `cache`; calls `sb.functions.invoke('analyse-outfit-photos', { body: { photos: [...] } })`; merges results into the cache map; returns `{ updatedCache, statuses }` per data-model.md contract
- [ ] T020 [P] [US2] Implement `supabase/functions/analyse-outfit-photos/index.ts`: Deno Edge Function that validates auth via Supabase JWT; validates request body (1–10 photos, data URIs); for each photo sleeps 1.5 s then returns one `ExtractedItemDto` stub (`name: "Extracted Item"`, `category: "top"`, `color: "Beige"`, `material: "Cotton"`, `measurements: {"chest":"52 cm","shoulder":"44 cm"}`); returns `AnalyseResponse` per the contract in `contracts/analyse-outfit-photos.md`
- [ ] T021 [US2] Create `src/features/wardrobe-add/useAIWizard.ts`: state machine with steps `upload | analyse | review | done`; holds `photos: PhotoEntry[]`, `statusMap: Map<photoId, PhotoAnalysisStatus>`, `resultsCache: Map<photoId, ExtractedItem[] | null>`, `reviewItems: ExtractedItem[]`; actions: `addPhotos(entries)`, `removePhoto(id)`, `setPhotoMethod(id, method)`, `setPhotoNote(id, note)`, `startAnalysis()` (checks premium tier via `useFitEngineStore`; shows upgrade prompt if free), `retryFailed()` (resubmits only `'failed'` photos), `removeItem(itemId)`, `updateItem(itemId, patch)`, `confirmAll()`, `reset()`; delegates to `aiAnalysisService.analysePhotos()` (depends on T019)
- [ ] T022 [P] [US2] Create `src/features/wardrobe-add/components/PhotoChooser.tsx`: two-phase overlay shown automatically when Upload step has no photos; phase 1 — method picker ("Extract by AI" / "Extract by item"); phase 2 — launches `ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, selectionLimit: 10 })` and calls `onAdd(entries: PhotoEntry[])` with the results; accepts `onAdd`, `onClose` props
- [ ] T023 [P] [US2] Create `src/features/wardrobe-add/components/AIUploadStep.tsx`: lists `photos` with method badge, per-photo note `TextInput`, and REMOVE button; shows count line "N PHOTO(S) SELECTED"; shows "ANALYSE N PHOTOS" CTA (disabled when `photos.length === 0`); renders `PhotoChooser` overlay when photos list is empty; accepts `photos`, `onAddPhotos`, `onRemovePhoto`, `onSetNote`, `onSetMethod`, `onAnalyse` props
- [ ] T024 [US2] Create `src/features/wardrobe-add/components/AIAnalyseStep.tsx`: thumbnail strip showing each photo with its `PhotoAnalysisStatus` badge (PENDING / PROCESSING / COMPLETE / FAILED); scanning animation (Animated sweep) on the currently-processing photo; shows "RETRY FAILED" button when any photo has `status === 'failed'` and no photo is currently processing; accepts `photos`, `statusMap`, `onRetry` props (depends on T021)
- [ ] T025 [US2] Create `src/features/wardrobe-add/components/AIReviewStep.tsx`: groups `reviewItems` by `sourcePhotoId`; each group has a section header (photo thumbnail); each item card shows cutout image placeholder, editable name, tappable field rows for category/colour/material/brand/link (chip picker for structured fields, text input for free-form), type-aware measurements grid, editable tag chips, and a REMOVE button; "CONFIRM ALL · N" sticky bar (disabled and showing "Nothing to save" empty state when all items are removed); accepts `photos`, `reviewItems`, `onUpdateItem`, `onRemoveItem`, `onConfirm` props (depends on T021)
- [ ] T026 [P] [US2] Create `src/features/wardrobe-add/components/AIDoneStep.tsx`: shows count of items saved and source photo count; "VIEW MY WARDROBE" primary button; accepts `itemCount`, `photoCount`, `onViewWardrobe` props
- [ ] T027 [US2] Create `src/features/wardrobe-add/components/AIWizard.tsx`: full-screen `Modal` (animationType="slide") containing a 4-step indicator (Upload → Analyse → Review → Done), a back/close header, and the active step component routed from `useAIWizard` step state; accepts `visible`, `onClose` props and uses `useAIWizard` internally (depends on T022, T023, T024, T025, T026)
- [ ] T028 [US2] Wire "Extract by AI" from `MethodSheet.tsx` to open `AIWizard`; the premium gate in `useAIWizard.startAnalysis()` must show an upgrade prompt (using `usePremium` / existing premium gate pattern) instead of calling `aiAnalysisService` when the user is free-tier; on wizard `onClose` with saved items, call `useAppStore().addWardrobeItem()` for each confirmed `ExtractedItem` in sequence
- [ ] T029 [US2] Verify per-photo partial failure flow in `useAIWizard.ts`: after a simulated network error mid-batch (mock `aiAnalysisService` to reject one photo), confirm `statusMap` shows `'complete'` for resolved photos and `'failed'` for the rejected photo; confirm `retryFailed()` only resubmits the failed photo; confirm results cache for completed photos is unchanged

**Checkpoint**: User Stories 1 and 2 both independently functional. AI wizard works with premium gate.

---

## Phase 5: User Story 3 — Wardrobe Intro at Onboarding Completion (Priority: P3)

**Goal**: After completing the colour palette onboarding step, the user sees the Wardrobe Intro screen exactly once. "ADD FIRST ITEM" opens the method sheet overlay; on save the user lands on the home feed, not the intro screen again.

**Independent Test**: Fresh account → complete through colour palette → CONTINUE → Wardrobe Intro appears → "ADD FIRST ITEM" → method sheet overlay → add one item → home feed. Kill and relaunch app → home feed (not Wardrobe Intro).

- [ ] T030 [US3] Update `app/(onboarding)/colors.tsx`: in `handleContinue` change `router.push('/(onboarding)/complete')` to `router.push('/(onboarding)/wardrobe-intro')`; the `/complete` screen is no longer reachable from this path (it may remain in the router for now but is no longer linked)
- [ ] T031 [US3] Update `app/(onboarding)/wardrobe-intro.tsx`: add local `boolean` state `methodSheetOpen`; change "ADD FIRST ITEM" `PrimaryButton` `onPress` to `setMethodSheetOpen(true)` (do NOT call `completeOnboarding` here); render `MethodSheet` controlled by `methodSheetOpen`; when a single-item flow `onSave` completes (via `useAddItemFlow` passed into the sheet), call `await completeOnboarding()` then `router.replace('/(tabs)')`; "Skip for now" remains unchanged (`completeOnboarding` → `replace('/(tabs)')`)
- [ ] T032 [US3] Verify the Wardrobe Intro gate: the existing `onboardingComplete` flag in `authStore` is set to `true` after `completeOnboarding()` runs; confirm that relaunching the app with `onboardingComplete === true` skips the onboarding stack and lands on the tabs (verify in `app/_layout.tsx` routing logic — no change needed, just validate)

**Checkpoint**: Onboarding funnel delivers to Wardrobe Intro correctly. Screen is never shown twice.

---

## Phase 6: User Story 4 — Post-Onboarding Wardrobe Add (Priority: P4)

**Goal**: After onboarding, the user can add items at any time from the wardrobe tab using the same method sheet. New items appear instantly in the grid.

**Independent Test**: Log in as a user who has completed onboarding → wardrobe tab → tap "+" FAB or nav-bar "+" → method sheet appears → complete a single-item add → item visible in grid immediately.

- [ ] T033 [US4] Confirm `app/(tabs)/wardrobe.tsx` "+" nav-bar icon and floating "+" FAB both open the `MethodSheet` (wired in T015); verify both buttons are distinct `Pressable` elements each calling the same `openMethodSheet()` action from `useAddItemFlow`
- [ ] T034 [US4] Verify optimistic UI in `app/(tabs)/wardrobe.tsx`: after `useAppStore().addWardrobeItem()` resolves, the returned `WardrobeItem` is prepended to `wardrobeItems` in the store; the wardrobe `FlatList`/grid reads `wardrobeItems` directly and re-renders without a route change or pull-to-refresh

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Design system compliance, edge case coverage, and final validation.

- [ ] T035 [P] Design review: audit all new components in `src/features/wardrobe-add/components/` for design token compliance — no inline hex values, all colours via `T.color.*`, all fonts via `T.font.*`, spacing via `T.s()`, icons are hairline stroke only (strokeWidth 1.2–1.4), no drop shadows, no gradients, no spring/bounce animations
- [ ] T036 [P] Edge case: camera permission denied → in `useAddItemFlow.handleCamera()` check permission result; if denied set `cameraBlocked: true`; in `ItemGuide.tsx` show an inline "Camera access was denied. Use the library instead." message below the source buttons and hide the camera button
- [ ] T037 [P] Edge case: discard at any step → `useAddItemFlow.handleDiscard()` and `useAIWizard.reset()` must clear all in-progress state; verify no item is added to the store; verify `BottomSheet` / `Modal` closes cleanly
- [ ] T038 [P] Edge case: AI Review with all items removed → `AIReviewStep.tsx` must disable the "CONFIRM ALL" button and show a "Nothing to save" empty state message when `reviewItems.filter(i => !i.removed).length === 0`
- [ ] T039 Run all scenarios and edge cases from `specs/005-wardrobe-add-item-screens/quickstart.md` on both iOS simulator and Android emulator; confirm DB state in Supabase Studio (measurements JSONB, link column) matches expected values

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story phases
- **Phase 3 (US1)**: Depends on Phase 2 — P1 MVP, implement first
- **Phase 4 (US2)**: Depends on Phase 2 — can start after Phase 2 in parallel with Phase 3 if staffed; but T028 depends on MethodSheet wiring in Phase 3
- **Phase 5 (US3)**: Depends on Phase 3 (MethodSheet must exist)
- **Phase 6 (US4)**: Depends on Phase 3 (wardrobe.tsx wiring complete)
- **Phase 7 (Polish)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: Only depends on Foundational. No dependency on US2/US3/US4.
- **US2 (P2)**: Depends on Foundational + `MethodSheet` from US1 (T014). Service (T019) and Edge Function (T020) can be built in parallel with US1.
- **US3 (P3)**: Depends on US1 `MethodSheet` + `useAddItemFlow` being complete (T013, T014).
- **US4 (P4)**: Largely covered by US1 wiring (T015). T033–T034 are verification tasks only.

### Within Each User Story

- Types and hooks before components that use them
- Simpler components (guide, processing) before composite ones (review, wizard)
- Hook complete before wiring into screens
- Delete old code only after replacement is wired (T016 after T014–T015)

### Parallel Opportunities

All tasks marked [P] within a phase can run concurrently. Highest-value parallelism:

```
# Phase 2 (run in parallel):
T005  Add WardrobeItem fields (fitEngine.ts)
T006  Extend wardrobeService.ts
T008  Create MethodSheet component

# Phase 3 (run in parallel first, then sequential):
T010  ItemGuide component
T011  ItemProcessing component
→ then T012 ItemReview (depends on T010, T011)
→ then T013 useAddItemFlow
→ then T014–T018 sequentially

# Phase 4 (run in parallel first):
T019  aiAnalysisService.ts
T020  Edge Function stub
T022  PhotoChooser component
T023  AIUploadStep component
T026  AIDoneStep component
→ then T021 useAIWizard (depends on T019)
→ then T024 AIAnalyseStep, T025 AIReviewStep (depend on T021)
→ then T027 AIWizard shell (depends on T022–T026)
→ then T028–T029 wiring and verification
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run Scenario 1 from quickstart.md
5. Ship MVP — wardrobe add works for all users via the method sheet

### Incremental Delivery

1. Phase 1–2: Foundation → DB migrated, types updated, MethodSheet stub ready
2. Phase 3 (US1): Single-item flow → Old `/add-item` gone, new flow live → **MVP**
3. Phase 4 (US2): AI wizard → Premium feature live
4. Phase 5 (US3): Onboarding Intro → Funnel complete
5. Phase 6 (US4): Post-onboarding add → Already mostly done by Phase 3, verify only
6. Phase 7: Polish → Ready to merge

---

## Notes

- [P] tasks touch different files and have no dependencies on incomplete tasks in the same phase
- Delete `app/add-item.tsx` (T016) only after the replacement is fully wired (T014–T015)
- The `MethodSheet` bottom sheet is the single entry point for both flows — keep its API minimal (just `onSelectMethod`)
- `useAIWizard` is the only consumer of `aiAnalysisService`; no other code imports it directly
- All Supabase client calls remain inside service modules; hooks call services, screens call hooks
- Commit after each phase checkpoint to enable clean rollback if needed
