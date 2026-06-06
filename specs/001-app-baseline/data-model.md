# Data Model: True Clothes App — Current State Baseline

**Branch**: `001-app-baseline` | **Date**: 2026-06-06

This document describes the complete entity model — both existing tables (already in
production) and the new `clothing_items` table and `wardrobe-photos` storage bucket
being formally defined in this phase.

---

## Entity Relationship Overview

```
auth.users (Supabase managed)
    │
    ├──1:1── public.profiles          (identity, location, onboarding state)
    ├──1:1── public.body_measurements (private measurements)
    ├──1:1── public.style_profiles    (style tags, colour tones, formulas)
    └──1:N── public.clothing_items    (wardrobe — NEW this phase)
                  │
                  └── storage: wardrobe-photos/{userId}/{itemId}.jpg
```

All tables use `auth.uid()` row-level security. No cross-user reads are permitted.

---

## Existing Entities (already deployed — migration files being created)

### `public.profiles`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, FK → `auth.users.id` ON DELETE CASCADE | Matches auth user ID |
| `phone` | `text` | nullable | E.164 format (e.g., `+84977123456`) |
| `email` | `text` | nullable | |
| `gender` | `text` | CHECK IN ('male','female','other','prefer_not_to_say') | |
| `dob` | `date` | nullable | ISO date `YYYY-MM-DD` |
| `location_city` | `text` | nullable | |
| `location_country` | `text` | nullable | |
| `skin_undertone` | `text` | nullable | For future colour matching |
| `onboarding_complete` | `boolean` | NOT NULL DEFAULT false | Gate for main app access |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `updated_at` | `timestamptz` | DEFAULT now() | Auto-updated by trigger |

**RLS**: SELECT / INSERT / UPDATE scoped to `auth.uid() = id`.

**Trigger**: `updated_at` maintained by `moddatetime` extension trigger.

**Auto-create trigger**: Row inserted automatically on `auth.users` INSERT via
`handle_new_user()` trigger.

---

### `public.body_measurements`

Treated as sensitive/private — stored in a separate table from `profiles`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → `auth.users.id` ON DELETE CASCADE, UNIQUE | One row per user |
| `body_height` | `numeric` | nullable | Centimetres |
| `body_weight` | `numeric` | nullable | Kilograms |
| `chest` | `numeric` | nullable | Centimetres |
| `waist` | `numeric` | nullable | Centimetres |
| `hip` | `numeric` | nullable | Centimetres |
| `preferred_fit` | `text` | nullable | `"slim"` / `"regular"` / `"relaxed"` |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `updated_at` | `timestamptz` | DEFAULT now() | |

**RLS**: SELECT / INSERT / UPDATE / DELETE scoped to `auth.uid() = user_id`.

**Unit invariant**: All values stored in metric (cm, kg). Imperial conversion is a
UI-layer concern only (enforced by Constitution Principle IV).

---

### `public.style_profiles`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → `auth.users.id` ON DELETE CASCADE, UNIQUE | One row per user |
| `selected_styles` | `text[]` | NOT NULL DEFAULT '{}' | Style tag names (e.g., `"minimalist"`) |
| `color_preferences` | `text[]` | NOT NULL DEFAULT '{}' | Named colour tones (e.g., `"Navy"`) |
| `formula_preferences` | `text[]` | NOT NULL DEFAULT '{}' | Outfit formula names |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `updated_at` | `timestamptz` | DEFAULT now() | |

**RLS**: SELECT / INSERT / UPDATE / DELETE scoped to `auth.uid() = user_id`.

**Colour invariant**: Values in `color_preferences` MUST be named strings, never hex.
Hex lookup happens at render time via `src/design/tokens.ts`.

---

## New Entity: `public.clothing_items`

The critical missing piece. This table is queried by the `generate-outfits` Edge
Function but has never been formally defined as a migration. Without it (and data
in it), the fit engine always generates from an empty wardrobe.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → `auth.users.id` ON DELETE CASCADE, NOT NULL | |
| `photo_url` | `text` | nullable | Supabase Storage public URL |
| `photo_path` | `text` | nullable | Storage path for deletion (`{userId}/{id}.jpg`) |
| `category` | `text` | NOT NULL | `top` / `bottom` / `outerwear` / `footwear` / `accessory` |
| `colors` | `text[]` | NOT NULL DEFAULT '{}' | Named colour strings (e.g., `"Navy"`, `"Cream"`) |
| `size_label` | `text` | nullable | Free text (e.g., `"M"`, `"32/32"`) |
| `brand` | `text` | nullable | |
| `notes` | `text` | nullable | |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `updated_at` | `timestamptz` | DEFAULT now() | |

