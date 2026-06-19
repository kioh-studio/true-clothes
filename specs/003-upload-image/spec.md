# Feature Specification: Wardrobe Item Image Upload & Storage

**Feature Branch**: `004-upload-image`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "explore the @specs/003-upload-image/reference.md" — Help users upload and store their wardrobe item images and reuse them when the item is rendered in the app. Free users store images on-device with only the local path saved to the database; premium users store images in the cloud and retrieve them on demand.

## Clarifications

### Session 2026-06-14

- Q: Who can access a premium user's cloud-stored item photos? → A: Private per-user — retrievable only by the owner via authorized, time-limited (expiring) access.
- Q: Do premium photos work offline, or are they cloud-only? → A: Cloud is the source of truth, but fetched photos are cached on-device so they render offline and instantly on repeat views.
- Q: What is the image optimization target on capture? → A: Cap the long edge at ~1600 px with moderate compression (target ~200–500 KB per photo).
- Q: How is free-tier on-device-only storage (lost on reinstall / new device) handled in the experience? → A: Keep free photos on-device only, but clearly warn the user — e.g. "this photo is stored on this device only, so it (and outfit suggestions using it) won't be available on your other devices" — and prompt upgrade for cloud backup.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Free user adds an item photo that persists on-device (Priority: P1)

A free user adds a clothing item to their wardrobe and attaches a photo. The photo is kept on their device, and only a lightweight reference to it is saved alongside the item. Whenever the item appears anywhere in the app, its photo is shown — even with no internet connection.

**Why this priority**: Photo capture is the core of building a wardrobe. Without reliable on-device storage and display, free users cannot meaningfully use the wardrobe, which is the foundation of every downstream feature (feed, outfits, collections).

**Independent Test**: Sign in as a free user with no network, add an item with a photo, navigate away and back, and confirm the photo renders in the wardrobe grid, item detail, and outfit views.

**Acceptance Scenarios**:

1. **Given** a free user is adding a new wardrobe item, **When** they select or capture a photo and save the item, **Then** the photo is stored on their device and the item is saved with a reference to it.
2. **Given** a free user has previously added items with photos, **When** they reopen the app offline, **Then** every item's photo renders correctly without a network request.
3. **Given** a free user opens an item's detail screen, **When** the screen loads, **Then** the photo is displayed at a size and quality appropriate for that screen.

---

### User Story 2 - Premium user's item photos are backed up to the cloud (Priority: P1)

A premium user adds a clothing item with a photo. The photo is uploaded to cloud storage so it is backed up and retrievable on demand. When the item is shown, the app fetches the photo from the cloud.

**Why this priority**: Cloud backup and cross-device availability is the primary tangible benefit users pay for. It must work as reliably as the free on-device path.

**Independent Test**: Sign in as a premium user, add an item with a photo, sign in on a second device with the same account, and confirm the photo appears for that item.

**Acceptance Scenarios**:

1. **Given** a premium user is adding a new wardrobe item, **When** they select or capture a photo and save the item, **Then** the photo is uploaded to cloud storage and the item references the cloud copy.
2. **Given** a premium user has items with cloud-stored photos, **When** they sign in on a different device or after reinstalling the app, **Then** their item photos are retrieved and displayed.
3. **Given** a premium user views their wardrobe, **When** photos are being fetched from the cloud, **Then** each item shows a graceful loading state until its photo appears.

---

### User Story 3 - Upgrading to premium backs up existing photos (Priority: P2)

A free user who has built a wardrobe of on-device photos upgrades to premium. Their existing photos are migrated to the cloud so they become backed up and available across devices, without the user having to re-add anything.

**Why this priority**: Without migration, an upgrade would leave a user's existing wardrobe stuck on one device, undercutting the value of the upgrade and creating confusion about which photos are protected.

**Independent Test**: As a free user with several photographed items, upgrade to premium, wait for migration to complete, then sign in on a second device and confirm the previously local-only photos now appear.

**Acceptance Scenarios**:

1. **Given** a free user with on-device item photos, **When** they upgrade to premium, **Then** their existing photos are uploaded to the cloud and each item's reference is updated to the cloud copy.
2. **Given** a migration is in progress, **When** the user browses their wardrobe, **Then** photos remain visible throughout (from device until cloud copies are ready) with no broken-image gaps.
3. **Given** a migration is interrupted (e.g., the app closes or loses connectivity), **When** the app next runs as premium, **Then** migration resumes for any photos not yet uploaded.

