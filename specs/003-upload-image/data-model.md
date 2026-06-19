# Phase 1 Data Model: Wardrobe Item Image Upload & Storage

**Feature**: `004-upload-image` | **Date**: 2026-06-14

This feature adds a storage discriminator to the existing wardrobe item, plus device/cloud storage locations. It introduces no new top-level entity — the "Item Photo" and "Storage Tier" concepts from the spec are modeled as attributes/derived values on the existing `WardrobeItem` / `clothing_items`.

---

## Entity: WardrobeItem (extended)

Domain type in `src/types/fitEngine.ts`. New/changed fields in **bold**.

| Field | Type | Persistence | Notes |
|-------|------|-------------|-------|
| `id` | `string` (uuid) | DB `id` | Unchanged |
| `userId` | `string` | derived | Unchanged |
| **`photoStorage`** | `'local' \| 'cloud' \| 'none'` | DB `photo_storage` | Discriminator (D5). `'none'` = no photo |
| `photoUrl` | `string \| null` | in-memory only | Resolved **signed** URL (premium) — never persisted as the public URL |
| **`photoLocalUri`** | `string \| null` | in-memory only | Resolved absolute device `file://` uri for rendering |
| `photoPath` | `string \| null` | DB `photo_url` | Holds relative device path (local) **or** storage path `{userId}/{itemId}.jpg` (cloud) |
| `category` | `WardrobeItem['category']` | derived from `type` | Unchanged |
| `colors`, `sizeLabel`, `brand`, `name`, … | — | DB | Unchanged metadata |
| `createdAt` | `string` (ISO) | DB `added_at` | Unchanged |

**Validation rules**
- Exactly one photo per item (`photoStorage` is single-valued).
- `photoStorage='cloud'` ⇒ `photoPath` matches `{userId}/{itemId}.jpg` and the object is private (RLS-scoped).
- `photoStorage='local'` ⇒ `photoPath` is a **relative** path under `wardrobe-photos/` (no `file://`, no leading slash).
- `photoStorage='none'` ⇒ `photoPath` is null; UI renders placeholder.
- Optimized photo only: long edge ≤ ~1600 px, JPEG, target ~200–500 KB (FR-006/SC-009).

**State transitions** (`photoStorage`)

```text
none ──add photo (free)──────────────► local
none ──add photo (premium, uploaded)─► cloud
none ──add photo (premium, offline)──► local (pending) ──upload retry──► cloud
local ──free→premium upgrade migrate─► cloud         (device copy kept as cache)
local ──premium add, upload failed───► local (pending) ──retry on reconnect──► cloud
any  ──replace photo─────────────────► (old object/file removed) → local|cloud per current tier
any  ──delete item───────────────────► (removed)   (device + cloud objects cleaned up)
cloud ──downgrade premium→free───────► cloud        (retained read-only; new photos go local)
```

A premium user's item that is still `local` is, by definition, a pending upload / migration candidate — the same condition drives both the retry queue (D8) and upgrade migration (D7).

---

## Derived concept: Storage Tier

Not persisted on the item. Derived at action time from premium status:

| Source | Value |
|--------|-------|
| `usePremium().isPremium` → mirrored to `fitEngineStore.premium` | `premium ? 'premium' : 'free'` |

Passed explicitly into `addWardrobeItem(input, tier)` and the migration trigger. Governs the destination of **new** uploads only; existing items relocate solely via explicit upgrade migration (D7).

---

## Database change: `clothing_items`

New migration: `supabase/migrations/2026XXXX_clothing_items_photo_storage.sql`

```sql
alter table public.clothing_items
  add column if not exists photo_storage text not null default 'none'
    check (photo_storage in ('none', 'local', 'cloud'));

-- Backfill: existing rows with a photo_url were uploaded to the cloud bucket.
update public.clothing_items
  set photo_storage = 'cloud'
  where photo_url is not null and photo_storage = 'none';
```

- `photo_url` column is **reused** (no rename) to avoid touching existing reads; its meaning is now disambiguated by `photo_storage`.
- No RLS change on `clothing_items` (existing wardrobe-scoped policies apply).
- **Schema-drift guard**: verify the live `clothing_items` shape and the `wardrobe-photos` bucket privacy/RLS against the migrations before applying (project has known drift). Add corrective migrations if the live DB differs.

---

## Storage layout

| Tier | Location | Key/Path | Lifetime |
|------|----------|----------|----------|
| Device copy (free) | `FileSystem.documentDirectory` | `wardrobe-photos/{itemId}.jpg` | Until item deleted / app data cleared |
| Device cache (premium) | `FileSystem.documentDirectory` | `wardrobe-photos/{itemId}.jpg` | Best-effort cache; re-downloadable from cloud |
| Cloud object (premium) | Supabase bucket `wardrobe-photos` (private) | `{userId}/{itemId}.jpg` | Source of truth until item deleted |

Demo/seed items (`src/config/demo.ts`, `ITEMS`) keep using bundled `png` require-assets and bypass this layout entirely.

---

## Relationships

- `WardrobeItem 1 ──has 0..1── ItemPhoto` (photo is an attribute set, not a separate row).
- `ItemPhoto` lives in exactly one of {device, cloud(+device cache)} per `photoStorage`.
- Deleting the item cascades to removing both device and cloud copies (FR-014).
