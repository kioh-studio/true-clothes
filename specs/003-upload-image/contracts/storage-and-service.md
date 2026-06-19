# Contract: Item Photo Storage & Service Interfaces

**Feature**: `004-upload-image` | **Date**: 2026-06-14

This mobile app exposes no public network API. The "contracts" that downstream code (screens, stores, tests) depends on are: the **service interfaces**, the **storage path conventions**, the **signed-URL behavior**, and the **DB column contract**. All Supabase access stays behind these services (Constitution III).

---

## 1. `itemPhotoService` (NEW) — device + cloud photo mechanics

```ts
// src/services/itemPhotoService.ts
export type PhotoStorageKind = 'none' | 'local' | 'cloud';

/** Resize+compress a picked image to the storage standard (≤~1600px long edge, ~0.7 JPEG). */
export function optimizeImage(localUri: string): Promise<{ uri: string; width: number; height: number }>;

/** Write an optimized file into the stable device dir. Returns the RELATIVE path (no file://). */
export function writeDeviceCopy(itemId: string, optimizedUri: string): Promise<string /* relativePath */>;

/** Absolute device uri for a relative path, or null if the file is absent. */
export function resolveDeviceUri(relativePath: string): Promise<string | null>;

/** Upload an optimized file to the private bucket. Returns the storage path {userId}/{itemId}.jpg. */
export function uploadCloudCopy(userId: string, itemId: string, optimizedUri: string): Promise<string /* storagePath */>;

/** Download a cloud object into the device cache (premium offline/instant). Returns absolute uri. */
export function ensureCloudCached(storagePath: string): Promise<string>;

/** Short-lived signed URL for a private object (default ~3600s). */
export function signedUrl(storagePath: string, expiresInSec?: number): Promise<string>;

/** Remove device copy and/or cloud object. Best-effort; never throws on missing. */
export function removePhoto(args: { relativePath?: string | null; storagePath?: string | null }): Promise<void>;
```

**Guarantees**
- `optimizeImage` output satisfies SC-009 (≤~1600 px, ~200–500 KB target).
- `writeDeviceCopy`/`resolveDeviceUri` operate under `documentDirectory + 'wardrobe-photos/'`; relative paths only (D4).
- `uploadCloudCopy` writes to private bucket path `{userId}/{itemId}.jpg`; RLS enforces owner-only (FR-016).
- `signedUrl` never returns a public or non-expiring URL (SC-008).
- `removePhoto` is idempotent (safe to call on already-removed assets) — supports eager cleanup (D9).

---

## 2. `wardrobeService` (MODIFIED) — tier-aware item lifecycle

```ts
export interface AddItemInput { /* …existing fields… */ localPhotoUri: string | null; }

/** Tier decides storage. Local-first: device copy + row written before cloud upload. */
export function addItem(input: AddItemInput, tier: 'free' | 'premium'): Promise<WardrobeItem>;

/** Replace an item's photo (removes prior device/cloud copy, then stores new per current tier). */
export function replaceItemPhoto(id: string, localPhotoUri: string, tier: 'free' | 'premium'): Promise<WardrobeItem>;

/** Delete item AND its device/cloud photo (FR-014). */
export function deleteItem(id: string): Promise<void>;

/** Items whose photo is still local for a premium user = pending upload / migration candidates. */
export function listPendingCloudUploads(): Promise<WardrobeItem[]>;

/** Upload one pending item's local copy to cloud and flip photo_storage→'cloud'. Idempotent. */
export function promoteToCloud(id: string): Promise<WardrobeItem>;
```

**Behavioral contract**
- `addItem(_, 'free')` ⇒ writes device copy, inserts row with `photo_storage='local'`, **no** cloud call; returns item rendering from device. (FR-003, FR-007)
- `addItem(_, 'premium')` ⇒ writes device copy + row immediately (`'local'` pending), uploads async; on success flips to `'cloud'`. Offline ⇒ stays pending, retried later. (FR-004, FR-008a, FR-012)
- `fetchMyItems()` ⇒ returns items with `photoStorage` set; **does not** eagerly sign every URL (resolution is lazy via the hook, D3).
- All snake_case↔camelCase mapping stays internal (Principle III/IV). No `getPublicUrl` usage remains.

---

## 3. `useItemPhoto` (NEW hook) — unified rendering contract

```ts
// src/features/wardrobe-photos/useItemPhoto.ts
export type PhotoStatus = 'ready' | 'loading' | 'missing';
export function useItemPhoto(item: Pick<WardrobeItem,'id'|'photoStorage'|'photoPath'> & { png?: number }):
  { uri: string | null; status: PhotoStatus };
```

**Resolution contract** (D3): bundled `png` → local file → cloud cache → fetch+download → `missing` placeholder. Never throws; never yields a broken-image state (FR-009). Premium repeat views resolve from cache without network (FR-008a).

---

## 4. Migration contract — `useUpgradePhotoMigration`

- Trigger: premium transitions false→true.
- For each `photoStorage='local'` item: `promoteToCloud(id)`.
- Idempotent + resumable: already-`cloud` items skipped; interruption resumes next premium launch (FR-011, US3-3).
- Photos remain visible throughout (device copy retained as cache). No user action required.

---

## 5. DB column contract (`clothing_items`)

| Column | Meaning by `photo_storage` |
|--------|----------------------------|
| `photo_storage` | `'none'` \| `'local'` \| `'cloud'` (default `'none'`) |
| `photo_url` | `none`→null · `local`→relative device path `wardrobe-photos/{itemId}.jpg` · `cloud`→storage path `{userId}/{itemId}.jpg` |

Consumers MUST read `photo_storage` to interpret `photo_url`; they MUST NOT infer kind from the string shape.

---

## 6. UI contract (FR-017 disclosure, placeholder)

- **Free add**: a non-blocking disclosure states the photo is stored on this device only and won't be available — nor usable by outfit suggestions — on other devices, with an upgrade-to-cloud-backup affordance. Saving is never blocked. (FR-017)
- **Placeholder**: token-styled (design system) placeholder shown for `missing`/`loading`; on item detail, offers re-add/replace. (FR-009, FR-010)
- All visuals conform to `src/design/tokens.ts` and are specified in `src/design/wardrobe-photos/design.md` (Constitution I).
