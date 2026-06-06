# Server — Database Definition

Supabase project: `true-clothes` (`trtjcsxcowqecsebvyme`, region: `ap-northeast-1`)

---

## Schema overview

All app tables live in the `public` schema, which is the only schema exposed through the Supabase Data API (PostgREST). Supabase-managed schemas (`auth`, `storage`) are never queried directly from the client — access goes through the Supabase SDK methods.

---

## Tables

### `public.profiles`

One row per user. Auto-created by the `on_auth_user_created` trigger when a new `auth.users` entry is inserted. Stores identity and onboarding state.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `full_name` | `varchar(100)` | yes | — | User's full name, collected during onboarding |
| `email` | `varchar(254)` | yes | — | RFC 5321 max length |
| `phone` | `varchar(20)` | yes | — | E.164 format, max 15 digits |
| `gender` | `gender` (enum) | yes | — | `WOMAN` / `MAN` / `NON-BINARY` / `PREFER NOT TO SAY` |
| `date_of_birth` | `date` | yes | — | Stored as ISO date; input is DD/MM/YYYY — convert before insert |
| `location_city` | `varchar(100)` | yes | — | User-confirmed home city (e.g. "Ho Chi Minh City") |
| `location_country` | `varchar(100)` | yes | — | User-confirmed country (e.g. "Vietnam") |
| `skin_undertone` | `varchar(10)` | yes | — | `'warm'` / `'cool'` / `'neutral'`. Optional. Collected via jewelry preference question ("Which looks better on you? Gold / Silver / Both"). Used by the engine to boost colors that complement the user's undertone |
| `onboarding_complete` | `boolean` | no | `false` | Flipped to `true` on the final onboarding step |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | Auto-updated by trigger |

**Location design decision:** only city and country are stored — no coordinates. Live GPS is resolved on the client via `expo-location` and sent directly to the weather API per request. Coordinates are never persisted (privacy, staleness).

---

### `public.body_measurements`

One row per user (`user_id` is unique). Kept as a separate table from `profiles` because this data is sensitive and may require stricter access control or encryption in the future.

All values stored in metric units (cm, kg). Unit conversion (IN → CM, LB → KG) is a client-side concern done before the API call.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | no | PK, `gen_random_uuid()` |
| `user_id` | `uuid` | no | FK → `auth.users(id)` ON DELETE CASCADE, unique |
| `body_height` | `numeric(5,1)` | yes | cm |
| `body_weight` | `numeric(5,1)` | yes | kg |
| `body_bust` | `numeric(5,1)` | yes | cm, optional |
| `body_waist` | `numeric(5,1)` | yes | cm, optional |
| `body_hip` | `numeric(5,1)` | yes | cm, optional |
| `body_inseam` | `numeric(5,1)` | yes | cm, optional |
| `body_thigh` | `numeric(5,1)` | yes | cm, optional |
| `body_rise` | `numeric(5,1)` | yes | cm, optional |
| `body_shoulder_width` | `numeric(5,1)` | yes | cm, optional |
| `body_sleeve_length` | `numeric(5,1)` | yes | cm, optional |
| `body_upper_body_length` | `numeric(5,1)` | yes | cm, optional |
| `body_upper_arm` | `numeric(5,1)` | yes | cm, optional |
| `body_neck` | `numeric(5,1)` | yes | cm, optional |
| `body_foot_length` | `numeric(4,1)` | yes | cm, optional |
| `body_foot_width` | `numeric(4,1)` | yes | cm, optional |
| `preferred_fit` | `varchar(10)` | yes | `'SLIM'` / `'REGULAR'` / `'RELAXED'` / `'OVERSIZED'` |
| `updated_at` | `timestamptz` | no | Auto-updated by trigger |

---

### `public.style_profiles`

One row per user (`user_id` is unique). Stores style and color preferences collected during onboarding. Mirrors the `fitEngineStore` Zustand state shape.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | — | FK → `auth.users(id)` ON DELETE CASCADE, unique |
| `selected_styles` | `text[]` | `{}` | Style tag IDs, e.g. `['oldmoney', 'minimalist']` |
| `color_preferences` | `text[]` | `{}` | Named color tones, e.g. `['Cream', 'Navy']` |
| `formula_preferences` | `text[]` | `{}` | Fit-engine formula IDs; empty = use all |
| `updated_at` | `timestamptz` | `now()` | Auto-updated by trigger |

---

## Security

### Row Level Security (RLS)

RLS is enabled on all three tables. Each table has three policies (select, insert, update), all scoped to the authenticated user's own row:

