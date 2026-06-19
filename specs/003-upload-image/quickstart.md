# Quickstart & Validation: Wardrobe Item Image Upload & Storage

**Feature**: `004-upload-image` | **Date**: 2026-06-14

This guide validates the feature end-to-end against the spec. It references [data-model.md](./data-model.md) and [contracts/storage-and-service.md](./contracts/storage-and-service.md) rather than restating details. Implementation code lives in `tasks.md` / the implementation phase.

## Prerequisites

- Expo dev environment running (`npx expo start`) on a device/simulator (camera + file system needed; the photo flow can't be fully exercised in a pure web context).
- A test account that can toggle premium. RevenueCat is absent in Expo Go, so for local validation stub the tier by setting `fitEngineStore.premium` (free vs premium) — the storage routing reads tier, not RevenueCat directly (D1).
- DB migration applied: `2026XXXX_clothing_items_photo_storage.sql` (adds `photo_storage`). Verify the live `wardrobe-photos` bucket is private and RLS exists (schema-drift guard, D2/D5).

## Setup

```bash
npm install
# apply the new migration to your Supabase project (or local stack)
supabase db push    # or apply via your migration workflow
npx expo start
```

## Validation scenarios

Each maps to spec user stories / functional requirements.

### S1 — Free user, on-device, offline (US1 · FR-002/003/007/017)
1. Set tier = free. Add a wardrobe item with a photo.
2. Expect the FR-017 disclosure ("stored on this device only…") to appear, non-blocking; save succeeds.
3. Inspect the row: `photo_storage='local'`, `photo_url` is a relative `wardrobe-photos/{itemId}.jpg` path (no `file://`, no cloud object created).
4. Turn off network, kill and reopen the app. Item photo renders in wardrobe grid, item detail, and any outfit collage.
   - **Pass**: photo visible offline; no cloud object exists for it.

### S2 — Premium user, cloud + cache (US2 · FR-004/008/008a/016)
1. Set tier = premium. Add an item with a photo (online).
2. Row ends at `photo_storage='cloud'`, `photo_url='{userId}/{itemId}.jpg'`; a private object exists in `wardrobe-photos`.
3. Confirm the object is **not** publicly accessible (raw public URL → denied) and is reachable only via a signed URL that expires.
4. Reinstall the app / sign in on a second device → the item photo appears (fetched, then cached).
5. Go offline and reopen → previously viewed photo still renders from cache; instant on repeat.
   - **Pass**: SC-003 (cross-device), SC-008 (private/expiring), FR-008a (offline cache) all hold.

### S3 — Upgrade migration (US3 · FR-011)
1. As free, add 3+ photographed items (all `local`).
2. Flip tier to premium.
3. Migration runs: each item flips `local→cloud`, cloud objects created, device copies retained as cache; photos never disappear during migration.
4. Interrupt midway (kill app), reopen as premium → migration resumes for remaining `local` items.
   - **Pass**: 100% migrated (SC-005), no broken-image gap, resumable.

### S4 — Graceful degradation (US4 · FR-009/010)
1. For a `local` item, delete its device file out-of-band (simulate OS reclamation) → open any screen showing it.
2. Expect a token-styled placeholder (no crash, no broken image); item detail offers re-add/replace.
3. For a `cloud` item while offline with no cache, expect placeholder + auto-fetch on reconnect.
   - **Pass**: SC-004 (zero broken-image states/crashes).

### S5 — Optimization (FR-006 · SC-009)
1. Add a high-resolution photo (e.g., 4000 px).
2. Inspect the stored file (device and/or cloud): long edge ≤ ~1600 px, size ~200–500 KB.
   - **Pass**: SC-009.

### S6 — Cleanup (FR-013/014 · SC-007)
1. Replace an item's photo → prior device file and prior cloud object are gone; only the new one remains.
2. Delete an item → its device file and cloud object are removed.
   - **Pass**: no orphaned storage (SC-007).

### S7 — Demo account intact (Constitution workflow)
1. Launch the demo account (empty/seed wardrobe). Seed items still render via bundled assets; the feed works.
   - **Pass**: demo unaffected.

## Automated test pointers

- `src/services/__tests__/itemPhotoService.test.ts` — optimize size cap, relative-path round-trip, signed-URL never public, idempotent remove.
- `src/services/__tests__/wardrobeService.test.ts` — tier routing (free=no upload), premium local-first + promote, replace/delete cleanup.
- `src/features/wardrobe-photos/__tests__/useItemPhoto.test.ts` — resolution order, missing→placeholder, cache hit offline.
- Migration: unit-test `promoteToCloud` idempotency and resumability.

## Success-criteria coverage map

| Criterion | Scenario |
|-----------|----------|
| SC-001 free offline render | S1 |
| SC-002 latency / smoothness | S1, S2 |
| SC-003 cross-device | S2 |
| SC-004 zero broken-image | S4 |
| SC-005 upgrade migration | S3 |
| SC-006 add ≤30s | S1/S2 (timed) |
| SC-007 no orphans | S6 |
| SC-008 private/expiring | S2 |
| SC-009 image size | S5 |
