# Quickstart: Validation Guide — True Clothes App Baseline

**Branch**: `001-app-baseline` | **Date**: 2026-06-06

This guide documents runnable end-to-end validation scenarios that prove each
implemented feature works correctly. Run these scenarios after completing
implementation (`/speckit-tasks` → implementation phase).

---

## Prerequisites

1. **Environment file**: Copy `.env.example` → `.env` and fill in:
   ```
   EXPO_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```

2. **Database**: Run migrations against your Supabase project:
   ```bash
   supabase db push
   # or apply each migration file manually in Supabase SQL editor
   ```

3. **Storage bucket**: Confirm `wardrobe-photos` bucket exists in Supabase Storage
   with the RLS policies from `supabase/migrations/20260606000003_storage_policies.sql`.

4. **Start the app**:
   ```bash
   npm install
   npx expo start
   ```
   Open on iOS Simulator, Android Emulator, or Expo Go.

5. **Demo account**: Phone `+84977...`, OTP `123456` (see `src/config/demo.ts` for
   exact values). Use this for all validation scenarios unless noted otherwise.

---

## Scenario 1: Wardrobe Sync (Critical Path)

**Validates**: FR-020, FR-021, SC-006

### Steps

1. Log in with the demo account.
2. Navigate to **Wardrobe** (Menu → Your Wardrobe).
3. Tap **Add Item**.
4. Select a photo from the simulator/emulator's photo library.
5. Set category: **Top**, colour: **White**, brand: **Uniqlo**. Confirm.
6. Observe the item appears in the wardrobe grid.

### Expected outcomes

- Item appears in the wardrobe grid immediately (optimistic update).
- In Supabase dashboard → Table Editor → `clothing_items`: a new row exists for the
  demo user's ID with the correct category and colours.
- In Supabase dashboard → Storage → `wardrobe-photos`: a file exists at
  `{userId}/{itemId}.jpg`.
- Close and reopen the app. The item is still present (loaded from Supabase, not
  AsyncStorage).
- Delete the item. Confirm row and Storage file are both removed.

### Failure indicators

- Item appears locally but not in Supabase → `wardrobeService.addItem()` not wiring
  through; check that `appStore` calls the service.
- Storage file missing but DB row exists → Storage upload step failing silently; check
  `wardrobeService` error handling.

---

## Scenario 2: End-to-End Personalised Outfit Generation

**Validates**: FR-012, SC-005

### Steps

1. Complete Scenario 1 (wardrobe has at least one synced item).
2. Add 5 more items: 2 bottoms, 1 outerwear, 1 pair of shoes, 1 accessory. Sync all.
3. Navigate to **Home** (outfit feed).
4. Pull-to-refresh or restart the app to trigger a fresh feed load.

### Expected outcomes

- Feed shows outfits composed from items you added (recognisable by photo).
- Outfits respect the formula rules: most include a top + bottom + shoes combination.
- Style tags on feed cards match your selected style profile (e.g., "Minimalist").
- No fallback demo items appear (items from `src/data/index.ts` should not appear if
  your Supabase wardrobe has sufficient items).

### Failure indicators

- Feed shows the same pre-seeded demo outfits regardless of your wardrobe → Edge Function
  still querying empty table; confirm `clothing_items` rows exist in Supabase for the
  logged-in user.
- Feed is empty after adding items → Edge Function returning error; check Supabase
  Function logs.

---

## Scenario 3: Empty Wardrobe — Demo Feed State

**Validates**: FR-042 (empty wardrobe demo), FR-014 (weather integration)

### Steps

1. Log in with the demo account (fresh state — no items in Supabase `clothing_items`).
2. Navigate to the **Home** feed.
3. Observe the feed and any banners.

### Expected outcomes

**Empty wardrobe:**
- Feed displays exactly 2 curated demo outfits (not a blank screen).
- A sticky banner at the bottom of each active feed card reads:
  "Add your wardrobe to personalise your feed" with an "ADD ITEMS →" CTA.
- Tapping the banner navigates to the Wardrobe screen.
- After adding at least 1 item (Scenario 1), the demo outfits are replaced by the
  personalised feed. The demo banner disappears. No manual refresh required.

**Weather filter:**
- If location was set during onboarding, the temperature indicator in the top-right
  shows the live temperature (from Open-Meteo — no API key required).
- The weather filter bar pre-selects the band matching the live temperature
  (e.g., `WARM 22–27°` for 25°C).
- After 30 minutes without a refresh, the next boot fetches fresh weather (TTL cache).
- If location is unavailable, temperature shows `–` and filter defaults to `ALL`.

### Failure indicators

- Empty feed instead of 2 demo outfits → `isDemo` flag not set when `wardrobeItems.length === 0`.
- Demo banner persists after adding items → `wardrobeItems` not updating in store.
- Temperature always shows `–` → `refreshWeather()` skipping silently (no coords available).

