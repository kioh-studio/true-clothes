# Engine Migration Plan — Client vs Backend

This document defines what stays in the mobile app and what moves to a Supabase Edge Function.

---

## Guiding Principle

**App = UI + user input + display.**
**Backend = computation + data + business logic.**

The app should never run the outfit engine. It sends a request ("generate outfits for me") and receives scored results. All engine logic, scoring, filtering, and data lookups happen server-side.

---

## Open items

- **Item photos**: Currently stored on user's device (local asset paths). Supabase Storage upload will be implemented later. For now, `photo_url` in `clothing_items` holds local paths. When storage is wired up, the app will upload photos and replace local paths with Supabase Storage URLs.

---

## What stays in the app

### Services (keep)

| File | Lines | Why it stays |
|---|---|---|
| `src/services/supabase.ts` | 33 | Supabase client initialization — app needs this for auth and DB access |
| `src/services/authService.ts` | 46 | Phone OTP flow — must run on device (user enters code on their phone) |
| `src/services/profileService.ts` | 117 | Profile CRUD — app writes directly to `profiles` table |
| `src/services/measurementService.ts` | 103 | Measurement CRUD — app writes directly to `body_measurements` table |
| `src/services/styleProfileService.ts` | 63 | Style preference CRUD — app writes directly to `style_profiles` table |

### Stores (keep, but simplify)

| File | Lines | What changes |
|---|---|---|
| `src/stores/authStore.ts` | 156 | No change — stays as-is |
| `src/stores/fitEngineStore.ts` | 123 | **Remove `computeOutfits()`** — replace with an API call to the Edge Function. Store still holds measurements/styles/colors for the UI, but no longer runs the engine |
| `src/stores/appStore.ts` | 173 | No change — wardrobe items, saved outfits, worn history |

### Types (keep, partially)

| File | Lines | What changes |
|---|---|---|
| `src/types/fitEngine.ts` | 365 | **Keep only what the app needs:** `BodyMeasurements`, `UserStyleProfile`, `ScoredOutfit`, `IntentContext`, `ClothingItem`. Remove engine-internal types (`FitItem`, `StyleConfig`, `FormulaPool`, `EngineContext`, etc.) — those move to the backend |

### Data (remove most)

| File | Lines | What changes |
|---|---|---|
| `src/data/index.ts` | 358 | **Remove** `STYLES`, `COLORS` hardcoded arrays — app reads these from DB (`styles`, `colors` tables). Keep only the `ClothingItem` interface and any UI-only constants |
| `src/data/measurements.ts` | 280 | **Remove entirely** — `REAL_BODY_MEASUREMENTS` was dev placeholder data. `GARMENT_MEASUREMENTS` is now stored per-item in DB columns. No hardcoded measurement data in the app |

### App total after migration

| Category | Files | Lines |
|---|---|---|
| Services | 5 | 362 |
| Stores | 3 | ~400 (after removing computeOutfits) |
| Types | 1 | ~150 (after removing engine-internal types) |
| Data | 1 | ~50 (after removing hardcoded arrays) |
| **Total** | **10** | **~960** |

Down from 30 files / 5,373 lines to 10 files / ~960 lines on the client.

---

## What moves to the Edge Function

### New file: `supabase/functions/generate-outfits/index.ts`

Entry point. Handles the HTTP request, loads data from DB, runs the engine, returns results.

```
POST /functions/v1/generate-outfits

Request body:
{
  "intent"?: IntentContext    // optional chat-driven overrides
}

Auth: Bearer token (Supabase auth JWT — user identity from token)

Response:
{
  "outfits": ScoredOutfit[]   // top 24 ranked outfits
}
```

### Engine modules (move + restructure)

15 engine files consolidate into 6 backend modules:

```
supabase/functions/generate-outfits/
├── index.ts                 ← Entry point + DB loading
└── engine/
    ├── types.ts             ← Engine-internal types (FitItem, StyleConfig, etc.)
    ├── enrichment.ts        ← toFitItem() with DB lookups
    ├── filtering.ts         ← Style constraint hard filtering
    ├── generation.ts        ← Formula pools + candidate composition
    ├── scoring.ts           ← All 7 scorers merged
    └── ranking.ts           ← Hard constraints + rank + shuffle
```

### Migration map — old file → new location

