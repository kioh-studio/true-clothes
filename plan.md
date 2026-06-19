# Onboarding Logic Plan

## Documentation Policy
- UI/visual/interaction requirement changes must be recorded in the relevant `app/design/**/design.md` file(s).
- Non-UI logic changes must be recorded in this `plan.md`, including:
  - data storage and persistence behavior
  - backend/business logic behavior and flow changes
  - domain/model/repository contract changes
  - validation logic rules that affect application behavior
- Update documentation in the same working session as the implementation change.

## Changelog — 2026-06-14 · Feature 003-upload-image (tiered item-photo storage)
- **Storage routing**: `wardrobeService.addItem(input, tier)` now decides storage by tier.
  Free → on-device only (relative path `wardrobe-photos/{itemId}.jpg` in `documentDirectory`,
  persisted in `clothing_items.photo_url`, `photo_storage='local'`). Premium → optimized file
  uploaded to the **private** `wardrobe-photos` bucket at `{userId}/{itemId}.jpg`
  (`photo_storage='cloud'`), with the device copy retained as an offline cache.
- **Schema**: added `clothing_items.photo_storage` (`none|local|cloud`) — migration
  `20260614000001_clothing_items_photo_storage.sql` (+ backfill existing photos to `cloud`).
  Apply before release.
- **Privacy**: cloud photos are served via short-lived `createSignedUrl` (FR-016); the prior
  `getPublicUrl` call (broken on a private bucket) was removed.
- **Optimization**: images resized to ≤1600 px long edge, JPEG ~0.7, before storage (`itemPhotoService.optimizeImage`).
- **Local-first / no-rollback**: premium adds write device copy + row first, upload async; failures
  leave the item `photo_storage='local'`. `appStore.syncPendingPhotos()` promotes pending locals to
  cloud — triggered on hydrate, on reconnect, and on free→premium upgrade (`fitEngineStore.setPremium`),
  serving as both the upload-retry queue and the US3 upgrade migration.
- **Cleanup**: delete/replace removes the device file and/or cloud object (no orphans).
- **Offline add**: the previous hard offline guard in `addWardrobeItem` was removed — adding now
  works offline for both tiers.
- **Photo reference kinds in `photo_url`** (resolved by `useItemPhoto`, in precedence order):
  bundled `png` (demo) → `asset:<key>` (in-app catalog image via `wardrobe-photos/assetMap.ts`) →
  `http(s)://…` direct remote URL (rendered as-is, never signed) → relative device path (local) →
  Storage path (cloud, signed). The `http`/`asset` passthroughs fix seeded items whose `photo_url`
  holds a retailer URL (mislabeled `cloud` by the backfill) or a bundled-asset ref.
- **Seed**: the user's 18 image-less items were pointed at matching bundled assets
  (`photo_storage='local'`, `photo_url='asset:<key>'`); 14 retailer-URL items render via the http passthrough.
- **SDK 19**: `expo-file-system` legacy file API now imported from `expo-file-system/legacy`
  (`wardrobeService` via `itemPhotoService`, and `profileService`), fixing the `EncodingType` type error.

## Plan
- Implement onboarding as required first-run flow with persisted progress and completion gating.
- Keep the existing Compose UI screens and move flow logic to a centralized ViewModel.
- Persist onboarding state locally on mobile (current phase), with a clear boundary for future backend sync.
- Separate shareable profile data from private body-measurement data in the domain model for future sync policy.

## Decisions
- Storage (current): local mobile persistence only.
- Persistence mechanism in current implementation: SQLite (`SQLiteOpenHelper`) repository abstraction.
- Future migration direction: dynamic sync policy for non-sensitive fields, keep private measurement fields restricted.
- Scope: MVP completion flow only (no real wardrobe upload pipeline, no AI measurement estimation).

