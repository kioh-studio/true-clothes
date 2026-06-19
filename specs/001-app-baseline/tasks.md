---

description: "Task list for MIEN App — Current State Baseline"
---

# Tasks: MIEN App — Current State Baseline

**Input**: Design documents from `specs/001-app-baseline/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. US2 (Feed) and US3 (Wardrobe) are the
two partial stories. US8 (Advanced) closes all stubbed features. US1/US4–US7 are
already complete — only data-binding fixes remain for US3 and US7 (Phase 7 Stream D).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US2, US3, US8, US-COLL, INFRA)
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

- [X] T001 [P] Write `supabase/migrations/20260606000001_initial_schema.sql` — CREATE TABLE for `public.profiles`, `public.body_measurements`, `public.style_profiles` with all columns, RLS policies, foreign keys, and `updated_at` trigger as documented in `specs/001-app-baseline/data-model.md`
- [X] T002 [P] Write `supabase/migrations/20260606000002_clothing_items.sql` — CREATE TABLE for `public.clothing_items` with all columns from data-model.md (id, user_id, photo_url, photo_path, category CHECK constraint, colors[], size_label, brand, notes, created_at, updated_at), indexes on (user_id) and (user_id, category), and four RLS policies (SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`)
- [X] T003 [P] Write `supabase/migrations/20260606000003_storage_policies.sql` — CREATE BUCKET `wardrobe-photos` (private, 10 MB limit, jpeg/png/webp), add Storage RLS policies for SELECT/INSERT/DELETE scoped to `auth.uid()::text = (storage.foldername(name))[1]`
- [X] T004 [P] Create `src/types/weather.ts` — export `WeatherContext` interface (temperatureCelsius: number, temperatureBand: 'cold'|'mild'|'warm'|'hot', weatherCode: number, windspeedKmh: number, fetchedAt: string, locationCity: string | null) as specified in `specs/001-app-baseline/contracts/weather-service.md`
- [X] T005 [P] Create `src/services/wardrobeService.ts` — export typed function signatures for `fetchMyItems`, `addItem`, `updateItem`, `deleteItem`, `migrateLocalItems` plus `AddItemInput`, `UpdateItemInput`, `WardrobeStorageError`, `WardrobeDbError` error classes; leave implementations as `throw new Error('not implemented')` stubs per `specs/001-app-baseline/contracts/wardrobe-service.md`
- [X] T006 [P] Create `src/services/weatherService.ts` — export typed function signatures for `fetchCurrentWeather(coords)` and `getTemperatureBand(celsius)` plus `Coordinates` interface and `WeatherFetchError` class; leave `fetchCurrentWeather` as stub; implement `getTemperatureBand` pure function immediately (< 10 → cold, 10–19 → mild, 20–28 → warm, > 28 → hot) per `specs/001-app-baseline/contracts/weather-service.md`

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

