# Personal Colour v2 — Visual Spec

Per Constitution I (Luxury Minimalist Design): near-monochrome canvas, hairline
dividers only, serif headlines, no gradients/shadows. All colours/type via
`T.*` / `type.*` tokens (`src/design/tokens.ts`) except the camera-veil dark
backgrounds and drape swatches, which are intentionally saturated/dark by
design (they ARE the content being judged). Screens: `app/(onboarding)/
personal-color.tsx` and `app/personal-color-edit.tsx` (kept in lockstep).

## 1. Result header — 12-tone label

Replaces the bare 4-season word with the full 12-tone label (`result.label.en`,
e.g. "TRUE AUTUMN") in the existing `seasonLabel` style (10px, tertiary,
letter-spacing 2, uppercase via manual `.toUpperCase()` — the label strings
themselves are title-case in `TONE12_LABELS`). The `h1` "Your season." and the
4-season description (`SEASON_DESC[result.season]`) are unchanged — the
12-tone label sits ABOVE both, so the season family is still the reader's
primary anchor and the tone is the refinement layer above it.

## 2. Palette groups — NEUTRALS / CORE / ACCENTS (2026-07-06)

"YOUR PALETTE" is now three grouped rows reading `result.board` (a
`Tone12Board`: 8 neutrals, 12 core, 6 accents — the stylist-grade 26-swatch
upgrade from the original 8-swatch draft). Each group gets its own tiny
sublabel using the existing `paletteSectionLabel` style (`NEUTRALS`, `CORE`,
`ACCENTS`, 20px gap between groups), then a wrapping row of swatches sized
**28×28** (`paletteSwatchSmall`) — smaller than the old 36×36 `paletteSwatch`
(still defined, now otherwise unused) so a 12-wide core row still wraps
cleanly. `result.palette` (the flattened 26-hex array) is unchanged and still
feeds "THIS SEASON'S EDIT" below.

## 3. Seasonal edit row

Directly under the palette groups, same `paletteSectionLabel` style:
`THIS SEASON'S EDIT · {WEATHER}` where weather comes from `weatherSeasonNow`
(`tone12.ts`) — a display-only "what calendar season is it right now" lens,
distinct from the wardrobe-critic engine's live weather computation.

- 4 swatches from `seasonalEdit(result.palette, weather).edit` — the leading
  slice of the (now 26-hex) palette reordered for the current season
  (lightest-first in summer, deepest-first in winter, most-chromatic-first in
  spring, warmest-first in autumn).
- Swatch size **44×44** (`seasonEditSwatch`), deliberately larger than the
  palette groups' 28×28 chips — fewer, larger chips reads as "the
  highlights," not just a subset.
- Caption below (existing `caption` style, 11px, tertiary): "Lean on these
  right now — the slice of your palette that suits the season."
- Country code for hemisphere: both screens read the profile's
  reverse-geocoded ISO country code via
  `useAuthStore(s => s.locationCountryCode)` (hydrated from
  `profiles.location_country_code`, mirrored into state when the location
  screen saves) and pass it to `weatherSeasonNow`. When it's null (user
  skipped or overrode GPS), `weatherSeasonNow` defaults to the
  northern-hemisphere calendar.

## 3a. "Better to skip" line (2026-07-06)

Below the seasonal-edit caption, a text-only row (no swatches — luxury-minimal
per Constitution I, and these are colours to avoid, not to admire): sublabel
`BETTER TO SKIP` (`paletteSectionLabel`), then one line (new `skipListText`
style — `type.caption`, `T.color.tertiary`) joining `result.avoidColors`
(capitalized, e.g. "Camel · Orange · Beige") with `' · '`. Source is
`TONE12_AVOID[tone12]` (`tone12.ts`) — draft-curated, engine-vocabulary colour
names filtered against the `PrimaryColor` union (non-vocabulary names like
"mustard"/"rust"/"fuchsia"/"grey" are silently dropped before reaching this
line).

## 4. Draping refinement entry point