| Old file (client) | Lines | New location (backend) | What changes |
|---|---|---|---|
| `styleCatalog.ts` | 149 | **DELETED** | Data now in `styles` table |
| `styleConfigs.ts` | 294 | **DELETED** | Data now in `style_configs` table |
| `itemClassifier.ts` | 394 | `engine/enrichment.ts` | Remove all hardcoded maps (CATEGORY_MAP, COLOR_MAP, FABRIC_DEFAULTS, STYLE_AFFINITIES, COLOR_STYLE_BOOSTS). `toFitItem()` does DB lookups instead. ~80 lines |
| `formulaCatalog.ts` | 525 | `engine/generation.ts` | Remove FORMULA_CATALOG, COLOR_FAMILIES, NEUTRALS, STYLE_FORMULA_MATRIX data. Keep pool functions (poolMonochrome, poolNeutralPop, etc.). ~250 lines |
| `outfitCompositor.ts` | 129 | `engine/generation.ts` | Merge into generation.ts. ~80 lines added |
| `styleFilter.ts` | 157 | `engine/filtering.ts` | Reads constraints from `style_configs` table instead of hardcoded STYLE_CONFIGS. ~100 lines |
| `intentResolver.ts` | 191 | `engine/ranking.ts` or `index.ts` | Remove hardcoded mappings (OCCASION_DEFAULTS, BODY_GOAL maps). Read from `occasions` + `engine_config` tables. ~60 lines |
| `colorHarmony.ts` | 151 | `engine/scoring.ts` | Pure math — copy as-is |
| `styleCoherence.ts` | 143 | `engine/scoring.ts` | Pure math — copy as-is |
| `fitMatcher.ts` | 114 | `engine/scoring.ts` | Pure math — thresholds from `engine_config` |
| `proportionBalance.ts` | 44 | `engine/scoring.ts` | Pure math — volume scale from `engine_config` |
| `formalityConsistency.ts` | 24 | `engine/scoring.ts` | Pure math — copy as-is |
| `seasonMatch.ts` | 29 | `engine/scoring.ts` | Pure math — matrix from `engine_config` |
| `textureHarmony.ts` | 48 | `engine/scoring.ts` | Pure math — copy as-is |
| `anchorClarity.ts` | 68 | `engine/scoring.ts` | Pure math — copy as-is |
| `outfitRanker.ts` | 227 | `engine/ranking.ts` | Remove hardcoded weights/thresholds. Read from `engine_config`. ~150 lines |
| `shuffler.ts` | 69 | `engine/ranking.ts` | Copy as-is |
| `index.ts` | 197 | `index.ts` (entry) | Pipeline orchestration + DB loading. ~120 lines |

### Backend total after migration

| Module | Lines (estimated) | Content |
|---|---|---|
| `index.ts` | ~120 | DB load, auth check, run pipeline, return |
| `engine/types.ts` | ~200 | FitItem, StyleConfig, FormulaPool, ScoringWeights, etc. |
| `engine/enrichment.ts` | ~80 | toFitItem() — DB lookups for type/color/material |
| `engine/filtering.ts` | ~100 | Style hard constraint filtering |
| `engine/generation.ts` | ~330 | 10 formula pool functions + candidate compositor |
| `engine/scoring.ts` | ~400 | 7 scorers merged (color, style, fit, proportion, formality, season, texture) + anchor clarity |
| `engine/ranking.ts` | ~250 | Hard constraints, soft scoring, tier classification, diversity, shuffle |
| **Total** | **~1,480** | 7 files |

---

## DB tables read by the Edge Function

Per request, the function loads:

| Table | Rows | Cached? | Purpose |
|---|---|---|---|
| `profiles` | 1 | No | User's skin_undertone |
| `body_measurements` | 1 | No | User's body for fit scoring |
| `style_profiles` | 1 | No | Selected styles, color prefs |
| `clothing_items` | 50-200 | No | User's wardrobe |
| `styles` | 8 | Yes (per request) | Style attributes for scoring |
| `style_configs` | 8 | Yes (per request) | Hard filtering rules |
| `formulas` | 10 | Yes (per request) | Active formula list |
| `colors` | 38 | Yes (per request) | Color profiles for enrichment |
| `color_families` | 8 | Yes (per request) | Color grouping for formulas |
| `garment_types` | 50 | Yes (per request) | Type → category/formality/style mapping |
| `fabric_types` | 20 | Yes (per request) | Material → weight/breathability |
| `color_style_boosts` | 13 | Yes (per request) | Color → style tag boosts |
| `occasions` | 6 | Yes (per request) | Occasion defaults (if intent has occasion) |
| `engine_config` | 1 | Yes (per request) | All thresholds, weights, caps |

**4 user-specific queries + 1 bulk config query** (config tables can be loaded in a single query with multiple selects or loaded once and reused within the request).