```sql
using  ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id )
```

No `anon` role access. No delete policies — rows are removed via cascade when `auth.users` is deleted.

### Triggers

| Trigger | Table | Event | Function | Purpose |
|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | Auto-creates `profiles` + `wardrobes` rows on signup |
| `profiles_updated_at` | `public.profiles` | BEFORE UPDATE | `set_updated_at()` | Keeps `updated_at` current |
| `body_measurements_updated_at` | `public.body_measurements` | BEFORE UPDATE | `set_updated_at()` | Keeps `updated_at` current |
| `style_profiles_updated_at` | `public.style_profiles` | BEFORE UPDATE | `set_updated_at()` | Keeps `updated_at` current |

`handle_new_user()` is `SECURITY DEFINER` with `search_path = ''` (required to write into `public.profiles` from an `auth` schema trigger). All other functions are `SECURITY INVOKER`.

---

## Engine Configuration Tables

These tables power the outfit suggestion engine on the backend. They are **admin-managed** — regular users never write to them. The engine reads this data to decide which clothing items go together and how to score outfits.

Think of these tables as the "rulebook" the engine follows. Changing a row here changes how the engine behaves — no code deploy needed.

---

### `public.styles`

**What it is:** The list of fashion styles the app supports (e.g., Old Money, Streetwear, Minimalist).

**Why it's in the DB:** New fashion trends appear constantly. When "Dark Academia" or "Coastal Grandmother" becomes popular, an admin adds a row here instead of changing code. Each style also carries a numeric "personality" — its attributes — which the engine uses to compare outfits against what the user likes.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `varchar(50)` | no | — | PK. Slug identifier, e.g. `'oldmoney'`, `'streetwear'` |
| `name` | `varchar(100)` | no | — | Display name, e.g. `'Old Money'` |
| `description` | `text` | yes | — | Short editorial description for UI |
| `image_url` | `text` | yes | — | Style cover image |
| `popularity` | `numeric(3,3)` | no | `0.500` | 0.0–1.0. How popular/mainstream this style is. Used to weight discovery |
| `attributes` | `jsonb` | no | — | Style personality vector. Shape: `{ formality, colorPalette[], silhouette[], patternLevel, textureRichness, mood[] }` |
| `neighbors` | `jsonb` | no | `[]` | Related styles with similarity weights. Shape: `[{"id": "preppy", "weight": 0.8}, ...]`. Used in style coherence scoring — items tagged with a neighbor style get partial credit instead of being ignored |
| `niches` | `jsonb` | no | `[]` | Editorial sub-categories for UI display. Shape: `["Quiet Luxury", "Ivy League", ...]`. Not used by the engine |
| `active` | `boolean` | no | `true` | Soft-delete. Set to `false` to hide a style without removing data |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**`attributes` example:**
```json
{
  "formality": 4.5,
  "colorPalette": ["neutral", "earth", "monochrome"],
  "silhouette": ["tailored", "structured"],
  "patternLevel": 1.5,
  "textureRichness": 3.0,
  "mood": ["serious", "clean"]
}
```

**`neighbors` example:**
```json
[
  { "id": "minimalist", "weight": 0.8 },
  { "id": "preppy", "weight": 0.8 },
  { "id": "smartcasual", "weight": 0.6 }
]
```

**`niches` example:**
```json
["Quiet Luxury", "Ivy League", "European Heritage", "Coastal Preppy"]
```

---

### `public.style_configs`

**What it is:** The hard rules for each style — which colors are allowed, which fabrics are banned, what fits are acceptable, etc.

**Why it's in the DB:** These rules are the most-tuned part of the engine. When Old Money outfits score too casual, an admin narrows the formality range here. When users complain that Minimalist rejects too many colors, the palette grades get relaxed. Every style needs its own config, and changes must be immediate without code deploys.

