# Feature Specification: Wardrobe Add-Item Screens

**Feature Branch**: `005-wardrobe-add-item-screens`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "I just add new screen in True Clothes New Screens.zip, this is new screens when add item to wardrobe. Even in onboarding or after onboarding. Read the new screens, explore existing code and plan to migrate them"

## Clarifications

### Session 2026-06-17

- Q: How should type-aware item measurements (chest/waist/shoe size/bag dimensions) be stored? → A: Add a `measurements` JSONB column to `clothing_items`. Flexible for type-specific key-value pairs (e.g. `{"chest":"54 cm","shoulder":"46 cm"}`), queryable via PostgreSQL JSONB operators in the Edge Function (`(measurements->>'chest')::numeric >= 92`), and extensible without schema changes per new field. Dedicated typed columns are impractical due to high sparsity across item types.
- Q: When should the Wardrobe Intro screen be shown? → A: Exactly once, immediately after onboarding completion. It is not shown again on subsequent app sessions, even if the wardrobe remains empty. The existing `onboardingComplete` flag is sufficient to gate this — no additional state is required.
- Q: What does a free-tier user see when they tap "Extract by AI"? → A: The wizard opens normally. The premium gate fires when the user taps "ANALYSE N PHOTOS" — at that point an upgrade prompt is shown instead of triggering analysis. This lets free-tier users experience the upload flow and understand the value before being asked to upgrade.
- Q: What happens when AI analysis fails mid-batch (network loss or server error)? → A: Successfully-analyzed photos must be preserved — their results are not discarded. Only the failed photos are retried when the user taps "RETRY FAILED". Re-sending already-processed images would double AI API cost, so the Edge Function must track per-photo completion status and the client must never re-submit a photo whose result has already been received.
- Q: What is the disposition of the existing `add-item.tsx` screen? → A: Delete it. All "add item" entry points (wardrobe screen, Wardrobe Intro) route through the new method-selection bottom sheet. Any existing navigation references to the `/add-item` route must be updated or removed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single-Item Capture (Extract by Item) (Priority: P1)

After onboarding or from the wardrobe, the user taps the Add button and sees a method-selection sheet. They choose "Extract by item" (free, on-device), receive a photo guidance screen with do/don't tips, take or pick a photo of a single clothing item on a plain background, watch on-device background removal, then review and correct AI-detected attributes (type, colour, material, pattern, occasion, season) before saving.

**Why this priority**: This is the foundational wardrobe-building flow available to all users at no cost. Without it, no items can be added and the rest of the app has no data to work with.

**Independent Test**: Can be tested end-to-end by tapping "Add" in the wardrobe, selecting "Extract by item", photographing a garment, and confirming the resulting item appears in the wardrobe grid.

**Acceptance Scenarios**:

1. **Given** the wardrobe screen is open, **When** the user taps the "+" button or the floating Add button, **Then** a bottom sheet appears with "Extract by item" and "Extract by AI" options.
2. **Given** the method sheet is open, **When** the user taps "Extract by item", **Then** the guide screen appears with photo tips (do's and don'ts) and source picker buttons (camera / library).
3. **Given** the guide screen is shown, **When** the user captures or selects a photo, **Then** the processing screen appears with an animated progress indicator and on-device analysis status text.
4. **Given** processing is complete, **When** the review screen appears, **Then** it shows the photo, an editable item name field, AI-detected attributes (type, colour, material, pattern) each tappable for inline editing, occasion/season chip groups, and optional detail fields (brand, size, price, purchase date, where, care, notes).
5. **Given** the review screen, **When** the user taps "ADD TO WARDROBE", **Then** the item is saved and the user returns to the wardrobe with the new item visible in the grid.
6. **Given** the review screen, **When** the user taps "Discard", **Then** no item is saved and the sheet closes.

---

### User Story 2 - AI Outfit Import Wizard (Extract by AI) (Priority: P2)

