---

description: "Task list for True Clothes App — Current State Baseline"
---

# Tasks: True Clothes App — Current State Baseline

**Input**: Design documents from `specs/001-app-baseline/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. US2 (Feed) and US3 (Wardrobe) are the
two partial stories. US8 (Advanced) closes all stubbed features. US1/US4–US7 are
already complete — no tasks needed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US2, US3, US8)
- Exact file paths included in every task description

## Path Conventions (Expo Router — this project)

- Screens: `app/`
- Stores: `src/stores/`
- Services: `src/services/`
- Types: `src/types/`
- Features/hooks: `src/features/`
- Edge Functions: `supabase/functions/`
- Migrations: `supabase/migrations/`
- Design docs: `src/design/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Write migration files, scaffold new service modules and types. All tasks
are parallel — different files, no dependencies between them.

- [ ] T001 [P] Write `supabase/migrations/20260606000001_initial_schema.sql` — CREATE TABLE for `public.profiles`, `public.body_measurements`, `public.style_profiles` with all columns, RLS policies, foreign keys, and `updated_at` trigger as documented in `specs/001-app-baseline/data-model.md`
- [ ] T002 [P] Write `supabase/migrations/20260606000002_clothing_items.sql` — CREATE TABLE for `public.clothing_items` with all columns from data-model.md (id, user_id, photo_url, photo_path, category CHECK constraint, colors[], size_label, brand, notes, created_at, updated_at), indexes on (user_id) and (user_id, category), and four RLS policies (SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`)
- [ ] T003 [P] Write `supabase/migrations/20260606000003_storage_policies.sql` — CREATE BUCKET `wardrobe-photos` (private, 10 MB limit, jpeg/png/webp), add Storage RLS policies for SELECT/INSERT/DELETE scoped to `auth.uid()::text = (storage.foldername(name))[1]`
- [ ] T004 [P] Create `src/types/weather.ts` — export `WeatherContext` interface (temperatureCelsius: number, temperatureBand: 'cold'|'mild'|'warm'|'hot', weatherCode: number, windspeedKmh: number, fetchedAt: string, locationCity: string | null) as specified in `specs/001-app-baseline/contracts/weather-service.md`
- [ ] T005 [P] Create `src/services/wardrobeService.ts` — export typed function signatures for `fetchMyItems`, `addItem`, `updateItem`, `deleteItem`, `migrateLocalItems` plus `AddItemInput`, `UpdateItemInput`, `WardrobeStorageError`, `WardrobeDbError` error classes; leave implementations as `throw new Error('not implemented')` stubs per `specs/001-app-baseline/contracts/wardrobe-service.md`
- [ ] T006 [P] Create `src/services/weatherService.ts` — export typed function signatures for `fetchCurrentWeather(coords)` and `getTemperatureBand(celsius)` plus `Coordinates` interface and `WeatherFetchError` class; leave `fetchCurrentWeather` as stub; implement `getTemperatureBand` pure function immediately (< 10 → cold, 10–19 → mild, 20–28 → warm, > 28 → hot) per `specs/001-app-baseline/contracts/weather-service.md`

**Checkpoint**: All migration files written, service scaffolds in place, types defined.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Apply migrations to Supabase so the `clothing_items` table and
`wardrobe-photos` bucket exist before any wardrobe sync code can be tested.

**⚠️ CRITICAL**: Phases 3–5 cannot be end-to-end tested until this phase is complete.

- [ ] T007 Apply all three migration files to the Supabase project by running `supabase db push` from the project root (requires Supabase CLI linked to the project); confirm success in Supabase dashboard → Table Editor and Storage
- [ ] T008 Verify in Supabase dashboard: `clothing_items` table exists with correct columns and RLS enabled; `wardrobe-photos` bucket exists with private access; demo account (`+84977...`) can SELECT from `clothing_items` (returns empty array, no RLS error)

**Checkpoint**: Foundation ready — wardrobe sync implementation can now begin.

---

## Phase 3: User Story 3 — Wardrobe Sync to Supabase (Priority: P2 spec / P0 plan) 🎯 Critical

**Goal**: User wardrobe items are synced to Supabase on every add/delete, fetched from
Supabase on every boot, and photos stored in the `wardrobe-photos` bucket. The fit
engine's Edge Function can now access the user's real wardrobe.

**Independent Test**: Add an item in the app → check Supabase dashboard → row appears
in `clothing_items`, photo in `wardrobe-photos/{userId}/`. Kill and reopen app → item
still present (loaded from Supabase). Delete item → row and photo both removed.

### Implementation for User Story 3

- [ ] T009 [P] [US3] Implement `wardrobeService.fetchMyItems()` in `src/services/wardrobeService.ts` — query `clothing_items` WHERE user_id = auth.uid() ORDER BY created_at DESC; generate signed URLs (1-hour expiry) for each `photo_path` via `supabase.storage.from('wardrobe-photos').createSignedUrl()`; map snake_case row to camelCase `ClothingItem`; return empty array (not throw) if no items; throw `WardrobeDbError` on query error
- [ ] T010 [P] [US3] Implement `wardrobeService.addItem()` in `src/services/wardrobeService.ts` — pre-generate `itemId = crypto.randomUUID()`; if `localPhotoUri` provided, read file with `expo-file-system` and upload Blob to `wardrobe-photos/{userId}/{itemId}.jpg` via `supabase.storage.from('wardrobe-photos').upload()`; throw `WardrobeStorageError` on upload failure (do NOT proceed to DB insert); insert row to `clothing_items` with pre-generated id; throw `WardrobeDbError` on insert failure and attempt Storage cleanup; return fully-mapped `ClothingItem` with signed URL
- [ ] T011 [P] [US3] Implement `wardrobeService.deleteItem()` in `src/services/wardrobeService.ts` — delete row from `clothing_items` by id (RLS enforces ownership); after DB delete succeeds, attempt `supabase.storage.from('wardrobe-photos').remove([photo_path])`; Storage delete failure MUST be logged (`console.warn`) but MUST NOT throw — orphaned files are acceptable in MVP
- [ ] T012 [P] [US3] Implement `wardrobeService.updateItem()` in `src/services/wardrobeService.ts` — update `colors`, `size_label`, `brand`, `notes` on `clothing_items` by id; return updated `ClothingItem` with signed URL; throw `WardrobeDbError` if row not found or update fails
- [ ] T013 [US3] Implement `wardrobeService.migrateLocalItems()` in `src/services/wardrobeService.ts` — iterate legacy items sequentially (not parallel); for each: call `addItem()` with the item's `localPhotoUri` and metadata; call `onProgress(done, total)` after each regardless of success/failure; continue on individual failures; return array of successfully migrated `ClothingItem`s
- [ ] T014 [US3] Update `src/stores/appStore.ts` — replace local wardrobe array operations with service calls: `addWardrobeItem()` action calls `wardrobeService.addItem()` then appends to local state on success; `removeWardrobeItem()` calls `wardrobeService.deleteItem()` then removes from local state; `hydrate()` calls `wardrobeService.fetchMyItems()` to populate `wardrobeItems` (replaces AsyncStorage read for wardrobe); catch `WardrobeStorageError` / `WardrobeDbError` and set an `wardrobeError: string | null` state field surfaced to UI
- [ ] T015 [US3] Add offline guard to wardrobe add flow in `src/stores/appStore.ts` — before calling `wardrobeService.addItem()`, check network connectivity via `NetInfo.fetch()` (import `@react-native-community/netinfo`); if `isConnected === false`, set `wardrobeError = "Adding items requires an internet connection"` and return without modifying state (FR-045)
- [ ] T016 [US3] Add first-boot migration logic to `src/stores/appStore.ts` `hydrate()` — after auth check, read `wardrobeMigrated` flag from AsyncStorage; if flag absent AND `wardrobeItems` exists in legacy AsyncStorage state, call `wardrobeService.migrateLocalItems()` with a progress callback that sets `migrationProgress: { done, total } | null` state; on completion (success or partial), write `wardrobeMigrated: true` to AsyncStorage and clear legacy wardrobe from AsyncStorage
- [ ] T017 [US3] Add migration progress UI to `app/_layout.tsx` — read `migrationProgress` from `appStore`; if non-null, render a full-screen overlay (luxury minimal: large thin text "Syncing your wardrobe… {done}/{total}" on Canvas background) that blocks navigation until migration completes; remove overlay when `migrationProgress` returns to null

**Checkpoint**: Wardrobe fully synced end-to-end. Add item → appears in Supabase. Boot → loaded from Supabase. Fit engine Edge Function now receives real wardrobe items.

---

## Phase 4: User Story 2 — Outfit Feed Improvements (Priority: P1) 🎯 MVP+

**Goal**: Feed shows 1-2 curated demo outfits (with "add your wardrobe" banner) when
wardrobe is empty; retains last-loaded outfits + shows retry banner on error; weather
temperature band drives outfit filtering in real time.

**Independent Test**: (a) Clear wardrobe → feed shows 1-2 demo outfits + banner.
Add one item → demo outfits disappear, personalised feed loads. (b) Kill network →
pull-to-refresh shows retry banner, existing outfits stay visible. (c) Weather band
in filter matches Open-Meteo temperature for current location.

### Implementation for User Story 2

- [ ] T018 [P] [US2] Implement `weatherService.fetchCurrentWeather()` in `src/services/weatherService.ts` — call `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&temperature_unit=celsius&windspeed_unit=kmh`; parse `current_weather.temperature`, `current_weather.windspeed`, `current_weather.weathercode`; derive `temperatureBand` via `getTemperatureBand()`; set `fetchedAt` to `new Date().toISOString()`; set `locationCity` from the passed `locationCity` param (optional); throw `WeatherFetchError` on network error or non-200 response
- [ ] T019 [US2] Add weather state to `src/stores/appStore.ts` — add `weatherContext: WeatherContext | null` and `weatherLastFetched: string | null` to persisted state; add `refreshWeather()` async action: skip if last fetch was < 30 min ago AND `weatherContext` is non-null; read `coords` from `authStore.getState().profile?.location?.coords`; if no coords, return silently; call `weatherService.fetchCurrentWeather(coords, locationCity)`; on success set `weatherContext` and `weatherLastFetched`; on `WeatherFetchError` retain existing `weatherContext` silently
- [ ] T020 [US2] Call `appStore.refreshWeather()` on app boot in `app/_layout.tsx` — add to the hydration sequence after `authStore.hydrate()` completes and user is authenticated; fire-and-forget (do not await in the critical path)
- [ ] T021 [US2] Wire `weatherContext.temperatureBand` to the feed temperature filter in `app/(tabs)/index.tsx` and `src/features/feed/useFitFeed.ts` — replace static hardcoded temperature band with `appStore.weatherContext?.temperatureBand`; pass as default filter value so the feed pre-selects the user's current weather band on load
- [ ] T022 [US2] Implement empty wardrobe state in the outfit feed (FR-042) in `src/features/feed/useFitFeed.ts` and `app/(tabs)/index.tsx` — after `wardrobeItems` loads from store, check if `wardrobeItems.length === 0`; if empty, return 1–2 hand-picked curated demo outfits from `src/data/index.ts` (select the two highest-quality/most-visually-appealing pre-built outfits) plus an `isDemo: true` flag; in `app/(tabs)/index.tsx` when `isDemo` is true render a sticky banner at the bottom of the feed card: large thin text "Add your wardrobe to personalise your feed" with a CTA button navigating to Wardrobe screen; when `wardrobeItems.length > 0`, always set `isDemo: false` regardless of previous state
- [ ] T023 [US2] Implement feed error recovery (FR-043) in `src/stores/fitEngineStore.ts` and `app/(tabs)/index.tsx` — add `feedError: boolean` state to `fitEngineStore`; in `fetchOutfits()` action: on Edge Function error, set `feedError = true` and do NOT clear the `outfits` array (retain last loaded); in `app/(tabs)/index.tsx`: when `feedError` is true, render a subtle inline banner at the very top of the feed (thin text: "Couldn't refresh — tap to retry", tapping calls `fetchOutfits()` and clears `feedError`); banner uses `T.color.Warning` text on `T.color.Canvas` background, hairline bottom border

**Checkpoint**: Empty wardrobe shows 2 curated demo outfits + CTA banner. Demo disappears once wardrobe has items. Feed error shows retry banner without clearing content. Temperature filter defaults to live weather band.

---

## Phase 5: User Story 8 — Complete Stubbed Features (Priority: P1)

**Goal**: Share outfit fires native share sheet. Settings screen is accessible with
unit toggle, sign out, and delete account. Help & Feedback screen accessible with
FAQ and feedback link. All three currently navigate to nothing.

**Independent Test**: (a) Outfit Detail → Share → native share sheet appears with
outfit text. (b) Menu → Settings → screen opens with unit toggle + delete account.
(c) Menu → Help → screen opens with FAQ items + "Send feedback" link opens mail app.
(d) Settings → Delete Account → confirmation → all Supabase data purged → signed out.

### Implementation for User Story 8

- [ ] T024 [P] [US8] Create `app/settings.tsx` — Settings screen using `src/design/tokens.ts` exclusively; sections: (1) Preferences — unit toggle Metric/Imperial (reads/writes `appStore.unitPreference: 'metric'|'imperial'`, add this field to appStore); (2) Account — Sign Out button (calls `authStore.logout()`); (3) Danger Zone — "Delete Account" button (danger red `T.color.Error` text, hairline border, calls a `deleteAccount()` action); (4) App — version string from `app.json` via `expo-constants`; apply luxury minimal design: large thin section headings, generous padding, hairline separators
- [ ] T025 [P] [US8] Create `app/help.tsx` — Help & Feedback screen using design tokens; render 5 static FAQ items as expandable accordion rows (question visible, answer hidden behind tap): Q1 "How does the outfit engine work?", Q2 "Why are my outfits not personalised?", Q3 "Can I use the app offline?", Q4 "How do I delete my account?", Q5 "How do I change my body measurements?"; at the bottom: a "Send feedback" row that calls `Linking.openURL('mailto:support@trueclothes.app')` on tap; luxury minimal typography throughout
- [ ] T026 [P] [US8] Create `supabase/functions/delete-user/index.ts` — Deno Edge Function: (1) verify Bearer JWT, get `userId` via `supabase.auth.getUser(token)`; (2) delete all Storage objects in `wardrobe-photos/{userId}/` via `supabase.storage.from('wardrobe-photos').list(userId)` then `remove()`; (3) call `supabase.auth.admin.deleteUser(userId)` using the service role key from `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`; respond 200 on success, 401 on auth failure, 500 on error; all `clothing_items`, `profiles`, `body_measurements`, `style_profiles` rows cascade-delete automatically via FK ON DELETE CASCADE
- [ ] T027 [US8] Implement `deleteAccount()` action in `src/stores/authStore.ts` — call `supabase.functions.invoke('delete-user')` with user's JWT; on success: call `authStore.logout()` to clear local session and navigate to auth screen; on error: surface error message to caller; this function is called from `app/settings.tsx` after confirmation
- [ ] T028 [US8] Add confirmation modal to `app/settings.tsx` Delete Account button — on tap, show a `Modal` (React Native) or `Alert.alert` with title "Delete account?", message "This permanently deletes your profile, wardrobe, and all data. This cannot be undone.", two buttons: "Cancel" (dismiss) and "Delete" (calls `authStore.deleteAccount()`); show inline loading indicator while deletion is in progress; on success navigate to `/(onboarding)` root
- [ ] T029 [US8] Wire Share.share() for outfit sharing (FR-031) — in `app/outfit/[id].tsx` (or its hook), implement `shareOutfit()`: build share message as `"{style tag} look — {item1}, {item2}, {item3} | True Clothes"`; call `Share.share({ message })` from `react-native`; call `shareOutfit()` from the existing share icon's `onPress` handler; no new dependencies required
- [ ] T030 [US8] Register `settings` and `help` routes in `app/_layout.tsx` — add `<Stack.Screen name="settings" options={{ title: 'Settings', animation: 'slide_from_right' }} />` and `<Stack.Screen name="help" options={{ title: 'Help & Feedback', animation: 'slide_from_right' }} />`
- [ ] T031 [US8] Replace "soon" stubs for Settings and Help in `app/(tabs)/menu.tsx` — find the menu items with `soon: true` for Settings and Help & Feedback; replace `onPress` handlers with `router.push('/settings')` and `router.push('/help')` respectively; remove the "soon" badge from both items; leave all other "soon" items (Trending, Style Guide, Shop) unchanged

**Checkpoint**: All three stub gaps closed. Share fires native sheet. Settings and Help are navigable screens. Delete account purges all user data and returns to auth.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, design spec updates, and final consistency pass.

- [ ] T032 [P] Update `src/design/wardrobe/design.md` (create if absent) — document visual treatment for: (a) sync upload in progress (subtle activity indicator on item thumbnail), (b) sync error state (item thumbnail with error badge, retry tap), (c) first-boot migration overlay (full-screen, thin text, progress counter), (d) offline rejection toast ("Adding items requires an internet connection")
- [ ] T033 [P] Update `specs/001-app-baseline/quickstart.md` — add/update Scenario 3 (empty wardrobe shows 2 demo outfits + banner; demo vanishes after first item sync); update Scenario 4 (share outfit); update Scenario 5 (settings: unit toggle + delete account flow); update Scenario 8 (offline add rejection returns error message, no local state change)
- [ ] T034 Update `src/stores/appStore.ts` persistence config — ensure `unitPreference`, `wardrobeError`, `migrationProgress`, `weatherContext`, `weatherLastFetched`, `feedError` are correctly included in or excluded from the AsyncStorage persist configuration (persist: unitPreference, weatherContext, weatherLastFetched; do NOT persist: wardrobeError, migrationProgress, feedError — these are session-only)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately, all 6 tasks run in parallel
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS end-to-end testing of all user stories
- **US3 Wardrobe Sync (Phase 3)**: Depends on Phase 2 (clothing_items table must exist). T009–T012 run in parallel; T013 depends on T010; T014 depends on T009–T012; T015–T016 depend on T014; T017 depends on T016
- **US2 Feed Improvements (Phase 4)**: T018–T019 run in parallel; T020 depends on T019; T021 depends on T020; T022 depends on Phase 3 completion (wardrobeItems in store); T023 depends on T022
- **US8 Stubbed Features (Phase 5)**: T024–T026 run in parallel; T027 depends on T026; T028 depends on T024 + T027; T029 independent of T024–T028; T030 depends on T024 + T025; T031 depends on T030
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **US3 (Wardrobe Sync)**: Depends on Foundational (Phase 2) only — no dependency on US2/US8
- **US2 (Feed Improvements)**: T018–T021 can start after Phase 2; T022 depends on US3 completion (needs wardrobe items in store); T023 is independent of US3
- **US8 (Stubbed Features)**: Fully independent of US3 and US2 — can start after Phase 2

### Within Each User Story

- Services before store integration
- Store integration before screen wiring
- New screens before navigation registration
- Navigation registration before menu wiring

### Parallel Opportunities

```bash
# Phase 1 — all 6 tasks launch together:
T001: Write 20260606000001_initial_schema.sql
T002: Write 20260606000002_clothing_items.sql
T003: Write 20260606000003_storage_policies.sql
T004: Create src/types/weather.ts
T005: Create src/services/wardrobeService.ts (scaffold)
T006: Create src/services/weatherService.ts (scaffold + getTemperatureBand)

# US3 service layer — 4 tasks launch together:
T009: wardrobeService.fetchMyItems()
T010: wardrobeService.addItem()
T011: wardrobeService.deleteItem()
T012: wardrobeService.updateItem()

# US2 weather — 2 tasks launch together:
T018: weatherService.fetchCurrentWeather()
T019: appStore weather state + refreshWeather()  [then T020 → T021 → T022 → T023]

# US8 — 3 tasks launch together:
T024: Create app/settings.tsx
T025: Create app/help.tsx
T026: Create supabase/functions/delete-user/index.ts
```

---

## Implementation Strategy

### MVP First — Wardrobe Sync Only (Phases 1–3)

1. Complete Phase 1: Setup (all migration files + service scaffolds)
2. Complete Phase 2: Apply migrations to Supabase
3. Complete Phase 3: US3 Wardrobe Sync (T009–T017)
4. **STOP and VALIDATE**: Add item → Supabase row + Storage file. Boot → item loaded. Feed uses real wardrobe.
5. This unblocks personalised outfit generation end-to-end.

### Incremental Delivery

1. Phases 1–3 → Wardrobe sync working ✅
2. Phase 4 → Feed error recovery + weather + empty state ✅
3. Phase 5 → Share + Settings + Help + Delete Account ✅
4. Phase 6 → Polish and documentation ✅

### Parallel Team Strategy (if multiple developers)

After Phase 2 completes:
- **Developer A**: Phase 3 (Wardrobe Sync — T009–T017)
- **Developer B**: Phase 4 T018–T021 (Weather service + store), then T022–T023
- **Developer C**: Phase 5 (Stubbed Features — T024–T031)

All three developers can work independently after migrations are applied.

---

## Notes

- `[P]` tasks have no shared file dependencies — safe to run in parallel
- `[US2]`/`[US3]`/`[US8]` labels map to spec.md user stories
- Each phase has an explicit **Checkpoint** — validate independently before moving on
- T015 (offline guard) requires `@react-native-community/netinfo` — verify it is already installed (`package.json`) before implementing; if absent, install first
- T026 (delete-user Edge Function) uses `SUPABASE_SERVICE_ROLE_KEY` — this env var must be set in Supabase project settings under Edge Function secrets, never in `.env`
- T029 (Share) uses React Native built-in `Share` — no additional package needed
- Constitution gate reminder for every task touching Supabase: all DB/Storage calls MUST go through the service module (`wardrobeService.ts`), never directly from screens or stores