**How the engine uses it:** During outfit generation, the engine loads the config for the user's selected style(s). Items that violate **any** hard rule (banned fabric, banned color, wrong fit) are removed from the candidate pool before scoring even begins.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `style_id` | `varchar(50)` | no | — | FK → `styles(id)`, unique. One config per style |
| `palette` | `jsonb` | no | — | Color grading rules. Maps each color name to `'perfect'`, `'allowed'`, `'accent'`, or `'banned'` |
| `fabrics_allowed` | `text[]` | no | `{}` | Whitelist of fabric names. Empty = all allowed |
| `fabrics_banned` | `text[]` | no | `{}` | Blacklist of fabric names. Checked after whitelist |
| `allowed_fits` | `text[]` | no | `{}` | Which silhouette fits work, e.g. `['slim', 'regular']` |
| `formality_range` | `numeric[]` | no | — | `[min, max]` on 1.0–5.0 scale. Items outside this range are rejected |
| `banned_features` | `text[]` | no | `{}` | Visual features to reject, e.g. `['loud_logo', 'distressed']` |
| `weight_overrides` | `jsonb` | yes | — | Per-style scoring weight adjustments. Overrides the default weights |
| `overrides` | `text[]` | no | `{}` | Which user preferences this style ignores, e.g. `['favorite_color', 'preferred_fit']` |
| `updated_at` | `timestamptz` | no | `now()` | |

**`palette` example (Old Money):**
```json
{
  "navy": "perfect", "cream": "perfect", "camel": "perfect",
  "brown": "allowed", "tan": "allowed",
  "burgundy": "accent",
  "red": "banned", "yellow": "banned", "neon_color": "banned"
}
```

**`weight_overrides` example:**
```json
{
  "style": 0.20, "color": 0.20, "fit": 0.05,
  "proportion": 0.05, "formality": 0.15, "season": 0.10, "texture": 0.10
}
```

---

### ~~`public.style_neighbors`~~ — REMOVED

Folded into `styles.neighbors` as `jsonb`. Too few rows (~20) to justify a separate table with FKs and joins.

---

### ~~`public.style_niches`~~ — REMOVED

Folded into `styles.niches` as `jsonb`. Editorial display strings — the engine never reads them. No need for a separate table.

---

### `public.formulas`

**What it is:** The list of outfit composition strategies. A formula describes *how* pieces are combined — "monochrome" means one color family across all items, "neutral_pop" means a neutral base with one bold accent.

**Why it's in the DB:** Formula definitions (name, description, visibility) are content that should be editable. However, the actual *logic* of how each formula picks items stays in code — this table is the catalog, not the algorithm.

**How the engine uses it:** When generating outfits, the engine picks which formulas to try based on the user's selected styles (via `style_formula_matrix`) and any explicit formula preferences. It then runs the code-side logic for each formula to generate candidate outfits.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `varchar(50)` | no | — | PK. Slug, e.g. `'monochrome'`, `'neutral_pop'` |
| `name` | `varchar(100)` | no | — | Display name, e.g. `'Monochrome'` |
| `description` | `text` | yes | — | Full description of the formula strategy |
| `short_desc` | `varchar(200)` | yes | — | One-line summary for UI tags |
| `active` | `boolean` | no | `true` | Set `false` to disable a formula without deleting |

---

### ~~`public.style_formula_matrix`~~ — REMOVED

**Decision:** All formulas are available for all styles. There is no style→formula gate.

**Rationale:** Formulas are universal composition principles (rule of thirds, monochrome, layering). They describe *how* pieces are arranged, not *what* they look like. Any formula can produce good results for any style — a "rule of thirds" streetwear outfit works just as well as a "rule of thirds" old money outfit. The style's `style_configs` (palette, fabrics, fits, formality) already controls the aesthetic. The formula just arranges the filtered items.

**Formula selection is driven by:**
- User preference → `style_profiles.formula_preferences`
- Intent/occasion → `occasions.preferred_formulas`, `engine_params` (color scheme → formula mappings)
- If none specified → engine tries all active formulas from the `formulas` table

---

### `public.colors`

**What it is:** The master color catalog. Each color has a display definition (name, hex) and a classification profile (hue, saturation, lightness, undertone) used by the engine for color harmony scoring.

**Why it's in the DB:** Colors are used in two places — the UI (palette picker during onboarding) and the engine (classifying items, scoring harmony). New colors can be added, hex values tweaked for better display, or the HSL profile adjusted to improve engine accuracy.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `name` | `varchar(50)` | no | — | PK. Display name, e.g. `'Cream'`, `'Navy'` |
| `hex` | `varchar(7)` | no | — | CSS hex for UI display, e.g. `'#EFE6D2'` |
| `tag` | `varchar(50)` | no | — | Color family label, e.g. `'WARM NEUTRAL'`, `'COOL'`, `'ACCENT'` |
| `primary_color` | `varchar(20)` | no | — | Engine classification, e.g. `'cream'`, `'navy'` |
| `lightness` | `varchar(10)` | no | — | `'light'` / `'medium'` / `'dark'` |
| `saturation` | `varchar(10)` | no | — | `'muted'` / `'balanced'` / `'vivid'` |
| `hue` | `smallint` | yes | — | 0–360 degrees. NULL for achromatic (black, white, gray) |
| `sat_pct` | `smallint` | no | `0` | 0–100. Saturation percentage |
| `lum_pct` | `smallint` | no | `0` | 0–100. Luminance percentage |
| `undertone` | `varchar(10)` | no | — | `'warm'` / `'cool'` / `'neutral'` |
| `active` | `boolean` | no | `true` | Soft-delete for UI color picker |

