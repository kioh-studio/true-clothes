# Onboarding Logic Plan

## Documentation Policy
- UI/visual/interaction requirement changes must be recorded in the relevant `app/design/**/design.md` file(s).
- Non-UI logic changes must be recorded in this `plan.md`, including:
  - data storage and persistence behavior
  - backend/business logic behavior and flow changes
  - domain/model/repository contract changes
  - validation logic rules that affect application behavior
- Update documentation in the same working session as the implementation change.

## Changelog — 2026-06-21 · Smarter on-device cutout fallback (background-model segmentation)

**Why.** The on-device extractor's tier-2 fallback (corner chroma-key) only worked
on a perfectly uniform background. Real onboarding photos (flat-lay on a wood/linen
floor or bed) defeated it: ML SubjectSegmenter (tier 1) fails on flat-lays (no
salient "subject"), and the corner-key left all the wood grain/seam pixels →
"couldn't isolate cleanly". Goal is to keep extraction **on-device/free** (the
AI path costs per use) so users build a wardrobe fast during onboarding.

**Decision.** Pure-native algorithm (no OpenCV / no new deps — keeps the app light,
which matters for the install/onboarding funnel). GrabCut was rejected: it adds
~30–40 MB (iOS framework) and, being colour-model based, would NOT solve the one
case pure-native also can't (item colour ≈ background colour).

**Algorithm (validated in Python on real photos before porting; replaces tier-2 in
both `ExpoItemExtractModule.kt` and `.swift`):**
1. Work at ~512 px. sRGB→LAB.
2. Sample a 6%-wide border frame; k-means (k=6) → background colour model.
3. **Keep only clusters with ≥10% border share** — drops foreground that intrudes
   into the border (e.g. a dress touching the edge). *Critical*: without this, an
   edge-touching item poisons the bg model and the whole item gets erased.
4. Per-pixel bg-candidate if min LAB distance to a kept cluster < 14.
5. Flood from the borders (4-conn components) → keep only border-connected bg;
   foreground = the rest. Handles multi-tone backgrounds (grain, seams) that a
   single-colour key can't.
6. Fill holes → 3×3 opening → drop fg components < 1% area.
7. **Degenerate guard:** fg < 3% or > 97% → return null → tier 3 (original +
   `usedFallback`). This is what stops a low-contrast white-on-white photo from
   being output as a blank/erased image; the UI then shows the "plainer background"
   hint.
8. Feather (small box-blur ≈ gaussian) + soft threshold; upscale mask to full res.

**Validated results (Python reference, exact params): black dress on wood floor
ΔE≈75 → clean cut-out (44% fg); navy dress on grey studio ΔE≈56 → clean cut-out
(17% fg); white dress on grey ΔE≈1.8 → 0% → guard rejects (correct — no colour
signal; that clean studio shot is ML tier-1's job, and no colour method incl.
GrabCut could separate it). Rule of thumb: works whenever item vs background ΔE
≳ 12–15.**

**Emulator/perf hardening (2026-06-21, after on-device testing).** Testing surfaced
that **ML Kit Subject Segmentation's model is downloaded on demand via Play
Services** and cannot be provisioned on the test emulator (logcat: `dl-Mlkit
SubjectSegmentation…has no usable artifacts` looping). The segmenter then stalled
the full 10 s timeout per item, and GMS's endless retry churn overloaded the
emulator → System-UI ANR. Fixes (all in `ExpoItemExtractModule.kt`):
- **Skip ML tier-1 on emulators** (`Build.FINGERPRINT/HARDWARE/MODEL` detection) →
  app goes straight to the on-device fallback and never triggers the GMS download.
- **3 s fail-fast + per-process skip flag**: on a real device, if the model isn't
  ready (first-run download / offline) the first call caps at 3 s and every later
  extraction skips ML for the rest of the session (no repeated stalls when adding
  several items). Labels/OCR awaits 10 s → 5 s.