---

## What the app does after migration

```
┌─────────────────────────────────────────────────────────┐
│  APP (React Native)                                     │
│                                                         │
│  Screens:                                               │
│    Onboarding → write to profiles, body_measurements,   │
│                 style_profiles                          │
│    Wardrobe   → CRUD clothing_items                     │
│    Feed       → call Edge Function, display results     │
│    Saved      → read/write saved_outfits                │
│    History    → read/write outfit_history                │
│                                                         │
│  What the app does NOT do:                              │
│    ✗ Run the engine                                     │
│    ✗ Score outfits                                      │
│    ✗ Filter by style rules                              │
│    ✗ Classify items (toFitItem)                         │
│    ✗ Hold config data (styles, formulas, colors, etc.)  │
│                                                         │
│  The app is a thin UI client.                           │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │  POST /functions/v1/generate-outfits
                      │  Authorization: Bearer <jwt>
                      │  Body: { intent?: IntentContext }
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  EDGE FUNCTION (Supabase)                               │
│                                                         │
│  1. Auth check (JWT → user_id)                          │
│  2. Load user data (profile, measurements, styles)      │
│  3. Load wardrobe (clothing_items)                      │
│  4. Load config tables (cached within request)          │
│  5. Enrich items → FitItem[]                            │
│  6. Filter by style constraints                         │
│  7. Generate candidates (up to 500)                     │
│  8. Score & rank (7 dimensions)                         │
│  9. Return top 24 outfits                               │
│                                                         │
│  ~1,480 lines of code, 7 files                          │
│  ~60-200ms per request                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 2 (Product Features) — New Scoring Dimensions

These additions were implemented in the `002-product-features` branch and MUST be kept in sync between `src/services/fitEngine/` (legacy local path) and `supabase/functions/generate-outfits/engine/` (authoritative backend).

### New scoring dimensions

| Dimension | File | Weight | Description |
|---|---|---|---|
| Body shape | `scoring.ts` | Boost | Items whose proportions are compatible with `body_shape` get a score boost (e.g., triangle → score up A-line bottoms) |
| Personal palette | `colorHarmony.ts` | ×1.3 | Outfits whose item colors overlap `personal_palette` receive a 30% score boost |
| Formula weights | `scoring.ts` + `ranking.ts` | Variable | Selected formula slug (`color_harmony`, `rule_of_thirds`, `proportion_balance`, `monochrome`) adjusts scorer weights at request time |

### New request payload fields (Edge Function)

```
POST /functions/v1/generate-outfits
Body:
{
  exclude_ids?: string[]        // outfit IDs to skip (seen + recently worn)
  worn_cooldown_ids?: string[]  // outfit IDs worn within last 7 days
  formula_id?: string           // UUID from public.formulas; null = default weights
  intent_context?: IntentContext // forward-compat hook for future AI chat
}
```

### New response fields

```
{
  outfits: ScoredOutfit[]  // exactly 10 (or fewer if pool exhausted)
  has_more: boolean        // true if more outfits remain after this batch
}
```

### Pagination + dedup

- Response capped at **10 outfits** per request (down from 24).
- Client tracks `shownOutfitIds` in AsyncStorage and sends as `exclude_ids`.
- When server returns < 3 outfits, client flushes `shownOutfitIds` for a fresh cycle.
- `worn_cooldown_ids` = outfit IDs with `worn_at` within last 7 days (from `outfit_interactions`).

### Server-backed outfit interactions

Outfit save / worn / scheduled state is now persisted to `public.outfit_interactions`.
`appStore` optimistically updates local Sets and fires best-effort server sync.
On hydrate, server state wins over local AsyncStorage state.

---

## Summary

| Metric | Before (all client) | After Phase 1 (client + backend) | After Phase 2 additions |
|---|---|---|---|
| Client files | 30 | 10 | 15 (+5 services/hooks) |
| Client lines | 5,373 | ~960 | ~1,800 |
| Backend files | 0 | 7 | 8 (+extract-garments) |
| Backend lines | 0 | ~1,480 | ~1,680 |
| Engine runs on | User's phone | Supabase Edge Function | Supabase Edge Function |
| Config data lives in | Hardcoded TypeScript | Database (admin-editable) | Database (admin-editable) |
| Update engine behavior | Code deploy to app stores | Update DB row (instant) | Update DB row (instant) |
| Scoring dimensions | 7 | 7 | 9 (+ body shape, + personal palette) |
| Outfits per response | 24 | 24 | 10 with pagination |