- [X] T009 [P] [US3] Implement `wardrobeService.fetchMyItems()` in `src/services/wardrobeService.ts` — query `clothing_items` WHERE user_id = auth.uid() ORDER BY created_at DESC; generate signed URLs (1-hour expiry) for each `photo_path` via `supabase.storage.from('wardrobe-photos').createSignedUrl()`; map snake_case row to camelCase `ClothingItem`; return empty array (not throw) if no items; throw `WardrobeDbError` on query error
- [X] T010 [P] [US3] Implement `wardrobeService.addItem()` in `src/services/wardrobeService.ts` — pre-generate `itemId = crypto.randomUUID()`; if `localPhotoUri` provided, read file with `expo-file-system` and upload Blob to `wardrobe-photos/{userId}/{itemId}.jpg` via `supabase.storage.from('wardrobe-photos').upload()`; throw `WardrobeStorageError` on upload failure (do NOT proceed to DB insert); insert row to `clothing_items` with pre-generated id; throw `WardrobeDbError` on insert failure and attempt Storage cleanup; return fully-mapped `ClothingItem` with signed URL
- [X] T011 [P] [US3] Implement `wardrobeService.deleteItem()` in `src/services/wardrobeService.ts` — delete row from `clothing_items` by id (RLS enforces ownership); after DB delete succeeds, attempt `supabase.storage.from('wardrobe-photos').remove([photo_path])`; Storage delete failure MUST be logged (`console.warn`) but MUST NOT throw — orphaned files are acceptable in MVP
- [X] T012 [P] [US3] Implement `wardrobeService.updateItem()` in `src/services/wardrobeService.ts` — update `colors`, `size_label`, `brand`, `notes` on `clothing_items` by id; return updated `ClothingItem` with signed URL; throw `WardrobeDbError` if row not found or update fails
- [X] T013 [US3] Implement `wardrobeService.migrateLocalItems()` in `src/services/wardrobeService.ts` — iterate legacy items sequentially (not parallel); for each: call `addItem()` with the item's `localPhotoUri` and metadata; call `onProgress(done, total)` after each regardless of success/failure; continue on individual failures; return array of successfully migrated `ClothingItem`s
- [X] T014 [US3] Update `src/stores/appStore.ts` — replace local wardrobe array operations with service calls: `addWardrobeItem()` action calls `wardrobeService.addItem()` then appends to local state on success; `removeWardrobeItem()` calls `wardrobeService.deleteItem()` then removes from local state; `hydrate()` calls `wardrobeService.fetchMyItems()` to populate `wardrobeItems` (replaces AsyncStorage read for wardrobe); catch `WardrobeStorageError` / `WardrobeDbError` and set a `wardrobeError: string | null` state field surfaced to UI
- [X] T015 [US3] Add offline guard to wardrobe add flow in `src/stores/appStore.ts` — before calling `wardrobeService.addItem()`, check network connectivity via `NetInfo.fetch()` (import `@react-native-community/netinfo`); if `isConnected === false`, set `wardrobeError = "Adding items requires an internet connection"` and return without modifying state (FR-045)
- [X] T016 [US3] Add first-boot migration logic to `src/stores/appStore.ts` `hydrate()` — after auth check, read `wardrobeMigrated` flag from AsyncStorage; if flag absent AND `wardrobeItems` exists in legacy AsyncStorage state, call `wardrobeService.migrateLocalItems()` with a progress callback that sets `migrationProgress: { done, total } | null` state; on completion (success or partial), write `wardrobeMigrated: true` to AsyncStorage and clear legacy wardrobe from AsyncStorage
- [X] T017 [US3] Add migration progress UI to `app/_layout.tsx` — read `migrationProgress` from `appStore`; if non-null, render a full-screen overlay (luxury minimal: large thin text "Syncing your wardrobe… {done}/{total}" on Canvas background) that blocks navigation until migration completes; remove overlay when `migrationProgress` returns to null

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

