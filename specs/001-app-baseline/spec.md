# Feature Specification: MIEN App — Current State Baseline

**Feature Branch**: `001-app-baseline`

**Created**: 2026-06-06

**Status**: Draft

**Input**: Codebase audit — documenting what has already been built, what features
are complete, what is partially done, and what appears broken or missing.

**Legend**:
- ✅ Complete — implemented, functional, state persists correctly within a session
- ⚠️ Partial — UI present and functional; critical back-end or sync integration absent
- ❌ Missing/Stubbed — visible in UI but produces no meaningful action, or not started

---

## Clarifications

### Session 2026-06-06

- Q: When wardrobe sync is working and user has zero synced items, what should the feed show? → A: Show 1–2 curated high-quality demo outfits that illustrate the app's aesthetic, with a persistent banner CTA ("Add your wardrobe to personalise your feed"). As soon as the user has ≥1 clothing item synced to Supabase, the demo outfits are removed entirely and only personalised suggestions appear.
- Q: When outfit generation fails (Edge Function error or network timeout), what should the feed show? → A: Retain the last-loaded outfits; show a subtle inline banner at the top reading "Couldn't refresh — tap to retry." Feed content is never cleared on error. Silent background retry is not performed — user initiates retry explicitly.
- Q: Should the app provide account and data deletion? → A: Yes. Settings MUST include a "Delete account" action that permanently purges only the authenticated user's own data — profile, body measurements, style profile, wardrobe items, and wardrobe photos. No other user's data is affected. Deletion is irreversible and requires an in-app confirmation step before executing.
- Q: Should Settings include a notification toggle given push infrastructure doesn't exist yet? → A: No. Exclude the notification toggle from the Settings MVP entirely. It will be added only when push notifications are implemented. Shipping a non-functional toggle erodes trust.
- Q: When a user tries to add a wardrobe item while offline or Supabase is unreachable, what should happen? → A: Reject the add immediately with a clear message: "Adding items requires an internet connection." No local state change occurs. The user must be online to add items, since local-only items are invisible to the fit engine and would create a false wardrobe state.

---

## User Scenarios & Testing

### User Story 1 — New User Onboarding (Priority: P1) ✅ Complete

A first-time user opens MIEN and is guided through a sequential setup flow
that collects everything the app needs to generate personalised outfit suggestions:
identity, location, body measurements, style preferences, and colour palette. At the
end, the user is prompted to add their first clothing item before accessing the main app.

**Why this priority**: Onboarding is the prerequisite for every other feature. Without
it, no personalisation is possible and the main app is inaccessible.

**Independent Test**: Install the app fresh and complete all 11 screens through to the
outfit feed. The demo account (`+84977...`, OTP `123456`) can be used to shortcut OTP.

**Acceptance Scenarios**:

1. **Given** the app is freshly installed, **When** the user opens it, **Then** the
   Welcome screen appears with the brand name and a single CTA button.
2. **Given** the user is on the Account screen, **When** they enter a valid phone number
   and submit, **Then** a 6-digit OTP is sent and the OTP verification screen opens.
3. **Given** the user enters the correct OTP, **When** they confirm, **Then** they
   advance to the Personal Info screen.
4. **Given** the user completes all 11 onboarding screens, **When** they reach the
   final screen, **Then** `onboardingComplete` is set to `true` and the main app
   (outfit feed) is shown.
5. **Given** a user has partially completed onboarding, **When** they reopen the app,
   **Then** they resume from the last incomplete screen rather than restarting.

**Known Gaps**:
- Apple Sign-in and Google Sign-in show a "Coming soon" alert instead of initiating
  OAuth. (FR-006, FR-007)
- The "AI body scan" path in the Measurements screen does not exist; manual entry only.
  (FR-009)

---

### User Story 2 — Outfit Discovery Feed (Priority: P1) ⚠️ Partial

After onboarding, the user sees a full-screen, vertically-scrolling feed of outfit
suggestions — one per page. Each card shows an outfit photo, style tag, temperature
range, and occasion label. The user can scroll, save outfits, mark them worn, schedule
them, or open the detail view.

**Why this priority**: The feed is the primary value-delivery surface.

**Independent Test**: Log in with the demo account and scroll the feed. Outfits should
render, scrolling should be 60 fps, and save/worn actions should persist across sessions.

**Acceptance Scenarios**:

1. **Given** the user is on the Home tab, **When** the feed loads, **Then** outfit cards
   appear full-screen with one outfit per scroll snap.
2. **Given** an outfit card is visible, **When** the user taps the heart icon, **Then**
   the outfit is saved and the icon reflects the saved state.
