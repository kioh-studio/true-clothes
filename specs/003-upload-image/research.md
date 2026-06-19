# Phase 0 Research: Wardrobe Item Image Upload & Storage

**Feature**: `004-upload-image` | **Date**: 2026-06-14

All spec-level ambiguities were already resolved in `/speckit-clarify` (Session 2026-06-14). This document records the **technical decisions** that turn those product decisions into an implementable design, grounded in the existing codebase.

---

## D1. Tier-aware storage routing

**Decision**: Storage destination is chosen at upload time from the user's premium status. Free → device only; premium → cloud (with device cache). The `addWardrobeItem` store action reads premium tier (`fitEngineStore.premium`, mirrored from `usePremium`) and passes an explicit `tier: 'free' | 'premium'` argument into the service. The service never reads global state (Constitution III — services are stateless/typed).

**Rationale**: Keeps the tier signal flowing through stores/services (Principles II, III, VI) rather than the service reaching into RevenueCat. Matches FR-002.

**Alternatives considered**:
- Service reads premium status directly — rejected: couples the service to monetization and global state.
- Always upload then "hide" for free users — rejected: defeats the free-tier value (no cloud cost) and FR-007 offline guarantee.

---

## D2. Cloud access = private bucket + signed URLs (fixes existing latent bug)

**Decision**: Use the existing **private** `wardrobe-photos` bucket (`public=false`, per `20260606000003_storage_policies.sql`) and generate short-lived **signed URLs** via `createSignedUrl(path, ~3600s)` on read. Replace the current `getPublicUrl()` call in `wardrobeService.addItem`, which returns a non-working URL on a private bucket. Follow the proven avatar pattern in `profileService.uploadAvatar` / `storage_avatars` migration.

**Rationale**: Satisfies FR-016 / SC-008 (private, expiring access). The `WardrobeItem.photoUrl` type comment already states "signed URL (1-hour expiry)" — the type intends this; only the implementation drifted. Per-user RLS on `{userId}/...` path is already in place.

**Alternatives considered**:
- Public bucket + public URLs — rejected: violates FR-016 (anyone with the URL could view).
- Long-lived/permanent signed links — rejected by clarification Q1 (Option C declined).

**Risk / verification**: Per the project's known schema-drift, **verify against the live DB** in Phase implementation that (a) `wardrobe-photos` is actually private and (b) the three RLS policies exist, before relying on them. If drift exists, add a corrective migration.

---

## D3. Unified "resolve to local file" rendering layer

**Decision**: Introduce `useItemPhoto(item)` returning `{ uri | null, status: 'ready'|'loading'|'missing' }`. Resolution order:
1. Demo/seed item with bundled `png` asset → use the asset (keeps demo account working).
2. `photoStorage === 'local'` → resolve device path; if the file is missing → `missing`.
3. `photoStorage === 'cloud'` → if a cached device copy exists → use it (instant/offline); else fetch a signed URL, download to the cache dir, then use it. While downloading → `loading`; on failure offline → `missing` (retry when connectivity returns).

Every surface (`wardrobe.tsx`, `item/[id].tsx`, `Collage.tsx`, feed thumbnails) renders the returned local `uri` with React Native `<Image source={{ uri }}>`, or a token-styled placeholder when `missing`/`loading`.

**Rationale**: One code path for both tiers (FR-005), built-in offline + instant repeat for premium (FR-008a), graceful placeholder everywhere (FR-009). Caching by **storage path → downloaded file** (not by signed-URL string) survives signed-URL rotation, which a URL-keyed HTTP cache would not.

**Alternatives considered**:
- Adopt `expo-image` for URL disk caching — rejected: not currently a dependency, and signed-URL rotation defeats URL-keyed caches; explicit path-keyed file cache is more predictable and reuses `expo-file-system`.
- Render remote signed URL directly each time — rejected: breaks offline and re-downloads on every view (fails FR-008a, SC-002 repeat-view).

---

## D4. On-device storage location & reference format

**Decision**: Store device copies in a stable directory: `FileSystem.documentDirectory + 'wardrobe-photos/{itemId}.jpg'`. Persist only the **relative path** (`wardrobe-photos/{itemId}.jpg`) — never an absolute `file://` URI — and resolve to absolute at read time by prefixing `documentDirectory`.

**Rationale**: The OS app-sandbox absolute path can change between launches/reinstalls; storing a relative path keeps references valid across app updates on the same device. Honors the reference brief ("send the path to the database as string") while avoiding the brittleness of absolute URIs. Out-of-sandbox cache/temp URIs from the picker are copied in, not referenced.

**Alternatives considered**:
- Persist absolute `file://` URI (as the brief literally says) — rejected: fragile across reinstalls/OS path changes.
- Store local reference only in AsyncStorage, not the DB — rejected: the spec/brief want the reference on the item record; keeping it on `clothing_items` keeps one source of truth per item and simplifies upgrade migration.

---

## D5. Persisting the local-vs-cloud discriminator

**Decision**: Add a `photo_storage text` column to `clothing_items` with values `'local' | 'cloud' | 'none'` (default `'none'`). Reuse the existing `photo_url` column to hold **either** the relative device path (local) **or** the storage path `{userId}/{itemId}.jpg` (cloud); the discriminator removes ambiguity rather than sniffing prefixes. Map to `WardrobeItem.photoStorage` and keep `photoLocalUri` (resolved, in-memory only) plus `photoUrl` (resolved signed URL, in-memory only) in the domain type.