- [X] T018 [P] [US2] Implement `weatherService.fetchCurrentWeather()` in `src/services/weatherService.ts` — call `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&temperature_unit=celsius&windspeed_unit=kmh`; parse `current_weather.temperature`, `current_weather.windspeed`, `current_weather.weathercode`; derive `temperatureBand` via `getTemperatureBand()`; set `fetchedAt` to `new Date().toISOString()`; set `locationCity` from the passed `locationCity` param (optional); throw `WeatherFetchError` on network error or non-200 response
- [X] T019 [US2] Add weather state to `src/stores/appStore.ts` — add `weatherContext: WeatherContext | null` and `weatherLastFetched: string | null` to persisted state; add `refreshWeather()` async action: skip if last fetch was < 30 min ago AND `weatherContext` is non-null; read `coords` from `authStore.getState().profile?.location?.coords`; if no coords, return silently; call `weatherService.fetchCurrentWeather(coords, locationCity)`; on success set `weatherContext` and `weatherLastFetched`; on `WeatherFetchError` retain existing `weatherContext` silently
- [X] T020 [US2] Call `appStore.refreshWeather()` on app boot in `app/_layout.tsx` — add to the hydration sequence after `authStore.hydrate()` completes and user is authenticated; fire-and-forget (do not await in the critical path)
- [X] T021 [US2] Wire `weatherContext.temperatureBand` to the feed temperature filter in `app/(tabs)/index.tsx` and `src/features/feed/useFitFeed.ts` — replace static hardcoded temperature band with `appStore.weatherContext?.temperatureBand`; pass as default filter value so the feed pre-selects the user's current weather band on load
- [X] T022 [US2] Implement empty wardrobe state in the outfit feed (FR-042) in `src/features/feed/useFitFeed.ts` and `app/(tabs)/index.tsx` — after `wardrobeItems` loads from store, check if `wardrobeItems.length === 0`; if empty, return 1–2 hand-picked curated demo outfits from `src/data/index.ts` (select the two highest-quality/most-visually-appealing pre-built outfits) plus an `isDemo: true` flag; in `app/(tabs)/index.tsx` when `isDemo` is true render a sticky banner at the bottom of the feed card: large thin text "Add your wardrobe to personalise your feed" with a CTA button navigating to Wardrobe screen; when `wardrobeItems.length > 0`, always set `isDemo: false` regardless of previous state
- [X] T023 [US2] Implement feed error recovery (FR-043) in `src/stores/fitEngineStore.ts` and `app/(tabs)/index.tsx` — add `feedError: boolean` state to `fitEngineStore`; in `fetchOutfits()` action: on Edge Function error, set `feedError = true` and do NOT clear the `outfits` array (retain last loaded); in `app/(tabs)/index.tsx`: when `feedError` is true, render a subtle inline banner at the very top of the feed (thin text: "Couldn't refresh — tap to retry", tapping calls `fetchOutfits()` and clears `feedError`); banner uses `T.color.Warning` text on `T.color.Canvas` background, hairline bottom border

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

- [X] T024 [P] [US8] Create `app/settings.tsx` — Settings screen using `src/design/tokens.ts` exclusively; sections: (1) Preferences — unit toggle Metric/Imperial (reads/writes `appStore.unitPreference: 'metric'|'imperial'`, add this field to appStore); (2) Account — Sign Out button (calls `authStore.logout()`); (3) Danger Zone — "Delete Account" button (danger red `T.color.Error` text, hairline border, calls a `deleteAccount()` action); (4) App — version string from `app.json` via `expo-constants`; apply luxury minimal design: large thin section headings, generous padding, hairline separators
- [X] T025 [P] [US8] Create `app/help.tsx` — Help & Feedback screen using design tokens; render 5 static FAQ items as expandable accordion rows (question visible, answer hidden behind tap): Q1 "How does the outfit engine work?", Q2 "Why are my outfits not personalised?", Q3 "Can I use the app offline?", Q4 "How do I delete my account?", Q5 "How do I change my body measurements?"; at the bottom: a "Send feedback" row that calls `Linking.openURL('mailto:support@mien.app')` on tap; luxury minimal typography throughout
- [X] T026 [P] [US8] Create `supabase/functions/delete-user/index.ts` — Deno Edge Function: (1) verify Bearer JWT, get `userId` via `supabase.auth.getUser(token)`; (2) delete all Storage objects in `wardrobe-photos/{userId}/` via `supabase.storage.from('wardrobe-photos').list(userId)` then `remove()`; (3) call `supabase.auth.admin.deleteUser(userId)` using the service role key from `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`; respond 200 on success, 401 on auth failure, 500 on error; all `clothing_items`, `profiles`, `body_measurements`, `style_profiles` rows cascade-delete automatically via FK ON DELETE CASCADE
- [X] T027 [US8] Implement `deleteAccount()` action in `src/stores/authStore.ts` — call `supabase.functions.invoke('delete-user')` with user's JWT; on success: call `authStore.logout()` to clear local session and navigate to auth screen; on error: surface error message to caller; this function is called from `app/settings.tsx` after confirmation
- [X] T028 [US8] Add confirmation modal to `app/settings.tsx` Delete Account button — on tap, show a `Modal` (React Native) or `Alert.alert` with title "Delete account?", message "This permanently deletes your profile, wardrobe, and all data. This cannot be undone.", two buttons: "Cancel" (dismiss) and "Delete" (calls `authStore.deleteAccount()`); show inline loading indicator while deletion is in progress; on success navigate to `/(onboarding)` root
- [X] T029 [US8] Wire Share.share() for outfit sharing (FR-031) — in `app/outfit/[id].tsx` (or its hook), implement `shareOutfit()`: build share message as `"{style tag} look — {item1}, {item2}, {item3} | MIEN"`; call `Share.share({ message })` from `react-native`; call `shareOutfit()` from the existing share icon's `onPress` handler; no new dependencies required
- [X] T030 [US8] Register `settings` and `help` routes in `app/_layout.tsx` — add `<Stack.Screen name="settings" options={{ title: 'Settings', animation: 'slide_from_right' }} />` and `<Stack.Screen name="help" options={{ title: 'Help & Feedback', animation: 'slide_from_right' }} />`
- [X] T031 [US8] Replace "soon" stubs for Settings and Help in `app/(tabs)/menu.tsx` — find the menu items with `soon: true` for Settings and Help & Feedback; replace `onPress` handlers with `router.push('/settings')` and `router.push('/help')` respectively; remove the "soon" badge from both items; leave all other "soon" items (Trending, Style Guide, Shop) unchanged