3. **Given** an outfit card is visible, **When** the user taps "Worn today", **Then** the
   outfit is logged to the user's worn history with today's date.
4. **Given** an outfit card is visible, **When** the user taps the photo, **Then** the
   Outfit Detail screen opens.
5. **Given** the feed is open and a temperature filter is applied, **When** the filter
   value changes, **Then** only outfits within the selected range remain visible.

**Known Gaps (Partial)**:
- Wardrobe items are local-only; the Edge Function generates from an empty wardrobe.
  Post-fix: empty wardrobe shows 1–2 curated demo outfits + "add your wardrobe" banner;
  demo disappears once ≥1 item is synced. (FR-012, FR-020, FR-042)
- Weather filtering uses static temperature bands; live weather API not integrated. (FR-014)

---

### User Story 3 — Wardrobe Management (Priority: P2) ⚠️ Partial

The user builds a personal wardrobe by photographing or uploading clothing items and
tagging them with category, colour, and optional metadata. The wardrobe is browsable
and filterable. Items are the data source for outfit generation.

**Why this priority**: The wardrobe is the raw material for all personalisation.
An empty or local-only wardrobe breaks the personalisation engine.

**Independent Test**: Add three items (top, bottom, shoes). Close and reopen the app.
All three items should still appear in the Wardrobe grid. (Note: data will be lost on
reinstall — this is the key gap.)

**Acceptance Scenarios**:

1. **Given** the user is on the Wardrobe screen, **When** they tap "Add Item", **Then**
   they can choose a photo from the camera or photo library.
2. **Given** a photo is selected, **When** the user fills in category, colour, and
   optional metadata and confirms, **Then** the item appears in the wardrobe grid.
3. **Given** items are in the wardrobe, **When** the user selects a category filter,
   **Then** only items of that category are shown.
4. **Given** an item exists, **When** the user taps and confirms deletion, **Then**
   the item is removed from the grid.
5. **Given** the user reopens the app, **When** the Wardrobe screen loads, **Then**
   all previously added items are visible (within the same device/install).

**Known Gaps**:
- Items are persisted in local device storage only. Reinstalling or switching devices
  permanently loses all wardrobe data. (FR-019 gap, FR-020 missing)
- Item photos are stored on-device; they are not uploaded to remote storage. (FR-021)
- Because items are never synced to Supabase, the server-side fit engine cannot access
  the user's actual wardrobe for personalised outfit generation. (FR-020)

---

### User Story 4 — Outfit Curation: Save, Schedule, Collect, Worn Log (Priority: P2) ✅ Complete

The user curates outfits across four dimensions: saving favourites, scheduling outfits
for specific dates, organising them into named collections, and logging what they
actually wore. All four states persist across app sessions.

**Why this priority**: Curation turns one-time discovery into daily utility and is
the primary engagement driver.

**Independent Test**: Save an outfit, schedule it for tomorrow, add it to a new
collection, mark it as worn today. Navigate away and return to each respective screen
to confirm all four states persisted.

**Acceptance Scenarios**:

1. **Given** an outfit is on screen, **When** the user taps Save, **Then** it appears
   in the Saved Outfits list.
2. **Given** an outfit detail is open, **When** the user taps Schedule and selects a
   date, **Then** the outfit is pinned to that calendar date.
3. **Given** the Schedule screen is open, **When** the user selects a date with a
   scheduled outfit, **Then** the outfit for that date is shown.
4. **Given** the user creates a new collection and adds outfits, **When** the collection
   detail view opens, **Then** all added outfits are displayed.
5. **Given** an outfit is marked "Worn today", **When** the user opens History and
   selects today's date, **Then** that outfit appears in the log.

---

### User Story 5 — Style Personalisation (Priority: P3) ✅ Complete

After onboarding, the user can revisit and update their style preferences, colour
palette, body measurements, and outfit formula preferences at any time from the Menu.
Changes are persisted and feed into future outfit suggestions.

**Why this priority**: Style evolves. The app must allow preferences to change without
forcing a full re-onboarding.

**Independent Test**: Change selected style from "Minimalist" to "Streetwear". Navigate
back to the feed and refresh. Outfit style tags should reflect the change (once wardrobe
sync is working end-to-end).

**Acceptance Scenarios**:

1. **Given** the user opens Style Preferences, **When** they deselect one style and
   select another, **Then** the change is saved immediately.
2. **Given** the user edits their Colour Palette, **When** they toggle colour tones,
   **Then** selections persist after leaving the screen.
3. **Given** the user opens Measurements and switches the unit to inches, **When** they
   enter a height value in inches, **Then** the value is stored internally in centimetres.
