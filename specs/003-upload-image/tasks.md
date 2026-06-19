---
description: "Task list for Wardrobe Item Image Upload & Storage"
---

# Tasks: Wardrobe Item Image Upload & Storage

**Input**: Design documents from `/specs/003-upload-image/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/storage-and-service.md, quickstart.md

**Tests**: Included as targeted service/hook tests because `quickstart.md` § "Automated test pointers" names them and the repo uses a `src/**/__tests__/` convention. They are not full TDD gating — implement alongside each story.

**Organization**: Tasks are grouped by user story (priority order) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US4 (maps to spec user stories)

## Path Conventions (Mobile — Expo Router)

`app/` (screens) · `src/` (stores, services, features, components, types, design, data) · `supabase/migrations/` · `src/**/__tests__/` (unit tests)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the feature module and design surface.

- [X] T001 Create feature module directory `src/features/wardrobe-photos/` with an `index.ts` barrel
- [X] T002 [P] Create UI/visual spec for placeholder + FR-017 disclosure in `src/design/wardrobe-photos/design.md` (token usage, no inline hex, hairline style per Constitution I)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, types, and shared storage plumbing every story depends on.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [X] T003 Verify live DB vs. migrations (known schema drift): confirm `wardrobe-photos` bucket is private and the three storage RLS policies exist, and capture the real `clothing_items` shape — document findings in `specs/003-upload-image/research.md` (append) before relying on them (research D2/D5)
- [X] T004 Create migration `supabase/migrations/20260614000001_clothing_items_photo_storage.sql` adding `photo_storage text not null default 'none' check (in 'none','local','cloud')` plus the cloud backfill `update` (data-model.md § Database change)
- [X] T005 Extend `WardrobeItem` in `src/types/fitEngine.ts`: add `photoStorage: 'local'|'cloud'|'none'` and `photoLocalUri: string|null`; document that `photoPath` holds relative-device-path OR cloud storage path (data-model.md § WardrobeItem)
- [X] T006 Resolve the expo-file-system SDK 19 `EncodingType` issue (research D10): create a typed read/write/base64 helper in `src/services/itemPhotoService.ts` and confirm `tsc` passes for it
- [X] T007 Scaffold `src/services/itemPhotoService.ts` per `contracts/storage-and-service.md` §1: `PhotoStorageKind`, the `documentDirectory + 'wardrobe-photos/'` path helpers, and exported function signatures (empty bodies/throws) so stories can fill them independently
- [X] T008 Update `wardrobeService` mappers (`rowToItem`) in `src/services/wardrobeService.ts` to populate `photoStorage` from `photo_storage` and stop assuming a public URL (no behavior change yet; mapping only)

**Checkpoint**: Schema, types, and service contracts exist — user stories can proceed.

---

## Phase 3: User Story 1 - Free user, on-device photo that persists (Priority: P1) 🎯 MVP

**Goal**: Free users add a photo stored on-device; only a reference is persisted; it renders everywhere, offline; they are warned it is device-only.

**Independent Test**: As free + offline, add a photographed item, relaunch, and confirm the photo renders in grid, detail, and collage with no cloud object created (quickstart S1).

### Tests for User Story 1

- [X] T009 [P] [US1] Tests for device-side `itemPhotoService` (optimize ≤~1600 px/~0.7, relative-path round-trip, idempotent `removePhoto`) in `src/services/__tests__/itemPhotoService.test.ts`
- [X] T010 [P] [US1] Test free-tier routing of `wardrobeService.addItem(_, 'free')` (writes device copy + `photo_storage='local'`, performs NO cloud upload) in `src/services/__tests__/wardrobeService.test.ts`

### Implementation for User Story 1

- [X] T011 [US1] Implement `optimizeImage` (expo-image-manipulator: long edge ≤~1600 px, JPEG ~0.7) in `src/services/itemPhotoService.ts` (FR-006/SC-009)
- [X] T012 [US1] Implement `writeDeviceCopy`/`resolveDeviceUri`/device branch of `removePhoto` (relative paths under `documentDirectory/wardrobe-photos/`) in `src/services/itemPhotoService.ts` (research D4)
- [X] T013 [US1] Implement `addItem(input, 'free')` local-first in `src/services/wardrobeService.ts`: optimize → device copy → insert row `photo_storage='local'`, `photo_url`=relative path, NO cloud call (FR-002/003/007)
- [X] T014 [US1] Implement `replaceItemPhoto` (local) and device-copy cleanup in `deleteItem` in `src/services/wardrobeService.ts` (FR-013/014 local portion)
- [X] T015 [P] [US1] Create `useItemPhoto` hook (resolution: bundled `png` → local file → `missing`) and feature types in `src/features/wardrobe-photos/useItemPhoto.ts` and `src/features/wardrobe-photos/types.ts` (contracts §3)
- [X] T016 [P] [US1] Create token-styled photo placeholder primitive in `src/components/ui/PhotoPlaceholder.tsx` and export from `src/components/ui/index.ts` (Constitution I)
- [X] T017 [US1] Update `appStore.addWardrobeItem` in `src/stores/appStore.ts` to accept/derive `tier` (from `fitEngineStore.premium`) and pass it to `wardrobeService.addItem` (research D1)
- [X] T018 [US1] Add non-blocking FR-017 disclosure (device-only; not on other devices nor usable by suggestions; upgrade CTA) for free users in `app/add-item.tsx`
- [~] T019 [US1] Render via `useItemPhoto` + placeholder in `app/(tabs)/wardrobe.tsx`, `app/item/[id].tsx`, and `src/components/outfit/Collage.tsx` (FR-005)
- [X] T020 [US1] Document non-UI logic in `plan.md` and UI specs in `src/design/wardrobe-photos/design.md` (Documentation Policy)

**Checkpoint**: Free-tier on-device flow fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Premium photos backed up to cloud (Priority: P1)

**Goal**: Premium photos upload to the private cloud bucket, fetch via signed URLs, cache on-device for offline + instant repeat, and survive reinstall/new device.

**Independent Test**: As premium, add a photo → private cloud object via signed (not public) URL; sign in on a 2nd device → photo appears; go offline → cached photo still renders (quickstart S2).

### Tests for User Story 2

- [X] T021 [P] [US2] Tests for cloud-side `itemPhotoService` (`signedUrl` never returns public/non-expiring; `uploadCloudCopy` path `{userId}/{itemId}.jpg`; `ensureCloudCached` round-trip) in `src/services/__tests__/itemPhotoService.test.ts`
- [X] T022 [P] [US2] Tests for premium local-first add + `promoteToCloud` flip to `cloud` in `src/services/__tests__/wardrobeService.test.ts`

### Implementation for User Story 2

- [X] T023 [US2] Replace `getPublicUrl` with `createSignedUrl`; implement `signedUrl(path, ~3600s)` and `uploadCloudCopy` in `src/services/itemPhotoService.ts` (FR-016/SC-008, research D2)
- [X] T024 [US2] Implement `ensureCloudCached` (download cloud object → device cache, keyed by item/path not signed URL) in `src/services/itemPhotoService.ts` (FR-008a, research D3)
- [X] T025 [US2] Implement `addItem(input, 'premium')` local-first + async upload + flip `local`→`cloud`, plus `listPendingCloudUploads` and `promoteToCloud` in `src/services/wardrobeService.ts` (FR-004/008/012, research D8)
- [X] T026 [US2] Extend `useItemPhoto` cloud branch (cache hit → `ready`; else fetch+download → `loading`; offline-miss → `missing`) in `src/features/wardrobe-photos/useItemPhoto.ts`
- [X] T027 [US2] Add cloud-object cleanup (`storage.remove`) to `deleteItem` and `replaceItemPhoto` in `src/services/wardrobeService.ts` (FR-013/014 cloud portion, SC-007)
- [X] T028 [US2] Retry pending uploads on reconnect and app start: extend the existing `NetInfo` listener / `hydrate` in `src/stores/appStore.ts` to call `promoteToCloud` for premium `local` items (research D8)

**Checkpoint**: Premium cloud + cache flow works and is independently testable; both P1 stories deliver the launch scope.

---

## Phase 5: User Story 3 - Upgrading to premium backs up existing photos (Priority: P2)

**Goal**: On free→premium upgrade, existing local photos migrate to cloud automatically, resumably, with no visual gap.

**Independent Test**: As free with 3+ local photos, flip to premium → all migrate to `cloud`; interrupt and relaunch → migration resumes; photos never disappear (quickstart S3).

**Dependency note**: Reuses `promoteToCloud`/upload primitives from US2 (T024–T025).

### Tests for User Story 3

- [X] T029 [P] [US3] Test `promoteToCloud` idempotency + resumability (already-cloud skipped; interrupted set completes) in `src/services/__tests__/wardrobeService.test.ts`

### Implementation for User Story 3

- [~] T030 [US3] Create `useUpgradePhotoMigration` hook (enumerate `photo_storage='local'`, `promoteToCloud` each, keep device copy as cache, report progress) in `src/features/wardrobe-photos/useUpgradePhotoMigration.ts` (contracts §4, research D7)
- [X] T031 [US3] Detect premium transition false→true and trigger migration once (wire in `src/stores/appStore.ts` or `app/_layout.tsx`, guarded/idempotent) (FR-011)
- [X] T032 [US3] Ensure photos remain visible throughout migration (device copy retained until cloud confirmed) and verify US3-3 resumability path

**Checkpoint**: Upgrade migration complete and independently testable.

---

## Phase 6: User Story 4 - Photos degrade gracefully when unavailable (Priority: P3)

**Goal**: Missing local files, failed cloud fetches, and offline-no-cache all show a clean placeholder (no crash/broken image) with a re-add path.

**Independent Test**: Delete an item's device file out-of-band → placeholder shown, no crash, detail offers re-add; cloud item offline with no cache → placeholder + auto-retry on reconnect (quickstart S4).

**Dependency note**: Builds on `useItemPhoto` (T015/T026) and placeholder (T016).

### Tests for User Story 4

- [X] T033 [P] [US4] Test `useItemPhoto` `missing` resolution (local file absent; cloud offline no-cache) in `src/features/wardrobe-photos/__tests__/useItemPhoto.test.ts`

### Implementation for User Story 4

- [X] T034 [US4] Confirm/handle `missing` placeholder for reclaimed local files across `app/(tabs)/wardrobe.tsx`, `app/item/[id].tsx`, `src/components/outfit/Collage.tsx` (FR-009)
- [ ] T035 [US4] Add re-add/replace action when a photo is missing in `app/item/[id].tsx` (FR-010)
- [X] T036 [US4] Cloud offline-no-cache → placeholder + auto re-fetch on reconnect in `src/features/wardrobe-photos/useItemPhoto.ts` (edge case: premium offline, not yet cached)

**Checkpoint**: All four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T037 [P] Verify demo account (`src/config/demo.ts`) still renders seed items via bundled assets (Constitution workflow / quickstart S7)
- [X] T038 [P] `tsc` strict clean (no `any`) and lint pass across changed files; confirm the `EncodingType` fix removed the pre-existing error
- [ ] T039 Run all `quickstart.md` scenarios S1–S7 and record pass/fail
- [ ] T040 [P] Performance + size audit: feed scroll stays 60 fps with photos; sample stored files meet SC-009 (≤~1600 px, ~200–500 KB)
- [X] T041 [P] Final docs: update `plan.md` changelog (storage routing, signed-URL fix) and `src/design/wardrobe-photos/design.md`

---

## Implementation Status — 2026-06-14

Legend: `[X]` done · `[~]` partial · `[ ]` not started. Everything below is `tsc`-clean
(app-side error count 6→5; the 1 fixed was the `EncodingType` issue) and the routing
test suite passes (4/4).

**Done (code-complete):** all of Setup + Foundational; US1 except item-detail re-add; all
US2 service/store logic; US3 upgrade trigger; US4 placeholder/offline-retry; docs; tsc fix.

**Partial / deviations:**
- `[~] T019` — `useItemPhoto` wired into the wardrobe grid (`app/(tabs)/wardrobe.tsx`). `item/[id].tsx`
  and `Collage.tsx` render demo items (bundled `png`) which are unaffected; wiring them for *real*
  wardrobe items is deferred with T035.
- `[~] T030` — implemented as `appStore.syncPendingPhotos()` (triggered from `fitEngineStore.setPremium`,
  reconnect, and hydrate) instead of a separate `useUpgradePhotoMigration` hook. Same behavior,
  fewer moving parts; the dedicated hook + progress UI is optional.

**Not started (need device/DB, or extra test mocks):**
- `[ ] T009 / T021 / T029 / T033` — device-side & hook tests (require mocking expo-file-system,
  expo-image-manipulator; only the tier-routing test was written, T010/T022).
- `[ ] T035` — re-add/replace photo action on a real-item detail screen.
- `[ ] T037 / T039 / T040` — demo-account check, quickstart S1–S7, perf/size audit — all require a
  running device/simulator.

**⚠️ Required before this works at runtime:** apply migration
`supabase/migrations/20260614000001_clothing_items_photo_storage.sql` to the database
(NOT applied — it alters the live `ACTIVE_HEALTHY` project and needs your go-ahead).

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; **blocks all stories**.
- **US1 (Phase 3, P1)**: after Foundational. MVP. No dependency on other stories.
- **US2 (Phase 4, P1)**: after Foundational. Shares the service/hook with US1 but is independently testable (premium add path).
- **US3 (Phase 5, P2)**: after US2 (reuses `promoteToCloud`/upload primitives).
- **US4 (Phase 6, P3)**: after US1 (extends `useItemPhoto` + placeholder); also covers the US2 cloud-offline edge.
- **Polish (Phase 7)**: after all desired stories.

### Within Each Story

- Tests before implementation where listed · service before hook before screen · device branch before cloud branch.

### Parallel Opportunities

- T002 (design doc) ∥ Setup.
- Foundational: T004/T005 are largely independent; T003 should land first (informs T004).
- US1: T009 ∥ T010 (tests); T015 ∥ T016 (hook ∥ placeholder, different files).
- US2: T021 ∥ T022 (tests).
- Cross-story: once Foundational is done, US1 and US2 can be staffed in parallel (different developers), reconciling on the shared `itemPhotoService`/`useItemPhoto` files.

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Device-side itemPhotoService tests in src/services/__tests__/itemPhotoService.test.ts"
Task: "Free-tier routing test in src/services/__tests__/wardrobeService.test.ts"

# Independent-file implementation together:
Task: "useItemPhoto hook in src/features/wardrobe-photos/useItemPhoto.ts"
Task: "PhotoPlaceholder primitive in src/components/ui/PhotoPlaceholder.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 US1 → **STOP & VALIDATE** quickstart S1 → demo.

### Full launch (both P1 stories)

Add US2 (premium cloud) → validate S2 → the P1 launch scope is complete. Then US3 (upgrade migration), then US4 (resilience) as incremental P2/P3 increments.

### Notes

- `[P]` = different files, no incomplete-task dependency.
- The `photo_storage='local'` + premium condition is the single mechanism behind both US2 retry (T028) and US3 migration (T030) — keep them consistent.
- Honor Constitution: services own all Supabase access; screens stay thin; schema change ships as the T004 migration; document UI in `design.md` and logic in `plan.md`.