**Rationale**: Explicit discriminator is more robust than inferring from a `file://` prefix (D4 stores relative paths, so prefix-sniffing wouldn't work). Minimal schema delta; service owns the snake_case↔camelCase mapping (Principle IV).

**Alternatives considered**:
- Infer kind from value shape — rejected: brittle, especially with relative local paths.
- Separate `photo_local_path` + `photo_cloud_path` columns — rejected: only one is ever set; a discriminator + single column is simpler and matches the one-photo-per-item invariant.

---

## D6. Image optimization (resize/compress)

**Decision**: On capture/select, run `expo-image-manipulator` to resize so the long edge ≤ ~1600 px and compress to JPEG at ~0.7 quality, targeting ~200–500 KB, before any storage. The optimized file is the only copy kept (no full-resolution original) for both tiers.

**Rationale**: Implements FR-006 / SC-009 with an already-installed dependency. Applied before upload and before writing the device copy, so cloud bandwidth, device storage, and 60 fps rendering all benefit.

**Alternatives considered**:
- Server-side/Edge resize — rejected: free users never upload; resize must happen on-device anyway, so do it once for both tiers.
- Keep original + derive thumbnails — rejected: out of scope (one photo per item), doubles storage.

---

## D7. Free → premium migration

**Decision**: On detecting an upgrade (premium becomes true), `useUpgradePhotoMigration` enumerates the user's `photo_storage='local'` items and, for each, uploads the device copy to the cloud, flips the row to `photo_storage='cloud'` with the storage path, and keeps the device copy as the premium cache. Idempotent and resumable: re-running skips already-cloud items, so an interrupted migration continues on next premium launch (FR-011, US3 scenario 3). Photos remain visible throughout (device copy until cloud is confirmed).

**Rationale**: Reuses the same upload primitive as `addItem`; mirrors the existing `migrateLocalItems` resumable pattern (flag-gated, per-item best-effort). Keeping the device copy as cache means zero visual gap and satisfies FR-008a immediately post-upgrade.

**Alternatives considered**:
- Delete device copy after upload — rejected: would force a re-download for the premium cache and risk an offline gap right after upgrade.
- Migrate lazily on next view of each item — rejected: leaves items unbacked-up indefinitely; weaker guarantee than FR-011.

---

## D8. Upload failure handling & no-rollback reality

**Decision**: Premium add is local-first: write the optimized device copy + insert the `clothing_items` row immediately (item usable at once, photo shown from device), then upload to cloud asynchronously. On upload failure, the item stays `photo_storage='local'` with a pending flag; a retry runs on reconnect (reuse `NetInfo` already wired in `appStore.hydrate`) and on next app start. Only after a confirmed upload does the row flip to `'cloud'`.

**Rationale**: Honors Constitution V (local-first, async sync, no rollback) and FR-012. The discriminator doubling as the durable retry queue means a crash mid-upload self-heals (anything still `'local'` for a premium user is a migration/retry candidate — the same code path as D7).

**Alternatives considered**:
- Block the add until cloud upload succeeds — rejected: violates local-first responsiveness and fails offline adds.
- Separate pending-upload table — rejected: the `photo_storage='local'` + premium-tier condition already encodes the queue.

---

## D9. Deletion & orphan cleanup

**Decision**: Deleting an item removes its device copy (if any) and its cloud object (if `photo_storage='cloud'`, via `storage.remove([path])`) before/after the row delete, best-effort. Replacing a photo deletes the prior device copy and prior cloud object, then writes the new one. (FR-013, FR-014, SC-007).

**Rationale**: Prevents orphaned storage on both tiers; mirrors the existing post-DB-error storage cleanup already in `addItem`.

**Alternatives considered**:
- Periodic reconciliation sweep — rejected for MVP: eager cleanup at mutation time is simpler and sufficient; a sweep can be added later if SC-007 audits find drift.

---

## D10. expo-file-system EncodingType note

**Observation**: `wardrobeService` and `profileService` use `FileSystem.EncodingType.Base64`, which the installed `expo-file-system` ~19 typing flags as missing (pre-existing `tsc` errors). 

**Decision**: Align the new `itemPhotoService` with whatever the working runtime API is in SDK 19 (e.g., the `File`/`Paths` API or `readAsStringAsync` with the correct encoding constant), and fix the encoding reference consistently. Treat as an implementation-phase detail; not a design fork. Flagged here so `/speckit-tasks` includes a "verify file read/write API on SDK 19" task.

---

## Summary of resolved unknowns

| Topic | Resolution |
|-------|-----------|
| Tier routing | Store passes explicit `tier` to stateless service (D1) |
| Cloud privacy | Existing private bucket + signed URLs; fix `getPublicUrl` drift (D2) |
| Rendering | Unified resolve-to-local-file hook + placeholder (D3) |
| Local path format | Relative path under `documentDirectory/wardrobe-photos/` (D4) |
| Local/cloud marker | `photo_storage` discriminator column (D5) |
| Optimization | ≤1600 px / ~0.7 JPEG via expo-image-manipulator (D6) |
| Upgrade migration | Idempotent, resumable, device copy retained as cache (D7) |
| Failure/no-rollback | Local-first + retry queue encoded by discriminator (D8) |
| Cleanup | Eager device + cloud removal on delete/replace (D9) |
| File API | Align/fix EncodingType for SDK 19 (D10) |

**No NEEDS CLARIFICATION remain.** Ready for Phase 1.