4. **Given** the user updates any preference, **When** the outfit feed is next refreshed,
   **Then** the new suggestions reflect the updated profile.

---

### User Story 6 — Manual Outfit Builder (Priority: P3) ✅ Complete

The user manually composes an outfit by selecting individual clothing items from their
wardrobe, one category at a time. The builder surfaces compatible items as selections
are made.

**Why this priority**: Gives the user agency to compose looks the automated engine
might not generate.

**Independent Test**: Open "Build an Outfit", select a top, a bottom, and shoes. The
composed outfit should be displayable and saveable.

**Acceptance Scenarios**:

1. **Given** the user opens Build an Outfit, **When** they tap a category strip, **Then**
   all available items in that category are shown.
2. **Given** a top is selected, **When** the user moves to the Bottoms strip, **Then**
   the previously chosen top remains selected.
3. **Given** items are selected across categories, **When** the user views the composed
   outfit, **Then** all selected items are shown together as a complete look.

---

### User Story 7 — User Profile & Stats (Priority: P3) ✅ Complete

The user can view a personal profile showing wardrobe statistics (item count, saved
outfits, collections) and navigate to preference-editing screens. Sign-out is accessible
from the profile.

**Acceptance Scenarios**:

1. **Given** the user navigates to Profile, **When** the screen loads, **Then** the
   wardrobe item count, saved outfits count, and collections count are displayed.
2. **Given** the user taps an edit link (e.g., Style Preferences), **When** the edit
   screen opens, **Then** current preference values are pre-filled.
3. **Given** the user taps Sign Out and confirms, **When** the action completes, **Then**
   the local session is cleared and the auth screen is shown.

---

### User Story 8 — Advanced & Social Features (Priority: P4) ❌ Not Implemented

Features planned for future releases. All are visible in the current UI but produce
no meaningful action when tapped.

**Acceptance Scenarios** (all currently fail):

1. **Given** the user taps "Sign in with Apple" on the Account screen, **When** the
   OAuth flow should launch, **Then** a "Coming soon" alert appears instead.
2. **Given** the user taps "Sign in with Google", **When** the OAuth flow should launch,
   **Then** a "Coming soon" alert appears instead.
3. **Given** the user taps "GENERATE ON YOU" on the Outfit Detail screen, **When** the
   AI try-on should render, **Then** a bottom sheet opens but displays no content.
4. **Given** the user taps the Share icon on Outfit Detail, **When** a native share
   sheet should appear, **Then** no action occurs.
5. **Given** the user taps "Trending in Your Area" in the Menu, **When** a screen
   should open, **Then** no navigation occurs (item is marked "soon").
6. **Given** the user taps "Style Guide" in the Menu, **When** a screen should open,
   **Then** no navigation occurs (item is marked "soon").
7. **Given** the user taps "Settings", **When** a settings screen should open, **Then**
   no navigation occurs (item is marked "soon").
8. **Given** the user taps "Help & Feedback", **When** a support screen should open,
   **Then** no navigation occurs (item is marked "soon").
9. **Given** the user taps "Shop Recommendations", **When** a screen should open,
   **Then** no navigation occurs (item is marked "soon").

---

### Edge Cases

- What happens when the user's wardrobe is empty (zero synced items)? The feed shows
  1–2 curated demo outfits chosen to exemplify the app's visual quality, alongside a
  persistent banner: "Add your wardrobe to personalise your feed." The demo outfits are
  removed from the feed permanently once the user has at least one clothing item synced
  to Supabase. They do not reappear even if the user later deletes all items.
- What happens when the Supabase Edge Function fails or times out? The feed retains
  its last-loaded outfits and displays a subtle inline banner: "Couldn't refresh — tap
  to retry." The feed is never cleared on error. The user initiates the retry explicitly
  by tapping the banner; no silent background retry is performed.
- What happens when the OTP expires? A timer and retry button are present; the user
  must request a new code.
- What happens when the user reinstalls the app? All locally-persisted wardrobe items
  and photos are permanently lost. Supabase-persisted data (profile, preferences,
  measurements) is recovered on next login.
- What happens when the app is used offline? Locally-persisted state (saved, scheduled,
  worn) remains accessible. The outfit feed cannot load new suggestions and retains
  last-loaded outfits. Attempting to add a wardrobe item while offline is rejected
  immediately with the message "Adding items requires an internet connection" — no
  local state change is made.
- What happens when both phone and email OTP are used by the same user? The auth
  system supports either method independently; the user's profile links both.

---

## Requirements

### Functional Requirements — Authentication & Onboarding