**Checkpoint**: All three stub gaps closed. Share fires native sheet. Settings and Help are navigable screens. Delete account purges all user data and returns to auth.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, design spec updates, and final consistency pass.

- [X] T032 [P] Update `src/design/wardrobe/design.md` (create if absent) — document visual treatment for: (a) sync upload in progress (subtle activity indicator on item thumbnail), (b) sync error state (item thumbnail with error badge, retry tap), (c) first-boot migration overlay (full-screen, thin text, progress counter), (d) offline rejection toast ("Adding items requires an internet connection")
- [X] T033 [P] Update `specs/001-app-baseline/quickstart.md` — add/update Scenario 3 (empty wardrobe shows 2 demo outfits + banner; demo vanishes after first item sync); update Scenario 4 (share outfit); update Scenario 5 (settings: unit toggle + delete account flow); update Scenario 8 (offline add rejection returns error message, no local state change)
- [X] T034 Update `src/stores/appStore.ts` persistence config — ensure `unitPreference`, `wardrobeError`, `migrationProgress`, `weatherContext`, `weatherLastFetched`, `feedError` are correctly included in or excluded from the AsyncStorage persist configuration (persist: unitPreference, weatherContext, weatherLastFetched; do NOT persist: wardrobeError, migrationProgress, feedError — these are session-only)

---

## Phase 7: Collections Management UI + Schema Drift Fix + Data Binding Fixes (2026-06-07)

**Context**: Phases 1–6 complete. Four open work streams remain:
(A) Schema drift corrective migration; (B) Collections management UI wiring;
(C) Outfit detail "Add to Collection" semantic fix; (D) Screen data binding gaps —
wardrobe screen, add-item screen, and profile screen all point at stale local state
instead of the remote Supabase-backed state introduced in Phase 3.

Tasks from `specs/001-app-baseline/plan.md` Phase 7 plus three new gaps surfaced
in the UI audit (T043–T045).

### Stream A — Infrastructure

- [X] T035 [INFRA] Write `supabase/migrations/20260607000003_fix_schema_drift.sql` — add `IF NOT EXISTS` guards for: (1) `CREATE TABLE IF NOT EXISTS public.wardrobes (id uuid PK DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id))` with RLS `select/insert own` policies; (2) `ALTER TABLE public.clothing_items ADD COLUMN IF NOT EXISTS wardrobe_id uuid REFERENCES public.wardrobes(id) ON DELETE CASCADE`; (3) `ALTER TABLE public.clothing_items DROP COLUMN IF EXISTS user_id` — DO NOT execute this, just add a comment noting the column may need removal once all rows are migrated. Migration is idempotent and safe to run against the live DB.