## Progress
- Added onboarding domain contract (`OnboardingRepository`) and aggregate state model (`OnboardingSnapshot`, `OnboardingStep`, privacy metadata).
- Added local persistence data source and repository implementation for onboarding snapshots.
- Added onboarding presentation layer with centralized validation and `OnboardingViewModel`.
- Refactored app flow entry to use ViewModel state, resume step, and gate app entry by completion flag.
- Enabled final onboarding step to complete flow (`AddingWardrobe` next action now callable).
- Added required dependencies for lifecycle ViewModel and DataStore in Gradle catalogs/build file.
- Switched persistence to SQLite entities + helper + repository to align with mobile SQLite decision.

## Changelog
### 2026-03-19
- Created onboarding domain models and repository interface:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/domain/OnboardingModels.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/domain/OnboardingRepository.kt`
- Implemented local persistence layer:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/OnboardingLocalDataSource.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/DataStoreOnboardingRepository.kt`
- Added presentation logic for validation and flow orchestration:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/presentation/OnboardingValidation.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/presentation/OnboardingViewModel.kt`
- Rewired app onboarding entry/gating:
  - `app/src/main/java/com/brian_bui/true_clothes/MainActivity.kt`
- Updated onboarding last-step action behavior:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/AddingWardrobeOnboardingScreen.kt`
- Added dependencies:
  - `gradle/libs.versions.toml`
  - `app/build.gradle.kts`
- Implemented SQLite entity/storage layer and wired ViewModel repository:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/OnboardingProfileEntity.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/PrivateMeasurementsEntity.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/OnboardingSQLiteHelper.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/RoomOnboardingRepository.kt` (contains `SQLiteOnboardingRepository`)
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/presentation/OnboardingViewModel.kt`
- Implemented real location detection on country onboarding:
  - Added runtime location permissions in `app/src/main/AndroidManifest.xml`
  - Added permission request flow, device location lookup, reverse geocoding, and country auto-selection in `app/src/main/java/com/brian_bui/true_clothes/onboarding/CountryOnboardingScreen.kt`
- Switched country detection to Fused Location Provider API:
  - Added Play Services location dependency in `gradle/libs.versions.toml` and `app/build.gradle.kts`
  - Replaced `LocationManager` usage with `FusedLocationProviderClient` (`lastLocation` + `getCurrentLocation`) in `app/src/main/java/com/brian_bui/true_clothes/onboarding/CountryOnboardingScreen.kt`
- Updated country auto-detection display/value mapping:
  - Keep persisted selection as country option for flow validation/state.
  - When location permission is granted and geocoder resolves address, show country input text as `city, country`.
  - Clear detected location display when user manually chooses a country from the list.

### 2026-05-26 — Fit Engine: Style Coherence Improvements
- **`styleCoherence.ts`**: Fixed style preference matching to better differentiate outfits:
  - `itemAttributes()` now uses only top 2 style tags (was all 4-5), primary weighted 3× (was 2×). Secondary tag's set attributes filtered to only overlapping values. Prevents attribute bloat where every item matches every user preference.
  - `scoreStyleCoherence()` now blends 70% attribute similarity + 30% direct primary-tag match against user's selected styles. Items whose primary style tag matches a user-selected style get a measurable boost.
  - `computeUserAttributes()` threshold lowered from 0.3 to 0.15 so earlier-selected styles aren't dropped when 3+ styles are selected.
  - `attributeSimilarity()` reweighted: formality 25% (was 20%), mood 25% (was 25%), silhouette 20% (was 15%), palette 15% (was 20%), texture 10%, pattern 5% (was 10%). Prioritizes the most style-distinctive dimensions.