The user chooses "Extract by AI" from the method sheet. A full-screen wizard opens with four sequential steps — Upload, Analyse, Review, Done. The user adds one or more outfit photos, labels each as AI-extracted or single-item, optionally adds notes per photo, then triggers analysis. The app scans each photo and presents all extracted items grouped by source photo. The user can edit every field (name, category, colour, fabric, brand, link, measurements, tags) or remove items they don't own before confirming. A done screen confirms how many pieces were saved.

**Why this priority**: AI-extracted multi-item import dramatically lowers the friction of wardrobe population for users with existing outfit photos. It supports bulk import in a single session.

**Independent Test**: Can be tested by selecting "Extract by AI" from the method sheet, adding multiple photos, running analysis, editing at least one field, removing one item, and confirming — then verifying the saved count matches items confirmed.

**Acceptance Scenarios**:

1. **Given** the method sheet, **When** the user taps "Extract by AI", **Then** the full-screen AI wizard opens with a 4-step progress indicator (Upload → Analyse → Review → Done).
2. **Given** the Upload step is open and no photos are added, **When** the screen first opens, **Then** the two-phase chooser overlay appears automatically, prompting the user to pick a method (AI or item) for their first photo.
3. **Given** the Upload step, **When** the user adds photos, **Then** each photo shows its method badge (AI or Item), a per-photo text field for notes, and a Remove button; a count summary line appears above.
4. **Given** at least one photo is added, **When** the user taps "ANALYSE N PHOTOS", **Then** the Analyse step shows a scanning animation across each photo sequentially with progress thumbnails.
5. **Given** analysis is complete, **When** the Review step opens, **Then** extracted items are grouped under their source photo, each item shows its cutout image, an editable name, and tappable fields for category, colour, fabric, brand, and link; measurements and tags are also editable.
6. **Given** the Review step, **When** the user taps a field value, **Then** an inline chip picker appears for structured fields (category, colour, fabric) or a text input for free-form fields (brand, link).
7. **Given** the Review step, **When** the user taps "REMOVE" on an item card, **Then** the item is removed from the review list and the confirm button count updates.
8. **Given** the Review step, **When** the user taps "CONFIRM ALL · N", **Then** the Done step shows the count of pieces saved and the count of source photos.
9. **Given** the Done step, **When** the user taps "VIEW MY WARDROBE", **Then** they are taken to the wardrobe screen with all confirmed items visible.

---

### User Story 3 - Wardrobe Intro at Onboarding Completion (Priority: P3)

After completing onboarding (styles and colours selected), the user lands on a Wardrobe Intro screen instead of jumping directly to the home feed. The screen shows an empty-closet illustration, a three-step overview (snap → extract → outfits), and two CTAs: "ADD FIRST ITEM" (opens the add-item flow) and "Skip for now" (goes to the home feed).

**Why this priority**: The wardrobe intro screen contextualises why the user should add items before seeing outfit suggestions, increasing first-session wardrobe population rate.

**Independent Test**: Can be tested by completing the full onboarding sequence and confirming the wardrobe intro screen appears as the final step before the home feed.

**Acceptance Scenarios**:

1. **Given** the user completes the onboarding colour-palette step, **When** they tap "CONTINUE", **Then** the Wardrobe Intro screen appears with an empty-closet illustration and the three-step overview.
2. **Given** the Wardrobe Intro screen, **When** the user taps "ADD FIRST ITEM", **Then** the add-item method sheet opens (same flow as Story 1).
3. **Given** the Wardrobe Intro screen, **When** the user taps "Skip for now", **Then** they land on the home feed (outfit feed tab).
4. **Given** the user adds their first item from the Wardrobe Intro screen and saves it, **Then** they are returned to the home feed (not back to the intro screen).

---

### User Story 4 - Re-opening Add-Item from Within Wardrobe (Priority: P4)

After onboarding, the user navigates to the Wardrobe tab and can add more items using the same method sheet triggered by the floating "+" button or the nav-bar "+" icon.