- [X] T036 [P] [INFRA] Add `CollectionDisplayItem` type and `resolveItemIds()` pure helper to `src/data/index.ts` — export `interface CollectionDisplayItem { id: string; name: string; categoryLabel: string; imageSource: number | { uri: string } | null }`; export `function resolveItemIds(ids: string[], wardrobeItems: WardrobeItem[]): CollectionDisplayItem[]` — two-pass lookup: (1) `itemById(id)` for static items → map `{ id, name: i.name, categoryLabel: i.type, imageSource: i.png ?? (i.img ? { uri: i.img } : null) }`; (2) `wardrobeItems.find(i => i.id === id)` for UUID items → map `{ id, name: w.category.toUpperCase(), categoryLabel: w.category.toUpperCase(), imageSource: w.photoUrl ? { uri: w.photoUrl } : null }`; skip nulls. `WardrobeItem` must be imported from `src/types/fitEngine.ts`. This is a pure function with no side effects.

### Stream B — Collections Management UI

- [X] T037 [P] [US-COLL] Create `src/features/collections/useCollectionSheet.ts` hook — manages bottom-sheet form state for create/edit flows: `name: string`, `description: string`, `visible: boolean`, `mode: 'create' | 'edit'`, `editingId: string | null`; actions: `openCreate()` (set mode=create, clear fields, visible=true), `openEdit(collection: Collection)` (set mode=edit, pre-fill fields, visible=true), `close()`, `setName()`, `setDescription()`; no Supabase calls — delegates to `appStore.createCollection` / `appStore.updateCollection` from the caller

- [X] T038 [US-COLL] Wire "Create Collection" sheet in `app/collections/index.tsx` — import `useCollectionSheet` hook; wire the existing `+` icon `Pressable` `onPress` to `sheet.openCreate()`; render a `BottomSheet` with: text input for name (required, max 60 chars), text input for description (optional, max 200 chars), a confirm `PrimaryButton` labelled "CREATE" that calls `appStore.createCollection(name, description)` then `sheet.close()`, and a dismiss `TextLink`; disable confirm button when name is empty; show inline error when `appStore.collectionsError` is non-null; luxury minimal design: large thin labels, hairline `TextInput` borders using `T.color.hairline`, `T.font.serif` for labels — T038 depends on T037

- [X] T039 [US-COLL] Wire "Edit Collection" sheet and delete action in `app/collections/[id].tsx` — wire existing edit icon `Pressable` `onPress` to `sheet.openEdit(collection)`; render a `BottomSheet` with: pre-filled name + description inputs (same design as T038), a confirm `PrimaryButton` labelled "SAVE" calling `appStore.updateCollection(id, { name, description })` then `sheet.close()`, a `TextLink` labelled "Delete collection" in `T.color.error` that shows an `Alert.alert("Delete collection?", "This cannot be undone.", [Cancel, Delete])` on tap, Delete calls `appStore.deleteCollection(id)` and navigates back via `router.back()` — T039 depends on T037

- [X] T040 [US-COLL] Implement "Add Items to Collection" picker in `app/collections/[id].tsx` — add an "ADD ITEMS" text button or hairline button below the item grid; on tap: open a `BottomSheet` (maxHeight 85%) containing a `FlatList` of all items from `appStore.wardrobeItems` that are NOT already in `collection.itemIds`; render each as a half-width card (CARD_W pattern from existing code) with selected-border highlight (`borderColor: T.color.primary` when selected, `T.color.hairline` otherwise); manage a local `selectedIds: Set<string>` state; add a fixed bottom bar with "ADD {n} ITEMS" `PrimaryButton` (disabled when empty) that calls `appStore.addItemToCollection(id, itemId)` for each selected ID sequentially then closes the sheet; if `wardrobeItems` is empty, render a prompt: "Add items to your wardrobe first" with a CTA to the wardrobe screen

- [X] T041 [US-COLL] Update item lookup in `app/collections/index.tsx` and `app/collections/[id].tsx` to use `resolveItemIds()` — in both screens, replace the current `c.itemIds.map(id => ITEMS.find(i => i.id === id)).filter(Boolean)` pattern with `resolveItemIds(c.itemIds, appStore.wardrobeItems)`; update rendering to use `CollectionDisplayItem.imageSource` in Image source prop and `CollectionDisplayItem.categoryLabel` / `name` for labels; `Photo` component may need to be replaced with a plain `Image` in the collage cells since `Photo` expects `ClothingItem` shape — verify and fix if needed; T041 depends on T036