- **`outfitRanker.ts`**: Increased style+color weights to 25% each (was 20%), reduced fit+proportion to 10% each (was 15%). User preferences now contribute 50% of total score vs. 40% before.
- **Two-tier ranking**: Added `classifyTier()` — Tier 1 if both top AND bottom have a top-2 style tag matching user's selected styles; Tier 2 otherwise. Outfits sorted tier-first, then by totalScore within each tier. User-style-matching outfits always appear before flex/discovery outfits.
- **`shuffler.ts`**: Rewritten to respect style tiers. Shuffles within quality thirds inside each tier, never mixes Tier 1 and Tier 2 outfits.
- **`ScoredOutfit` type**: Added `tier: 1 | 2` field. Propagated to `Outfit` type for downstream use.

### 2026-05-29 — Intent Engine: Chat AI → Suggest Engine Bridge
- **`IntentContext` type** (`src/types/fitEngine.ts`): New type for chat-driven outfit intent. Fields: `styles`, `mood`, `colorScheme`, `bodyGoal`, `proportionRule`, `occasion`, `formalityRange`, `seasonOverride`, `maxColors`, `requireOuterwear`, `requireAccessory`, `weightOverrides`, `rawInput`. All optional — only set fields override the user's baseline profile.
- **Supporting types**: `ColorScheme` (monochrome | analogous | complementary | neutral_accent | tonal), `BodyGoal` (elongation | broaden_shoulders | define_waist | balanced), `OccasionTag` (daily | date_night | business | weekend | event | travel), `ScoringWeights`.
- **`intentResolver.ts`** (`src/services/fitEngine/intentResolver.ts`): Resolves `IntentContext` into concrete engine parameters — formula preferences, scoring weight adjustments, style overrides, and hard constraints. Maps colorScheme → formula IDs, bodyGoal → formula + weight boosts, occasion → formality range defaults.
- **`EngineContext` updated**: Added optional `intent` and `scoringWeights` fields. When `intent` is present, `generateOutfits()` calls `resolveIntent()` and `applyIntent()` to merge overrides into the context before running the pipeline.
- **`outfitRanker.ts` updated**: Now reads `ctx.scoringWeights` when present, falling back to default weights. No behavior change when intent is absent.
- **Design principle**: The intent layer is an override, not a replacement. User's baseline profile (styles, colors, body) remains the default. Intent acts as a temporary filter/boost for a single generation request.
- **Not yet implemented**: seasonOverride in scorer, chat AI prompt template, chat UI screen.

### 2026-05-29 — Engine Redesign: StyleConfig + Anchor Clarity + HSL Colors

**Phase 1: StyleConfig system with hard constraints**
- **`StyleConfig` type** (`src/types/fitEngine.ts`): New prescriptive style config with three parts: (1) hard constraints — palette with graded matching (perfect/allowed/accent/banned), fabricsAllowed/fabricsBanned, allowedFits, formalityRange, bannedFeatures; (2) override power — which user preferences the style clobbers; (3) per-style scoring weights.
- **`styleConfigs.ts`** (`src/services/fitEngine/styleConfigs.ts`): All 8 style configs authored (oldmoney, minimalist, streetwear, smartcasual, preppy, athleisure, y2k, bohemian). Each with unique palette restrictions, fabric rules, fit constraints, and tuned scoring weights.
- **`styleFilter.ts`** (`src/services/fitEngine/styleFilter.ts`): `filterByStyle()` applies hard constraints to DELETE non-matching items before candidate generation. Returns `FilterResult` with passed items and rejected items + reasons (for UI explanation layer). Safety valve: if all items in a required category are filtered out, the least-violating items are restored.
- **Pipeline wired**: `generateOutfits()` now applies `filterByStyle()` using the primary style config before candidate generation. Per-style weights applied to ranker. Override cascade: intent weights > style weights > defaults.