---

### `public.color_families`

**What it is:** Named groups of related colors. The engine uses these when a formula needs to work with "the same color family" — e.g., the monochrome formula picks items from one family.

**Why it's in the DB:** As new colors are added to the `colors` table, they need to be assigned to families. The groupings can also be adjusted — maybe "teal" should belong to both "blues" and "greens".

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `family_name` | `varchar(30)` | no | PK. e.g. `'blacks'`, `'blues'`, `'earths'` |
| `colors` | `text[]` | no | Array of `primary_color` values, e.g. `['navy', 'blue', 'teal']` |

---

### `public.garment_types`

**What it is:** The classification rules for each type of clothing. When a user adds a "TEE" to their wardrobe, this table tells the engine: it's a `top`, has base formality `2.5`, acts as a `base` layer, and is associated with `streetwear, athleisure, smartcasual, minimalist`.

**Why it's in the DB:** New garment types appear as the wardrobe feature grows. A user might add a "PONCHO" — an admin creates a row here defining how the engine should treat it, without any code change.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `type_key` | `varchar(30)` | no | — | PK. Uppercase slug, e.g. `'TEE'`, `'BLAZER'`, `'LOAFERS'` |
| `category` | `varchar(15)` | no | — | `'top'` / `'bottom'` / `'outwear'` / `'shoes'` / `'accessory'` |
| `base_formality` | `numeric(2,1)` | no | `2.5` | Default formality score (1.0–5.0) before adjustments |
| `style_affinities` | `text[]` | no | `{}` | Style IDs this type naturally belongs to, e.g. `['preppy', 'oldmoney']` |
| `layer_roles` | `text[]` | no | `{'base'}` | Possible layer positions this type can fill. `'base'` = worn on body, `'mid'` = over a base layer (cardigan over tee), `'outer'` = outermost layer. Items with multiple roles (e.g. JACKET = `['mid','outer']`) let the engine decide based on outfit context |
| `default_material` | `varchar(30)` | yes | — | FK → `fabric_types(name)`. Fallback material when user doesn't provide one. E.g. TEE → `'cotton'`, BLAZER → `'wool'`, JEANS → `'denim'` |

---

### `public.fabric_types`

**What it is:** Material definitions. When the engine classifies an item, it looks up the fabric here to determine weight, breathability, and implied season.

**Why it's in the DB:** New materials can be added (e.g., "tencel", "modal") and existing ones adjusted. If breathability ratings are wrong (say, "linen" should be `high` not `medium`), an admin fixes it here.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `name` | `varchar(30)` | no | — | PK. Lowercase, e.g. `'cotton'`, `'wool'`, `'denim'` |
| `weight` | `varchar(10)` | no | — | `'light'` / `'medium'` / `'heavy'` |
| `breathability` | `varchar(10)` | no | — | `'low'` / `'medium'` / `'high'` |
| `season` | `varchar(15)` | no | — | Default season: `'summer'` / `'allSeason'` / `'winter'` |
| `style_boosts` | `text[]` | no | `{}` | Extra style tags when item uses this fabric, e.g. `['streetwear', 'oldmoney']` |

---

### `public.color_style_boosts`

**What it is:** Extra style tag associations based on item color. When an item is black, it gets a small boost toward "minimalist" and "streetwear" — this table defines those mappings.

**Why it's in the DB:** As styles evolve, color associations change. "Burgundy" might gain an association with a new style. These are lightweight tuning knobs.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `color_name` | `varchar(20)` | no | PK. References `primary_color` value, e.g. `'black'`, `'olive'` |
| `style_tags` | `text[]` | no | Style IDs to boost, e.g. `['minimalist', 'streetwear']` |

---

### `public.occasions`

**What it is:** The list of occasions the user can filter by (e.g., "date night", "business", "travel"), along with the engine defaults for each.

