# Research: True Clothes App — Current State Baseline

**Branch**: `001-app-baseline` | **Date**: 2026-06-06

All decisions below were resolved through codebase analysis and evaluation of options
against the existing tech stack. No external unknowns remained after analysis.

---

## Decision 1: Wardrobe Sync Strategy

**Question**: How should locally-stored wardrobe items be synced to Supabase so the
fit engine can access them?

**Decision**: On-write sync with optimistic local state.

- When a user adds an item: write to Supabase `clothing_items` first (with the photo
  uploaded to Supabase Storage), then update local Zustand state with the returned
  remote ID. On failure, roll back local state and show an error.
- On app boot (when authenticated): hydrate wardrobe from Supabase `clothing_items`
  instead of from AsyncStorage alone. This makes Supabase the source of truth for
  wardrobe items (replacing AsyncStorage for this entity).
- Photo upload: use `supabase.storage.from('wardrobe-photos').upload()` with path
  `{userId}/{itemId}.jpg`. `expo-image-picker` returns a local file URI; convert to
  a `Blob` via `expo-file-system` `readAsStringAsync` + `atob()` or use the
  `FormData` fetch pattern supported by React Native.

**Rationale**: On-write sync is simpler than eventual-consistency queuing and
appropriate for < 200 items per user. The fit engine Edge Function already queries
`clothing_items` — making items appear there immediately after add closes the
personalisation gap without any Edge Function changes.

**Alternatives considered**:
- Background sync queue (rejected: unnecessary complexity for low item count)
- Pull-only on boot (rejected: newly added items wouldn't appear in engine until next
  boot; confusing UX)
- Keep local + duplicate to Supabase (rejected: two sources of truth leads to drift,
  already the current problem)

---

## Decision 2: SQL Migration Strategy

**Question**: How should the existing schema (currently documented in markdown only)
be version-controlled as SQL migrations?

**Decision**: Create three Supabase migration files covering all existing tables,
written as "initial state" migrations rather than diffs.

- File 1 `20260606000001_initial_schema.sql`: `profiles`, `body_measurements`,
  `style_profiles` tables with RLS policies and triggers (as documented in
  `docs/server-database-definition.md`).
- File 2 `20260606000002_clothing_items.sql`: `clothing_items` table with RLS policies
  (this table is referenced by the Edge Function but was never formally defined as
  a migration).
- File 3 `20260606000003_storage_policies.sql`: Supabase Storage bucket
  `wardrobe-photos` with user-scoped RLS access policies.

**Rationale**: Starting from documented schema state gives a clean baseline. Future
schema changes will be additive migration files on top of this foundation. Running
`supabase db reset` from this point will produce a correctly structured database.

**Alternatives considered**:
- Single monolithic migration file (rejected: harder to read and review)
- Generate via `supabase db diff` (rejected: requires a live DB; writing from docs is
  equivalent and more portable)

---

## Decision 3: Weather API

**Question**: Which weather API should be integrated for live weather data in the feed?

**Decision**: Open-Meteo (`https://api.open-meteo.com`).

- Free, no API key required, no rate limits for reasonable personal-app usage.
- REST API returning JSON. Endpoint: `GET /v1/forecast?latitude={lat}&longitude={lon}&current_weather=true`
- Returns: `temperature` (°C), `weathercode` (WMO), `windspeed`.
- `expo-location` is already installed and used during onboarding; reuse the stored
  `location.coords` from `authStore` to avoid re-requesting permissions.
- Cache weather response in `appStore` with a 30-minute TTL. Feed reads
  `appStore.weatherContext` — no direct API calls from the feed hook or screen.

**Rationale**: Zero-dependency (no API key to manage), sufficient accuracy for
temperature-range outfit filtering, and coordinates are already available via
`authStore.profile.location`.

**Alternatives considered**:
- OpenWeatherMap (rejected: requires API key, complicates onboarding/config)
- WeatherAPI.com (rejected: same API key concern)
- Device weather data via native bridge (rejected: not available in Expo managed workflow)

---

## Decision 4: Outfit Share Implementation

**Question**: How should "Share outfit" be implemented given no implementation exists?

**Decision**: Use React Native's built-in `Share.share()` API.

- No new dependency required.
- Share payload: outfit title (style tag + occasion) + a descriptive text summary of
  the items. Deep link URL omitted for MVP (app not in production yet).
- Triggered from the existing share button in `app/outfit/[id].tsx`.
- Logic lives in a `useOutfitDetail` hook action, not inline in JSX.

**Rationale**: Built-in API covers the requirement with zero dependencies. Deep linking
and screenshot sharing can be added in a future iteration once the app has a production URL.

**Alternatives considered**:
- `react-native-share` library (rejected: adds native dependency, managed Expo workflow
  limitations; built-in API sufficient for text sharing)
- Screenshot + share (rejected: screenshot capture in Expo managed workflow requires
  `expo-view-shot` — unnecessary for MVP)

---

## Decision 5: Settings and Help Screens

**Question**: What should the Settings and Help & Feedback screens contain at MVP?

**Decision**:

**Settings** (`app/settings.tsx`):
- Notification preferences toggle (local preference; no push infrastructure yet — toggle
  is persisted locally but has no backend effect until push notifications are implemented)
- Unit preference (metric/imperial) — already supported in measurements but not surfaced
  as a global setting
- Sign out (move from profile to settings, or duplicate)
- App version display

**Help & Feedback** (`app/help.tsx`):
- FAQ items (static, hardcoded for MVP — 5-6 common questions)
- "Send feedback" — opens `mailto:` link to a configured support email
- No in-app form for MVP (avoids backend requirement)

**Rationale**: Both screens can be built entirely with static content and local state.
No new backend tables or API calls needed. This closes the stubbed navigation gap
immediately without blocking on infrastructure.

**Alternatives considered**:
- In-app feedback form with Supabase table (deferred: adds scope; `mailto:` sufficient
  for initial users)
- Intercom/Zendesk integration (deferred: v2 when user base justifies it)
