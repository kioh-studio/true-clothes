# Feature Specification: Try On — Pre-Purchase Fit Check & Mix-and-Match

**Feature Branch**: `008-try-on`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "đọc @specs/try-on/reference.md" — Help users shop smarter by scanning an item they intend to buy and checking whether it actually suits them (color, fit, measurement, style, fabric) on a 0–100 scale, then mixing and matching it against their existing wardrobe to see what outfits it could create — all before deciding to add it to their wardrobe.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan a prospective purchase and get a suitability verdict (Priority: P1)

A user is shopping (in a store or browsing online) and is unsure whether a particular garment is right for them. They open the Try On flow, capture the item with the camera or pick a photo from their library, and the app returns a clean, background-removed image of the item along with its detected attributes (type, color, fit, material, style, etc.). The app then produces a **Verdict** — an overall suitability score out of 100 with a per-criterion breakdown across Color, Style, Fit, Measurement, and Fabric — explaining how well the item matches the user's personal profile.

**Why this priority**: This is the core value of the feature — answering "should I buy this?" before money is spent. It is independently shippable: a user gets real decision-making value from the verdict alone, even without the mix-and-match step.

**Independent Test**: Provide a photo of a single garment, trigger the scan, and verify the app displays an isolated (background-removed) item image, its extracted attributes (with any unobtainable attribute shown as empty/unknown rather than guessed), and a Verdict containing an overall 0–100 score plus a score for each of the five criteria.

**Acceptance Scenarios**:

1. **Given** a user on the Try On scan screen, **When** they capture or select a photo of a single garment, **Then** the app shows a progress state and afterwards displays a result screen with the item's background-removed image and its extracted attributes.
2. **Given** the item has been extracted, **When** the user views the result, **Then** any attribute the system could not determine is shown as empty/unknown and is never fabricated.
3. **Given** the extracted attributes are available, **When** the Verdict is generated, **Then** the result screen shows an overall suitability score from 0 to 100 and an individual score for each criterion: Color, Style, Fit, Measurement, and Fabric.
4. **Given** the Verdict is displayed, **When** the user reads each criterion, **Then** each criterion communicates why it scored as it did in plain language (e.g., "this olive tone complements your earth-tone palette").
5. **Given** the scanned item, **When** the result screen is shown, **Then** the item is NOT yet saved to the wardrobe.

---

### User Story 2 - Mix and match the prospective item with the existing wardrobe (Priority: P2)

From the result screen, the user taps **Mix & Match** to see how the prospective item would combine with clothes they already own. The app navigates to a styling screen that generates outfit combinations, where **every generated outfit includes the scanned item** paired with compatible wardrobe pieces. This lets the user judge real-world versatility ("will I actually wear this with what I own?") before buying.

**Why this priority**: Versatility against an existing wardrobe is a major purchase driver, but it only makes sense after the item has been scanned and understood (US1). It builds directly on US1 and meaningfully increases purchase confidence.

**Independent Test**: After scanning an item, tap Mix & Match and verify the app produces one or more outfit combinations in which the scanned item appears in every single suggested outfit, paired with items drawn from the user's wardrobe.

**Acceptance Scenarios**:

1. **Given** a result screen for a scanned item, **When** the user taps Mix & Match, **Then** the app navigates to a styling screen that pairs the scanned item with wardrobe items.
2. **Given** the user is on the Mix & Match screen, **When** outfit combinations are generated, **Then** every generated outfit contains the scanned item.
3. **Given** the user's wardrobe contains compatible pieces, **When** outfits are generated, **Then** the suggested outfits use only items the user already owns alongside the scanned item.
4. **Given** the user has finished exploring combinations, **When** they leave the Mix & Match screen, **Then** they return to the result screen and the scanned item is still NOT saved to the wardrobe.

---

### User Story 3 - Decide whether to keep the item (Priority: P3)

After reviewing the verdict and the mix-and-match results, the user decides. If they are satisfied, they tap **Add** and the item is saved into their wardrobe as a clothing item (carrying over its extracted attributes and isolated image). If they are not satisfied, they tap **No**, the item is discarded, and they return to the scan screen to try another item.