**Why it's in the DB:** Occasions are a product/editorial decision. Adding "Wedding Guest" or adjusting the formality range for "Business" should be instant. Each occasion tells the engine what formality range to enforce and which formulas tend to work best.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `varchar(30)` | no | — | PK. Slug, e.g. `'date_night'`, `'business'` |
| `name` | `varchar(50)` | no | — | Display name, e.g. `'Date Night'` |
| `formality_range` | `numeric[]` | no | — | `[min, max]` on 1.0–5.0 scale |
| `preferred_formulas` | `text[]` | no | `{}` | Formula IDs that work well for this occasion. Empty = no preference |

---

### `public.engine_config`

**What it is:** A single-row table holding every tunable number in the engine — limits, thresholds, weights, matrices. Simple values are proper typed columns; complex objects stay `jsonb`.

**Why it's in the DB:** These numbers are the most frequently adjusted part of the engine during quality tuning. "Outfits have too many colors" → lower `max_distinct_colors`. "Not enough variety" → raise `top_n`. All without a code deploy.

**Why a single row:** There is only one engine. These settings are global — not per-user, not per-style. One row, always.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `boolean` | no | `true` | PK. Always `true` — enforces exactly one row via `CHECK (id = true)` |
| `top_n` | `smallint` | no | `24` | Max outfits returned per request |
| `per_formula_cap` | `smallint` | no | `80` | Max candidates generated per formula |
| `generation_cap` | `smallint` | no | `500` | Total candidate limit before ranking |
| `max_distinct_colors` | `smallint` | no | `4` | Hard reject outfits with more distinct colors than this |
| `max_formality_gap` | `numeric(2,1)` | no | `2.5` | Hard reject if formality spread between items exceeds this |
| `default_weights` | `jsonb` | no | — | Base scoring weights: `{"style":0.25, "color":0.25, "fit":0.10, "proportion":0.10, "formality":0.10, "season":0.10, "texture":0.05}` |
| `fit_thresholds` | `jsonb` | no | — | Per-measurement ease ranges. Shape: `{"chest":{"ideal":[2,6],"ok":[0,12]}, ...}` |
| `season_matrix` | `jsonb` | no | — | 5×5 season compatibility scores. Shape: `{"summer":{"summer":1.0,"spring":0.8,...}, ...}` |
| `harmony_ranges` | `jsonb` | no | — | Hue degree thresholds for color relationships. Shape: `{"analogous":30, "near_analogous":50, ...}` |
| `volume_scale` | `jsonb` | no | — | Fit → volume number for proportion scoring. Shape: `{"slim":1, "regular":2, "relaxed":3, "wide":4, "oversized":5}` |
| `body_goal_formulas` | `jsonb` | no | — | Which formulas each body goal prefers. Shape: `{"elongation":["monochrome","tonal_gradient"], ...}` |
| `body_goal_boosts` | `jsonb` | no | — | Weight adjustments per body goal. Shape: `{"elongation":{"proportion":0.20,"color":0.30}, ...}` |
| `color_scheme_formulas` | `jsonb` | no | — | Color scheme → formula mapping. Shape: `{"monochrome":["monochrome"], "tonal":["tonal_gradient"], ...}` |
| `updated_at` | `timestamptz` | no | `now()` | Auto-updated by trigger |

---

## Security

### Row Level Security (RLS)

RLS is enabled on all user-data tables. Each table has three policies (select, insert, update), all scoped to the authenticated user's own row:

```sql
using  ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id )
```

No `anon` role access. No delete policies — rows are removed via cascade when `auth.users` is deleted.

**Engine config tables** (`styles`, `style_configs`, `formulas`, `colors`, `garment_types`, `fabric_types`, `occasions`, `engine_config`, etc.) are **read-only for all authenticated users** and **writable only by admin** (service role or a future admin role). RLS policies:

```sql
-- Everyone can read
create policy "select" on public.styles for select to authenticated using (true);

-- Only service role can write (no insert/update/delete policy for authenticated)
```

### Triggers

| Trigger | Table | Event | Function | Purpose |
|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | Auto-creates `profiles` + `wardrobes` rows on signup |
| `profiles_updated_at` | `public.profiles` | BEFORE UPDATE | `set_updated_at()` | Keeps `updated_at` current |
| `body_measurements_updated_at` | `public.body_measurements` | BEFORE UPDATE | `set_updated_at()` | Keeps `updated_at` current |
| `style_profiles_updated_at` | `public.style_profiles` | BEFORE UPDATE | `set_updated_at()` | Keeps `updated_at` current |

`handle_new_user()` is `SECURITY DEFINER` with `search_path = ''` (required to write into `public.profiles` from an `auth` schema trigger). All other functions are `SECURITY INVOKER`.