| ID | Requirement | Status |
|----|-------------|--------|
| FR-001 | The app MUST guide new users through an 11-screen onboarding flow before granting access to the main app | ✅ Complete |
| FR-002 | The app MUST support phone number authentication via 6-digit OTP | ✅ Complete |
| FR-003 | The app MUST support email authentication via 6-digit OTP (magic link) | ✅ Complete |
| FR-004 | The app MUST persist onboarding completion state so a completed user is never shown onboarding again | ✅ Complete |
| FR-005 | The app MUST allow resumption of a partially completed onboarding flow from the last incomplete screen | ✅ Complete |
| FR-006 | The app MUST support Apple Sign-in | ❌ Stubbed |
| FR-007 | The app MUST support Google Sign-in | ❌ Stubbed |
| FR-008 | The app MUST collect age/gender, location, height, weight, style preferences, and colour palette during onboarding | ✅ Complete |
| FR-009 | The app MUST optionally support AI pose capture for automatic body measurement | ❌ Not started |

### Functional Requirements — Outfit Feed

| ID | Requirement | Status |
|----|-------------|--------|
| FR-010 | The app MUST present outfits in a full-screen, one-outfit-per-snap, vertically-scrolling feed | ✅ Complete |
| FR-011 | The app MUST allow users to filter feed outfits by temperature range | ✅ Complete |
| FR-012 | The app MUST generate personalised outfit suggestions based on the user's own wardrobe, style profile, and body measurements | ⚠️ Engine exists; wardrobe sync missing |
| FR-013 | The app MUST allow users to navigate from a feed card to a full outfit detail view | ✅ Complete |
| FR-014 | The app MUST incorporate real-time local weather data into outfit suggestions | ❌ Not started |

### Functional Requirements — Wardrobe

| ID | Requirement | Status |
|----|-------------|--------|
| FR-015 | The app MUST allow users to add clothing items by photographing them or selecting from the photo library | ✅ Complete |
| FR-016 | The app MUST allow users to tag items with category, colour, size, and optional metadata | ✅ Complete |
| FR-017 | The app MUST allow users to filter their wardrobe by category | ✅ Complete |
| FR-018 | The app MUST allow users to delete wardrobe items | ✅ Complete |
| FR-019 | The app MUST persist wardrobe items across app sessions on the same device | ⚠️ Local only; lost on reinstall |
| FR-020 | The app MUST sync wardrobe items to the remote database so the fit engine can access them | ❌ Not implemented |
| FR-021 | The app MUST upload item photos to remote storage | ❌ Not implemented |

### Functional Requirements — Outfit Curation

| ID | Requirement | Status |
|----|-------------|--------|
| FR-022 | The app MUST allow users to save and unsave outfits | ✅ Complete |
| FR-023 | The app MUST allow users to schedule outfits to specific calendar dates | ✅ Complete |
| FR-024 | The app MUST allow users to mark outfits as worn and log the date | ✅ Complete |
| FR-025 | The app MUST allow users to create named collections and add or remove outfits | ✅ Complete |
| FR-026 | The app MUST display a history log of outfits worn, grouped by date | ✅ Complete |

### Functional Requirements — Style Personalisation

| ID | Requirement | Status |
|----|-------------|--------|
| FR-027 | The app MUST allow users to update their selected style tags and sub-style niches at any time | ✅ Complete |
| FR-028 | The app MUST allow users to update their colour palette preferences | ✅ Complete |
| FR-029 | The app MUST allow users to update body measurements with imperial/metric conversion | ✅ Complete |
| FR-030 | The app MUST allow users to update outfit formula preferences | ✅ Complete |

### Functional Requirements — Advanced Features (Future)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-031 | The app MUST allow users to share outfits to external channels | ❌ Stubbed |
| FR-032 | The app MUST provide an AI try-on feature overlaying outfits on the user's own image | ❌ Stubbed |
| FR-033 | The app MUST show trending outfits in the user's geographic area | ❌ Not started |
| FR-034 | The app MUST provide a curated style guide | ❌ Not started |
| FR-035 | The app MUST provide a settings screen containing: unit preference (metric/imperial), app version display, sign out, and delete account (see FR-044) | ❌ Not started |
| FR-036 | The app MUST provide in-app help and feedback submission | ❌ Not started |
| FR-037 | The app MUST provide shop recommendations for clothing items | ❌ Not started |
| FR-042 | The app MUST show 1–2 curated demo outfits in the feed (with an "add your wardrobe" CTA banner) when the user has zero synced wardrobe items; demo outfits MUST be removed permanently once ≥1 item is synced | ❌ Not implemented |
| FR-043 | When outfit generation fails, the feed MUST retain its last-loaded outfits and display a subtle inline "Couldn't refresh — tap to retry" banner; the feed MUST NOT be cleared on error | ❌ Not implemented |
| FR-044 | The Settings screen MUST include a "Delete account" action that permanently purges only the authenticated user's own data (profile, measurements, style profile, wardrobe items, and wardrobe photos); the action MUST require an explicit in-app confirmation before executing; no other user's data is affected | ❌ Not implemented |
| FR-045 | Attempting to add a wardrobe item while offline or when Supabase is unreachable MUST be rejected immediately with the message "Adding items requires an internet connection"; no local state change MUST occur on failure | ❌ Not implemented |