**Why this priority**: This closes the loop and connects Try On to the existing wardrobe, but the decision/commit step has no value without US1 (and is enriched by US2). It is the smallest slice and naturally last.

**Independent Test**: From a result screen, tap Add and verify the item now appears in the wardrobe with its attributes and isolated image; separately, scan another item, tap No, and verify nothing was added and the app returns to the scan screen.

**Acceptance Scenarios**:

1. **Given** a result screen for a scanned item, **When** the user taps Add, **Then** the item is saved to the wardrobe with its extracted attributes and background-removed image, and the user is informed it was added.
2. **Given** a result screen for a scanned item, **When** the user taps No, **Then** the item is discarded (not saved) and the app returns to the scan screen.
3. **Given** the user added the item, **When** they later open their wardrobe, **Then** the item is present and indistinguishable in capability from items added through other wardrobe-add methods.

---

### Edge Cases

- **No garment detected**: The photo contains no recognizable garment (blurry, empty, or non-clothing subject) — the app explains it could not detect an item and lets the user retake/reselect.
- **Multiple garments in frame**: The user photographs a full outfit instead of one item — the system focuses the scan on a single primary garment (the Try On flow is single-item; multi-garment extraction is the separate "Extract by AI" feature).
- **Missing user profile data**: The user has not completed measurements, color palette, or style preferences — a criterion that depends on missing data cannot be scored honestly. In that case the criterion is shown with a "Not enough info" state (with a prompt to complete the relevant profile section) and is excluded from the overall score; the Verdict still renders using the remaining criteria.
- **Empty or sparse wardrobe**: The user taps Mix & Match but their wardrobe has no compatible pieces (or is empty) — the styling screen communicates that there is nothing to pair with yet, rather than showing broken/empty outfits.
- **Extraction succeeds but evaluation fails**: The item image and attributes are produced but the verdict cannot be generated (service error) — the user can still view the item and retry the verdict.
- **Connectivity loss mid-scan**: The network drops during extraction or verdict generation — the app surfaces a clear retry path and does not leave a half-saved item.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to start a Try On scan by either capturing a new photo with the camera or selecting an existing photo from their device library.
- **FR-002**: System MUST process the scanned photo and produce a single isolated item image with the background removed.
- **FR-003**: System MUST display the scanned item using its background-removed (cut-out) form on the result screen.
- **FR-004**: System MUST extract the item's attributes (including at minimum type, color, fit, material/fabric, and style) from the photo.
- **FR-005**: System MUST leave any attribute it cannot reliably determine as empty/unknown and MUST NOT fabricate a value.
- **FR-006**: System MUST generate a Verdict for the scanned item consisting of an overall suitability score on a 0–100 scale.
- **FR-007**: The Verdict MUST score each of the five criteria — Color, Style, Fit, Measurement, and Fabric — individually on a 0–100 scale, and the overall score (FR-006) MUST be a composite of those per-criterion scores.
- **FR-008**: The Verdict MUST evaluate the item against the user's personal profile — their color palette, style preferences, and body measurements — not against generic fashion rules alone.
- **FR-009**: Each criterion in the Verdict MUST present a plain-language explanation of its assessment.
- **FR-009a**: When a criterion's required user-profile data is missing, the system MUST display that criterion in a "Not enough info" state (prompting the user to complete the relevant profile section) and MUST exclude it from the overall composite score, while still rendering the Verdict from the remaining criteria.
- **FR-010**: System MUST provide a Mix & Match action on the result screen that navigates the user to a styling screen.
- **FR-011**: On the Mix & Match screen, System MUST generate outfit combinations in which **every** generated outfit includes the scanned item.
- **FR-012**: Mix & Match outfits MUST be composed only of the scanned item plus items already in the user's wardrobe.
- **FR-013**: System MUST NOT persist the scanned item to the wardrobe at any point before the user explicitly taps Add.
- **FR-014**: System MUST provide an Add action that saves the scanned item to the user's wardrobe, carrying over its extracted attributes and isolated image.
- **FR-015**: System MUST provide a No / reject action that discards the scanned item without saving and returns the user to the scan screen.
- **FR-016**: An item added via Try On MUST be a fully functional wardrobe item, equivalent to items added through other wardrobe-add methods (usable in future outfit suggestions).
- **FR-017**: System MUST show clear progress feedback during extraction and verdict generation, and a clear, recoverable error path if either step fails.
- **FR-018**: The Try On screens MUST follow the provided UI reference designs (the "True Clothes Try On" screen set), treating those designs as the source of truth for layout and interaction.