**Phase 2: Stored item attributes + anchor clarity scorer**
- **`FitItem` extended** with stored fields: `fit` (slim/regular/relaxed/wide/oversized), `warmth` (1–5), `formality` (1–5), `statementStrength` (0–5), `fabricName`. All derived at classification time in `itemClassifier.ts`, not at scoring time.
- **`itemClassifier.ts`**: Added `deriveFit()` (from item.fit field or name keywords, with per-type defaults), `deriveWarmth()` (from material), `deriveFormality()` (from type + color + material), `deriveStatementStrength()` (from pattern + graphics + saturation + subtype drama), `deriveFabricName()` (normalized material name).
- **`anchorClarity.ts`** (`src/services/fitEngine/anchorClarity.ts`): New scorer implementing the "One Hero Piece" principle. Uses stored `statementStrength` to score: 1 clear hero with quiet support = 1.0, no hero = 0.5, multiple competing loud items = 0.2. Fills the 0.05 reserved weight slot.
- **`proportionBalance.ts`** rewritten to use stored `fit` field (VOLUME map: slim=1, regular=2, relaxed=3, wide=4, oversized=5) instead of deriving volume from style tag silhouettes.
- **`formalityConsistency.ts`** simplified to use stored `formality` field directly instead of deriving from style tag lookups.

**Phase 2c: Improved diversification**
- **`outfitRanker.ts`**: Replaced binary exact-match dedup with graded overlap penalty. Outfits sharing 2+ items with already-selected higher-ranked outfits receive a score penalty (0.05 per overlapping item beyond 1). Prevents "5 outfits with the same navy pants" while allowing partial overlap. Re-sorts within tiers after penalty application.

**Phase 2 (ranker): New hard constraints**
- `passesHardConstraints()` now also rejects: both top AND bottom oversized (proportion cardinal sin), formality gap > 2.5 between any items, intent formalityRange violation, missing required outerwear/accessory slots.
- Accepts `ctx.intent?.maxColors` to tighten the default 4-color limit.

**Phase 3: HSL color migration**
- **`ColorProfile` extended** with: `hue` (0–360, undefined for achromatic), `sat` (0–100), `lum` (0–100), `undertone` (warm/cool/neutral).
- **`itemClassifier.ts`**: `COLOR_MAP` now stores HSL values for all 35 named colors with correct hue angles, saturation, lightness, and undertone classification.
- **`colorHarmony.ts` rewritten**: Uses continuous HSL math instead of discrete lookup tables. New dimensions: (1) color relationship scoring via hue angle difference (analogous ≤30°, complementary 150–180°, clashing 60–120°); (2) undertone consistency (warm/cool mixing penalty); (3) lightness contrast via continuous lum values; (4) saturation consistency via sat percentages. Weights: 0.20 alignment + 0.20 relationship + 0.15 undertone + 0.15 contrast + 0.10 saturation + 0.10 colorCount + 0.10 graphic.

### 2026-05-30 — Supabase auth + profile integration

**Auth model**
- Phone OTP via Supabase Auth is the primary path. Email is collected during account onboarding but is **not** an auth method — it is stored on `public.profiles.email` for recovery/communication only.
- Social (Apple/Google) buttons are temporarily stubbed (Alert: "Coming soon"). Wiring requires native config + a deep-link redirect handler; deferred.

