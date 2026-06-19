# Feature Specification: AI Item Extraction from Outfit Photos

**Feature Branch**: `006-ai-item-extraction`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "đọc file @specs/extract-by-ai/reference.md" — Help users import their clothes into their wardrobe more easily by letting AI detect every garment in an outfit photo, auto-fill each garment's attributes, and produce a clean isolated product image for each one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract a whole outfit into individual wardrobe items (Priority: P1)

A user has a photo of themselves (or a reference look) wearing several pieces at once — for example a jacket, a tee, jeans, and sneakers. Instead of adding each piece manually (photographing, cropping, typing in type, color, material, fit, etc.), the user picks the photo, taps **Extract by AI**, and the app returns one entry per detected garment. Each entry arrives with its attributes pre-filled and a clean, isolated product image on a white background. The user reviews the results and confirms to add them to their wardrobe.

**Why this priority**: This is the core value of the feature. Manual wardrobe building is the single biggest friction point before the app can generate outfit suggestions. One photo → many ready-to-save items removes most of that friction and is independently shippable.

**Independent Test**: Provide a single outfit photo containing multiple garments, trigger extraction, and verify the app returns a correctly ordered list where every detected garment has attributes filled from the controlled vocabulary and a matching isolated image. Delivers value even without any editing capability.

**Acceptance Scenarios**:

1. **Given** a user viewing the Add Item flow, **When** they select an outfit photo containing multiple garments and tap "Extract by AI", **Then** the app shows a progress state and afterwards displays one reviewable entry per detected garment.
2. **Given** extraction has completed, **When** the user inspects an entry, **Then** its `type`, `color`, `material`, `fit`, `pattern`, and `warmth_season` are each populated with a single valid value from the controlled vocabulary, and a `name` and `description` are present.
3. **Given** extraction has completed, **When** the user looks at an entry's image, **Then** the image shows only that one garment, isolated on a white background, with no other garments from the original photo attached.
4. **Given** the returned entries, **When** the app displays them, **Then** each entry's attributes are paired with the correct isolated image (data and image never mismatched).
5. **Given** the user is satisfied with the extracted entries, **When** they confirm, **Then** the selected entries are added to their wardrobe as individual clothing items.

---

### User Story 2 - Review and correct AI results before saving (Priority: P2)

After extraction, the user can edit any pre-filled field, deselect garments they don't want to keep (e.g., an accessory the AI picked up but they don't own), and only then commit the chosen items to the wardrobe.

**Why this priority**: AI extraction is a strong starting point but not infallible — a color or material guess may be wrong, or a non-owned item may be detected. Letting the user correct before saving keeps wardrobe data trustworthy, which the fit engine depends on. It builds directly on US1 and is the natural safeguard around it.

**Independent Test**: With a set of extracted entries, change an entry's type and color, deselect one entry, confirm, and verify the wardrobe contains exactly the kept items with the user's edits applied.

**Acceptance Scenarios**:

1. **Given** extracted entries are displayed, **When** the user changes a field (e.g., color from "Blue" to "Navy"), **Then** the edit is reflected and the controlled-vocabulary constraint is preserved (only valid values selectable).
2. **Given** extracted entries are displayed, **When** the user deselects an entry, **Then** it is excluded from the items that get saved.
3. **Given** the user has edited and selected entries, **When** they confirm, **Then** only the selected entries are persisted, with edits applied.

---

### User Story 3 - Capture logo / statement signals for later use (Priority: P3)

When a garment carries a visible logo, slogan, or graphic, the system records whether a logo is present, its relative size, its kind (brand logo / slogan text / graphic), and any readable text, and stores this alongside the item.

**Why this priority**: Logo prominence is a meaningful styling signal (statement strength), but the outfit engine does not yet consume it. Capturing it now means the data exists when the engine gains support, without requiring users to re-process their wardrobe later. It is additive and lowest urgency.

**Independent Test**: Extract a garment with a clearly visible brand logo and verify the stored item records logo presence, a size category, a type, and any OCR text — even though this data does not change any current suggestion.

**Acceptance Scenarios**:

