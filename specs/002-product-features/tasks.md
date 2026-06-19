---
description: "Task list for MIEN â€” Product Features Phase"
---

# Tasks: MIEN â€” Product Features Phase

**Input**: Design documents from `specs/002-product-features/`

**Prerequisites**: plan.md âœ… Â· research.md âœ… Â· data-model.md âœ… Â· contracts/ âœ… Â· quickstart.md âœ…

**Tests**: Not requested â€” no test tasks included.

**Organization**: Tasks grouped by user story. Each stream is independently testable.
Phase 1 (schema) and Phase 2 (i18n) are shared blockers. All user story phases depend on both.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[âš‘ DESIGN]**: UI gate â€” consult Claude for design spec BEFORE coding this screen.
  Ask: *"Design the [Screen] screen for MIEN following luxury minimalist tokens in src/design/tokens.ts"*
- **[Story]**: US1=Personal Color Â· US2=Measurements Â· US3=Profile Identity Â·
  US4=Outfit Persistence Â· US5=Feed Pagination Â· US6=Style+Formula Â·
  US7=Item Detail Â· US8=AI Extraction Â· US9=Offline Â· US10=Monetization

## Path Conventions (Expo Router)

- Screens: `app/`
- Stores: `src/stores/`
- Services: `src/services/`
- Types: `src/types/`
- Features/hooks: `src/features/`
- i18n: `src/i18n/`
- Edge Functions: `supabase/functions/`
- Migrations: `supabase/migrations/`

---

## Phase 1: Infrastructure â€” Schema Migrations

**Purpose**: All 8 migration files written and pushed to Supabase before any app code changes.
All tasks are parallel â€” different files.

**âš ï¸ CRITICAL**: Phases 3â€“12 (all user stories) cannot be end-to-end tested until this phase is applied.