**Service layer (`src/services/`)**
- `supabase.ts`: Supabase client with `AsyncStorage` session adapter, `detectSessionInUrl: false`. Reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` at module load; throws if missing.
- `authService.ts`: `toE164`, `sendPhoneOtp`, `verifyPhoneOtp`, `getCurrentUserId`, `signOut`. The only module that touches `sb.auth.*`.
- `profileService.ts`: `fetchMyProfile`, `updateMyProfile`, `markOnboardingComplete`. Maps app-shaped data to DB columns at this boundary only — `dob` (`DD/MM/YYYY` ↔ ISO), `location` (`"City, Country"` ↔ `location_city` + `location_country`).

**`authStore.ts` refactor**
- Replaced `login(phone,email)` with two-step `sendOtp(phone,email)` → `verifyOtp(code)`. On successful verify, the store writes phone (+ email if provided) to `public.profiles` and hydrates the rest from the DB.
- `setProfile`, `completeOnboarding`, `logout` now go through `profileService` / `authService` instead of `AsyncStorage`. Local state still mirrors fields for fast UI.
- `hydrate()` reads the session, populates state from `public.profiles`, and subscribes to `sb.auth.onAuthStateChange` so token refresh / external sign-out keep state consistent.

**Screen wiring**
- `app/(onboarding)/account.tsx`: `handleContinue` now calls `sendOtp` and routes to `/(onboarding)/otp` (no longer skips OTP). Inline send/verify errors, loading state on the CTA.
- `app/(onboarding)/otp.tsx`: shows the resolved E.164 `pendingPhone`, calls `verifyOtp`, supports real resend. If a user lands here without a `pendingPhone` (deep link, refresh), it bounces back to `account`.
- Downstream onboarding screens (`basics`, `location`, `complete`, `wardrobe-intro`) and `(tabs)/menu` continue to use `setProfile` / `completeOnboarding` / `logout` — same surface, now backed by Supabase.

**Config**
- `package.json`: added `@supabase/supabase-js`. Run `npm install` after pulling.
- `.env.example` added with `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `.env` added to `.gitignore`.

**Not deployed / NOT in this change**
- No schema migrations applied or pushed — `public.profiles` is consumed as documented in `docs/server-database-definition.md`, assumed already deployed.
- `public.clothing_items` still NOT implemented (per the DB doc), so the wardrobe is still local.
- OAuth providers (Apple/Google) deferred.

### 2026-05-31 — Engine migration to Supabase Edge Function

**What moved**
- All 15 engine modules (itemClassifier, styleCatalog, styleConfigs, formulaCatalog, outfitCompositor, styleFilter, intentResolver, colorHarmony, styleCoherence, fitMatcher, proportionBalance, formalityConsistency, seasonMatch, textureHarmony, anchorClarity, outfitRanker, shuffler) consolidated into 7 backend files under `supabase/functions/generate-outfits/engine/`.
- Entry point: `supabase/functions/generate-outfits/index.ts` — HTTP handler with auth, DB loading, pipeline orchestration.

**Backend structure (7 files, ~2,100 lines)**
| File | Content |
|---|---|
| `engine/types.ts` | All engine-internal types (FitItem, StyleConfig, FormulaPool, etc.) |
| `engine/enrichment.ts` | toFitItem() with category/color/fabric/style classification maps |
| `engine/filtering.ts` | Style hard constraint filtering + STYLE_CONFIGS data |
| `engine/generation.ts` | Formula catalog + 10 pool functions + candidate compositor |
| `engine/scoring.ts` | 7 scorers merged + anchor clarity + style catalog data |
| `engine/ranking.ts` | Intent resolver + ranker (hard constraints + soft scoring + diversification) + daily shuffler |
| `index.ts` | HTTP handler, auth check, DB loading, pipeline orchestration |

**API**
```
POST /functions/v1/generate-outfits
Auth: Bearer <Supabase JWT>
Body: { "intent"?: IntentContext }
Response: { "outfits": ScoredOutfit[] }
```

**Client changes**
- `fitEngineStore.ts`: Removed `computeOutfits()` (local engine call). Added `fetchOutfits(intent?)` which calls `sb.functions.invoke('generate-outfits')`. Removed `formulaPreferences` state and `setFormulaPreferences` (now server-side).
- `useFitFeed.ts`: Rewritten from synchronous `useMemo` to async `useEffect` + `useState`. Calls `fetchOutfits()`, converts `ScoredOutfit[]` to `Outfit[]` for the feed. Added `loading` and `refresh` to the return value.
- `types/fitEngine.ts`: Trimmed to client-only types — `BodyMeasurements`, `UserStyleProfile`, `ScoredOutfit`, `IntentContext`, `OutfitSlots`, `ScoringWeights`. Removed engine-internal types (`FitItem`, `StyleConfig`, `FormulaPool`, `EngineContext`, etc.).