---

### User Story 4 - Photos degrade gracefully when unavailable (Priority: P3)

When an item's photo cannot be located or loaded — for example a free user's on-device file was reclaimed by the operating system, or a cloud fetch fails — the app shows a clean placeholder instead of a broken image or crash, and offers a way to re-add the photo.

**Why this priority**: Missing-image states are inevitable given on-device storage volatility and network failures. Handling them gracefully protects the luxury-minimal experience and prevents crashes, but it is a resilience layer rather than core capture.

**Independent Test**: Remove or invalidate an item's stored photo, open any screen showing that item, and confirm a placeholder appears with an option to re-add a photo, with no crash.

**Acceptance Scenarios**:

1. **Given** an item whose stored photo can no longer be found, **When** the item is rendered, **Then** a placeholder is shown in place of the photo.
2. **Given** a cloud photo fetch fails, **When** the item is rendered, **Then** the app shows a placeholder and retries retrieval when conditions allow.
3. **Given** an item is showing a placeholder, **When** the user opens its detail screen, **Then** they are offered a clear action to re-add or replace the photo.

---

### Edge Cases

- **On-device file reclaimed**: The operating system clears app storage or the cached file is deleted — the item must show a placeholder and allow re-adding, never a broken image or crash.
- **Free user reinstall / new device**: On-device photos are not synced and are absent after reinstall or on a new device. This is an accepted free-tier limitation (see Assumptions) and must be communicated honestly rather than silently failing.
- **Premium upload failure**: The cloud upload fails (no connectivity, timeout). The item must still be saveable, the photo shown from a local copy in the interim, and the upload retried automatically.
- **Premium offline, photo not yet cached**: A premium user is offline and opens an item whose photo has never been fetched/cached on this device — the app must show a placeholder and fetch the photo automatically once connectivity returns.
- **Downgrade premium → free**: Already-cloud photos must remain viewable; only new uploads follow the free on-device path.
- **Oversized or high-resolution source image**: Very large photos must be optimized so they do not exhaust device storage, slow rendering, or consume excessive bandwidth.
- **Replacing an item's photo**: Adding a new photo to an item that already has one must replace it and clean up the prior stored copy.
- **Deleting an item**: Removing a wardrobe item must clean up its associated stored photo (on-device and/or cloud) to avoid orphaned storage.
- **Unsupported or corrupt file**: A selected file that is not a usable image must be rejected with a clear message rather than producing a broken item.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to attach a photo to a wardrobe item when adding or editing it, by capturing a new photo or selecting an existing one.
- **FR-002**: The system MUST determine where a newly added photo is stored based on the user's subscription tier at the time of upload (free → on-device; premium → cloud).
- **FR-003**: For free users, the system MUST store the photo on the user's device and persist only a reference to that on-device photo with the item record.
- **FR-004**: For premium users, the system MUST store the photo in cloud storage and persist a reference that allows the photo to be retrieved on any device where the user is signed in.
- **FR-005**: The system MUST display each item's photo wherever the item appears (e.g., wardrobe grid, item detail, outfit collage, feed thumbnails), sized and scaled appropriately for each context.
- **FR-006**: The system MUST optimize photos on capture by resizing so the long edge is at most ~1600 px and applying moderate compression (target ~200–500 KB per photo), so that storage use, bandwidth, and rendering performance stay within acceptable limits. The original full-resolution file is not retained.
- **FR-007**: For free users, item photos MUST be viewable with no network connection.
- **FR-008**: For premium users, item photos MUST be retrievable after reinstalling the app or signing in on a different device.
- **FR-008a**: For premium users, the cloud copy is the source of truth, but photos fetched from the cloud MUST be cached on-device so that previously viewed photos render offline and display instantly on repeat views without re-fetching.
- **FR-009**: When a referenced photo cannot be located or loaded, the system MUST display a placeholder and MUST NOT show a broken image or crash.
- **FR-010**: The system MUST provide a way for users to re-add or replace an item's photo, including when the current photo is missing.
- **FR-011**: When a user upgrades from free to premium, the system MUST migrate their existing on-device item photos to cloud storage and update each item's reference accordingly, without requiring manual re-entry.
- **FR-012**: The system MUST handle photo upload or retrieval failures gracefully, keeping the item usable, surfacing a recoverable state, and retrying when conditions allow.
- **FR-013**: Each stored photo MUST be associated with exactly one wardrobe item; replacing or deleting an item's photo MUST clean up the previously stored copy to avoid orphaned storage.
- **FR-014**: Deleting a wardrobe item MUST remove its associated stored photo from wherever it is held (on-device and/or cloud).
- **FR-015**: The system MUST reject files that are not usable images with a clear message, leaving the item without a broken photo reference.
- **FR-016**: Cloud-stored item photos MUST be private to their owner — retrievable only by the user who uploaded them, through authorized, time-limited access. Photos MUST NOT be accessible via public or non-expiring links.
- **FR-017**: When a free user adds a photo, the system MUST clearly disclose that the photo is stored on this device only — and therefore will not be available, nor usable by outfit suggestions, on the user's other devices or after reinstalling — and MUST offer upgrading to premium for cloud backup. The disclosure MUST NOT block the user from saving the item.