### Key Entities *(include if feature involves data)*

- **Scanned Item (transient)**: The prospective garment under evaluation. Holds the source photo reference, the background-removed image, and the extracted attributes (type, color, fit, material/fabric, style, and any others). Exists only in the Try On session until the user adds or rejects it; it is not a wardrobe item until added.
- **Verdict**: The suitability assessment of a Scanned Item for the current user. Holds an overall 0–100 composite score and a per-criterion 0–100 score for Color, Style, Fit, Measurement, and Fabric, each with a plain-language explanation. A criterion lacking the required profile data carries a "Not enough info" state instead of a score and is excluded from the composite. Derived from the Scanned Item's attributes and the user's profile.
- **Mix & Match Outfit (transient)**: A suggested combination pairing the Scanned Item with one or more existing wardrobe items. Every such outfit necessarily contains the Scanned Item. Not persisted unless the broader save flow chooses to (out of scope here — these are exploratory).
- **User Profile (existing)**: The user's color palette, style preferences, and body measurements, used as the basis for the Verdict. Already captured during onboarding.
- **Wardrobe Item (existing)**: Clothing the user already owns, used as the candidate pool for Mix & Match and the destination when the user taps Add.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from opening the Try On flow to seeing a complete Verdict (item image + attributes + scores) in under 30 seconds for a typical photo.
- **SC-002**: In at least 90% of scans of a clear, single-garment photo, the system returns an isolated item image and a Verdict without the user needing to retake the photo.
- **SC-003**: 100% of outfits shown on the Mix & Match screen contain the scanned item (no outfit ever omits it).
- **SC-004**: 0% of scanned items are written to the wardrobe before the user taps Add (no accidental/premature saves).
- **SC-005**: When an attribute or criterion cannot be determined, it is shown as unknown/insufficient rather than a fabricated value in 100% of such cases.
- **SC-006**: A user can complete the full decision loop (scan → review verdict → mix & match → Add or No) without leaving the Try On flow or losing the scanned item's data partway through.
- **SC-007**: At least 70% of users who reach a Verdict proceed to either Add or Mix & Match (rather than abandoning), indicating the verdict is actionable. *(adoption signal, measured post-launch)*

## Assumptions

- The Try On flow is **single-item**: it evaluates one prospective garment per scan. Multi-garment extraction from a full outfit photo is handled by the separate "Extract by AI" feature, not here.
- Item extraction (background removal + attribute detection) reuses the same AI-extraction approach already established for wardrobe-add, adapted to a single product image.
- The Verdict is computed by a server-side evaluation step that takes the extracted attributes plus the user's profile (color palette, style, measurements) as input.
- Mix & Match reuses the app's existing outfit-suggestion/fit logic, constrained so the scanned item is mandatory in every result.
- The scanned item's isolated image is displayed (and later stored, if added) in its background-removed form.
- "No" discards the current scan only and returns to the scan screen; it does not affect anything already in the wardrobe.
- The user has completed onboarding (or at least enough of it) such that some profile data exists; degraded behavior when profile data is missing is governed by the clarification under Edge Cases.
- UI/layout details are governed by the provided "True Clothes Try On" reference screens; this spec defines behavior, not pixel-level visual design.

## Dependencies

- Existing AI item-extraction capability (background removal + attribute detection).
- Existing user profile data: color palette, style preferences, body measurements.
- Existing wardrobe data and the wardrobe-add path (Try On's Add action commits into the same wardrobe).
- Existing outfit-suggestion / fit logic for the Mix & Match step.
- The provided "True Clothes Try On" UI reference screen set.