**Data note**
- Style catalog, style configs, formula catalog, and classification maps are kept hardcoded in the edge function for now. They will move to DB config tables (styles, style_configs, formulas, colors, garment_types, fabric_types, color_style_boosts, engine_config) in a future migration.
- The edge function reads user data from: `profiles`, `body_measurements`, `style_profiles`, `clothing_items`.

**Not changed**
- The 15 original engine files in `src/services/fitEngine/` are still present. They can be removed once the edge function is deployed and verified. `src/data/measurements.ts` can also be removed (garment measurements now come from `clothing_items.measurements` column).

## Next
- Deploy the edge function: `supabase functions deploy generate-outfits`.
- Create DB config tables (styles, style_configs, formulas, etc.) and migrate hardcoded data out of the edge function.
- Remove the 15 original engine files from `src/services/fitEngine/` after verifying the edge function works.
- Wire `public.clothing_items` once schema is defined.
- Add Apple/Google sign-in (native config + redirect handling).

---

## 2026-06-10 — Engine P0 fixes + LLM curator layer

**Engine fixes (`supabase/functions/generate-outfits/`)**
- **Personal color wired into scoring** (Q16): `index.ts` now reads `profiles.color_season` + `personal_palette`; `personal_palette` merges into `colorPreferences`, `color_season` flows into `ctx.colorSeason` so `seasonCompatibilityBonus` in `scoring.ts` is live (was dead code — `profileRes` fetched but never used).
- **Color lookup case-insensitive** (`enrichment.ts`): `COLOR_MAP`/`COLOR_STYLE_BOOSTS` keyed exact Title Case; lowercase values from future AI extraction silently fell through to the default 'natural' profile. Material lookups normalized via `primaryMaterial()` for the same reason.
- **Exclude by core triple**: paging exclusion used the top-slot id as pseudo-id, so excluding one outfit killed every outfit sharing that top. Server + client (`fitEngineStore.ts`) now key on `top|bottom|shoes`; legacy bare-top ids still honored until shown-ID caches cycle.
- **`seasonOverride` now scored**: `scoreSeasonMatch(items, targetSeason?)` blends 0.6×target-match + 0.4×internal consistency when intent carries a season; previously resolved but unused.
- **`poolHighLow` uses real formality**: replaced the category-level `estimateFormality` (top max ≈3.5 → formal-top pools nearly unreachable) with enrichment's `item.formality`.
- **Candidate generation de-biased** (`generation.ts`): the cap was consumed by outerwear/accessory variants of the first core triple; now all distinct top×bottom×shoes triples are generated first, variants layered round-robin after. Shuffle is seeded per user+day (mulberry32) so paging/exclusion are coherent within a day.

**New: LLM curator (`engine/curator.ts`)**
- Final taste pass after rank+shuffle: Claude re-ranks the top ≤24 rule-validated candidates into 10 picks, may veto 0–4, writes a one-line `stylistNote` per pick (locale-aware vi/en). References candidates by index only — cannot invent items/combos.
- Model `claude-haiku-4-5` (~$0.0055/batch), override via `CURATOR_MODEL` secret; structured outputs (`output_config.format` json_schema); 3.5s timeout, 0 retries; any failure → silent fallback to rule order. Skipped entirely when `ANTHROPIC_API_KEY` secret is unset.
- API: request body adds `locale?: 'vi'|'en'` and `curate?: boolean` (client gates by tier); response adds `curated: boolean`; `ScoredOutfit` gains `stylistNote?` (server + client types).
- UI follow-up: feed card should render `stylistNote`; client may prefetch the next batch around card ~6 to hide curator latency.

**Ops**
- To enable curation: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (function works without it — rule order, no notes).

---

## 2026-06-11 — Engine taste layer, weather wiring, curator gating, legacy cleanup

