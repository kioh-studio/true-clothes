# Feature Specification: On-Device "Extract by Item" Wardrobe Import

**Feature Branch**: `007-extract-by-item`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "đọc file @specs/extract-by-item/reference.md" — Let users add a SINGLE clothing item to their wardrobe quickly, for free, fully on the device (no server, no AI credit, private), by photographing one item on a plain background; the app cuts the item out of its background and pre-fills its attributes for review.

## Clarifications

### Session 2026-06-20

- Q: Build/runtime constraint for on-device ML (Vision/ML Kit can't run in Expo Go)? → A: Use native on-device ML via a **custom dev client built with EAS Build** (cloud — no Mac required; Android also buildable on Windows). Testing uses the dev build, not Expo Go.
- Q: What background does the cut-out use? → A: **Transparent PNG (alpha)** — composites cleanly onto any outfit card/collage.
- Q: Auto-detect garment `type` on-device in MVP? → A: **Best-effort** — pre-fill when confident, leave blank for the user when confidence is low.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add one item for free, on the device (Priority: P1)

A user has a single garment laid flat or hung against a plain wall/surface. In the Add to Wardrobe wizard they pick **"Extract by item"** (badged free / on-device) for that photo. The app removes the plain background to produce a clean cut-out of just that garment and presents it as one reviewable entry with its attributes pre-filled. The user confirms and the item is saved — with no network call and without consuming any AI credit.

**Why this priority**: This is the free, private alternative to the paid AI method and the core value of the feature. It lets cost-sensitive or privacy-conscious users build their wardrobe at no cost, and works without connectivity. It is independently shippable and testable.

**Independent Test**: Provide a single-item photo on a plain background, choose "Extract by item", and verify the app returns one entry with the item cleanly isolated (background removed) and saves it to the wardrobe — entirely offline, with no credit deducted.

**Acceptance Scenarios**:

1. **Given** the wizard method chooser, **When** the user selects "Extract by item" and a single-item photo on a plain background, **Then** the app produces one review entry showing the item isolated on a clean (white/transparent) background.
2. **Given** an extracted entry, **When** the user inspects it, **Then** its controlled attributes (`type`, `color`, `pattern`, …) are pre-filled with valid controlled-vocabulary values (or left blank for the user when confidence is low), never free text.
3. **Given** the device is offline (airplane mode), **When** the user runs "Extract by item", **Then** it still works end-to-end (no network dependency).
4. **Given** the user confirms, **When** the item is saved, **Then** it is added to the wardrobe through the standard path with `source` marked as on-device item, and **no** AI extraction credit is consumed.

---

### User Story 2 - On-device attribute enrichment (Priority: P2)

The app pre-fills as many attributes as on-device analysis can reasonably determine — dominant colour, a best-guess garment type, solid-vs-patterned, and any readable logo text — so the user types as little as possible; everything remains editable in the same review card used by the AI method.

**Why this priority**: A bare cut-out with no attributes would push all data entry onto the user. Best-effort enrichment makes the free path genuinely fast, approaching the AI method's convenience while staying on-device. It builds on US1.

**Independent Test**: Extract a solid-coloured item and verify its `color` is pre-filled to the nearest controlled colour and `pattern` defaults to solid; extract a clearly different garment type and verify a reasonable `type` is pre-filled (or left blank when the guess is weak), all editable.

**Acceptance Scenarios**:

1. **Given** a solid-coloured garment, **When** it is extracted, **Then** `color` is set to the nearest controlled colour and `pattern` to "solid".
2. **Given** a garment the on-device classifier recognises with reasonable confidence, **When** it is extracted, **Then** `type` is pre-filled to the nearest controlled type; **when** confidence is low, `type` is left for the user rather than guessed wildly.
3. **Given** any pre-filled attribute, **When** the user edits it in the review card, **Then** the edit is accepted and constrained to controlled-vocabulary values for controlled fields.

---

### User Story 3 - Capture logo / statement signals on-device (Priority: P3)

When the item carries visible text or a logo, on-device text recognition records its presence and any readable text, stored with the item for future styling intelligence (not used by the current engine).

**Why this priority**: Mirrors the AI method's logo capture so wardrobe data is consistent regardless of import method, without requiring re-processing later. Lowest urgency and additive.

**Independent Test**: Extract an item with visible brand text and verify the stored item records a logo signal with the readable text; extract a plain item and verify no logo is recorded.

**Acceptance Scenarios**:

1. **Given** an item with legible text/logo, **When** it is extracted, **Then** the stored item records logo presence and the recognised text.
2. **Given** logo data captured this way, **When** outfit suggestions are generated, **Then** they are unaffected by it (captured, not yet scored).

---

### Edge Cases

- **Busy / non-plain background**: When the background is not a plain colour, background removal may be imperfect. The app MUST still produce a usable entry (best-effort cut-out or the original photo) and let the user proceed, retry, or crop — never block with a hard failure.
- **No clear subject detected**: The app MUST inform the user and let them retry or proceed to manual entry rather than producing an empty entry.
- **Multiple items in one photo**: The "item" method expects one item; if several are present it MUST focus on the single dominant item (one entry per photo), and the user can switch that photo to the AI method for multi-item extraction.
- **Low-confidence attribute**: Uncertain controlled attributes MUST be left blank/default for the user instead of a wild guess; controlled fields MUST never contain free text.
- **Device without on-device ML support**: The app MUST degrade gracefully — still allow the user to add the item (e.g. original photo + manual attributes) without crashing.
- **Measurements**: Pre-filled as type-aware editable estimates, consistent with the AI method; never derived from the user's body measurements.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Add to Wardrobe wizard MUST offer an **"Extract by item"** method, presented as free and on-device, alongside "Extract by AI".
- **FR-002**: The method MUST accept one user-supplied photo of a single garment on a plain/solid background.
- **FR-003**: The system MUST remove the plain background on the device and produce a clean cut-out of the single item on a **transparent (alpha) background**, sized consistently for outfit cards (~1K), with no other items or background.
- **FR-004**: Processing MUST run entirely on the device — the photo MUST NOT be sent to any server, and the method MUST function offline.
- **FR-005**: The method MUST NOT consume an AI extraction credit; it is free regardless of tier.
- **FR-006**: The system MUST pre-fill the dominant `color` snapped to the nearest controlled colour value.
- **FR-007**: The system MUST pre-fill a best-guess `type` snapped to the nearest controlled type when confidence is reasonable, and leave it for the user when confidence is low.
- **FR-008**: The system MUST set `pattern` (solid vs patterned), defaulting to "solid", editable.
- **FR-009**: The system MUST detect any legible logo/text on the device and record it as a logo signal (presence + recognised text), stored with the item and NOT fed to the current outfit engine.
- **FR-010**: The system MUST pre-fill `material`, `fit`, `warmth_season`, and `measurements` as sensible, type-aware, editable defaults/estimates (consistent with the AI method), never derived from the user's body measurements.
- **FR-011**: All controlled attribute values MUST match the engine's controlled vocabulary exactly (snapped on the device); controlled fields MUST never contain free text.
- **FR-012**: One "item" photo MUST yield exactly one review entry, shown in the same review surface and editable with the same controls as the AI method.
- **FR-013**: On confirmation, the entry MUST be saved through the standard wardrobe path, with provenance marked as the on-device item method.
- **FR-014**: Users MUST be able to edit any pre-filled attribute and delete the entry before saving (shared review behaviour).
- **FR-015**: When background removal or attribute detection is imperfect or unavailable, the system MUST degrade gracefully (best-effort result or original photo + manual entry) without blocking or crashing.
- **FR-016**: The method MUST integrate via the wizard's existing item-method seam and MUST NOT change the AI method's behaviour.

### Key Entities *(include if feature involves data)*

- **Single-Item Photo**: The user-supplied image of one garment on a plain background. Input to one on-device extraction.
- **Item Cut-out**: The background-removed image of the single garment, on a clean background, used as the item's photo.
- **Extracted Item Entry**: The structured, editable result for the one garment — same shape as the AI method's entry (`type`, `name`, `color`, `material`, `fit`, `pattern`, `warmth_season`, `measurements`, logo signal, image), saved as a wardrobe Clothing Item.
- **Logo Signal**: Per-item statement metadata (presence + recognised text) captured on-device; stored, not scored.
- **Clothing Item (existing)**: The wardrobe entity each saved entry becomes; controlled vocabulary, named colours, metric measurements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can turn a single-item photo on a plain background into a saved, attribute-filled wardrobe item without typing colour or (when recognised) type before review.
- **SC-002**: For typical plain-background photos, the item is cleanly isolated (background removed) in at least 85% of cases.
- **SC-003**: 100% of saved entries have every controlled attribute set to a valid controlled-vocabulary value (zero free text in controlled fields).
- **SC-004**: The method makes zero network requests and consumes zero AI credits in 100% of runs (verifiable offline).
- **SC-005**: Adding one item via "Extract by item" takes the user materially less effort than fully manual entry.
- **SC-006**: The cut-out contains exactly one garment on a clean background, with no original background visible, in the large majority of plain-background photos.

## Assumptions

- **Shared wizard & review**: This method plugs into the Add to Wardrobe wizard, review card, controlled vocabulary, and save path delivered by feature 006; it implements the item-method seam 006 stubbed and changes nothing in the AI method.
- **Clean background = transparent PNG**: The cut-out is presented on a transparent (alpha) background so it composites cleanly onto any outfit card/collage (clarified 2026-06-20; not user-configurable in MVP).
- **Build/runtime**: On-device ML uses native modules (iOS Vision / Android ML Kit) shipped via a custom dev client built with EAS Build (cloud; no Mac required). The app is tested via that dev build, not Expo Go (clarified 2026-06-20).
- **One item per photo**: The method is for a single item; multi-item outfits are the AI method's job.
- **Best-effort enrichment**: On-device analysis pre-fills colour, type, pattern, and logo text where it reasonably can; material/fit/warmth/measurements are editable defaults. The user's edits are the accuracy safeguard.
- **Measurements estimated + editable**: Consistent with feature 006 (pre-filled, editable; never from body measurements).
- **Graceful degradation**: On devices/photos where on-device segmentation or classification is weak or unavailable, the user can still add the item manually from the photo.
- **Privacy/offline is the value**: No photo leaves the device and no credit is used; this is the deliberate differentiator from the AI method.