**Why this priority**: Returning users must be able to expand their wardrobe at any time with the same cohesive flow.

**Independent Test**: Can be tested by navigating to the wardrobe tab after onboarding and tapping the add button to verify the method sheet appears.

**Acceptance Scenarios**:

1. **Given** the main wardrobe screen, **When** the user taps the floating "+" button or the top-right "+" icon, **Then** the method selection bottom sheet opens.
2. **Given** the method sheet opened from within the wardrobe, **When** the user completes adding an item, **Then** the new item appears immediately in the wardrobe grid without a full reload.

---

### Edge Cases

- What happens when the user denies camera permission? The capture step must fall back to the library picker and show an inline message explaining why camera is unavailable.
- What happens when the user cancels mid-way through any step? The sheet closes, no item is saved, and all in-progress state is reset.
- What happens when the user removes all items during the AI wizard Review step? The confirm button becomes disabled and a "Nothing to save" empty state appears.
- What happens when photo analysis fails mid-batch (network or AI error)? Successfully-analyzed photos are preserved. The Analyse step shows which photos completed and which failed, with a "RETRY FAILED" button that re-submits only the failed photos. Already-processed photos are never re-sent (cost constraint). The wizard only advances to Review once all photos are either complete or explicitly skipped by the user.
- What happens when the user selects no photos in the library picker and taps confirm? The confirm button remains disabled until at least one photo is selected.
- What happens when the wardrobe is empty and the user lands on the wardrobe screen (post-onboarding skip)? The empty wardrobe state is shown with a prominent "ADD FIRST ITEM" call to action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST present a method selection bottom sheet when the user initiates "add item" from either the wardrobe screen or the Wardrobe Intro onboarding screen.
- **FR-002**: The method sheet MUST offer two options: "Extract by item" (free, on-device) and "Extract by AI" (AI-powered, multi-item).
- **FR-003**: The "Extract by item" path MUST show a photo guidance screen with visual do/don't tips before requesting a photo.
- **FR-004**: The photo guidance screen MUST offer both "take a photo" (camera) and "choose from library" source options.
- **FR-005**: After a photo is selected or captured via "Extract by item", the app MUST display a processing screen with an animated progress indicator while performing on-device background removal and attribute detection.
- **FR-006**: The review screen MUST display the captured photo, an editable item name, and AI-detected attributes (type, colour, material, pattern) as tappable rows that expand inline chip pickers.
- **FR-007**: The review screen MUST include multi-select chip groups for Occasion and Season.
- **FR-008**: The review screen MUST include optional detail fields: brand, size, purchase price, purchase date, where purchased, care instructions, and notes.
- **FR-009**: The "Extract by AI" path MUST open a full-screen wizard with a four-step progress indicator: Upload, Analyse, Review, Done. Free-tier users may enter the wizard and add photos; the premium gate is checked only when they tap "ANALYSE N PHOTOS", at which point an upgrade prompt is shown instead of running analysis.
- **FR-010**: The AI wizard Upload step MUST allow the user to add multiple photos, each assigned to either "Extract by AI" or "Extract by item" method, with a per-photo optional notes field.
- **FR-011**: The AI wizard MUST support selecting photos from the device library using a multi-select grid picker.
- **FR-012**: The AI wizard Analyse step MUST display a scanning animation per photo and a progress thumbnail strip showing each photo's status: pending, processing, complete, or failed. On failure, only the failed photos are shown with a "RETRY FAILED" action; successfully-analysed photos retain their results and are never re-submitted to the AI service.
- **FR-013**: The AI wizard Review step MUST group extracted item cards under their source photo, with each card showing: cutout image, editable name, tappable fields for category/colour/fabric/brand/link, type-aware measurement fields, and an editable tag list.
- **FR-014**: Users MUST be able to remove individual extracted items from the AI wizard Review step before saving.
- **FR-015**: The AI wizard Done step MUST display the count of pieces saved and offer navigation to the wardrobe.
- **FR-016**: The Wardrobe Intro screen MUST be shown exactly once — immediately after the user completes the colour palette onboarding step — and MUST NOT be shown again on subsequent sessions, even if the wardrobe remains empty.
- **FR-017**: The Wardrobe Intro screen MUST offer "ADD FIRST ITEM" (opens add-item flow) and "Skip for now" (goes to home feed) actions.
- **FR-018**: After completing an add-item flow from the Wardrobe Intro screen, the user MUST be routed to the home feed, not back to the intro screen.
- **FR-019**: The add-item flow launched from the wardrobe screen MUST close the sheet and return to the wardrobe grid with the new item visible upon save.
- **FR-020**: All new screens MUST comply with the luxury minimalist design system (design token colours, Cormorant Garamond / Inter fonts, hairline icons, no filled icons, no gradients).