1. **Given** a garment with a visible logo, **When** it is extracted, **Then** the stored item records logo presence, size category (small / medium / large), kind (brand logo / slogan text / graphic), and readable text if any.
2. **Given** a garment with no visible logo, **When** it is extracted, **Then** the stored item records that no logo is present.
3. **Given** logo data has been captured, **When** the current outfit suggestions are generated, **Then** the logo data does not alter the results (captured but not yet consumed).

---

### Edge Cases

- **No garments detected**: The photo contains no recognizable clothing (e.g., a landscape). The app MUST inform the user that nothing was detected and offer to retry or add manually, rather than failing silently or showing empty entries.
- **Single garment**: A photo with exactly one garment MUST still produce one valid entry (the flow is not limited to multi-item photos).
- **Uncertain attribute**: When the AI is unsure of an enum attribute, it MUST pick the nearest valid controlled-vocabulary value rather than emit free text. Measurements are pre-filled as type-aware AI estimates and remain user-editable; they MUST NOT be inferred from the user's body measurements.
- **Partial image-generation failure**: If isolated images are produced for some garments but fail for others, the app MUST still return every detected garment with its attributes, clearly marking which entries are missing an image, and MUST keep data and images correctly paired (a failure for one item MUST NOT shift images onto the wrong items).
- **Prompt-injection via user-supplied context**: Any optional user-provided text used to enrich extraction MUST be treated as untrusted data and MUST NOT be able to override extraction rules, the controlled vocabulary, or output format.
- **Non-clothing or disallowed image content**: Faces or background context in the original photo MUST NOT appear in the isolated per-garment images.
- **Multiple photos**: The user MAY select more than one photo; each photo is processed as an independent extraction with its own results.
- **Slow or failed processing**: A timeout or backend failure MUST surface a clear, recoverable error (retry / cancel), never a partial or corrupted save.
- **Many garments in one photo**: A photo with an unusually large number of garments MUST be handled gracefully (bounded processing), informing the user if not all could be processed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Add Item flow MUST offer an "Extract by AI" action that accepts a user-supplied clothing/outfit photo.
- **FR-002**: For each photo the user chooses to extract, the system MUST process that single photo independently and return one structured entry per detected garment as an ordered list.
- **FR-003**: Each extracted entry MUST include a single `type` value chosen from the controlled `type` vocabulary; `type` is mandatory and is the primary attribute downstream logic depends on.
- **FR-004**: Each extracted entry MUST include a short human-readable `name` and a `description` of the garment's distinguishing features.
- **FR-005**: Each extracted entry MUST include `color`, `material`, `fit`, `pattern`, and `warmth_season`, each set to exactly one valid value from its respective controlled vocabulary (see Controlled Vocabulary). `warmth_season` MUST be one of: `lightweight_summer`, `midweight_transitional`, `warm_winter`, `all_season`.
- **FR-006**: When the system is uncertain about an enum attribute, it MUST select the closest valid controlled-vocabulary value; it MUST NOT output free-form text for any controlled attribute.
- **FR-007**: The system MUST pre-fill AI-estimated garment `measurements` for each entry, **type-aware** (top / bottom / footwear / bag groups), shown **editable** so the user can correct or clear any value. Estimates derive from the garment as seen plus typical values for its type — NOT from the user's body measurements. Only measurement keys that map to a real engine column are persisted.
- **FR-008**: For each detected garment, the system MUST produce an isolated product image showing only that garment on a white background, with no other garments and no person/background from the original photo.
- **FR-009**: Generated isolated images MUST be produced at a consistent, suggestion-card-ready resolution (target ~1K) so they scale cleanly into outfit cards on the home feed.
- **FR-010**: Each generated isolated image MUST be associated with its corresponding entry such that attributes and image are always correctly paired in the returned results.
- **FR-011**: The system MUST return the complete set of extracted entries (with their images) for a photo together, so the app can auto-fill each item and place each image into the correct slot.
- **FR-012**: The app MUST present the extracted entries to the user for review, with each attribute pre-filled (User Story 2).
- **FR-013**: Users MUST be able to edit any pre-filled attribute before saving, constrained to valid controlled-vocabulary values for controlled attributes.
- **FR-014**: Users MUST be able to deselect/exclude individual extracted entries so that only chosen entries are saved to the wardrobe.
- **FR-015**: On confirmation, the system MUST add the selected entries to the user's wardrobe as individual clothing items, persisted through the standard wardrobe data path.
- **FR-016**: The system MUST detect and record logo/graphic signals per garment — presence, size category (small / medium / large), kind (brand logo / slogan text / graphic), and OCR text when readable — and store them with the item. This logo data MUST NOT affect current outfit suggestions (captured for future use only).
- **FR-017**: Any optional user-supplied context added to enrich extraction MUST be handled as untrusted input and MUST NOT be able to alter extraction rules, the controlled vocabulary, or the required output structure.
- **FR-018**: When no garment is detected, the system MUST clearly communicate this and let the user retry or fall back to manual entry.
- **FR-019**: When extraction or image generation fails wholly or partially, the system MUST surface a clear, recoverable state (retry / cancel) and MUST NOT persist partial or mismatched data.
- **FR-020**: All controlled attribute values emitted by extraction MUST match the engine's controlled vocabulary exactly, because downstream normalization maps strictly and silently falls back to defaults on any mismatch.
- **FR-021**: The `tags` attribute (and any logo data in MVP) is for UI/filtering and future use only and MUST NOT be fed into the current outfit-scoring logic.
- **FR-022**: The import flow is a full-screen **multi-photo wizard** with four steps — Upload → Analyse → Review → Done. Users MAY add multiple photos in one session; each photo carries its own extraction method and optional notes, and is processed independently.
- **FR-023**: Each photo is added via a method chooser offering **"Extract by AI"** (this feature) and **"Extract by item"** (on-device, single item — delivered by the separate `extract-by-item` feature). The Review step groups extracted entries under their source photo.
- **FR-024**: Each review entry exposes editable `name`, `brand`, product `link`, and free-form `tags` (UI/filter only) in addition to the controlled attributes; tags and link are not fed to the engine.