### Stream C — Outfit Detail Fix

- [X] T042 [US-COLL] Repurpose "Add to Collection" button on `app/outfit/[id].tsx` — replace the `toggleCollection(outfit.id)` call (which incorrectly tracks outfit IDs in `collectionsAddedSet`) with: (1) a local `collectionPickerOpen: boolean` state; (2) on button press: open a `BottomSheet` showing a list of the user's `appStore.collections` as pressable rows (name + item count); (3) when a collection is selected, iterate `outfit.itemIds` and for each item whose ID is a Supabase UUID (not a static demo ID — check `!/^[a-z]/.test(id)` or similar), call `appStore.addItemToCollection(collectionId, itemId)`; (4) on completion, close picker and show a brief inline confirmation text "Items added to {collection.name}"; if `collections` is empty, render a prompt "Create a collection first" with a link to `/collections`; remove `collectionsAddedSet` from `useAppStore` destructure in this component — the `collectionsAddedSet` store field itself is preserved for now (other screens may use it) but its usage in outfit detail is replaced

### Stream D — Data Binding Fixes

These three gaps were introduced when the Phase 3 service layer was implemented but the
screens were not updated to read from the new store state.

- [X] T043 [P] [US3] Update `app/(tabs)/wardrobe.tsx` to display `wardrobeItems` (remote, Supabase-backed) instead of `items` (static + local-only) — replace `const { items, addItem } = useAppStore()` with `const { wardrobeItems, removeWardrobeItem, wardrobeError } = useAppStore()`; update the `filtered` derivation to read from `wardrobeItems` using `WardrobeItem.category` (e.g. 'top', 'bottom') for filter matching, mapping to FILTER labels ('TOP', 'BOTTOM' etc); update `ItemCard` rendering: `WardrobeItem` has `photoUrl` instead of `img`/`png` — pass `{ uri: item.photoUrl }` as the image source; update the delete handler to call `removeWardrobeItem(item.id)`; show `wardrobeError` as a top banner when non-null; keep the `AddItemSheet` / FAB but remove its inline `addItem()` call (wired in T044)

- [X] T044 [P] [US3] Update `app/add-item.tsx` to call `addWardrobeItem()` (Supabase sync) instead of `addItem()` (local-only) — in `handleSave()`, replace `addItem({ id: 'u_' + Date.now(), ... })` with `await appStore.addWardrobeItem({ localPhotoUri: imageUri ?? undefined, category: category.toLowerCase() as WardrobeItem['category'], colors: [color], sizeLabel: size, brand: brand || undefined, notes: name || undefined })`; import `WardrobeItem` type from `src/types/fitEngine.ts`; show an `ActivityIndicator` on the save button while the upload/insert is in progress; on `wardrobeError` non-null, display the error inline and allow retry; on success navigate back with `router.back()`; also update the `onAdded` handler in `app/(tabs)/wardrobe.tsx`'s `AddItemSheet` to call `addWardrobeItem()` using the same pattern (T043 and T044 can proceed in parallel — different files)

- [X] T045 [P] [US7] Wire `app/(tabs)/profile.tsx` display name and avatar initial to `authStore` — replace the hardcoded `"Khoi Nguyen"` and `"K"` with live data: import `useAuthStore`; read `authStore.profile?.phone` or `authStore.profile?.email` as the display identity (format: mask phone as `+84 *** ***{last4}` or show email prefix); derive the avatar initial from the first character of the display identity; if `authStore.profile` is null (not yet loaded), show placeholder `"—"`; the "Edit profile" TextLink currently has no `onPress` — add navigation to a future `/profile-edit` route stub (push `router.push('/profile-edit' as any)`) or remove the link if that route is not planned for this phase (check CLAUDE.md — it is not listed, so remove or disable the link to avoid dead navigation)