Below the existing "REFINE — OPTIONAL" section, a bordered secondary button
(reuses the screen's own `secondaryBtn`/`secondaryBtnText` style — 48px tall,
0.5px `T.color.primary` border, `type.ui` label): **REFINE WITH DRAPING**.
When any drape axis is non-zero (`Object.values(drape).some(v => v !== 0)`),
a small text link **RESET DRAPING** (`skipInline` style) appears beneath it,
calling `resetDrape()`. Tapping the button flips a screen-local
`draping` boolean; while true, `DrapeSession` renders full-screen in place of
the step's `ScrollView` (same slot convention the wrist/hair camera steps
already use — "camera steps get their own full-height views outside the
scroll"). The result screen's own top bar and step dots stay mounted above it
(unchanged behaviour for the existing camera steps).

## 5. `DrapeSession` (`src/features/personal-color/components/DrapeSession.tsx`)

Full-screen, self-contained, two phases:

**Phase 1 — selfie**: front `CameraView` (`facing="front"`, no torch),
absoluteFill, dark `rgba(0,0,0,0.35)` veil overlay anchored bottom
(`captureOverlay`), same capture-button treatment as the wrist/hair scan
steps (72px ring, 58px white disc). Caption: "One selfie — we'll compare it
against colour drapes. Nothing leaves your phone." An `IconX` (20px, white)
top-left closes the session (cleans up first).

**Phase 2 — 3 drape rounds**, solid dark veil (`#0E0D0C`), centered:

| Round | Axis | Left card (direction +1) | Right card (direction −1) |
|---|---|---|---|
| 1 | warmth | `#D4A24C` warm gold | `#9AB2C8` cool blue-grey |
| 2 | value  | `#E8DCC8` light ivory | `#2E2A3A` deep charcoal |
| 3 | chroma | `#C2185B` clear bright | `#A89AA4` soft mauve |

Each card: a 150px-wide colored backing panel (`drapeCard`, 14px padding, 2px
`rgba(255,255,255,0.9)` hairline border) containing the selfie `Image`
(160px tall, `resizeMode="cover"`) — the coloured panel IS the "drape," the
selfie sits inside it. Cards sit side by side, 12px gap, centered
(`cardsRow`). Question caption above ("Which makes your face look
fresher?"), round counter ("DRAPE N OF 3") above that. A **CAN'T TELL —
SKIP** text link advances the round without calling `applyDrape`. Picking a
card calls `applyDrape(axis, direction)` then advances; after round 3, the
session cleans up and calls `onDone()`.

All colours above are **CALIBRATION-PENDING** draft swatches (matches the
`TONE12_PALETTES` disclaimer in `tone12.ts`) — not yet colourist-reviewed.

**Privacy**: the captured selfie URI lives only in `DrapeSession`'s local
state, never persisted or uploaded. It's deleted via
`FileSystem.deleteAsync(uri, { idempotent: true })` on session completion, on
the X/back close, and (belt-and-braces) on unmount — whichever fires first;
idempotent delete makes the overlap harmless.

**Camera permission**: reuses `useCameraPermissions`; requests once
automatically if not yet granted and re-askable. If denied, renders a plain
dark-veil fallback message + a **CLOSE** text button instead of the camera.

## 6. Dual-flash wrist capture (ambient-light cancellation)

Both `WristScanStep` components (onboarding + edit) now take two photos per
tap instead of one: torch stays on for the first shot, is then switched off
(`enableTorch={torch}` component state), the code waits ~350ms for the sensor
to re-settle, then takes a second (ambient) shot. Both URIs are passed to
`onCapture(flashUri, ambientUri)` → `setCameraPhoto('wrist', flashUri,
ambientUri)`. A `busyRef` guards re-entrancy so a second tap mid-sequence is
a no-op. Only the flash-lit URI is kept as the on-screen thumbnail
(`wristPhotoUri`) — the ambient shot is analysis-only and never displayed.

Updated scan caption (both screens): "Position the inside of your wrist in
the frame. Two quick shots — flash on, then off — to cancel the room's
lighting."

`usePersonalColorDetection.setCameraPhoto('wrist', uri, ambientUri?)`:
when `ambientUri` is present, both photos are analysed
(`analyzeWristUndertone`) and reconciled — same key on both reads is treated
as a strong signal (`confident: true` regardless of either read's own
margin); disagreement keeps the flash read but flags `confident: false`
(surfaces the existing "Low light? double-check this one." hint on the
result screen); if the flash read fails outright, falls back to the ambient
read as-is. Single-URI calls (no `ambientUri`) are unchanged.