### Infrastructure Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-038 | All database schema changes MUST be tracked as SQL migration files in version control | ❌ Schema documented in markdown only; no migration files |
| FR-039 | The demo account MUST remain functional at all times as the primary manual testing entry point | ✅ Complete |
| FR-040 | The outfit feed MUST scroll at 60 frames per second on mid-range devices | ✅ Complete |
| FR-041 | The server-side outfit generation MUST complete within 3 seconds | ⚠️ No measurement; assumed acceptable |

### Key Entities

- **ClothingItem**: A single piece of clothing. Attributes: photo (local URI), category
  (top / bottom / outerwear / footwear / accessory), colour tones (named strings),
  brand, size label, notes. Currently persisted locally only.
- **Outfit**: A composition of one or more ClothingItems with style tags, occasion tag,
  and user-state flags (saved, worn, scheduled, collected).
- **OutfitSuggestion**: A server-generated, scored outfit with a match score, weather
  context, and quality tier (preference-match vs. discovery).
- **UserProfile**: Identity, location (city/country), gender, date of birth.
- **BodyMeasurements**: Height (cm), weight (kg), optional chest/waist/hip (cm),
  preferred fit. Stored in metric; display conversion is a UI concern.
- **StyleProfile**: Selected style tags, dominant colour tones (named strings),
  formula preferences.
- **Collection**: A named, user-curated group of outfits.
- **WornRecord**: An entry linking an Outfit to the date it was worn.

---

## Success Criteria

### Measurable Outcomes — Currently Met

- **SC-001**: A new user can complete the full onboarding flow and reach the outfit feed
  within 5 minutes of first launch.
- **SC-002**: The outfit feed loads and displays at least one outfit within 3 seconds of
  navigating to the Home tab.
- **SC-003**: Wardrobe items added by the user persist and are visible after closing and
  reopening the app on the same device.
- **SC-004**: A user can save, schedule, mark as worn, and add to a collection — and find
  each action reflected in the corresponding screen — without leaving the app.
- **SC-005**: The outfit feed scrolls at 60 frames per second on mid-range iOS and Android
  devices.

### Measurable Outcomes — Not Yet Met (Gaps)

- **SC-006** *(target)*: Outfit suggestions reflect only items from the user's personal
  wardrobe, not fallback demo data. Requires wardrobe sync to Supabase (FR-020).
- **SC-007** *(target)*: A user who reinstalls the app or switches devices recovers their
  full wardrobe without data loss. Requires remote wardrobe + photo storage (FR-020, FR-021).
- **SC-008** *(target)*: OAuth sign-in (Apple or Google) completes within 30 seconds of
  initiating. Requires OAuth implementation (FR-006, FR-007).
- **SC-009** *(target)*: Outfit suggestions account for the current local weather, not
  static temperature bands. Requires weather API integration (FR-014).

---

## Assumptions

- The primary target user is a fashion-conscious individual in an urban environment who
  owns physical clothing and wants daily outfit suggestions based on what they actually own.
- The initial market is Vietnam (primary) and Southeast Asia (secondary), reflected in
  the demo account locale.
- "Complete" means the feature is implemented, functional, and state persists correctly
  within a single device session on one device.
- "Partial" means the user-facing UI is present and functional, but a critical back-end
  or cross-device persistence integration is absent.
- "Missing/Stubbed" means the feature is visible in the UI but produces no meaningful
  action when triggered.
- The Supabase back-end is correctly provisioned in the target environment.
  The codebase requires valid `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` environment variables to function.
- The demo account (`+84977...`, OTP `123456`) is maintained as a permanent testing
  shortcut and must not be removed or broken.
- Measurements are always stored internally in metric (cm, kg). Imperial display
  is a conversion layer in the UI only.
- Colour tones are always stored as named strings (e.g., `"Cream"`, `"Navy"`), never
  as hex codes. Hex values exist only in the design token file.
