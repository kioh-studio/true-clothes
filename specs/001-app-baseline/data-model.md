# Data Model: MIEN App — Current State Baseline

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

---

## New Entity: `public.collections` (added 2026-06-07)

Collections group wardrobe items — not outfits. A collection is a named, user-curated
set of clothing items (e.g. "Workweek picks", "Travel capsule"). An item can belong
to multiple collections (many-to-many via `collection_items` join table).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → `auth.users.id` ON DELETE CASCADE, NOT NULL | Owner |
| `name` | `text` | NOT NULL | Human label, no uniqueness constraint |
| `description` | `text` | NOT NULL DEFAULT '' | Optional longer description |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() | Auto-maintained by trigger |

**RLS**:
- SELECT / INSERT / UPDATE / DELETE scoped to `auth.uid() = user_id`.

**Trigger**: `collections_updated_at` — `BEFORE UPDATE FOR EACH ROW` calls
`public.handle_updated_at()` to maintain `updated_at`.

**Indexes**: `collections_user_id_idx ON public.collections (user_id)`.

**Constraints**:
- No max collections per user.
- No minimum items per collection.
- Name is not unique — users can have two collections with the same name.

---

## New Entity: `public.collection_items` (join table, added 2026-06-07)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `collection_id` | `uuid` | FK → `public.collections.id` ON DELETE CASCADE, NOT NULL | |
| `item_id` | `uuid` | FK → `public.clothing_items.id` ON DELETE CASCADE, NOT NULL | |
| `added_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| PRIMARY KEY | — | `(collection_id, item_id)` | Item appears at most once per collection |

**RLS**: All operations gated on parent collection ownership:
- SELECT: `EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_id AND c.user_id = auth.uid())`
- INSERT: same `EXISTS` check (with check)
- DELETE: same `EXISTS` check

**Index**: `collection_items_item_id_idx ON public.collection_items (item_id)` — for
"which collections does this item belong to?" lookups.

**Cascade behaviour**: Deleting a collection removes all its `collection_items` rows.
Deleting a wardrobe item removes all `collection_items` rows that reference it.

---

## TypeScript Domain Types — Collections (client-side)

```typescript
// In src/data/index.ts (existing, updated 2026-06-07)
interface Collection {
  id: string
  name: string
  description: string
  createdDate: string      // Display label e.g. "CREATED MAY 2026"
  itemIds: string[]        // Wardrobe item IDs — may be static demo IDs OR Supabase UUIDs
}

// Internal DB row in collectionsService.ts — never exported
interface CollectionRow {
  id: string
  name: string
  description: string | null
  created_at: string
  collection_items: { item_id: string }[] | null
}

// Display helper output — returned by resolveItemIds() in src/data/index.ts
interface CollectionDisplayItem {
  id: string
  name: string
  categoryLabel: string    // Normalised: "TEE", "TOP", "JEANS", etc.
  imageSource: number | { uri: string } | null  // number = local require(), uri = remote URL
}
```

**Two-pass item resolution** (see Research Decision 6):
```
resolveItemIds(ids: string[], wardrobeItems: WardrobeItem[]): CollectionDisplayItem[]

  For each id:
    1. Try itemById(id) from ITEMS static data → map to CollectionDisplayItem
    2. Else try wardrobeItems.find(i => i.id === id) → map to CollectionDisplayItem
    3. Else return null (item deleted or not yet loaded)
```

---

## Updated Entity Relationship Diagram

```
auth.users (Supabase managed)
    │
    ├──1:1── public.profiles
    ├──1:1── public.body_measurements
    ├──1:1── public.style_profiles
    ├──1:1── public.wardrobes                    (live schema — see Decision 7)
    │             │
    │             └──1:N── public.clothing_items (wardrobe_id FK)
    │                           │       │
    │                           │       └── storage: wardrobe-photos/{userId}/{id}.jpg
    │                           │
    └──1:N── public.collections │
                  │             │
                  └──N:M──────── public.collection_items
                                (collection_id, item_id — join table)
```

**Schema drift note** (see Research Decision 7): The migration files T001–T003
originally used `clothing_items.user_id` directly. The live DB uses `wardrobes` +
`clothing_items.wardrobe_id`. A corrective migration (`20260607000003_fix_schema_drift.sql`)
documents the correct schema for `supabase db reset` correctness without modifying
any existing rows.