**Engine (`supabase/functions/generate-outfits/`)**
- **Claude path fully separated**: `curatorEnabled()` checks `ANTHROPIC_API_KEY` up front in `index.ts` — when unset, the curation branch is skipped entirely (no prompt building, no SDK call) and the rule-engine order returns directly.
- **Taste layer** (`scoreTasteAdjustment` in scoring.ts): flat bonus for ~17 classic core combos (shirt+trousers+loafers, tee+jeans+sneakers, …) keyed on new `FitItem.typeName`; multiplicative vetoes for clashing pairs (sandals+trousers, oxfords+shorts, …), all-dark-flat looks, warm/cool undertone fights, ≥3 competing statement pieces. Applied in ranking as `(base + bonus) × multiplier` — one fatal flaw now sinks an outfit instead of being averaged away.
- **Confidence weighting** (ranking.ts): dimensions with no real data (fit without measurements, style without attributes) drop out of the weighted average instead of injecting neutral 0.5s; weights renormalize over valid dims. `fit` weight floors at 0.18 when the user has body measurements.
- **Multi-style filtering** (index.ts): items pass if they fit ANY of the user's selected styles (up to 5), union across configs; scoring weights still from the primary style.
- **Catalog dedupe**: `STYLE_CATALOG` (scoring.ts) is now derived from `STYLE_CONFIGS` (filtering.ts) — single source of truth, no more drift.

**Client**
- **Weather → engine** (fitEngineStore.ts): `weatherContext.temperatureBand` (cold/mild/warm/hot → winter/fall/spring/summer) is sent as `intent.seasonOverride` on every feed fetch — live weather now shapes suggestions end-to-end.
- **Curation gating**: premium (RevenueCat `usePremium`, synced into the store by `useFitFeed`) → every batch curated; free → one curated batch per day (AsyncStorage `last-curated-date`); sends `curate: false` otherwise.
- **Stylist note UI** (app/(tabs)/index.tsx): renders `outfit.stylistNote` above the bottom meta in italic serif; `Outfit` type gains `stylistNote?`.
- **Prefetch**: feed `onEndReachedThreshold` 0.5 → 3 (next batch loads ~3 cards before the end, hiding curator latency).
- **formulas-edit fixed**: was importing the deleted legacy catalog and a store API that no longer existed; now uses server-driven `formulas` catalog (Q44) + restored `formulaPreferences`/`setFormulaPreferences` on the store (persisted via `style_profiles.formula_preferences`, hydrated on launch).
- **Legacy removed**: `src/services/fitEngine/` (15 files + tests) and `src/data/measurements.ts` deleted — edge function is verified as the only engine.

**Still open (needs decisions/schema)**: ingest-time AI enrichment columns on `clothing_items`; DRESS as one-piece composition (Q29); behavior-event logging (Q18); catalogs → DB tables; blind model eval once `ANTHROPIC_API_KEY` is set.

---

## 2026-06-11 (2) — Ingest enrichment, one-piece support, behavior events, interaction-service repair

**Ingest-time enrichment (engine reads stored attributes)**
- The extraction prompt already returned `pattern` + `warmthSeason` and `clothing_items` already had the columns — but the client `ExtractedItem` dropped both fields between extraction and save. Chain now complete: `ExtractedItem` carries them → `confirmItems` passes to `AddItemInput` → `wardrobeService` persists (text column, comma-joined) → engine selects `pattern, warmth_season` and prefers stored values over name-keyword inference (`resolvePattern`, `applyStoredWarmth` in enrichment.ts; stored warmth maps to fabricWeight + season).

**One-piece composition (Q29)**
- New `ItemCategory 'onepiece'`; DRESS/JUMPSUIT/OVERALLS/GOWN map to it. Generation emits onepiece+shoes (+outerwear) candidates where the one-piece fills both top and bottom slots with the same id; `slotsToIds` (server + client) dedupes so the garment is scored/rendered once. Fit uses TOP_MAPPINGS; proportion counts it as both halves; curator describes it as `one-piece:`.

