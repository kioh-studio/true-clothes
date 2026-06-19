# Quickstart: MIEN — Product Features Phase

**Branch**: `002-product-features` | **Date**: 2026-06-08

Validation scenarios proving each feature stream works end-to-end.

---

## Prerequisites

- Supabase project with all 8 phase-2 migrations applied (`supabase db push`)
- Expo Dev Client build installed on test device (required for camera pose estimation)
- `EXPO_PUBLIC_REVENUECAT_API_KEY` configured in `.env`
- Demo account (`+84977...`) available

---

## Scenario 1 — Personal Color Detection

**Note**: Vein-color question dropped. Two detection paths: camera scan (wrist + hair) or manual questions only.

### Path A — Camera scan

1. Start fresh onboarding → reach the Color step.
2. Tap "Detect my personal color" → `personal-color.tsx` opens.
3. Tap **SCAN MY COLOURS** → grant camera permission.
4. Wrist scan step: point rear camera at inner wrist, tap Capture.
5. Hair scan step: point at hair roots, tap Capture.
6. Answer 2 questions: eye color swatch + gold/silver preference.
7. See result screen: season badge, undertone, palette strip (8–12 colors).
8. Tap SAVE → return to Color step, personal palette merged with manual picks.
9. **Verify in Supabase**: `profiles.color_season`, `skin_undertone`, `personal_palette` populated.

### Path B — Manual questions only

1. Tap **ANSWER QUESTIONS** on the intro.
2. Answer 4 questions: skin tone, hair shade, eye color, metal preference.
3. See result screen → SAVE.
4. **Verify**: same Supabase columns set.

### Feed verification

- Open the outfit feed → outfits whose item colors overlap the `personal_palette` should rank higher (×1.3 boost).

---

## Scenario 2 — Extended Measurements + Body Shape

1. Reach the Measurements step (or navigate to `measurements-edit.tsx` from profile).
2. Enter height and weight. Tap each optional field → tooltip opens with explanation animation.
3. Enter all 15 fields. Tap "Compute body shape" → shape badge appears (e.g., Hourglass).
4. Manually override body shape via the picker.
5. Tap consent checkbox → consent recorded.
6. Save.
7. **Verify in Supabase**: `body_measurements` row has all 15 non-null values.
   `body_shape` matches expected classification. `measurements_consent = true`.

---

## Scenario 3 — Profile Edit + Avatar

1. Go to Profile tab → tap edit icon.
2. Change display name to "Test User".
3. Tap avatar → pick photo from library. Photo uploads.
4. Save.
5. Kill and reopen app.
6. **Verify**: Profile tab shows "Test User" and the uploaded avatar.
   **Verify in Supabase**: `profiles.display_name = 'Test User'`, `avatar_path` non-null.

---

## Scenario 4 — Server-Side Outfit Persistence

1. On the outfit feed, long-press an outfit → save it.
2. Kill the app. Reopen.
3. Go to Saved Outfits in the menu.
4. **Verify**: Saved outfit still visible.
5. Log in from a second device with the same account.
6. **Verify**: Saved outfit visible on second device.
7. **Verify in Supabase**: `outfit_interactions` table has row with `type = 'saved'`.

---

## Scenario 5 — Feed Pagination + Worn Cooldown

1. Scroll through 10 outfit cards to the end.
2. **Verify**: Automatic fetch of 10 more cards (~1.5 s).
3. **Verify**: No outfit appears twice across the two batches.
4. Mark outfit A as "worn today".
5. Kill app. Reopen. Request new batch.
6. **Verify**: Outfit A does not appear in the new batch.
7. Wait 7+ days (or manually update `worn_at` in Supabase to 8 days ago).
8. Fetch new batch.
9. **Verify**: Outfit A is eligible to appear again.

---

## Scenario 6 — Formula + Style Catalog

**Note**: Formula selector UI in the feed (T047) and formula-edit screen formula picker (T045) are pending design review. The backend and store are fully wired; the in-feed picker will be added after design approval.

1. Open a Supabase admin session. Add a new style row: `{ slug: 'quiet_luxury', name: 'Quiet Luxury', is_active: true }`.
2. Kill the app. Reopen.
3. Go to Style Preferences.
4. **Verify**: "Quiet Luxury" appears in the style list without an app release (24h cache — may need cache clear).
5. Menu → Outfit formulas → select a formula (saves `active_formula_id` to `style_profiles`).
6. **Verify**: `style_profiles.active_formula_id` matches the `formulas` table UUID.
7. Pull-to-refresh on the feed.
8. **Verify**: Edge Function request body includes `formula_id` matching selected formula.

---

## Scenario 7 — Item Detail + Extended Attributes

**Note**: Full-screen item detail page (`app/item/[id].tsx`, T053–T054) is pending design review. Extended attributes are fully stored and the add-item form is complete.

1. Add an item via the wardrobe screen. Fill: name, primary color, material, pattern, warmth_season.
2. **Verify in Supabase**: `clothing_items` row has all new columns (`name`, `primary_color`, `material`, `pattern`, `warmth_season`) populated.
3. Add a `Dress` category item.
4. **Verify**: Dress appears in **DRESSES** filter tab in the wardrobe grid.
5. Add a `Cap` or `Hat` category item.
6. **Verify**: Item appears in **HEADWEAR** filter tab.

---

## Scenario 8 — AI Item Extraction (free tier)

**Note**: Extraction review UI screens (T068–T071) are pending design review. The hook (`useItemExtraction`), Edge Function (`extract-garments`), and credit service are fully implemented. Once the UI screens are designed and built, this full scenario will be testable end-to-end.

**Backend-only verification** (works now):
1. Call the `extract-garments` Edge Function directly with a base64 photo and Bearer JWT.
2. **Verify**: Returns `{ items, confidence }` with detected garments.
3. **Verify in Supabase**: `usage_credits` row created for current month.
4. Call twice more.
5. **Verify**: Third call blocked with 402 status (credit exhausted for free tier).

**Full UI scenario** (after T068–T071 are implemented):
1. Tap "Upload outfit photo" in the wardrobe add flow.
2. Pick a photo of a person wearing 3 visible items.
3. Add optional notes: "Extract the jacket separately from the shirt."
4. **Verify**: Loading state shows, result appears within 10 s.
5. Review screen shows 3 extracted items with auto-filled attributes.
6. Correct one attribute. Confirm.
7. **Verify**: 3 items appear in wardrobe.
8. **Verify in Supabase**: `usage_credits.used = 1` for current month.
9. Repeat once more. Credit = 2.
10. Attempt a third extraction → **Verify**: Upgrade prompt shown, extraction blocked.

---

## Scenario 9 — i18n

1. Go to Settings → Language → switch to Vietnamese.
2. **Verify**: All visible strings on the current screen switch to Vietnamese.
3. Navigate to other screens (wardrobe, feed, profile).
4. **Verify**: All strings translated (no English fallback visible for keys that have VI translations).
5. Switch back to English.
6. **Verify**: All strings revert.

---

## Scenario 10 — Offline Mode

1. Enable airplane mode.
2. Browse the wardrobe grid.
3. **Verify**: Items visible (cached).
4. Browse the outfit feed.
5. **Verify**: Last-loaded outfits visible (cached).
6. Attempt to add a new item.
7. **Verify**: Offline banner shows. Item NOT added to local state prematurely.
8. Re-enable network.
9. **Verify**: Add-item flow resumes normally.