### Key Entities *(include if feature involves data)*

- **Item Photo**: The image asset attached to a single wardrobe item. Key attributes: the owning item, where it is stored (on-device vs. cloud), the locator/reference used to retrieve it, optimized dimensions/size, and when it was added or last replaced.
- **Storage Tier**: The effective storage destination for new photos, derived from the user's current subscription status (free → on-device, premium → cloud). Governs both new uploads and upgrade migration behavior.
- **Wardrobe Item** (existing): The clothing record a photo belongs to; this feature adds/owns the photo reference on that record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of free-user item photos that still exist on the device render correctly with no network connection.
- **SC-002**: Item photos appear without noticeable delay — on-device photos display effectively instantly, and cloud photos display within a few seconds on a typical connection — while keeping wardrobe and feed scrolling smooth.
- **SC-003**: 100% of a premium user's cloud-stored item photos are available and display correctly after reinstalling the app or signing in on a new device.
- **SC-004**: Zero crashes and zero broken-image states are caused by missing or failed photos; a placeholder is always shown instead.
- **SC-005**: After a free user upgrades to premium, 100% of their existing on-device photos are migrated to the cloud and remain continuously visible throughout the migration.
- **SC-006**: A user can add an item with a photo and see it rendered in their wardrobe in under 30 seconds end to end.
- **SC-007**: No orphaned photos remain after items or photos are deleted or replaced (verified by reconciling stored photos against existing item references).
- **SC-008**: A cloud-stored item photo is never retrievable by any account other than its owner — verified by attempting access from a different account and from an expired link, with zero successful retrievals.
- **SC-009**: Stored item photos have a long edge of at most ~1600 px and a typical file size under ~500 KB, regardless of the source photo's resolution.

## Assumptions

- Storage destination is decided by the user's subscription tier **at the moment of upload**; existing photos are not relocated except by the explicit upgrade migration (FR-011).
- Free-tier photos are device-local only and are **not** synced across devices or restored after reinstall. This is an accepted tier limitation and a deliberate premium upsell, not a defect; it is communicated honestly to users via the on-device-only disclosure (FR-017).
- Downgrading from premium to free retains read access to already-cloud photos; only newly added photos follow the on-device path.
- Each wardrobe item has at most one photo; multi-image galleries are out of scope for this feature.
- Photos are optimized to a reasonable maximum dimension/quality on capture to balance visual fidelity against storage and bandwidth.
- The existing wardrobe item management, subscription/premium status signal, and backend cloud storage and database are reused; this feature adds the photo reference and storage routing rather than new account or billing concepts.
- Supported inputs are standard photo formats produced by the device camera and photo library.

### Out of Scope

- Multiple photos per item or image galleries.
- In-app image editing (cropping, filters, background removal) beyond automatic resizing/optimization.
- Sharing item photos outside the app.
- AI-based garment recognition or extraction from photos (covered by separate features).
- Bulk import/export of photos.

### Dependencies

- Existing wardrobe item creation/editing flow.
- Existing premium/subscription status signal.
- Existing backend cloud storage and database for premium persistence.
- Device camera and photo library access.
