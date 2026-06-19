# Data Model: MIEN — Product Features Phase

**Branch**: `002-product-features` | **Date**: 2026-06-08
**Extends**: `specs/001-app-baseline/data-model.md`

This document covers all **new and updated** entities. Unchanged entities from phase 1
(`public.wardrobes`, `public.collections`, `public.collection_items`) are not repeated.

---

## Updated Entity Relationship Diagram

```
auth.users
    │
    ├──1:1── public.profiles              [UPDATED: display_name, avatar, color_season]
    ├──1:1── public.body_measurements     [UPDATED: full 15 fields, body_shape]
    ├──1:1── public.style_profiles        [UPDATED: active_formula_id]
    ├──1:1── public.wardrobes
    │             └──1:N── public.clothing_items  [UPDATED: name, material, pattern, ...]
    │
    ├──1:N── public.collections ──N:M── collection_items
    ├──1:N── public.outfit_interactions   [NEW: saved/worn/scheduled]
    ├──1:N── public.usage_credits         [NEW: scan credit tracking]
    └──N:M── public.styles (catalog)      [NEW: server-driven]
                                          [NEW: public.formulas catalog]
```

---

## Updated Entity: `public.profiles`

**Changes from phase 1**: Add `display_name`, `avatar_url`, `avatar_path`,
`color_season`, `personal_palette`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, FK → `auth.users.id` ON DELETE CASCADE | (unchanged) |
| `phone` | `text` | nullable | (unchanged) |
| `email` | `text` | nullable | (unchanged) |
| `display_name` | `text` | nullable | **NEW** — user-editable non-unique name |
| `avatar_url` | `text` | nullable | **NEW** — signed URL (refreshed on load) |
| `avatar_path` | `text` | nullable | **NEW** — Storage path `avatars/{userId}.jpg` |
| `gender` | `text` | CHECK | (unchanged) |
| `dob` | `date` | nullable | (unchanged) |
| `location_city` | `text` | nullable | (unchanged) |
| `location_country` | `text` | nullable | (unchanged) |
| `skin_undertone` | `text` | nullable | **POPULATED NOW** — `warm` / `cool` / `neutral` |
| `color_season` | `text` | nullable | **NEW** — `spring` / `summer` / `autumn` / `winter` |
| `personal_palette` | `text[]` | NOT NULL DEFAULT '{}' | **NEW** — named color strings from season result |
| `onboarding_complete` | `boolean` | NOT NULL DEFAULT false | (unchanged) |
| `created_at` | `timestamptz` | DEFAULT now() | (unchanged) |
| `updated_at` | `timestamptz` | DEFAULT now() | (unchanged) |

**New Storage bucket**: `avatars` (private, 5 MB limit, jpeg/png/webp).
Path: `avatars/{userId}.jpg`.

---

## Updated Entity: `public.body_measurements`

**Changes from phase 1**: Expand from 5 fields to the canonical 15-field set (Q7).
Add `body_shape` and `pose_estimated` flag.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | (unchanged) |
| `user_id` | `uuid` | FK, UNIQUE | (unchanged) |
| `body_height` | `numeric` | nullable | cm (unchanged) |
| `body_weight` | `numeric` | nullable | kg (unchanged) |
| `bust` | `numeric` | nullable | **RENAMED** from `chest`, cm |
| `waist` | `numeric` | nullable | cm (unchanged) |
| `hip` | `numeric` | nullable | cm (unchanged) |
| `inseam` | `numeric` | nullable | **NEW** — cm |
| `thigh` | `numeric` | nullable | **NEW** — cm |
| `rise` | `numeric` | nullable | **NEW** — cm (crotch seam to waistband) |
| `shoulder_width` | `numeric` | nullable | **NEW** — cm |
| `sleeve_length` | `numeric` | nullable | **NEW** — cm |
| `upper_body_length` | `numeric` | nullable | **NEW** — cm (shoulder to waist) |
| `upper_arm` | `numeric` | nullable | **NEW** — cm (bicep circumference) |
| `neck` | `numeric` | nullable | **NEW** — cm |
| `foot_length` | `numeric` | nullable | **NEW** — cm |
| `foot_width` | `numeric` | nullable | **NEW** — cm |
| `preferred_fit` | `text` | nullable | `slim` / `regular` / `relaxed` (unchanged) |
| `body_shape` | `text` | nullable | **NEW** — `hourglass` / `rectangle` / `triangle` / `inverted_triangle` / `apple`; user-overridable |
| `pose_estimated` | `boolean` | NOT NULL DEFAULT false | **NEW** — true if camera auto-fill was used |
| `measurements_consent` | `boolean` | NOT NULL DEFAULT false | **NEW** — explicit consent recorded |
| `created_at` | `timestamptz` | DEFAULT now() | (unchanged) |
| `updated_at` | `timestamptz` | DEFAULT now() | (unchanged) |