- **Bulk pixel I/O** in the ML mask application (`getPixels`/`setPixels` instead of
  per-pixel `getPixel`/`setPixel`, which is pathologically slow on multi-MP images).
- Operationally cleared GMS (`pm clear com.google.android.gms`) to stop the
  already-pending download churn on the test emulator.
Root cause was the environment (emulator can't provision the unbundled ML model),
not the fallback or app logic; real devices download the model once and work.

**Tiers now:** ML SubjectSegmenter (skipped on emulator) → background-model fallback → original+nudge.
Android dev client rebuilt & installed (`BUILD SUCCESSFUL`). iOS port mirrors the
Kotlin (only buildable/verifiable on an iOS build). On-device confirmation of the
Kotlin port against the validated result is the remaining check.

## Changelog — 2026-06-21 · Enable extract-by-item on emulator (first native dev build)

**Why.** "Extract by item" was disabled on the emulator. Root cause: the emulator
ran **Expo Go** (`host.exp.exponent`), which cannot include custom local native
modules, so `requireOptionalNativeModule('ExpoItemExtract')` → null →
`isAvailable=false` (expected, documented). Fix = build a **dev client** that
compiles `modules/expo-item-extract`. This was its **first ever Android build**, so
several latent module bugs surfaced (all build-time, none caught before because the
module had only ever been referenced, never compiled):

1. **`app.json` had no `android.package`** → `expo prebuild` can't generate the
   Android project. Added `"package": "com.briank.mien"` (mirrors the iOS
   `bundleIdentifier`). Prebuild now generates `android/` (CNG; treat as ephemeral).
2. **`modules/expo-item-extract/android/build.gradle`** referenced
   `$kotlin_version` (undefined ext property) on an explicit `kotlin-stdlib-jdk8`
   dep → project evaluation failed. Removed the line; the `kotlin-android` plugin
   adds stdlib automatically.
3. **Wrong ML Kit Subject Segmentation Gradle coordinate.** `com.google.mlkit:
   subject-segmentation:1.0.0-beta1` does not exist on Google Maven. Subject
   Segmentation ships **only via Play Services**: changed to
   `com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1`
   (verified the version against Google Maven metadata). The Kotlin imports
   (`com.google.mlkit.vision.segmentation.subject.*`) are unchanged.
4. **Wrong Subject Segmentation API call** in `ExpoItemExtractModule.kt`: the
   factory is `SubjectSegmentation.getClient(options)`, not
   `SubjectSegmenter.getClient(...)`. Fixed the call + added the `SubjectSegmentation`
   import; the other 4 Kotlin errors (`foregroundConfidenceMask`, type inference,
   `* 255`) were all cascades that cleared once `getClient` resolved.

**Result.** `BUILD SUCCESSFUL`; `app-debug.apk` installed as `com.briank.mien`;
dev client launched against Metro (8081). `isAvailable` is now true on the emulator
→ extract-by-item is enabled. iOS Vision path is untouched (these were Android-only
build issues). Test image (`black dress on wood-plank floor`) was pushed to the
emulator gallery for the patterned-background case.

## Changelog — 2026-06-21 · describe-outfit: per-locale prompts (EN/VI)

**Goal.** `describe-outfit` should return an **English** description when called with
`locale: 'en'` and a **Vietnamese** one with `locale: 'vi'`.

**Edge function (`supabase/functions/describe-outfit/index.ts`, redeployed).**
- Replaced the single English `SYSTEM_PROMPT` (which carried a "write in {lang}"
  rider) with **two fully-localised system prompts** — `SYSTEM_PROMPT.en` and
  `SYSTEM_PROMPT.vi` — plus localised user-turn labels (`LABELS.{en,vi}`:
  styles / occasion / "Outfit:" / "write the description in …"). The whole prompt
  is now in the target language so the copy reads natively, rather than asking an
  English prompt to switch languages.
- `resolveLocale(body.locale)` → `'en'` only when explicitly `'en'`, else `'vi'`
  (Vietnamese stays the default for any missing/unknown value). Item lines stay
  language-neutral (they're DB attribute data the model weaves in).
- Verified on the deployed function with a real demo JWT: identical outfit payload
  → fluent English for `en`, fluent Vietnamese for `vi`.

**Client — locale was hardcoded, now follows the app language.**
- `useOutfitDescription` passed `locale: 'vi'` literally, so an English UI still
  got Vietnamese. It now reads the live language via `useTranslation()` →
  `i18n.language.startsWith('vi') ? 'vi' : 'en'`, and re-runs when the language
  changes (added `locale` to the effect deps).
- `outfitDescriptionService.describeOutfit` cache was keyed by `outfitId` only, so
  switching language would return the stale other-language text. Key is now
  `${outfitId}::${locale}` so EN and VI are cached independently.
- Server change is live (no rebuild). Client change ships with the next app reload.

## Changelog — 2026-06-20 · Demo account → fixed user with pre-seeded cloud wardrobe

**Problem.** The demo path used `signInAnonymously()`, but anonymous sign-in is disabled on the live project (0 anon users ever) and ephemeral anyway (fresh uid/login) — so the demo never got a session, let alone a persistent wardrobe. RLS on `clothing_items`/`wardrobes` (role `authenticated`, `auth.uid() = wardrobes.user_id`) and on `storage.objects` (`auth.uid() = (storage.foldername(name))[1]`) means the demo needs a stable authed uid owning its own data + images.

**Approach (A + I1).** Fixed demo user via email+password (no anonymous auth, no security-setting changes), with images duplicated into the demo's own storage folder (existing RLS unchanged).

**DB / storage ops (live project, idempotent):**
- Created permanent auth user `demo@mien.app` (email-confirmed, bcrypt password, email identity) → stable uid `D = 19595dec-bad6-48e7-a859-fbabee490b7d`. Verified password sign-in via GoTrue REST.
- Profile `D`: `account_type='demo'`, `onboarding_complete=true`, demo profile fields.
- Copied Khoi's 32 `clothing_items` (wardrobe `2857ddef…`) into the demo wardrobe (`b9651128…`) with new ids, `photo_storage='cloud'`, `photo_url = D/<source_basename>` (basename preserved so the copy is a folder-prefix swap).
- Copied the 32 storage objects `d90a166b…/<name>` → `D/<name>` via the Storage API as the demo user, gated by a **temporary, tightly-scoped** SELECT policy (`demo_seed_read_owner`: only uid D, only Khoi's folder) that was **dropped immediately after** — storage policy set is back to the original 6.

**Code:**
- `src/config/demo.ts`: `DEMO_EMAIL = "demo@mien.app"`; added `DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD`.
- `src/services/authService.ts`: added `signInWithPassword(email, password)`.
- `src/stores/authStore.ts`: demo `verifyOtp` branch now calls `signInWithPassword(DEMO_EMAIL, DEMO_PASSWORD)` instead of `signInAnonymously()` (keeps the `000000` OTP UX + onboarding pre-seed). Phone and email demo entry both converge on this one user.
- `.env` + `eas.json` (all 3 profiles): added `EXPO_PUBLIC_DEMO_PASSWORD`.

**Security note.** `EXPO_PUBLIC_DEMO_PASSWORD` is a **baked-in shared demo credential** (committed in `eas.json`, shipped in the binary) — same backdoor class as the `000000` OTP, but scoped to a throwaway demo account holding only demo data (not Khoi's account). Khoi's real folder stays private (verified: demo signing a `d90a166b…` path → 400).

**Verification.** Demo wardrobe returns 32 cloud items; 32 objects under `D/`; demo signs + GETs its own image (HTTP 200, real bytes) under normal RLS; cross-folder read denied (400). `tsc` clean; full suite 81/81. **A new EAS build is required** for the app-side changes (new demo email + `signInWithPassword` + demo password env) to reach TestFlight.

## Changelog — 2026-06-20 · Clean build archive + dev/prod (emulator vs standalone) parity

**Part A — clean build, no leftovers.**
- Added `.easignore` (self-contained superset of `.gitignore`'s heavy excludes) so the EAS build archive ships only what the app needs. Excludes: `node_modules/`, `.expo/`, `dist/`, `.env*`, OS/IDE cruft, scratch artifacts (`*.zip`, `*.log`, `*.orig`, `*.stackdump`, `screens/` design exports), dev helper `scripts/`, `specs/` docs, tests/mocks (`**/__tests__/`, `**/*.test.*`, `jest.config.js`), and the dev-only seeder pair (`app/dev-seed.tsx`, `**/*.dev.ts(x)`).
- Removed tracked crash dumps `bash.exe.stackdump` + `screens/bash.exe.stackdump` (they were committed and shipping in the archive). Added `*.stackdump` and `screens/*-temp/` to `.gitignore`.
- `screens/*-temp/` and `scripts/eas-submit-driver.sh` are untracked scratch; they were also entering the archive (untracked-but-unignored files are uploaded) and are now excluded via `.easignore`. The two `try-on` components reference `screens/...` only in comments, so nothing in `app/`/`src/` imports `screens/`.

**Part B — emulator/standalone parity.**
- Env vars the app reads at runtime: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`src/services/supabase.ts`), `EXPO_PUBLIC_REVENUECAT_API_KEY` (`app/_layout.tsx`). Local `.env` contains only the two Supabase keys — both already present in eas.json `production.env` with identical values → **same Supabase project + same cloud item images** in standalone as on the emulator. No `Constants.expoConfig.extra` / app.config indirection exists.
- `EXPO_PUBLIC_REVENUECAT_API_KEY` is absent from BOTH `.env` and eas.json, and `_layout.tsx` guards it (`if (!apiKey) return`). So RevenueCat is consistently **disabled in both dev and prod** — not a parity gap, not a crash. Its real value is unknown; not added (would diverge from the emulator). Enable later by adding it to eas.json `env` once a value is provided.
- `app/dev-seed.tsx` ran `seedLocalPhotos()` on mount (flipping items to `photo_storage='local'`, reverting the cloud migration) with **no `__DEV__` guard** — reachable in production via `mien://dev-seed`. Fixed: added an early `if (!__DEV__) return <disabled>` guard (hooks moved into an inner component to keep hook rules valid) AND excluded the file + seeder from the build archive via `.easignore`. Now inert/absent in standalone.

## Changelog — 2026-06-20 · Fix TestFlight standalone launch crash (missing build-time env)

**Symptom.** Production build (v1.0.0 build 2, `4edb1321-…`) crashed immediately on launch via TestFlight on a physical iPhone, while headless checks (tsc, `expo export`, dev bundle) were all green — i.e. a standalone-build-only crash.

**Root cause (confirmed).** `src/services/supabase.ts` reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `process.env` at **module load** and `throw`s if either is missing (it's imported during auth-store hydration, so it runs at launch). Those vars only existed in the local `.env`, which is **gitignored** → not uploaded to the EAS build server. `eas.json` had **no** `build.production.env` block, and `eas env:list --environment production` returned *"No variables found"*. So at build time Metro inlined `undefined` for both → the throw fired on first launch → instant crash. (Dev/Expo Go works because Metro loads `.env` from the local machine.)

**Fix.** Added an `env` block with the (publishable) Supabase URL + anon key to the `development`, `preview`, and `production` profiles in `eas.json`, so they are baked into every standalone build. No secrets added beyond the already-publishable anon key; no source hardcoding. The existing throw in `supabase.ts` is retained as the loud-failure guard.

**Follow-up required (NOT done here).** A new build is needed for TestFlight to pick this up: `eas build -p ios --profile production`, then resubmit. `EXPO_PUBLIC_REVENUECAT_API_KEY` is still unset everywhere, but `app/_layout.tsx` guards it (`if (!apiKey) return`) so it degrades gracefully and is not a crash cause.

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

---

## 2026-06-20 — AI item extraction (006) + on-device "Extract by item" (007)

**006 (deployed):** `generate-item-image` Edge Function (Gemini detect with controlled-vocab validate/snap + measurement estimates + logo + nano banana 2 isolated images, injection-safe note steering + content-safety). Client: `imageGenerationService`, `wardrobeService` now persists real `type/fit/m_*/brand/source_url/graphics` + `source`. Added `clothing_items.graphics jsonb` (migration `20260620000001`). Add-to-Wardrobe wizard under `src/features/wardrobe-add/`. Removed dead Claude `extract-garments` path.

**007 (JS done; native scaffolded):** on-device "Extract by item" method — free, offline, no `ai_extraction` credit. Native Expo module `modules/expo-item-extract` (iOS Vision / Android ML Kit: subject mask → transparent PNG, image labels, OCR). `extractByItemService` snaps colour (LAB ΔE → 37 via `colorMatch`), type (`itemTypeMap`, blank on low-confidence), pattern (solid), logo (OCR → `graphics`), measurement defaults. Requires an **EAS dev client** (not Expo Go); ML Kit/Vision do not run on the iOS simulator. Type is required before save (`clothing_items.type` is NOT NULL).

**AI image → transparent cut-out (refinement):** the AI method returns the item on a **white background**; the on-device ML segmenter is reused purely to turn that into a transparent cut-out. New `cutoutOnDevice(uri)` in `extractByItemService` wraps the native `extractItem` and keeps ONLY the cut-out (AI metadata stays authoritative); it is a **no-op that returns the white-bg image unchanged when the native module is absent** (Expo Go / simulator) and never throws. Wired into `useAddWizard`'s AI branch (`refineAiCutout`): each AI result is refined and the replaced white-bg file deleted (best-effort). Source-selection strategy is unchanged — "Extract by item" → on-device, "Extract by AI" → AI; this only post-processes the AI image when native ML is available. Try On's auto-selection is left as-is (its AI branch only runs when native is absent, so there is nothing to refine there).
---

## 2026-06-21 — Home-feed curator moved from Claude Haiku → Gemini

**`generate-outfits/engine/curator.ts`** rewritten to run on **Gemini** instead of the Anthropic SDK. Interface (`CuratorInput`/`CuratorResult`), the system prompt, and `assemble()` (index validation, veto application, rule-order backfill to 10) are unchanged — only the model call and the gate changed, so `index.ts` integration is untouched apart from a comment.
- Gate is now **`GOOGLE_API_KEY`** (the same secret `generate-item-image`/`evaluate-item` already use) — `curatorEnabled()` checks it; one secret powers all AI paths. The old `ANTHROPIC_API_KEY` is no longer read anywhere.
- Default model **`gemini-2.5-flash`** (override via `CURATOR_MODEL`). Call is plain REST `generateContent` (no SDK dep) with **structured JSON output** (`responseMimeType: 'application/json'` + `responseSchema`, Gemini's uppercase-type OpenAPI subset) replacing Claude tool-calling. `temperature: 0.4`, `maxOutputTokens: 2048`.
- Reliability unchanged in spirit: single attempt, hard **5s** `AbortController` timeout (was 3.5s on the SDK), any failure → silent fallback to rule order; the feed never blocks on this layer.
- **To enable curation:** `supabase secrets set GOOGLE_API_KEY=…` (already set for item extraction → curation is now on by default). `ANTHROPIC_API_KEY` can be removed.

**Curation now actually reachable — `account_type` wired into the premium gate**
- `usePremium` (`src/features/monetization/usePremium.ts`) previously derived `isPremium` from RevenueCat ONLY, so the generate-outfits curation gate (`fitEngineStore.resolveCurateFlag` — premium = every batch, free = one batch/day) never saw store-verified or test accounts as premium, especially in Expo Go where `react-native-purchases` doesn't load. It now resolves premium as **(RevenueCat `premium` entitlement active) OR (`hasPremiumAccountType()` → `account_type ∈ {premium, admin}`)**. This closes the gap flagged in the 2026-06-17 entry ("usePremium itself still derives isPremium only from RevenueCat") for the curation + cloud-photo gates.
- Effect: a profile with `account_type = 'premium'` (written only by the RevenueCat webhook on a verified purchase, or manually for test/demo) now gets **every** feed batch curated by Gemini — so the curator is visibly exercised. Test account `khoibuiqn1011@gmail.com` is already `premium` in the live DB; no DB change was needed, only the client wiring.

**Curator was silently never applying — `gemini-2.5-flash` thinking timeout (root cause)**
- Symptom: no `stylistNote` ever appeared; feed was always rule order even for a premium account with `curate:true`. Verified via a throwaway `diag-curator` function (deployed `--no-verify-jwt`, called, then deleted) that ran the exact Gemini call with synthetic candidates and returned raw `finishReason`/`usageMetadata`/timing.
- Root cause: `gemini-2.5-flash` enables **thinking by default**. The curation call spent **~1422 thought tokens and ~9.9s** (finishReason still STOP, JSON valid) — far over the 5s `AbortController` timeout, so every call aborted → `curateOutfits` returned null → silent fallback to rule order. (This was true at 3.5s/4s/5s alike.)
- Fix: `generationConfig.thinkingConfig = { thinkingBudget: 0 }` in `curator.ts`. Measured: same prompt drops to **~1.2s** with valid structured output. Timeout left at 5s for headroom. Redeployed `generate-outfits`.

**Curator now also writes the outfit description (not just the note)**
- The home-feed card shows the curator's `stylistNote` (quoted), but the **detail screen** renders `outfit.longDescription`, which for generated outfits was always `''` (blank). The only "description" was `outfit.description` = joined item names ("White oxford shirt, Navy chinos…").
- Curator schema/prompt extended: each pick now returns `description` (2–3 sentences, ~320 chars, editorial copy about vibe + how pieces work + occasion) alongside `note`, in the user's locale. New `ScoredOutfit.stylistDescription` (server `engine/types.ts` + client `types/fitEngine.ts`) carries it through; `index.ts` is unchanged (passes outfits through). `maxOutputTokens` 2048→4096 to fit 10 picks × (note + description) + vetoes.
- Client: `scoredToOutfit` maps `longDescription = scored.stylistDescription ?? description` — AI description when the batch was curated, item-list fallback otherwise (never blank). Verified end-to-end via the throwaway diag: ~2.5s, valid JSON, Vietnamese note + 2–3 sentence description per pick.

**Outfit description moved OUT of bulk curation → lazy per-outfit `describe-outfit` (supersedes the "curator also writes the description" note above)**
- Why: measured on the REAL payload (24 candidates, 10 picks WITH descriptions), generating all descriptions in one call is **8–11s** (gemini-2.5-flash 11s, flash-lite 8.5s, gemini-2.0-flash retired/404) — output-token bound, no model fits a feed timeout. That made `generate-outfits` abort every time → `curated:false`, no notes, no descriptions (verified via a throwaway token-minting harness that called the deployed function as the real user).
- New split:
  - **Feed curation (`curator.ts`)** reverted to **note + rank only** (reverted schema/prompt/`maxOutputTokens` to 2048; `ScoredOutfit.stylistDescription` removed server + client). Note-only of 24 candidates ≈ 4s; `TIMEOUT_MS` raised 5s→**8s** for headroom so it never intermittently aborts. Verified: `curated:true`, 10/10 notes, ~5.2s end-to-end.
  - **`describe-outfit` Edge Function (NEW)**: Bearer-authed; body `{ items:[{name,type,color,material?,fit?}], styles?, locale?, occasion? }` → ONE 2–3 sentence editorial description (gemini-2.5-flash, thinking off, 8s timeout). Returns `{ description:'' }` (never 500s) on any AI failure so the client falls back. Verified ~3.5s, valid Vietnamese.
  - **Client**: `outfitDescriptionService.describeOutfit()` (in-memory cache by outfit id) + `useOutfitDescription()` hook; `app/outfit/[id].tsx` calls it on open for `gen_…` outfits, starting from the item-list fallback (`Outfit.longDescription` = joined item names) and swapping in the AI text with a dim-while-loading state. Mock/sample outfits keep their authored copy.
- Net: feed stays fast (note only), the detail screen gets a rich AI description on demand (~1–3.5s, cached, with a loader).

## Personal colour — camera path now actually analyses the photo (2026-06-21)

**Problem.** The "SCAN MY COLOURS" path captured a wrist + hair photo but **never
used them** — `scorePersonalColor` ran purely on the 4 manual answers, and the
photos were shown only as reference thumbnails. The intro even claimed it "reads
wrist & hair tone", which was false; no pixel/LAB analysis existed anywhere.

**Fix — real on-device analysis, no remote AI, no native rebuild.**
- New `src/features/personal-color/analyzePhoto.ts`: `expo-image-manipulator`
  downscales the photo to 48×48 JPEG → `jpeg-js` (pure JS, added dep) decodes to
  RGBA → average the central 50% region (trimming near-black shadow < 25 and
  blown-out flash glare > 240) → sRGB→LAB.
  - **Wrist → skin undertone:** nearest of the 3 `SKIN_OPTIONS` swatches in the
    **a/b chroma plane only** (ignoring L) — phone auto-white-balance shifts
    brightness far more than hue, so lightness is dropped for robustness.
  - **Hair → option:** nearest `HAIR_OPTIONS` swatch in **full LAB** (shade +
    warmth both matter).
  - Every step is wrapped → any failure returns null and the quiz stays manual
    (never crashes). Verified the LAB math: all swatches self-classify, and test
    tones map sensibly (golden→warm, rosy→cool, light cool hair→platinum_ash).
- `usePersonalColorDetection`: capturing a photo now runs the matching analyser
  and **pre-fills** `skinUndertone` / `hairKey` (only when still unset, so a manual
  pick is never clobbered), with `analyzing` + `autoSkin`/`autoHair` flags. A manual
  selection clears the auto flag.
- UI (`personal-color-edit`): the reference-photo caption shows "Reading your
  tone…" while analysing and "Auto-detected from your photo — adjust if it looks
  off." once filled, so the pre-selected answer is transparent and editable.
- **Honest now:** because the camera genuinely informs the result, the intro copy
  is accurate. Manual-only path is unchanged. The on-device questionnaire remains
  the final say (user confirms/adjusts every auto-detected answer).
- **Dep note:** added `jpeg-js` (pure JS) — needs a **Metro restart** to bundle,
  but **no native rebuild**. `atob` is available on Hermes/Expo 54.
- (The shared onboarding `personal-color` screen uses the same hook, so the
  pre-fill works there too; only the edit screen got the explicit hint copy.)

**describe-outfit → gemini-2.5-flash-lite**
- Switched `describe-outfit` default model from `gemini-2.5-flash` to **`gemini-2.5-flash-lite`** (override now via its own `DESCRIBE_MODEL` env, decoupled from the curator's `CURATOR_MODEL`). Same-outfit A/B: flash-lite reads more editorial (less item-listing, names the occasion) at equal latency (~1.4–1.9s) and ~3–4× cheaper. Curator/note path unchanged (still `gemini-2.5-flash`).

**Fix: detail-screen description was never fetched — items resolved from mock, not cloud wardrobe**
- Symptom: no AI description on outfit detail. Root cause: `app/outfit/[id].tsx` resolved the outfit's garments via `itemById` (mock `ITEMS` in `src/data`), but generated outfits carry **DB ids** that live in `appStore.wardrobeItems` (cloud), not `appStore.items` (mock+legacy). So `items` came up empty → `useOutfitDescription` hit its `items.length === 0` guard and skipped the call. (The collage already resolves from `wardrobeItems`, which is why images showed but the description didn't.)
- Fix: detail screen now builds `describeItems` from `wardrobeItems` (id → {name,type,color:colors[0]∥primaryColor,material,fit}) with mock `itemById` fallback — same source the collage uses — and passes that to the hook. Fallback text is the resolved item names (cloud-wardrobe outfits have an empty `longDescription`). `useOutfitDescription` deps now include `items.length` so it re-runs if the cloud wardrobe hydrates after mount (cached by id, so no double request). Client-only change; no function redeploy.

---

## Feature 009 — AI Try-On "Wear on you"

Renders the user wearing a chosen outfit (distinct from the feature-008 "should I
buy this?" scan). Entry: outfit detail → **GENERATE ON YOU** → full screen
`app/try-on/wear.tsx`. The previous stub sheet in `outfit/[id].tsx` (hardcoded
178cm/70kg/M, no generation) is removed.

**Flow (state machine in `src/features/try-on/useWearOnYou.ts`):**
`upload → validating → ready → rendering → result` (+ `invalid` / `error`).
1. User takes/chooses a photo (`expo-image-picker`).
2. **Validate** (cheap gate) — `tryon-validate` confirms ONE clear human subject;
   on failure returns a user-facing Vietnamese reason and the user re-picks.
3. **Generate** — `tryon-generate` composites the outfit's garments onto the photo.
4. **Result** — generated image of the user wearing the outfit (no AI scoring).

**Edge functions (Gemini, reuse `GOOGLE_API_KEY` + auth pattern of generate-item-image):**
- `tryon-validate` — `gemini-2.5-flash` vision → `{valid, reason}`. Conservative:
  requires is_person ∧ single_subject ∧ body_visible ∧ quality_ok.
- `tryon-generate` — `gemini-3-pro-image-preview` (nano banana 2) image-out:
  `[user photo, ...garment reference images, prompt]` → one photorealistic image
  preserving the person's identity/pose/background. A detailed **PERSON PROFILE**
  (gender, age, height/weight, body shape, preferred fit, body measurements in cm)
  is passed as TEXT to guide body proportions + garment fit/drape — with an explicit
  guardrail that it must NOT change the face/skin/hair (those come from the photo).
  No scoring call (removed per product decision). Garment images are fetched
  server-side from short-lived **signed URLs**; garments without a remote URL
  (local/asset items) fall back to text descriptors. Max 6 garment images.

**Client:**
- `src/services/tryOnWearService.ts` — `validatePersonPhoto()`, `generateWearOn()`,
  and `buildWearGarments()` (maps outfit items → `{type,name,color,material,fit,imageUrl}`;
  signs cloud `photoPath` via `itemPhotoService.signedUrl`). User photo is downscaled
  (≤1280px JPEG) and sent as a **transient base64 data URI — never uploaded to storage**;
  the generated result is written to `documentDirectory/try-on/`.
- The screen builds a `WearProfile` from `authStore` (gender, age from dob, and all
  `measurements` body_* fields → labelled cm map) so generation gets the fullest body
  info available; the on-screen frame card still shows height/weight.

**Credit gating:** new `try_on` credit type in `usageCreditService` (free 2/month,
premium unlimited — mirrors `ai_extraction`). `credit_type` is an unconstrained
`text` column, so no DB migration needed. A credit is consumed only on a successful
generation (failures are free).

**PRIVACY — must verify before going live:** the user's photo is sent to Gemini.
On the **paid** Gemini tier, prompts/responses are NOT used for training (logged
briefly for abuse/safety only); on the **free** tier they MAY be used for training
+ human review. The `GOOGLE_API_KEY` project MUST be billing-enabled before this
feature ships. Functions deployed but feature should not go live until confirmed.