---

## Table categories

### User data (per-user, user writes own data)

| Table | Description |
|---|---|
| `profiles` | Identity, location, onboarding state, skin undertone |
| `body_measurements` | Sensitive body dimensions + preferred fit |
| `style_profiles` | User's selected styles, colors, formula preferences |
| `wardrobes` | One per user (1:1), auto-created on signup |
| `clothing_items` | Garments — in a wardrobe (personal) or catalog (shop) |
| `outfit_history` | Outfits the user actually wore + mood rating |
| `saved_outfits` | Outfits the user favorited from the feed |

### Engine config (global, admin-managed, read-only for users)

| Table | Description |
|---|---|
| `styles` | Fashion style catalog with personality attributes |
| `style_configs` | Hard rules per style (palette, fabrics, fits, formality) |
| ~~`style_neighbors`~~ | **Removed** — folded into `styles.neighbors` jsonb |
| ~~`style_niches`~~ | **Removed** — folded into `styles.niches` jsonb |
| `formulas` | Outfit composition strategy catalog |
| ~~`style_formula_matrix`~~ | **Removed** — all formulas available for all styles |
| `colors` | Color catalog with HSL classification profiles |
| `color_families` | Named groups of related colors |
| `garment_types` | Garment → category/formality/layer/style mappings |
| `fabric_types` | Material → weight/breathability/season/style mappings |
| `color_style_boosts` | Color → extra style tag associations |
| `occasions` | Occasion definitions with formality defaults |
| `engine_config` | All tunable numbers (weights, thresholds, caps, matrices). Single row |

### What stays in code (pure algorithm, not data)

| Logic | Reason |
|---|---|
| Pipeline flow (filter → generate → rank) | Core architecture — changes require code |
| Scoring formula (weighted sum of 7 dimensions) | Algorithm structure |
| Hard constraint checks (color count, pattern conflicts, season clashes) | Logic, not data |
| Outfit slot composition (how formulas pick items) | Algorithm per formula |
| Tier classification (tier 1 = matches user style, tier 2 = discovery) | Algorithm logic |
| Diversity penalty / dedup | Algorithm logic |
| Daily shuffle (deterministic by userId) | Algorithm logic |
| Attribute similarity calculation | Algorithm logic |
| Color harmony sub-scores (hue relationships, undertone checks) | Algorithm logic (thresholds are in `engine_params`) |
| Fit ease scoring curve | Algorithm logic (thresholds are in `engine_params`) |

---

## What is NOT stored

| Data | Where it lives | Reason |
|---|---|---|
| GPS coordinates | Client only | Privacy; stale within minutes |
| Current weather | Client → weather API | Real-time, not a user attribute |
| Auth tokens / sessions | `auth` schema (Supabase-managed) | Never touch directly |
| Generated outfits | Computed on-demand | Volatile; regenerated per request |
| Wardrobe items | `public.clothing_items` (planned) | Not yet implemented |

---

## Wardrobe & Outfit Tables

### `public.wardrobes`

**What it is:** One wardrobe per user. Auto-created on signup by the `handle_new_user()` trigger (alongside `profiles`).

**Why a separate table:** `clothing_items` represents any garment — whether it's in a user's wardrobe or a shop catalog item. The `wardrobes` table is the bridge that ties items to a user. This separation enables:
- Shop items (`wardrobe_id = null`) visible to all users
- Personal items (`wardrobe_id` set) visible only to the owner
- Future: cart, wishlist, or multiple named wardrobes without restructuring

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | FK → `auth.users(id)` ON DELETE CASCADE, unique (1:1) |
| `created_at` | `timestamptz` | no | `now()` | |

### `public.clothing_items`

**What it is:** A garment — either in a user's wardrobe or in the shop catalog.

- `wardrobe_id` set → personal item, belongs to that user's wardrobe
- `wardrobe_id` null → shop/catalog item, visible to all authenticated users