---

## Updated Entity: `public.clothing_items`

**Changes from phase 1**: Add `name`, `material`, `pattern`, `warmth_season`,
`additional_colors`, expand `category` CHECK.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | (unchanged) |
| `user_id` | `uuid` | NOT NULL | (unchanged; `wardrobe_id` variant per drift fix) |
| `photo_url` | `text` | nullable | (unchanged) |
| `photo_path` | `text` | nullable | (unchanged) |
| `category` | `text` | NOT NULL CHECK | **EXPANDED**: `top`/`bottom`/`outerwear`/`footwear`/`accessory`/`dress`/`headwear` |
| `name` | `text` | nullable | **NEW** — user-given item name |
| `primary_color` | `text` | NOT NULL DEFAULT '' | **NEW** — primary named color string |
| `colors` | `text[]` | NOT NULL DEFAULT '{}' | Additional colors (renamed semantics) |
| `material` | `text` | nullable | **NEW** — e.g., `Cotton`, `Linen` |
| `pattern` | `text` | nullable | **NEW** — e.g., `Solid`, `Striped`, `Plaid` |
| `warmth_season` | `text[]` | NOT NULL DEFAULT '{}' | **NEW** — `spring`/`summer`/`autumn`/`winter` |
| `size_label` | `text` | nullable | (unchanged) |
| `brand` | `text` | nullable | (unchanged) |
| `notes` | `text` | nullable | (unchanged) |
| `created_at` | `timestamptz` | DEFAULT now() | (unchanged) |
| `updated_at` | `timestamptz` | DEFAULT now() | (unchanged) |

---

## Updated Entity: `public.style_profiles`

**Changes from phase 1**: Add `active_formula_id`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| *(all existing columns unchanged)* | | | |
| `active_formula_id` | `uuid` | nullable, FK → `public.formulas.id` | **NEW** — global formula default |

---

## New Entity: `public.styles` (catalog)

Server-driven. READ-ONLY for clients. Admin-managed via Supabase dashboard.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `slug` | `text` | UNIQUE NOT NULL | e.g., `minimalist`, `streetwear` |
| `name` | `text` | NOT NULL | Display name, localizable |
| `name_vi` | `text` | nullable | Vietnamese display name |
| `description` | `text` | NOT NULL DEFAULT '' | One-liner for the style quiz |
| `related_slugs` | `text[]` | NOT NULL DEFAULT '{}' | Curated related styles |
| `display_order` | `int` | NOT NULL DEFAULT 0 | |
| `is_active` | `boolean` | NOT NULL DEFAULT true | Hide without deletion |
| `created_at` | `timestamptz` | DEFAULT now() | |

**RLS**: SELECT for authenticated users. No INSERT/UPDATE/DELETE for app users.

---

## New Entity: `public.formulas` (catalog)

Same pattern as `public.styles`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `slug` | `text` | UNIQUE NOT NULL | e.g., `color_harmony`, `rule_of_thirds` |
| `name` | `text` | NOT NULL | e.g., `Color Harmony` |
| `name_vi` | `text` | nullable | Vietnamese name |
| `description` | `text` | NOT NULL | One-line plain-language explanation |
| `display_order` | `int` | NOT NULL DEFAULT 0 | |
| `is_active` | `boolean` | NOT NULL DEFAULT true | |
| `created_at` | `timestamptz` | DEFAULT now() | |

---

## New Entity: `public.outfit_interactions`

Replaces AsyncStorage-only persistence for saved/worn/scheduled outfits.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users.id` ON DELETE CASCADE | |
| `outfit_id` | `text` | NOT NULL | Generated outfit hash or demo ID |
| `outfit_data` | `jsonb` | NOT NULL | Full snapshot: `{ itemIds, tags, style, title, ... }` |
| `type` | `text` | NOT NULL CHECK `IN ('saved','worn','scheduled')` | |
| `interacted_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `scheduled_for` | `date` | nullable | Only when type = `scheduled` |
| `worn_at` | `date` | nullable | Date outfit was marked worn |
| UNIQUE | | `(user_id, outfit_id, type)` | No duplicate interactions |

**RLS**: SELECT / INSERT / UPDATE / DELETE scoped to `auth.uid() = user_id`.

**Cooldown query** (sent to fit engine as exclusion list):
```sql
SELECT outfit_id FROM outfit_interactions
WHERE user_id = auth.uid()
  AND type = 'worn'
  AND worn_at >= CURRENT_DATE - INTERVAL '7 days';
```