- [X] T001 [P] Write `supabase/migrations/20260608000001_profiles_v2.sql` â€” `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text, ADD COLUMN IF NOT EXISTS avatar_url text, ADD COLUMN IF NOT EXISTS avatar_path text, ADD COLUMN IF NOT EXISTS color_season text CHECK (color_season IN ('spring','summer','autumn','winter')), ADD COLUMN IF NOT EXISTS personal_palette text[] NOT NULL DEFAULT '{}'`; also populate `skin_undertone` as no longer nullable default
- [X] T002 [P] Write `supabase/migrations/20260608000002_measurements_v2.sql` â€” `ALTER TABLE public.body_measurements` to RENAME `chest` â†’ `bust` (if column exists as `chest`); ADD 10 new columns (`inseam`, `thigh`, `rise`, `shoulder_width`, `sleeve_length`, `upper_body_length`, `upper_arm`, `neck`, `foot_length`, `foot_width` â€” all `numeric nullable`); ADD `body_shape text nullable`, `pose_estimated boolean NOT NULL DEFAULT false`, `measurements_consent boolean NOT NULL DEFAULT false`
- [X] T003 [P] Write `supabase/migrations/20260608000003_clothing_items_v2.sql` â€” `ALTER TABLE public.clothing_items` ADD COLUMN `name text nullable`, `primary_color text NOT NULL DEFAULT ''`, `material text nullable`, `pattern text nullable`, `warmth_season text[] NOT NULL DEFAULT '{}'`; ALTER the `category` CHECK constraint to include `'dress'` and `'headwear'` (drop old constraint, add new)
- [X] T004 [P] Write `supabase/migrations/20260608000004_style_profiles_v2.sql` â€” `ALTER TABLE public.style_profiles ADD COLUMN IF NOT EXISTS active_formula_id uuid REFERENCES public.formulas(id) ON DELETE SET NULL`; note: `formulas` table created in T005, so this migration file must run AFTER T005 or use deferred FK
- [X] T005 [P] Write `supabase/migrations/20260608000005_catalog_tables.sql` â€” CREATE `public.styles (id uuid PK, slug text UNIQUE NOT NULL, name text NOT NULL, name_vi text, description text NOT NULL DEFAULT '', related_slugs text[] DEFAULT '{}', display_order int DEFAULT 0, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now())`; CREATE `public.formulas (id uuid PK, slug text UNIQUE NOT NULL, name text NOT NULL, name_vi text, description text NOT NULL, display_order int DEFAULT 0, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now())`; RLS: SELECT for authenticated, no INSERT/UPDATE/DELETE; INSERT seed data for 8 default styles (minimalist, streetwear, smart_casual, business, casual, athleisure, vintage, bohemian) and 4 default formulas (color_harmony, rule_of_thirds, proportion_balance, monochrome)
- [X] T006 [P] Write `supabase/migrations/20260608000006_outfit_interactions.sql` â€” CREATE `public.outfit_interactions` per data-model.md; RLS SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`; INDEX on `(user_id, type)` and `(user_id, worn_at)` for cooldown queries
- [X] T007 [P] Write `supabase/migrations/20260608000007_usage_credits.sql` â€” CREATE `public.usage_credits` per data-model.md; RLS SELECT/INSERT/UPDATE scoped to `auth.uid() = user_id`
- [X] T008 [P] Write `supabase/migrations/20260608000008_storage_avatars.sql` â€” CREATE bucket `avatars` (private, 5 MB limit, image/jpeg+image/png+image/webp); Storage RLS policies: SELECT/INSERT/DELETE scoped to `auth.uid()::text = (storage.foldername(name))[1]`

**Checkpoint (Phase 1)**: All 8 migration files written. Manual step: run `supabase db push`. Verify in dashboard: all new columns, tables, and buckets present.

---

## Phase 2: i18n Foundation

**Purpose**: Must precede ALL new UI work. New screens are built i18n-first.
All string literals in new screens must use `t('key')` from the start.

- [X] T009 Install and configure `i18next` + `react-i18next` + `expo-localization` â€” run `npx expo install expo-localization` and `npm install i18next react-i18next`; create `src/i18n/index.ts` initialising i18next with `expo-localization` locale detection, fallback `en`, lazy-load JSON resources; export `i18n` instance and re-export `useTranslation` for convenience
- [X] T010 [P] Create `src/i18n/locales/en.json` â€” extract all hardcoded user-visible strings from existing screens (`app/(tabs)/*.tsx`, `app/(onboarding)/*.tsx`, `app/(tabs)/menu.tsx`, `app/settings.tsx`, `app/help.tsx`) into English key-value pairs; organise by screen namespace (e.g., `"onboarding.welcome.title"`, `"wardrobe.empty.title"`)
- [X] T011 [P] Create `src/i18n/locales/vi.json` â€” Vietnamese translations for all keys in `en.json`; provide all values (no English fallbacks for keys that exist)
- [X] T012 Update `app/_layout.tsx` â€” initialise `i18n` (import `src/i18n/index.ts`) before the root Stack renders; add language setting to `appStore` (`language: 'en' | 'vi'`, persisted); wire `appStore.language` change to call `i18n.changeLanguage()`
- [X] T013 Update `app/settings.tsx` â€” add Language section with two-option toggle (English / Tiáº¿ng Viá»‡t); on change: call `appStore.setLanguage(lang)` which calls `i18n.changeLanguage(lang)`; all string literals in this screen use `t()` calls

**Checkpoint (Phase 2)**: Toggle to Vietnamese in Settings â†’ all visible strings across the app switch language. No raw string literals in existing screens.

---

## Phase 3: User Story 3 â€” Profile Identity (Priority: P1)

**Goal**: User has an editable display name and uploadable avatar that persist server-side
and appear throughout the app.

**Independent Test**: Quickstart Scenario 3 â€” edit name + upload avatar â†’ restart app â†’ name and avatar persist.

### Implementation for User Story 3

- [X] T014 [P] [US3] Add new domain types to `src/types/profile.ts` â€” export `UserProfile` interface per data-model.md (`id`, `phone`, `email`, `displayName`, `avatarUrl`, `avatarPath`, `gender`, `dob`, `locationCity`, `locationCountry`, `skinUndertone`, `colorSeason`, `personalPalette`, `onboardingComplete`); export `ProfileUpdateError` and `AvatarUploadError` error classes
- [X] T015 [P] [US3] Extend `src/services/profileService.ts` â€” implement `updateProfile(patch)` writing to `public.profiles` (camelCase input â†’ snake_case DB columns); implement `uploadAvatar(localUri)` uploading to `avatars/{userId}.jpg` in Supabase Storage, deleting old avatar if `avatar_path` already set, returning `{ avatarUrl, avatarPath }`; implement `deleteAvatar()` removing from Storage and clearing DB columns; all per `contracts/profile-service.md`
- [X] T016 [US3] Update `src/stores/authStore.ts` â€” add `displayName`, `avatarUrl`, `colorSeason`, `personalPalette` fields to store state; add `updateProfile(patch)` action calling `profileService.updateProfile()` then updating local state; add `uploadAvatar(localUri)` action calling `profileService.uploadAvatar()` then updating `avatarUrl`; re-hydrate these fields from `profileService.fetchProfile()` on boot
- [X] T017 [US3] âš‘ DESIGN: Before implementing `app/profile-edit.tsx` â€” ask Claude: *"Design the Profile Edit screen for MIEN: editable display name field, avatar upload (tap-to-change circle), gender selector, DOB picker, location display. Luxury minimalist tokens, no gradients."*
- [X] T018 [US3] Create `src/features/profile/useProfileEdit.ts` â€” hook managing local form state for `displayName`, `gender`, `dob`; `isDirty` flag; `saving` boolean; `error` string; `save()` async action calling `authStore.updateProfile()`; `pickAvatar()` using `expo-image-picker` then calling `authStore.uploadAvatar()`
- [X] T019 [US3] Create `app/profile-edit.tsx` â€” uses `useProfileEdit` hook; displays: avatar circle (tap to change), display name `TextInput`, gender tag selector, DOB date picker, location row (read-only, links to location settings); SAVE `PrimaryButton` disabled when not dirty or saving; all strings via `t()`; register route in `app/_layout.tsx`
- [X] T020 [US3] Update `app/(tabs)/profile.tsx` â€” replace derived phone/email display name with `authStore.displayName`; render avatar from `authStore.avatarUrl` (Image with signed URL) or fallback initial circle; wire settings icon `onPress` to `router.push('/profile-edit')`

**Checkpoint (Phase 3)**: Profile edit screen opens. Name change persists across restart. Avatar uploads and displays.

---

## Phase 4: User Story 2 â€” Extended Measurements + Body Shape (Priority: P1)

**Goal**: Full 15-field measurement form with tooltips, body shape auto-computation,
explicit consent, and manual body shape override.

**Independent Test**: Quickstart Scenario 2 â€” fill all 15 fields â†’ body shape computes â†’ verify in Supabase.

### Implementation for User Story 2

- [X] T021 [P] [US2] Create `src/types/measurements.ts` â€” export `BodyMeasurements` interface per data-model.md (all 15 fields + `bodyShape`, `poseEstimated`, `measurementsConsent`); export field metadata array `MEASUREMENT_FIELDS: MeasurementFieldMeta[]` where each entry has `{ key, labelEn, labelVi, unit, required, tooltipEn, tooltipVi, animationKey }`; export `computeBodyShape(m: BodyMeasurements): BodyShape | null` pure function per research Decision 3 algorithm
- [X] T022 [P] [US2] Create `src/services/measurementService.ts` â€” `saveMeasurements(measurements)` writes to `body_measurements` (UPSERT by `user_id`); `fetchMeasurements()` reads current user's row; `MeasurementSaveError` class; all camelCase â†” snake_case conversion internal; column name uses `bust` (not `chest`)
- [X] T023 [US2] Create `src/features/measurements/useMeasurements.ts` â€” hook managing all 15 field values + `bodyShape` (auto-computed on change) + `preferredFit` + `consentGiven`; `saving`, `error` states; `save()` async action calling `measurementService.saveMeasurements()`; `isDirty` tracking; initial values loaded from `authStore` measurement state
- [X] T024 [US2] Update `src/stores/authStore.ts` â€” add `measurements: BodyMeasurements | null` field; add `saveMeasurements(m)` action; hydrate from `measurementService.fetchMeasurements()` on boot
- [X] T025 [US2] âš‘ DESIGN: Before updating `app/(onboarding)/measurements.tsx` â€” ask Claude: *"Redesign the Measurements onboarding screen for MIEN: 15 measurement fields grouped (required: height/weight; upper body; lower body; feet), each with a tap-to-open tooltip drawer (text + illustration placeholder), body shape result badge, consent checkbox. Luxury minimalist, generous spacing."*
- [X] T026 [US2] Update `app/(onboarding)/measurements.tsx` â€” replace current height/weight-only form with full 15-field form using `useMeasurements` hook; group fields into sections (REQUIRED / UPPER BODY / LOWER BODY / FEET); each field has tooltip icon that opens a modal overlay with field explanation; add body shape badge that updates live as values change; add consent checkbox with privacy link; CONTINUE button disabled until height, weight, and consent are filled; all strings via `t()`
- [X] T027 [US2] âš‘ DESIGN: Before creating `app/measurements-edit.tsx` â€” ask Claude: *"Design the Measurements Edit screen (post-onboarding) for MIEN: same 15 fields, body shape override picker, camera measurement CTA button (stub for Phase 4b), save/cancel actions. Luxury minimalist."*
- [X] T028 [US2] Create `app/measurements-edit.tsx` â€” full 15-field edit form using `useMeasurements` hook; body shape picker (manual override, 5 options with silhouette label); camera measurement button (stub: shows "Coming soon" alert); SAVE button; register route in `app/_layout.tsx`; add "Body measurements" row in `app/(tabs)/profile.tsx` section list to navigate here
- [X] T029 [US2] Add body shape to fit engine â€” update `src/services/fitEngine/scorer.ts` and `supabase/functions/generate-outfits/engine/scorer.ts` to accept `bodyShape` parameter; add a score boost for outfits whose items have proportions compatible with the user's body shape (use simple category rules: e.g., triangle body â†’ score up A-line bottoms, score down wide-shoulder tops)

**Checkpoint (Phase 4)**: 15 fields fillable. Body shape auto-computes. Saves to Supabase. Fit engine uses body shape.

---

## Phase 5: User Story 1 â€” Personal Color Detection (Priority: P1)

**Goal**: Questionnaire-based 4-season detection, personal palette stored on profile,
feeds into outfit color scoring.

**Independent Test**: Quickstart Scenario 1 â€” answer Winter quiz â†’ verify `color_season = 'winter'` in DB â†’ outfit feed skews cool/dark.

### Implementation for User Story 1

- [X] T030 [P] [US1] Create `src/utils/colorLab.ts` â€” pure math utility (no imports beyond TypeScript built-ins): `applyFlashCorrection(rgb: RGB): RGB` (fixed RÃ—1.05, GÃ—1.00, BÃ—0.95 multipliers); `rgbToLab(rgb: RGB): LAB` (standard CIELAB via XYZ D65 white point); `classifyUndertone(lab: LAB): 'warm' | 'cool' | 'neutral'` (b>20 && b>aÃ—1.5 â†’ warm; a>15 && a>b â†’ cool); `classifyHair(lab: LAB): { intensity: 'light'|'medium'|'dark', warmth: 'warm'|'cool'|'neutral' }`; `samplePixels(pixels: RGB[]): RGB` (average after discarding brightness<30 and >240); export all as named functions
- [X] T031 [P] [US1] Create `src/features/personal-color/colorSeasonData.ts` â€” export `SEASON_PALETTES: Record<Season, string[]>` (8â€“12 named color strings per season from `src/data/index.ts`); export `EYE_COLOR_OPTIONS` (4 entries with `labelEn`, `labelVi`, `swatchHex`, season scores); export `METAL_OPTIONS` (3 entries); export `scoreDetection(cameraSignals, questionAnswers): PersonalColorResult` combining camera scores (undertone+3, hair intensity+2, hair warmth+1) with question scores per research Decision 1 matrix; export `PersonalColorResult` type: `{ season, undertone, palette, cameraUsed: boolean }`
- [X] T032 [P] [US1] Create `src/services/personalColorService.ts` â€” `savePersonalColor(result)` writing `color_season`, `skin_undertone`, `personal_palette` to `public.profiles`; `getPersonalColor()` reading from profiles; `PersonalColorSaveError` class; per `contracts/personal-color-service.md`
- [X] T033 [US1] Create `src/features/personal-color/usePersonalColorDetection.ts` â€” hook managing full detection flow: `step: 'intro' | 'wrist-scan' | 'hair-scan' | 'questions' | 'result'`; `cameraSignals: { undertone, hairIntensity, hairWarmth } | null`; `questionAnswers: Record<string, number>`; `result: PersonalColorResult | null`; `saving`, `error` states; `startScan(type: 'wrist'|'hair')` activating `react-native-vision-camera` with torch on; `onFrameCaptured(pixels: RGB[])` running `colorLab` pipeline and storing signals; `answerQuestion(key, optionIndex)` updating answers; `computeResult()` calling `scoreDetection()`; `confirmSave()` calling `authStore.savePersonalColor(result)`; manual fallback: if user skips camera, `step` goes directly to `'questions'` which adds 2 extra skin/hair questions
- [X] T034 [US1] Update `src/stores/authStore.ts` â€” add `colorSeason`, `personalPalette` fields (already added in T016 but not yet populated from personal color); add `savePersonalColor(result)` action calling `personalColorService.savePersonalColor()` and updating local state
- [X] T035 [US1] âš’ DESIGN: Before creating `app/(onboarding)/personal-color.tsx` â€” ask Claude: *"Design the Personal Color Detection screen for MIEN: (1) intro step with two entry paths â€” SCAN (camera) and ANSWER QUESTIONS; (2) wrist scan step â€” live camera viewfinder with torch on, instructional text 'Hold inner wrist 15â€“20 cm from camera, palm up', capture button; (3) hair scan step â€” same camera UI pointing at hair roots; (4) two-question step â€” eye color (4 coloured circle swatches) + gold/silver preference; (5) result screen â€” season name in large serif, undertone badge, palette colour strip, SAVE and RETAKE. Luxury minimalist, full-screen."*
- [X] T036 [US1] Create `app/(onboarding)/personal-color.tsx` â€” multi-step screen using `usePersonalColorDetection` hook; step=intro shows two paths (camera / manual); step=wrist-scan shows rear camera viewfinder with torch on + capture button; step=hair-scan same; step=questions shows eye colour swatch tap + gold/silver toggle; step=result shows season + undertone + palette strip + SAVE / RETAKE; manual fallback adds 2 extra questions (simplified skin tone + hair shade) if camera skipped; all strings via `t()`; register in `app/(onboarding)/_layout.tsx`
- [X] T037 [US1] Update `app/(onboarding)/colors.tsx` â€” add "Detect my personal color" hairline button at the bottom of the manual color picker; `onPress` navigates to `/(onboarding)/personal-color`; after returning, merge `personalPalette` into the display of selected colors (show personal palette chips alongside manual picks with a small season badge label)
- [X] T038 [US1] âš’ DESIGN: Before creating `app/personal-color-edit.tsx` â€” ask Claude: *"Design the Personal Color Edit screen (post-onboarding) for MIEN: shows current season name + undertone chip + palette colour strip, RESCAN button (re-enters camera flow), RETAKE QUESTIONS button (re-enters question flow), manual palette override toggle. Luxury minimalist."*
- [X] T039 [US1] Create `app/personal-color-edit.tsx` â€” shows current `colorSeason` + `skinUndertone` + `personalPalette` strip; RESCAN button re-enters the camera detection flow (same `usePersonalColorDetection` hook, modal-style); RETAKE QUESTIONS skips straight to question step; register route; add "Personal color" row to profile section list navigating here
- [X] T040 [US1] Update fit engine color scoring â€” in `src/services/fitEngine/colorHarmony.ts` AND `supabase/functions/generate-outfits/engine/colorHarmony.ts`: accept `personalPalette: string[]` parameter; add a boost multiplier (Ã—1.3) to outfits whose item colors overlap with the personal palette; add `colorSeason` to the engine request payload from `fitEngineStore`

**Checkpoint (Phase 5)**: Camera scan (wrist + hair) + 2 questions produce season + palette. Palette stored in DB. Feed scores updated. Profile shows season badge. Manual question-only fallback works when camera skipped.

---

## Phase 6: User Story 6 â€” Style Catalog + Formula System (Priority: P2)

**Goal**: Style and formula catalogs are server-driven. Style quiz loads from Supabase.
Formula picker in feed and profile. Formula wired to outfit engine.

**Independent Test**: Quickstart Scenario 6 â€” add new style in Supabase dashboard â†’ relaunch app â†’ style appears without app release.

### Implementation for User Story 6

- [X] T041 [P] [US6] Create `src/services/stylesCatalogService.ts` â€” `fetchStyles(): Promise<StyleCatalogItem[]>` fetching from `public.styles WHERE is_active = true ORDER BY display_order`; 24-hour client-side cache in AsyncStorage key `styles-cache`; `StyleCatalogItem` type: `{ id, slug, name, nameVi, description, relatedSlugs, displayOrder }`
- [X] T042 [P] [US6] Create `src/services/formulasCatalogService.ts` â€” same pattern as styles service; `fetchFormulas()` from `public.formulas`; `FormulaCatalogItem` type; 24-hour cache in AsyncStorage key `formulas-cache`
- [X] T043 [US6] Update `src/stores/fitEngineStore.ts` â€” add `styles: StyleCatalogItem[]`, `formulas: FormulaCatalogItem[]`, `sessionFormulaId: string | null`; add `loadCatalogs()` action calling both services; call `loadCatalogs()` in `appStore.hydrate()` sequence; add `setSessionFormula(id)` action
- [X] T044 [US6] Update `app/(onboarding)/styles.tsx` â€” replace hardcoded style list with `fitEngineStore.styles`; show related styles as chip suggestions when a style is selected; enforce min 1 / max 5 selection (disable selecting beyond 5, show count badge); all strings via `t()`
- [ ] T045 [US6] âš‘ DESIGN: Before building formula picker UI â€” ask Claude: *"Design a Formula selector for MIEN: a horizontal scroll of formula cards (name + one-line description each), one selected at a time with hairline active border, appears at the bottom of the outfit feed screen and also in Style Preferences. Luxury minimalist."*
- [X] T046 [US6] Create `src/features/feed/useFormulaSelector.ts` â€” hook managing `activeFormulaId` (reads `fitEngineStore.sessionFormulaId ?? authStore.styleProfile?.activeFormulaId`); `setFormula(id)` updating session override; exposes `formulas` list from store
- [ ] T047 [US6] Update `app/(tabs)/index.tsx` (feed) â€” add formula selector row above/below the filter bar using `useFormulaSelector`; selecting a formula calls `fitEngineStore.setSessionFormula(id)` and triggers `fetchOutfits()`
- [X] T048 [US6] Update `app/(tabs)/menu.tsx` style preferences entry â€” navigates to a formula selection sub-screen (or adds formula picker to `app/styles-edit.tsx`); saving sets `authStore.styleProfile.activeFormulaId` via `fitEngineStore` â†’ `styleProfileService.saveStyleProfile()`
- [X] T049 [US6] Update `supabase/functions/generate-outfits/index.ts` â€” accept `formula_id` in request body; look up formula slug from `public.formulas`; pass slug to the engine's ranking function to adjust weights (e.g., `color_harmony` boosts color match score, `proportion_balance` boosts body-shape compatibility score)

**Checkpoint (Phase 6)**: Styles load from Supabase. Formula picker visible on feed. Selected formula changes outfit ranking.

---

## Phase 7: User Story 7 â€” Item Detail + Extended Attributes (Priority: P2)

**Goal**: Full item detail page with edit. All new attributes (name, material, pattern,
warmth_season, primary_color) on add-item and edit. Dress + headwear categories available.

**Independent Test**: Quickstart Scenario 7 â€” add item with extended attributes â†’ tap in wardrobe â†’ edit brand â†’ verify in Supabase.

### Implementation for User Story 7

- [X] T050 [P] [US7] Update `src/services/wardrobeService.ts` â€” add `name`, `primaryColor`, `material`, `pattern`, `warmthSeason` to `AddItemInput` and `UpdateItemInput`; update `addItem()` and `updateItem()` to write new columns; expand category type to include `'dress' | 'headwear'`; update `fetchMyItems()` mapping to include new fields
- [X] T051 [P] [US7] Update `src/types/fitEngine.ts` `WardrobeItem` interface â€” add `name`, `primaryColor`, `material`, `pattern`, `warmthSeason` fields; expand `category` union type to add `'dress' | 'headwear'`
- [X] T052 [US7] Update `app/add-item.tsx` â€” add CATEGORIES entries for `DRESS` and `HEADWEAR`; add `name` field (already exists), `primaryColor` picker (reuse color chip grid), `material` horizontal scroll tag selector, `pattern` tag selector (`Solid`, `Striped`, `Plaid`, `Floral`, `Graphic`, `Check`), `warmthSeason` multi-select (Spring/Summer/Autumn/Winter chips); update `handleSave()` to pass new fields to `addWardrobeItem()`
- [ ] T053 [US7] âš‘ DESIGN: Before building `app/item/[id].tsx` â€” ask Claude: *"Design the Item Detail screen for MIEN: full-bleed item photo at top (3:4), below: item name in large serif, attribute rows (category, color, material, brand, size, pattern, season), collections this item belongs to as chip row, EDIT button, DELETE button. Luxury minimalist, full-screen scroll."*
- [ ] T054 [US7] Build `app/item/[id].tsx` full detail page â€” loads `WardrobeItem` by id from `appStore.wardrobeItems`; displays full-bleed photo, all attributes in labeled rows, collections chips; EDIT button opens edit sheet (inline `BottomSheet` with all editable fields, SAVE calls `appStore.updateWardrobeItem()`); DELETE button with confirmation â†’ `appStore.removeWardrobeItem()`; register route in `app/_layout.tsx`
- [X] T055 [US7] Add `updateWardrobeItem(id, patch)` action to `src/stores/appStore.ts` â€” calls `wardrobeService.updateItem(id, patch)` then updates the item in local `wardrobeItems` array; sets `wardrobeError` on failure
- [X] T056 [US7] Update wardrobe category filters in `app/(tabs)/wardrobe.tsx` â€” add `DRESS` and `HEADWEAR` filter tabs; update `FILTER_CATS` mapping to include new categories

**Checkpoint (Phase 7)**: Item tapped â†’ full detail with all extended fields. Edit works. Dress + headwear appear in wardrobe with correct filter.

---

## Phase 8: User Story 4 â€” Server-Side Outfit Persistence (Priority: P2)

**Goal**: Saved / worn / scheduled outfits persisted to Supabase and visible across devices.

**Independent Test**: Quickstart Scenario 4 â€” save outfit on device A â†’ log in on device B â†’ outfit appears saved.

### Implementation for User Story 4

- [X] T057 [P] [US4] Create `src/types/outfit.ts` â€” export `OutfitInteraction` interface per data-model.md; export `OutfitInteractionError` class
- [X] T058 [P] [US4] Create `src/services/outfitInteractionService.ts` â€” implement all 8 functions per `contracts/outfit-interaction-service.md`: `saveOutfit`, `unsaveOutfit`, `markWorn`, `unmarkWorn`, `scheduleOutfit`, `unscheduleOutfit`, `fetchInteractions`, `fetchWornCooldownIds`; all UPSERT on `(user_id, outfit_id, type)` unique constraint; use outfit snapshot from `OUTFITS` data or `fitEngineStore.outfits` as `outfit_data`
- [X] T059 [US4] Update `src/stores/appStore.ts` â€” replace `toggleSave`, `toggleWorn`, `toggleSchedule` (currently AsyncStorage-only) with actions that call `outfitInteractionService` AND update local `savedSet` / `wornSet` / `scheduledSet`; on hydration call `outfitInteractionService.fetchInteractions()` to rebuild sets from server state; add `wornCooldownIds: string[]` field populated from `fetchWornCooldownIds()`
- [X] T060 [US4] Update `supabase/functions/generate-outfits/index.ts` â€” accept `worn_cooldown_ids: string[]` in request body alongside `exclude_ids`; exclude both sets from the candidate outfit pool before ranking

**Checkpoint (Phase 8)**: Save/worn/scheduled write to Supabase. Restart â†’ state restored from server. Cross-device sync works.

---

## Phase 9: User Story 5 â€” Feed Pagination + Dedup + Cooldown (Priority: P2)

**Goal**: Feed fetches 10 outfits per batch, auto-loads next batch on scroll-end,
never repeats seen outfits, excludes worn-in-last-7-days outfits.

**Independent Test**: Quickstart Scenario 5 â€” scroll through 10 â†’ 10 more load; mark worn â†’ absent for 7 days.

### Implementation for User Story 5

- [X] T061 [P] [US5] Update `src/stores/fitEngineStore.ts` â€” add `shownOutfitIds: string[]` (persisted in AsyncStorage); add `isFetchingMore: boolean`; update `fetchOutfits()` to: (1) append `shownOutfitIds` + `appStore.wornCooldownIds` as `exclude_ids` in Edge Function payload; (2) on response append new outfit IDs to `shownOutfitIds`; (3) if response returns < 3 outfits, flush `shownOutfitIds` and request fresh batch; add `fetchMoreOutfits()` action that calls `fetchOutfits()` with `append: true` (appends to `outfits` array rather than replacing)
- [X] T062 [US5] Update `app/(tabs)/index.tsx` â€” replace `FlatList` with a scroll-end detection pattern: when `onEndReachedThreshold` triggers, call `fitEngineStore.fetchMoreOutfits()`; show a thin loading indicator at bottom during `isFetchingMore`; ensure no visible scroll reset when new outfits append
- [X] T063 [US5] Update `supabase/functions/generate-outfits/index.ts` â€” accept `exclude_ids: string[]` in request body; filter candidate pool before ranking; return exactly 10 outfits (or fewer if pool exhausted); add `has_more: boolean` to response body

**Checkpoint (Phase 9)**: Scroll to end â†’ 10 more load. No repeats across batches. Worn outfits suppressed for 7 days.

---

## Phase 10: User Story 8 â€” AI Item Extraction (Priority: P3)

**Goal**: User uploads a worn-outfit photo â†’ Claude Vision identifies items â†’ user reviews and confirms â†’ items saved to wardrobe. Free tier: 2 scans/month.

**Independent Test**: Quickstart Scenario 8 â€” upload photo â†’ 3 items extracted â†’ confirm â†’ verify in Supabase + credit incremented.

### Implementation for User Story 8

- [X] T064 [P] [US8] Create `src/services/usageCreditService.ts` â€” implement `checkCredit(type)` and `incrementCredit(type)` per `contracts/usage-credit-service.md`; `InsufficientCreditsError` class; UPSERT on `(user_id, credit_type, period_start)` for first-day-of-month period
- [X] T065 [P] [US8] Create `supabase/functions/extract-garments/index.ts` â€” Deno edge function per `contracts/ai-extraction-service.md`; authenticates user via Bearer JWT; downloads raw photo from Storage; calls `claude-haiku-4-5` vision API with structured extraction prompt; returns `{ items, confidence }`; handles 401, 402 (credit), 500; prompt template: identify each distinct clothing item, output JSON array with `{ name, category, primaryColor, additionalColors, material, brand }`, category must be one of the valid enum values, append user notes as fenced context
- [X] T066 [US8] Create `src/services/aiExtractionService.ts` â€” implement `extractGarments`, `retryExtraction`, `confirmExtraction` per `contracts/ai-extraction-service.md`; retryExtraction tracks `uploadId` in a module-level `Set<string>` for one-free-retry semantics; confirmExtraction handles per-item PNG extraction (using `expo-image-manipulator` for crop) + Storage upload + `wardrobeService.addItem()`
- [X] T067 [US8] Create `src/features/ai-extraction/useItemExtraction.ts` â€” hook managing extraction flow state: `step: 'idle' | 'uploading' | 'processing' | 'review' | 'confirming' | 'done'`; `extractedItems: ExtractedItem[]`; `editedItems` (local overrides before confirm); `canRetry: boolean`; `creditStatus: CreditStatus | null`; actions: `startExtraction(uri, notes)`, `retryExtraction()`, `editItem(index, patch)`, `confirmItems()`
- [ ] T068 [US8] âš‘ DESIGN: Before building extraction flow screens â€” ask Claude: *"Design the AI Item Extraction multi-step flow for MIEN: (1) Photo upload step with notes textarea; (2) Processing skeleton/loading step; (3) Review step â€” vertical list of extracted item cards (photo crop, name, category, color, brand editable inline), CONFIRM ALL + individual REMOVE buttons; (4) Done step. Luxury minimalist."*
- [ ] T069 [US8] Build AI extraction flow in `app/add-item.tsx` â€” add a third option to the existing method picker: "Upload outfit photo (AI)"; this option navigates to a new screen `app/extraction-review.tsx` with the multi-step extraction flow; gate behind credit check (show remaining credits, show upgrade prompt if 0)
- [ ] T070 [US8] Create `app/extraction-review.tsx` â€” full extraction review screen using `useItemExtraction` hook; renders current step with appropriate UI; step=uploading shows progress; step=processing shows skeleton; step=review shows editable item list with confirm; step=done navigates to wardrobe; register route in `_layout.tsx`
- [ ] T071 [US8] âš‘ DESIGN: Before building upgrade/credit UI â€” ask Claude: *"Design an upgrade prompt / credit usage indicator for MIEN: shows 'X of 2 free scans used this month', a UPGRADE button with brief benefit list. Minimal, non-intrusive, luxury aesthetic."*
- [X] T072 [US8] Build `src/features/monetization/usePremium.ts` â€” RevenueCat integration: initialise `Purchases` SDK in `app/_layout.tsx` with `EXPO_PUBLIC_REVENUECAT_API_KEY`; `usePremium()` hook returns `{ isPremium, offerings, purchase(package), restore() }`; `CreditGate` component wrapping any premium feature with a show-upgrade fallback

**Checkpoint (Phase 10)**: Upload photo â†’ items extracted. Review and confirm. Items appear in wardrobe. Credit incremented. 3rd scan blocked for free users.

---

## Phase 11: User Story 9 â€” Offline Mode (Priority: P3)

**Goal**: App is fully usable offline for read operations. Write operations queue gracefully.

**Independent Test**: Quickstart Scenario 10 â€” airplane mode â†’ browse wardrobe + feed â†’ attempt add item â†’ see offline banner, no state mutation.

### Implementation for User Story 9

- [X] T073 [P] [US9] Audit all write actions in `src/stores/appStore.ts` and `src/stores/fitEngineStore.ts` â€” every action that calls a service must check `NetInfo.fetch()` before proceeding; create a shared `requireOnline()` util in `src/utils/network.ts` that throws `OfflineError` if not connected
- [X] T074 [P] [US9] Create `src/components/ui/OfflineBanner.tsx` â€” a fixed top banner (luxury minimal: thin hairline bottom border, small uppercase text "You're offline â€” changes will sync when you reconnect", `T.color.secondary` background, dismissible); shown when `appStore.isOffline === true`
- [X] T075 [US9] Add offline state to `src/stores/appStore.ts` â€” add `isOffline: boolean`; subscribe to `NetInfo.addEventListener()` in `hydrate()` to maintain `isOffline` in real time; when going back online, retry any queued operations (MVP: just re-fetch wardrobe + weather)
- [X] T076 [US9] Wire `OfflineBanner` into `app/_layout.tsx` â€” render above the Stack navigator so it appears on every screen when offline

**Checkpoint (Phase 11)**: Offline â†’ banner shows. Wardrobe and cached feed browseable. Add item blocked with offline message.

---

## Phase 12: User Story 10 â€” IntentContext Scaffold + Monetization (Priority: P3)

**Goal**: IntentContext type defined and hooked into Edge Function (future chat-ready).
RevenueCat SDK wired. Tier enforcement active for AI extraction.

**Independent Test**: Quickstart Scenario 8 step 12 â€” free user hits scan limit â†’ upgrade prompt shown with RevenueCat offering.

### Implementation for User Story 10

- [X] T077 [P] [US10] Create `src/types/intent.ts` â€” export `IntentContext` interface per research Decision 11; export `createEmptyIntent(): IntentContext` factory function returning `{ rawPrompt: '', turnCount: 0 }`
- [X] T078 [P] [US10] Update `supabase/functions/generate-outfits/index.ts` â€” add optional `intent_context?: IntentContext` field to request body type; if present and non-null log it (do not yet act on it); this is the forward-compatibility hook for the future AI chat feature
- [X] T079 [US10] Wire RevenueCat in `app/_layout.tsx` â€” `import Purchases from 'react-native-purchases'`; call `Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY! })` on mount; identify user with Supabase `userId` via `Purchases.logIn(userId)` after auth
- [X] T080 [US10] Complete `src/features/monetization/usePremium.ts` (stub created in T072) â€” implement `purchase(pkg)` calling `Purchases.purchasePackage(pkg)` wrapped in try/catch; `restore()` calling `Purchases.restorePurchases()`; `isPremium` derived from `CustomerInfo.entitlements.active['premium']`
- [X] T081 [US10] Apply premium gates â€” in `usageCreditService.checkCredit()`: check `usePremium().isPremium` first and skip limit if true; in extraction flow `useItemExtraction.startExtraction()`: if `creditStatus.remaining === 0 && !isPremium` â†’ set `step = 'upgrade'` instead of calling service; render upgrade screen from `CreditGate`

**Checkpoint (Phase 12)**: RevenueCat initialises. Premium entitlement bypasses scan limit. IntentContext field present in Edge Function request.

---

## Phase 13: Polish & Cross-Cutting Concerns

- [X] T082 [P] Update `src/design/tokens.ts` if any new design tokens emerge from the design reviews (color season badge colors, offline banner background, extraction step indicators)
- [X] T083 [P] Update `src/i18n/locales/en.json` and `vi.json` â€” add all new string keys introduced by Phases 3â€“12 (personal color quiz, measurements tooltips, extraction flow, upgrade prompt, offline banner, formula names)
- [X] T084 [P] Update `specs/002-product-features/quickstart.md` â€” verify all 10 scenarios against implemented code; add any discovered edge cases
- [X] T085 Apply all 8 migration files to live Supabase project: run `supabase db push`; verify in dashboard that all new columns, tables, and buckets are present; verify RLS policies with demo account
- [X] T086 Update `docs/engine-migration-plan.md` â€” document the new scoring dimensions added in this phase (body shape, personal palette boost, formula weights) so the dual-engine sync obligation is tracked

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Schema)**: Start immediately â€” no dependencies. Manual `supabase db push` required before end-to-end testing.
- **Phase 2 (i18n)**: Start immediately in parallel with Phase 1. MUST complete before ANY new UI screen is built.
- **Phases 3â€“12 (User Stories)**: All depend on Phase 1 applied + Phase 2 complete.
  - Phase 3 (Profile) â†’ Phase 5 (Personal Color) depends on `authStore` updates from Phase 3
  - Phase 6 (Style/Formula) â†’ Phase 9 (Feed) uses `sessionFormulaId` from Phase 6
  - Phase 8 (Outfit Persistence) â†’ Phase 9 (Feed) uses `wornCooldownIds` from Phase 8
  - Phase 10 (AI Extraction) â†’ Phase 12 (Monetization) uses `usePremium` from Phase 12

### Parallel Opportunities

```bash
# Phase 1 â€” all 8 migration files in parallel:
T001..T008 (different files, no shared state)

# Phase 2 â€” en.json and vi.json can be written in parallel:
T010 (en.json) || T011 (vi.json)

# After Phase 2 complete â€” these story pairs are fully independent:
T014..T020 (Profile) || T021..T029 (Measurements) â€” different files
T030..T040 (Personal Color) || T041..T049 (Style/Formula) â€” different files
T050..T056 (Item Detail) || T057..T060 (Outfit Persistence) â€” different files
T061..T063 (Feed Pagination) || T064..T076 (AI Extraction + Offline) â€” different files
```

### âš‘ DESIGN Task Gates

These tasks require a Claude design consultation BEFORE writing code.
Do NOT skip them â€” they ensure new screens conform to the luxury minimalist language.

| Gate | For screen | Ask Claude |
|------|-----------|------------|
| T017 | `profile-edit.tsx` | Display name, avatar circle, form layout |
| T025 | `measurements.tsx` (updated) | 15-field grouped form, tooltips, body shape badge |
| T027 | `measurements-edit.tsx` | Same as onboarding form + body shape override |
| T035 | `personal-color.tsx` | Camera scan steps (wrist + hair), 2-question fallback, result screen |
| T038 | `personal-color-edit.tsx` | Season result display, RESCAN + RETAKE paths |
| T045 | Formula selector UI | Horizontal scroll cards, active state |
| T053 | `item/[id].tsx` | Full-bleed photo, attribute rows, edit sheet |
| T068 | Extraction review flow | Multi-step: upload, processing, review, done |
| T071 | Upgrade / credit UI | Credit indicator, upgrade prompt |

---

## Implementation Strategy

### MVP â€” Phases 1â€“5 (core identity features)

1. Phase 1: Schema migrations
2. Phase 2: i18n foundation
3. Phase 3: Profile identity (name + avatar)
4. Phase 4: Extended measurements + body shape
5. Phase 5: Personal color detection
6. **VALIDATE**: Scenarios 1â€“3 in quickstart.md

### Full Product â€” Phases 6â€“12

Continue in priority order. Each phase is independently deployable.

---

## Notes

- All `âš‘ DESIGN` tasks are **blocking gates**: implement nothing on that screen until Claude provides a design spec
- Measurement column `chest` may already exist in live DB as `chest` â€” migration T002 uses `RENAME COLUMN IF EXISTS` pattern; check live schema before running
- RevenueCat `EXPO_PUBLIC_REVENUECAT_API_KEY` must be added to `.env` and Expo secrets before Phase 12
- `react-native-purchases` requires Expo Dev Client build (not Expo Go) â€” same constraint as pose estimation
- Constitution Gate 5: every change to fit engine scoring MUST update BOTH `src/services/fitEngine/` AND `supabase/functions/generate-outfits/engine/` â€” tasks T029 and T040 explicitly address this; do not skip the Edge Function update
- T022 âœ…: `measurementService.ts` already implemented with 15-field fetch/upsert (note: uses `BodyMeasurements` from `fitEngine.ts`; update imports when T021 creates `src/types/measurements.ts`)
- T028 âœ…: `measurements-edit.tsx` already exists with 15-field form; currently uses `useFitEngineStore` directly instead of `useMeasurements` hook â€” update after T023 is complete