---

## Scenario 4: Share Outfit

**Validates**: FR-031

### Steps

1. Navigate to the outfit feed and tap any outfit to open **Outfit Detail**.
2. Tap the **Share** icon.

### Expected outcomes

- Native OS share sheet appears.
- Share payload contains a text description of the outfit (style tag + item list).
- User can share to any available target (Messages, Notes, etc.).
- Cancelling the share sheet returns to the Outfit Detail screen without error.

### Failure indicators

- Nothing happens on tap → Share button handler not wired; check `useOutfitDetail` hook.
- Share sheet appears but payload is empty → check share text construction in hook.

---

## Scenario 5: Settings Screen

**Validates**: FR-035

### Steps

1. Navigate to **Menu** tab.
2. Tap **Settings**.

### Expected outcomes

- Settings screen opens with:
  - **Preferences**: Unit preference toggle (Metric / Imperial)
  - **Account**: Sign Out button
  - **Danger Zone**: Delete Account button (red text, hairline border)
  - **App**: Version string (e.g., `1.0.0`)
- Toggling unit preference persists after navigating away and returning.
- Tapping **Delete Account** → `Alert.alert` confirmation with "Cancel" and "Delete" buttons.
  - Cancel → dismisses, returns to Settings.
  - Delete → loading indicator while `delete-user` Edge Function runs →
    all Supabase data purged → signed out → redirected to onboarding.

### Failure indicators

- Menu item taps but nothing happens → Navigation route not registered; check
  `app/settings.tsx` exists and route is added to `app/(tabs)/menu.tsx`.
- Delete Account shows no loading state → `deleteLoading` state not wired to `ActivityIndicator`.
- Delete succeeds but user not signed out → `authStore.logout()` not called after deletion.

---

## Scenario 6: Help & Feedback Screen

**Validates**: FR-036

### Steps

1. Navigate to **Menu** tab.
2. Tap **Help & Feedback**.

### Expected outcomes

- Help screen opens with at least 5 FAQ accordion items.
- Tapping "Send Feedback" opens the device's mail app pre-addressed to the support email.

### Failure indicators

- Screen opens but FAQ list is empty → static FAQ data not populated in screen.
- "Send Feedback" does nothing → `mailto:` link not constructed correctly; verify with
  `Linking.openURL('mailto:...')`.

---

## Scenario 7: Local Item Migration (Existing Users)

**Validates**: Data migration for users with pre-sync wardrobe items.

*Note: This scenario requires simulating a user who had items before the sync update.*

### Steps

1. Clear the app data (simulate a pre-sync user state):
   ```bash
   # In Expo Go: uninstall and reinstall
   # In simulator: Device → Erase All Content and Settings, then re-login
   ```
2. Add 3 wardrobe items using the old flow (before wardrobeService is wired — simulate
   by temporarily bypassing the service and writing directly to AsyncStorage).
3. Apply the wardrobe sync update.
4. Reopen the app and log in.

### Expected outcomes

- A migration progress indicator appears briefly during first boot.
- After migration, all 3 items appear in the Wardrobe grid.
- All 3 items exist in Supabase `clothing_items` table.
- Reopening the app a second time does NOT trigger migration again (flag persisted).

---

## Scenario 8: Offline Behaviour

**Validates**: Offline-capability constraint

### Steps

1. Add items and curate some outfits (save, schedule, mark worn).
2. Enable airplane mode on the device.
3. Reopen the app.

### Expected outcomes

- Profile, Wardrobe (locally cached), Saved Outfits, Schedule, and History all load.
- Outfit feed shows a loading state or the last cached outfits (no crash).
- Attempting to add a wardrobe item while offline shows the error message:
  **"Adding items requires an internet connection"** (banner at top of Add Item screen).
  The item is NOT added to `wardrobeItems` state — no false optimism, no partial local state.
  The error clears when the user attempts another action.
- Toggling saved/worn/scheduled state while offline stores changes locally; they sync
  on next connection. *(Note: sync-on-reconnect is NOT implemented in MVP — this
  scenario may show unsynced state until next manual refresh.)*

---

## Validation Checklist

After running all scenarios:

- [ ] S1: Wardrobe items sync to Supabase (DB + Storage)
- [ ] S2: Feed shows user's own wardrobe items (not demo fallback)
- [ ] S3: Weather temperature appears on feed cards and updates on schedule
- [ ] S4: Native share sheet fires with outfit content
- [ ] S5: Settings screen accessible and unit toggle persists
- [ ] S6: Help screen accessible with FAQ + working feedback link
- [ ] S7: Pre-sync items migrate to Supabase on first boot
- [ ] S8: App remains usable offline; no crashes in airplane mode