**RLS**:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

**Category enum** (enforced via CHECK constraint):
```
CHECK (category IN ('top', 'bottom', 'outerwear', 'footwear', 'accessory'))
```

**Colour invariant**: `colors` values MUST be named strings. Same constraint as
`style_profiles.color_preferences`.

**Indexes**:
- `(user_id)` — primary lookup pattern
- `(user_id, category)` — wardrobe grid filter by category

---

## Storage: `wardrobe-photos` Bucket

| Property | Value |
|----------|-------|
| Bucket name | `wardrobe-photos` |
| Access | Private (requires auth) |
| Path pattern | `{userId}/{itemId}.jpg` |
| Max file size | 10 MB per upload |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp` |

**RLS policies**:
- SELECT (download): `auth.uid()::text = (storage.foldername(name))[1]`
- INSERT (upload): `auth.uid()::text = (storage.foldername(name))[1]`
- DELETE: `auth.uid()::text = (storage.foldername(name))[1]`

**Public URL**: Items use `supabase.storage.from('wardrobe-photos').getPublicUrl(path)`
only if bucket is set to public. Otherwise use signed URLs (preferred for private data).

**Decision**: Use signed URLs with a 1-hour expiry for photo display. Regenerated on
each feed/wardrobe load. This protects user wardrobe photos from being accessible without
authentication.

---

## TypeScript Domain Types (client-side)

These are the canonical shapes used in Zustand stores and across screens.
All snake_case ↔ camelCase conversion lives inside `wardrobeService.ts`.

```typescript
// Already in src/types/fitEngine.ts (existing)
interface ClothingItem {
  id: string
  userId: string
  photoUrl: string | null
  category: 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory'
  colors: string[]          // named colour strings, never hex
  sizeLabel: string | null
  brand: string | null
  notes: string | null
  createdAt: string         // ISO timestamp
}

// New internal type in wardrobeService.ts — never exported
interface ClothingItemRow {
  id: string
  user_id: string
  photo_url: string | null
  photo_path: string | null
  category: string
  colors: string[]
  size_label: string | null
  brand: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// New in src/types/weather.ts
interface WeatherContext {
  temperatureCelsius: number
  weatherCode: number       // WMO weather code
  fetchedAt: string         // ISO timestamp — for 30-min TTL check
  locationCity: string | null
}
```

---

## State Transitions: Wardrobe Item Lifecycle

```
[User selects photo] → [wardrobeService.addItem()]
      │
      ├── Upload photo to Storage: wardrobe-photos/{userId}/{tempId}.jpg
      │       ↓ success
      ├── Insert row to clothing_items (with photo_url, photo_path)
      │       ↓ success
      └── Update appStore.wardrobeItems (add item with remote ID)
              ↓
          [Item visible in wardrobe grid + available to fit engine]

[User deletes item] → [wardrobeService.deleteItem(id)]
      │
      ├── Delete from clothing_items
      ├── Delete from Storage: wardrobe-photos/{userId}/{id}.jpg
      └── Update appStore.wardrobeItems (remove item)
```

**Error handling**:
- If Storage upload fails → do not insert DB row, show error toast, do not update local state.
- If DB insert fails after Storage upload → attempt Storage cleanup, show error toast.
- If Storage cleanup also fails → log orphaned path for manual cleanup (acceptable in MVP).

---

## Data Migration: Existing Local Items

Users who added wardrobe items before this release have items in AsyncStorage only.
On first boot after the update:

1. `appStore.hydrate()` checks if `wardrobeItems` exist in AsyncStorage.
2. If items exist and user is authenticated, trigger a one-time migration:
   `wardrobeService.migrateLocalItems(localItems)` — uploads each to Supabase in sequence.
3. Local items without a remote photo (only a local URI) are uploaded as-is.
4. After successful migration, clear AsyncStorage wardrobe and use Supabase as source of
   truth going forward.
5. Migration flag `wardrobeMigrated: boolean` persisted in AsyncStorage to prevent
   re-running.

**Trade-off**: Migration is sequential to avoid hammering Storage. For a user with
50 items this could take ~30 s on slow connections. A progress indicator should be
shown during migration.