### Key Entities

- **AddItemMethod**: Enumerated choice the user makes when starting the add-item flow: `item` (on-device single-item extraction) or `ai` (multi-photo AI wizard).
- **PhotoEntry**: A single selected photo in the AI wizard, carrying its source photo reference, the chosen method, and an optional user-supplied note.
- **ExtractedItem**: An item identified from a photo by the AI, carrying: name, category, colour, fabric, brand, link, measurements (type-aware), and tags. Editable by the user in the Review step before being saved to the wardrobe.
- **ClothingItem** (existing): The persisted wardrobe entity. The add-item flow writes to this entity. Two new columns are required: `measurements` (JSONB — type-aware key-value pairs such as `{"chest":"54 cm","shoulder":"46 cm"}` for tops, `{"waist":"82 cm","inseam":"78 cm"}` for bottoms, `{"size":"EU 42"}` for shoes) and `link` (text — optional product URL). The existing `material` column covers the design's "fabric" field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a single item via "Extract by item" in under 90 seconds from tapping "+" to seeing the item in their wardrobe grid.
- **SC-002**: A user can import a full outfit (3–5 items) via "Extract by AI" in under 3 minutes from tapping "+" to tapping "VIEW MY WARDROBE" on the Done screen.
- **SC-003**: The Wardrobe Intro screen is presented to 100% of users who complete the onboarding colour-palette step.
- **SC-004**: The review form requires zero mandatory fields beyond the photo itself — every item can be saved with only a photo and default AI-detected values.
- **SC-005**: Cancelling or dismissing the add-item flow at any step leaves the wardrobe unchanged.
- **SC-006**: All new screens render without layout overflow or truncation on both 390 px (iPhone 15) and 430 px (iPhone 15 Pro Max) viewport widths.

## Assumptions

- On-device attribute detection (background removal, type/colour/material classification) will be simulated in the MVP using deterministic defaults, with real ML integration deferred to a future release.
- The AI multi-item extraction (AI wizard) will be simulated server-side in MVP by returning pre-structured item data; real vision API integration is a v2 concern.
- The `ClothingItem` schema requires two new columns: `measurements` (JSONB) and `link` (text). A Supabase migration will be produced during planning. The existing `material` column already covers what the designs label as "fabric".
- The "Extract by AI" method is the premium-tier entry point per the design; free-tier gate enforcement (showing an upgrade prompt vs. allowing access) is out of scope for this feature and will be handled by the existing `usePremium` hook.
- The `expo-image-picker` library already used in `add-item.tsx` is reused for camera and library access in all new flows.
- The add-item flow is always presented as a bottom sheet when triggered from the wardrobe screen, and as a full-screen or overlaid sheet when triggered from the Wardrobe Intro onboarding screen.
- The existing `app/add-item.tsx` screen is deleted as part of this feature. It is replaced entirely by the new method-selection sheet and associated step flows. All navigation references to the `/add-item` route must be audited and updated during implementation.
- The Wardrobe Intro screen replaces the existing `CompleteScreen` final-onboarding CTA ("Add items to wardrobe first") and is a separate, full-screen onboarding step.