### Key Entities *(include if feature involves data)*

- **Source Photo**: The user-supplied image of one or more worn garments. Input to a single extraction. Not necessarily persisted as a wardrobe artifact.
- **Extracted Item Entry**: The structured result for one detected garment. Attributes: `type` (required, controlled), `name`, `description`, `color` (controlled), `material` (controlled), `fit` (controlled), `pattern` (controlled), `warmth_season` (one of four), `measurements` (optional, may be empty), `tags` (UI/filter only), `item_image` (isolated generated image), and logo signals (presence, size, kind, text). Maps onto an existing wardrobe Clothing Item on save.
- **Logo Signal**: Per-garment statement-strength metadata — presence flag, size category, kind, and optional OCR text. Stored with the item; not consumed by current scoring.
- **Clothing Item (existing)**: The wardrobe entity each kept Extracted Item Entry becomes on save. Colors stored as named strings; measurements in metric; attributes constrained to the controlled vocabulary the engine reads.

### Controlled Vocabulary *(extraction output MUST match exactly)*

Downstream logic reads only these attributes: `type, name, color, material, fit, pattern, warmth_season` plus measurements (`m_*`). Other attributes are not consumed by current scoring.

- **`type`** (40 values, UPPERCASE): `TEE, POLO, KNIT, SHIRT, BLOUSE, VEST, SWEATER, CARDIGAN, HENLEY, JACKET, BLAZER, COAT, HOODIE, PARKA, OVERCOAT, JEANS, TROUSERS, CHINOS, SHORTS, SKIRT, DRESS, JUMPSUIT, OVERALLS, GOWN, LOAFERS, SNEAKERS, BOOTS, HEELS, SANDALS, OXFORDS, MULES, BAG, BELT, SCARF, WATCH, CAP, NECKLACE, SUNGLASSES, HAT, RING, BRACELET`
- **`color`** (37 names, Title Case): `White, Cream, Ivory, Beige, Sand, Stone, Dove, Tan, Camel, Gold, Mustard, Ochre, Yellow, Orange, Rust, Terracotta, Burgundy, Wine, Red, Pink, Purple, Olive, Green, Sage, Forest, Emerald, Teal, Blue, Indigo, Navy, Slate, Grey, Charcoal, Black, Brown, Multicolor, Natural`
- **`material`** (Title Case): `Cotton, Wool, Linen, Silk, Cashmere, Denim, Leather, Suede, Nylon, Polyester, Canvas, Corduroy, Tweed, Flannel, Jersey, Fleece, Velvet`
- **`fit`** (5 normalized groups; accepted aliases shown): `slim | fitted | skinny`, `regular | standard | classic`, `relaxed | comfort | loose`, `wide | wide-leg`, `oversized | boxy`
- **`pattern`** (valid aliases): `solid`, `striped | stripe`, `plaid | houndstooth | tartan`, `checked | checkered | check | gingham`, `floral`, `graphic`, `print | abstract | camo | polka dot`
- **`warmth_season`** (only 4 values): `lightweight_summer | midweight_transitional | warm_winter | all_season`
- **`measurements`** (cm, all optional, empty if unsure): `m_chest, m_shoulder_width, m_sleeves, m_body_length, m_upper_arm, m_waist, m_hip, m_inseam, m_thigh, m_rise`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can turn a single multi-garment photo into reviewable, attribute-filled wardrobe entries without typing any attribute manually before review.
- **SC-002**: For a photo with N clearly visible garments, the system returns N entries in at least 90% of typical multi-item outfit photos (no missed or phantom garments in the common case).
- **SC-003**: 100% of returned entries have every controlled attribute set to a valid controlled-vocabulary value (zero free-text values in controlled fields).
- **SC-004**: In returned results, attributes and isolated images are correctly paired in 100% of cases (no image/data mismatch), including when some image generations fail.
- **SC-005**: Adding a typical outfit (3–5 garments) to the wardrobe via AI extraction takes the user materially less effort and time than adding the same garments manually.
- **SC-006**: Every isolated image contains exactly one garment on a white background, with no person or other garments visible, in 100% of successfully generated images.
- **SC-007**: User-supplied enrichment text cannot change the output structure or controlled vocabulary in any tested injection attempt.