**Design principle:** Store only what the user provides or what can't be recomputed. The engine derives everything else at runtime from the lookup tables (`garment_types`, `fabric_types`, `colors`, `color_style_boosts`). No derived data (category, colorProfile, styleTags, warmth, formality, statementStrength) is stored — it's computed fresh each time via `toFitItem()`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `wardrobe_id` | `uuid` | yes | — | FK → `wardrobes(id)` ON DELETE CASCADE. Null = shop/catalog item |
| **Identity** |
| `type` | `varchar(30)` | no | — | FK → `garment_types(type_key)`. e.g. `'TEE'`, `'BLAZER'`, `'JEANS'`. The engine derives category, base formality, layer role, and style affinities from this |
| `name` | `varchar(200)` | no | — | Display name, e.g. `'Supima Cotton Crew Neck'`. Also parsed by engine for pattern keywords (plaid, stripe, graphic) and fit keywords (oversized, slim) |
| `color` | `varchar(50)` | no | — | FK → `colors(name)`. e.g. `'Navy'`, `'Cream'`. The engine looks up hue, saturation, lightness, undertone from the `colors` table |
| `material` | `varchar(30)` | yes | — | FK → `fabric_types(name)`. e.g. `'cotton'`, `'wool'`. If null, engine falls back to `garment_types.default_material`. Used to derive weight, breathability, season, warmth |
| `brand` | `varchar(100)` | yes | — | Brand name for display |
| `size` | `varchar(20)` | yes | — | Size label, e.g. `'M'`, `'W32 L30'`, `'EU 42'` |
| `fit` | `varchar(15)` | yes | — | Explicit fit: `'slim'` / `'regular'` / `'relaxed'` / `'wide'` / `'oversized'`. If null, engine infers from name keywords or type defaults |
| `fit_note` | `text` | yes | — | Free-text fit notes, e.g. `'runs large in shoulders'` |
| `price` | `integer` | yes | — | Price in VND (or smallest currency unit). Relevant for shop items |
| **Images** |
| `photo_url` | `text` | yes | — | User-uploaded photo (Supabase Storage) or product image URL |
| **Garment measurements** — all in cm (full circumference), except shoes (EU sizing). Nullable — each category uses a subset. Flattened for direct SQL queries (e.g., `WHERE m_chest BETWEEN 104 AND 110` for fit-based filtering) |
| `m_chest` | `numeric(5,1)` | yes | — | Tops + outerwear. Full chest circumference |
| `m_shoulder_width` | `numeric(5,1)` | yes | — | Tops + outerwear. Shoulder seam to seam |
| `m_sleeves` | `numeric(5,1)` | yes | — | Tops + outerwear. Shoulder to cuff |
| `m_body_length` | `numeric(5,1)` | yes | — | Tops + outerwear. Nape to hem |
| `m_upper_arm` | `numeric(5,1)` | yes | — | Tops + outerwear. Bicep circumference |
| `m_waist_top` | `numeric(5,1)` | yes | — | Tops. Waist circumference at top |
| `m_waist` | `numeric(5,1)` | yes | — | Bottoms. Waist circumference |
| `m_hip` | `numeric(5,1)` | yes | — | Bottoms. Hip circumference at widest |
| `m_inseam` | `numeric(5,1)` | yes | — | Bottoms. Crotch to ankle |
| `m_thigh` | `numeric(5,1)` | yes | — | Bottoms. Mid-thigh circumference |
| `m_rise` | `numeric(5,1)` | yes | — | Bottoms. Waist to crotch |
| `m_skirt_length` | `numeric(5,1)` | yes | — | Skirts/dresses. Waist to hem |
| `m_waist_outer` | `numeric(5,1)` | yes | — | Outerwear. Waist circumference at outer layer |
| `m_shoe_size` | `numeric(4,1)` | yes | — | Shoes. EU sizing as canonical unit (e.g. `42.0`). Client converts to/from US/UK |
| `m_shoe_width` | `varchar(5)` | yes | — | Shoes. Width designation, e.g. `'D'`, `'E'`, `'2E'` |
| **Source** |
| `source` | `varchar(15)` | no | `'personal'` | `'personal'` (user added manually) / `'shop'` (from a store listing). When a shop item is added to a wardrobe, it's copied as a new row with the wardrobe_id set |
| `source_url` | `text` | yes | — | Link to the product page. Available for both personal and shop items — users can save the link for reference or repurchasing |
| **Curated Closet concepts** (per-user, only meaningful when wardrobe_id is set) |
| `piece_role` | `varchar(15)` | yes | — | `'key'` / `'statement'` / `'basic'`. Key = versatile anchor. Statement = bold/expressive. Basic = neutral foundation |
| `occasion_tags` | `text[]` | no | `{}` | `['work', 'casual', 'both']`. Restricts which occasions this item can appear in |
| **Usage tracking** (per-user, only meaningful when wardrobe_id is set) |
| `times_worn` | `integer` | no | `0` | Incremented when user marks an outfit containing this item as "worn" |
| `last_worn_at` | `timestamptz` | yes | — | Last date this item was part of a worn outfit |
| **Timestamps** |
| `added_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | Auto-updated by trigger |

**Which measurement columns each category uses:**

| Column | Top | Bottom | Outerwear | Shoes |
|---|---|---|---|---|
| `m_chest` | ✓ | | ✓ | |
| `m_shoulder_width` | ✓ | | ✓ | |
| `m_sleeves` | ✓ | | ✓ | |
| `m_body_length` | ✓ | | ✓ | |
| `m_upper_arm` | ✓ | | ✓ | |
| `m_waist_top` | ✓ | | | |
| `m_waist` | | ✓ | | |
| `m_hip` | | ✓ | | |
| `m_inseam` | | ✓ | | |
| `m_thigh` | | ✓ | | |
| `m_rise` | | ✓ | | |
| `m_skirt_length` | | ✓ (skirts) | | |
| `m_waist_outer` | | | ✓ | |
| `m_shoe_size` | | | | ✓ |
| `m_shoe_width` | | | | ✓ |

All measurements in **centimeters, full circumference** (not half/flat). Shoe sizes in **EU** as canonical unit. Unit conversion (inches, US/UK shoe sizes) is a client-side concern.

**What is NOT stored on clothing_items (derived at runtime by the engine):**

| Field | Derived from | Lookup table |
|---|---|---|
| `category` (top/bottom/shoes/outwear/accessory) | `type` | `garment_types` |
| `colorProfile` (hue, sat, lum, undertone) | `color` | `colors` |
| `fabricProfile` (weight, breathability, season) | `material` or `default_material` | `fabric_types` + `garment_types` |
| `styleTags` | `type` + `color` + `material` | `garment_types` + `color_style_boosts` + `fabric_types` |
| `formality` (1-5) | `type` + `color` + `material` | `garment_types` + engine logic |
| `warmth` (1-5) | `material` + `category` | `fabric_types` + engine logic |
| `statementStrength` (0-5) | `name` + `color` + `type` | Engine logic (pattern/graphic inference) |
| `pattern` (solid/striped/plaid...) | `name` keywords | Engine logic |

---

### `public.outfit_history`

**What it is:** Tracks outfits the user actually wore. This is the confidence/feedback signal that closes the loop.

**Rationale (from The Curated Closet):** Clothes have emotional power. The right outfit boosts confidence, the wrong one drags mood down. Tracking what users actually wear (and how they feel about it) enables:
1. **Confidence-based scoring** — outfits similar to highly-rated worn outfits score higher
2. **Wardrobe detox** — surface items that are never worn and suggest removal
3. **Key piece detection** — items that appear in many worn outfits are automatically classified as key pieces
4. **Personal style learning** — the engine learns what the user *actually* wears vs what they *said* they like during onboarding

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | FK → `auth.users(id)` ON DELETE CASCADE |
| `item_ids` | `uuid[]` | no | — | The clothing item IDs in this outfit |
| `occasion` | `varchar(30)` | yes | — | What occasion it was worn for, e.g. `'work'`, `'date_night'` |
| `worn_at` | `date` | no | `current_date` | The date the outfit was worn |
| `rating` | `smallint` | yes | — | Optional 1-5 user rating — "how did this outfit make you feel?" |
| `notes` | `text` | yes | — | Optional free-text notes |
| `created_at` | `timestamptz` | no | `now()` | |

### `public.saved_outfits`

**What it is:** Outfits the user has favorited/saved from the feed. Used for the "Saved Outfits" screen in the menu.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | FK → `auth.users(id)` ON DELETE CASCADE |
| `item_ids` | `uuid[]` | no | — | The clothing item IDs that make up this outfit |
| `title` | `varchar(200)` | yes | — | Optional user or auto-generated title |
| `formula` | `varchar(50)` | yes | — | Which formula generated it, e.g. `'monochrome'`, `'neutral_pop'` |
| `occasion` | `varchar(30)` | yes | — | Occasion tag if relevant |
| `tags` | `text[]` | no | `{}` | Style tags, e.g. `['oldmoney', 'minimalist']` |
| `saved_at` | `timestamptz` | no | `now()` | |

---

### Color philosophy alignment

The engine's existing color system maps directly to Anuschka's "3 color groups" framework:

| Anuschka's term | Engine equivalent | Where it lives |
|---|---|---|
| Main colors | `palette: "perfect"` | `style_configs.palette` |
| Accent colors | `palette: "accent"` | `style_configs.palette` |
| Neutral colors | `NEUTRALS` set | `color_families` + engine code |

No changes needed — already implemented.