**Checkpoint (Phase 7 complete)**: Collections can be created, edited, deleted. Items can be added to collections via a picker. Outfit detail's "Add to Collection" adds wardrobe items (not outfit IDs). Wardrobe screen shows Supabase-synced items. Add item syncs to Supabase. Profile shows real user identity.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately, all 6 tasks run in parallel
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS end-to-end testing of all user stories
- **US3 Wardrobe Sync (Phase 3)**: Depends on Phase 2 (clothing_items table must exist). T009–T012 run in parallel; T013 depends on T010; T014 depends on T009–T012; T015–T016 depend on T014; T017 depends on T016
- **US2 Feed Improvements (Phase 4)**: T018–T019 run in parallel; T020 depends on T019; T021 depends on T020; T022 depends on Phase 3 completion (wardrobeItems in store); T023 depends on T022
- **US8 Stubbed Features (Phase 5)**: T024–T026 run in parallel; T027 depends on T026; T028 depends on T024 + T027; T029 independent of T024–T028; T030 depends on T024 + T025; T031 depends on T030
- **Polish (Phase 6)**: Depends on all user story phases being complete
- **Phase 7 (Collections UI + Schema Fix + Data Binding)**:
  - Stream A: T035 and T036 can start immediately (parallel)
  - Stream B: T037 can start immediately; T038 and T039 depend on T037 (parallel after T037); T040 depends on T037; T041 depends on T036
  - Stream C: T042 is independent of all other Phase 7 tasks
  - Stream D: T043, T044, T045 are all independent of each other and of Streams A/B/C — start immediately in parallel

### User Story Dependencies

- **US3 (Wardrobe Sync)**: Phase 3 service + store work done; T043/T044 (Stream D) complete the screen wiring
- **US2 (Feed Improvements)**: All tasks T018–T023 complete
- **US8 (Stubbed Features)**: All tasks T024–T031 complete
- **US-COLL (Collections UI)**: Depends on T036 (resolveItemIds) for T041; T037 for T038/T039/T040; T042 independent
- **US7 (Profile)**: T045 completes the data binding for profile screen

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

# Phase 7 Stream D — all 3 launch together (independent files):
T043: app/(tabs)/wardrobe.tsx → wardrobeItems
T044: app/add-item.tsx → addWardrobeItem()
T045: app/(tabs)/profile.tsx → authStore data
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
5. Phase 7 → Collections UI + data binding fixes (current work)

### Phase 7 Recommended Order

With a single developer, recommended sequencing within Phase 7:

1. **Start now (parallel)**: T035, T036, T037, T042, T043, T044, T045 — all touch different files
2. **After T037**: T038, T039, T040 (bottom sheets depend on the hook)
3. **After T036**: T041 (resolveItemIds helper must exist)
4. **Final check**: Run Scenario 9 in `specs/001-app-baseline/quickstart.md`

---

## Notes

- `[P]` tasks have no shared file dependencies — safe to run in parallel
- `[US2]`/`[US3]`/`[US8]`/`[US-COLL]`/`[US7]` labels map to spec.md user stories
- Each phase has an explicit **Checkpoint** — validate independently before moving on
- T015 (offline guard) requires `@react-native-community/netinfo` — verify it is already installed (`package.json`) before implementing; if absent, install first
- T026 (delete-user Edge Function) uses `SUPABASE_SERVICE_ROLE_KEY` — this env var must be set in Supabase project settings under Edge Function secrets, never in `.env`
- T029 (Share) uses React Native built-in `Share` — no additional package needed
- T043/T044: `WardrobeItem` from `src/types/fitEngine.ts` has `category` as `'top'|'bottom'|'outerwear'|'footwear'|'accessory'` — map to the wardrobe screen's FILTER labels ('TOP', 'BOTTOM', 'OUTERWEAR', 'FOOTWEAR', 'ACCESSORIES') when filtering
- T044: `addWardrobeItem()` in `appStore` takes an `AddItemInput` shape — check `wardrobeService` contract for exact field names before implementing
- T045: `/profile-edit` route does not exist and is not planned for this phase — disable or remove the "Edit profile" TextLink rather than adding dead navigation
- Constitution gate reminder for every task touching Supabase: all DB/Storage calls MUST go through the service module (`wardrobeService.ts`), never directly from screens or stores