## Assumptions

- **Entry point**: A full-screen 4-step **Add to Wardrobe wizard** (Upload → Analyse → Review → Done), per the approved design (`screens/.../outfit-import.jsx`), reached from the wardrobe add affordance. It replaces the single-item AI form in `app/add-item.tsx`.
- **Wizard hosts two methods**: "Extract by AI" (this feature, multi-item from a worn-outfit photo) and "Extract by item" (on-device segmentation of a single item on a plain background, specified separately in `specs/extract-by-item/`). This feature (006) builds the shared wizard shell + the AI method end-to-end.
- **Review before save**: Extracted entries are presented for review and require explicit user confirmation before being added to the wardrobe (no silent auto-save). This is the safer default and aligns with keeping wardrobe data trustworthy.
- **Items only**: Extraction imports individual clothing items into the wardrobe. The original outfit photo is not automatically saved as a separate "outfit/look" by this feature.
- **Multiple photos**: The user may extract from more than one photo; each photo is an independent extraction with its own results (the system does not merge garments across photos).
- **Measurements estimated + editable**: The system pre-fills AI-estimated, type-aware measurements that the user can correct or clear before saving (product decision, overriding the earlier "empty unless legible" stance). Estimated measurements DO feed the fit engine; the user editing/clearing them is the correctness safeguard. Never derived from body measurements.
- **Logo data dormant in MVP**: Logo/graphic signals are captured and stored but not consumed by the current outfit engine; they are reserved for a future engine capability.
- **Cost/rate guardrails**: Standard, reasonable per-user usage limits on AI extraction are assumed for cost control; exact thresholds are an implementation detail to be set during planning.
- **Existing wardrobe path reused**: Saved items flow through the existing wardrobe service and clothing-item data model; this feature adds extraction, not a new persistence model.