**Behavior events (Q18) + curator measurement**
- Migration `fix_outfit_interactions_for_events`: added `outfit_data jsonb`, widened type check to include `'impression'`, added the unique `(user_id, outfit_id, type)` that upserts required.
- `logImpressions()` records every outfit the feed shows with `{curated, formula, position}`; wired into both fetch paths (fire-and-forget). Save-rate by curated flag is now queryable: `select outfit_data->>'curated', count(*) ... join saved`.

**outfitInteractionService repair (schema drift — service had never written a row: 0 rows in prod)**
- `'save'` → `'saved'` (DB check constraint), `scheduled_date` → `scheduled_for` (actual column), snake_case → camelCase mapping in `fetchInteractions` (`outfitId` was undefined before), `types/outfit.ts` + appStore hydration updated to match.

**Deployed**: engine re-deployed and boot-verified. Client compiles (remaining tsc errors are pre-existing: expo-file-system EncodingType, help.tsx icon prop, untyped params in outfit/[id].tsx).

---

## 2026-06-17 — Account type discriminator + store-verified premium sync

**Schema**: `profiles.account_type text not null default 'free' check in ('free','premium','demo','admin')` (migration `20260616000001_profiles_account_type.sql`, applied to live DB). Previously account class was only known at runtime (RevenueCat) / by hardcoded demo credentials — now it is queryable and server-gateable.

**Source of truth — store payment only**: `account_type` is written *exclusively* by completed Google Play / App Store purchases, never set manually. Sync is server-authoritative via a new RevenueCat webhook:
- **`supabase/functions/revenuecat-webhook/index.ts`** (NEW): authenticates RevenueCat's configured shared secret (`REVENUECAT_WEBHOOK_SECRET`, NOT a Supabase JWT → must deploy `--no-verify-jwt`), maps `event.app_user_id` → `profiles.id`, and flips `account_type`. GRANT set (INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE/UNCANCELLATION/NON_RENEWING_PURCHASE/SUBSCRIPTION_EXTENDED/TEMPORARY_ENTITLEMENT_GRANT) → `premium`; REVOKE set (EXPIRATION/SUBSCRIPTION_PAUSED) → `free`. CANCELLATION/BILLING_ISSUE are no-ops (access kept until expiry). TRANSFER moves entitlement between ids. Only the `premium` entitlement is acted on; updates guard `account_type in ('free','premium')` so `demo`/`admin` are never clobbered; anonymous/non-UUID `app_user_id`s ignored.
- **`app/_layout.tsx`** (MODIFIED): RevenueCat init now calls `Purchases.logIn(supabaseUserId)` after `configure()` so `app_user_id` equals the Supabase `user.id` — the webhook's only way to resolve the event back to a profile. (T079 had specified this but the code only called `configure`.)

**First reader of `account_type` — AI import gate**: `useItemExtraction.startExtraction` now treats a user as premium if EITHER the live RevenueCat entitlement is active OR `profiles.account_type ∈ {premium, admin}` (new `hasPremiumAccountType()` / `fetchMyAccountType()` in `profileService.ts`). This lets a store-verified upgrade unlock unlimited AI import even where RevenueCat is absent (Expo Go) or hasn't synced. `incrementCredit` still runs but the count no longer gates premium accounts.

**Still not wired (open)**: `usePremium` itself still derives `isPremium` only from RevenueCat — so cloud photo storage (`addWardrobeItem` tier) and the generate-outfits curation gate do NOT yet read `account_type`. Webhook is written but not deployed; needs `supabase functions deploy revenuecat-webhook --no-verify-jwt`, `supabase secrets set REVENUECAT_WEBHOOK_SECRET=…`, and the matching URL+Authorization header configured in the RevenueCat dashboard.