---

## New Entity: `public.usage_credits`

Tracks monthly scan credits per user. One row per user per credit type per period.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users.id` ON DELETE CASCADE | |
| `credit_type` | `text` | NOT NULL CHECK `IN ('worn_outfit_scan')` | Extensible |
| `used` | `int` | NOT NULL DEFAULT 0 | Incremented on each scan |
| `free_limit` | `int` | NOT NULL DEFAULT 2 | Free tier monthly allowance |
| `period_start` | `date` | NOT NULL | First day of calendar month |
| UNIQUE | | `(user_id, credit_type, period_start)` | One row per month |

**RLS**: SELECT / INSERT / UPDATE scoped to `auth.uid() = user_id`.

**Credit check logic** (in `usageCreditService.ts`):
1. Look up row for `(userId, 'worn_outfit_scan', first_day_of_current_month)`.
2. If `used >= free_limit` AND user is not premium → reject with `InsufficientCreditsError`.
3. Increment `used` atomically using `UPDATE ... SET used = used + 1 ... RETURNING used`.

---

## TypeScript Domain Type Updates

```typescript
// src/types/profile.ts (NEW)
interface UserProfile {
  id: string
  phone: string | null
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  avatarPath: string | null
  gender: string | null
  dob: string | null            // ISO date
  locationCity: string | null
  locationCountry: string | null
  skinUndertone: 'warm' | 'cool' | 'neutral' | null
  colorSeason: 'spring' | 'summer' | 'autumn' | 'winter' | null
  personalPalette: string[]     // named color strings
  onboardingComplete: boolean
}

// src/types/measurements.ts (NEW — replaces inline in fitEngine.ts)
interface BodyMeasurements {
  userId: string
  bodyHeight: number | null     // cm
  bodyWeight: number | null     // kg
  bust: number | null           // cm
  waist: number | null          // cm
  hip: number | null            // cm
  inseam: number | null
  thigh: number | null
  rise: number | null
  shoulderWidth: number | null
  sleeveLength: number | null
  upperBodyLength: number | null
  upperArm: number | null
  neck: number | null
  footLength: number | null
  footWidth: number | null
  preferredFit: 'slim' | 'regular' | 'relaxed' | null
  bodyShape: 'hourglass' | 'rectangle' | 'triangle' | 'inverted_triangle' | 'apple' | null
  poseEstimated: boolean
  measurementsConsent: boolean
}

// src/types/intent.ts (NEW — IntentContext scaffold)
interface IntentContext {
  rawPrompt: string
  occasion?: string
  mood?: string
  style?: string
  excludeItemIds?: string[]
  swapCategory?: string
  turnCount: number
}

// src/types/outfit.ts (NEW)
interface OutfitInteraction {
  id: string
  outfitId: string
  outfitData: Record<string, unknown>   // snapshot
  type: 'saved' | 'worn' | 'scheduled'
  interactedAt: string
  scheduledFor?: string   // ISO date
  wornAt?: string         // ISO date
}
```

---

## Storage Buckets — Summary (all buckets)

| Bucket | Access | Path | Limit |
|--------|--------|------|-------|
| `wardrobe-photos` | Private | `{userId}/{itemId}.jpg` | 10 MB |
| `wardrobe-photos` (raw) | Private | `{userId}/raw/{uploadId}.jpg` | 20 MB (temp) |
| `avatars` | Private | `{userId}.jpg` | 5 MB |

---

## Migration Files Required

| File | Contents |
|------|----------|
| `20260608000001_profiles_v2.sql` | ADD COLUMN `display_name`, `avatar_url`, `avatar_path`, `color_season`, `personal_palette` to `profiles` |
| `20260608000002_measurements_v2.sql` | ADD 10 new measurement columns + `body_shape`, `pose_estimated`, `measurements_consent`; RENAME `chest` → `bust` |
| `20260608000003_clothing_items_v2.sql` | ADD `name`, `primary_color`, `material`, `pattern`, `warmth_season`; ALTER CHECK on `category` to include `dress` and `headwear` |
| `20260608000004_style_profiles_v2.sql` | ADD `active_formula_id` FK to `style_profiles` |
| `20260608000005_catalog_tables.sql` | CREATE `public.styles`, `public.formulas` with seed data |
| `20260608000006_outfit_interactions.sql` | CREATE `public.outfit_interactions` |
| `20260608000007_usage_credits.sql` | CREATE `public.usage_credits` |
| `20260608000008_storage_avatars.sql` | CREATE `avatars` bucket + RLS policies |
