# Quickstart & Validation Guide: Wardrobe Add-Item Screens

**Feature**: `005-wardrobe-add-item-screens` | **Date**: 2026-06-17

---

## Prerequisites

- Expo development build running on a simulator or physical device (iOS or Android).
- Supabase project with migration `20260617000001_clothing_items_measurements.sql` applied.
- `analyse-outfit-photos` Edge Function deployed (MVP stub version).
- A user account that has completed onboarding (auth + styles + colours steps done).
- A second test account that has NOT yet completed onboarding (for Story 3 validation).

---

## Scenario 1 — Single-item flow (User Story 1)

**Goal**: Confirm the "Extract by item" path works end-to-end.

1. Open the app. Navigate to the Wardrobe tab.
2. Tap the "+" icon in the nav bar or the floating "+" button.
3. Verify: A bottom sheet appears with two options — "Extract by item" and "Extract by AI".
4. Tap **Extract by item**.
5. Verify: A photo guidance screen appears with do/don't tips and source picker buttons
   (Camera / Library).
6. Tap **Library** and select any photo.
7. Verify: A processing screen appears with an animated indicator.
8. Wait ~2 seconds.
9. Verify: A review screen appears with the photo, editable name, AI-detected attributes
   (type, colour, material, pattern), occasion/season chip groups, and optional detail rows.
10. Tap the **TYPE** attribute row.
11. Verify: An inline chip picker expands; select a different type.
12. Tap **ADD TO WARDROBE**.
13. Verify: The sheet closes; the new item appears in the wardrobe grid without a full reload.

**Edge case — camera denied**: On a simulator, deny camera permissions when prompted.
Verify the guide step shows a "Camera unavailable" message and Library remains selectable.

**Edge case — discard**: Open the sheet, tap "Extract by item", reach the review step,
tap "Discard". Verify no item is added and the sheet closes.

---

## Scenario 2 — AI wizard flow (User Story 2)

**Goal**: Confirm the "Extract by AI" multi-photo wizard works end-to-end.

1. Open the Wardrobe tab. Tap "+" to open the method sheet.
2. Tap **Extract by AI**.
3. Verify: A full-screen wizard opens with a 4-step indicator (Upload → Analyse → Review →
   Done) and the two-phase photo chooser overlay appears automatically.
4. In the overlay, select "AI" method, then pick 2–3 photos from the library.
5. Verify: Photos appear with "AI" method badges, per-photo note fields, and remove buttons.
   A count line shows the total.
6. Add a note to one photo's note field.
7. Tap **ANALYSE N PHOTOS** (where N = number of photos selected).
8. Verify: The Analyse step shows a scanning animation with per-photo progress thumbnails
   (`processing → complete`).
9. Wait for all thumbnails to show `complete`.
10. Verify: The Review step opens with extracted items grouped under their source photo.
    Each item shows a name, category, colour, material/fabric, brand, link, measurements,
    and tag chips.
11. Tap a field value (e.g. colour) on one item.
12. Verify: A chip picker or text input appears appropriate to the field type.
13. Tap **REMOVE** on one item card.
14. Verify: The item disappears from the list; the confirm button count decreases.
15. Tap **CONFIRM ALL · N**.
16. Verify: The Done step shows the count of items saved and the number of source photos.
17. Tap **VIEW MY WARDROBE**.
18. Verify: The wardrobe grid shows the confirmed items.

**Edge case — free-tier gate**: Log in as a free-tier user. Open the AI wizard. Add photos.
Tap **ANALYSE N PHOTOS**. Verify: An upgrade prompt appears instead of analysis starting.
The wizard does not advance to the Analyse step.

**Edge case — partial failure (simulate network loss)**:
Disable the device network after photos are added. Tap **ANALYSE N PHOTOS**.
Verify: One or more photos show `failed` status. A **RETRY FAILED** button appears.
Re-enable the network. Tap **RETRY FAILED**.
Verify: Only the previously failed photos are resubmitted; already-complete photos retain
their results.

**Edge case — remove all items**: In the Review step, remove every extracted item.
Verify: The confirm button is disabled and a "Nothing to save" empty state appears.

---

## Scenario 3 — Wardrobe Intro at onboarding completion (User Story 3)

**Goal**: Confirm the Wardrobe Intro screen fires exactly once at the end of onboarding.

1. Use the second test account (onboarding not yet completed).
2. Complete onboarding through to the colour palette step.
3. Tap **CONTINUE** on the colour palette screen.
4. Verify: The Wardrobe Intro screen appears (empty-closet illustration, 3-step overview,
   "ADD FIRST ITEM" and "Skip for now" CTAs). The home feed does NOT appear yet.
5. Tap **ADD FIRST ITEM**.
6. Verify: The method sheet appears overlaid on the Wardrobe Intro screen.
7. Complete adding one item via the "Extract by item" path.
8. Verify: After saving, the app routes to the home feed (not back to Wardrobe Intro).
9. Kill and reopen the app.
10. Verify: The Wardrobe Intro screen does NOT appear again. The app opens to the home feed.

**Skip path**: Repeat steps 1–4 with a fresh account. Tap **Skip for now**.
Verify: The app routes to the home feed immediately.

---

## Scenario 4 — Post-onboarding wardrobe add (User Story 4)

**Goal**: Confirm returning users can add items from the wardrobe tab.

1. Log in as the fully-onboarded user from Scenario 1.
2. Navigate to the Wardrobe tab.
3. Tap the floating "+" button.
4. Verify: The method sheet appears (same as Scenario 1 step 3).
5. Complete adding an item via either method.
6. Verify: The new item appears in the wardrobe grid.

---

## Database Validation

After Scenario 1 or 2, open Supabase Studio and inspect the `clothing_items` table:

- Verify: The new item's row has the correct `material` value.
- Verify: If measurements were entered, the `measurements` JSONB column contains the
  expected key-value pairs (e.g. `{"chest":"54 cm"}`).
- Verify: `measurements` is `null` for items where none were entered.
- Verify: `link` column exists and is `null` or a URL string.

---

## Regression Checks

After implementation, verify these existing flows are unaffected:

- Outfit feed renders correctly on the home tab.
- Existing wardrobe items still appear in the grid.
- Collection detail screen's "Go to wardrobe" link navigates to the wardrobe tab
  (not the deleted `/add-item` route).
- Onboarding `/(onboarding)/complete` screen is no longer reachable from the colour
  palette step (colours → wardrobe-intro is the new path).
- Item detail screen (`/item/[id]`) still loads correctly for existing items.
