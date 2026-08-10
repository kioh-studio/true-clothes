# Personal Colour v2/v3 — Visual Spec

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
(rebuilt on the professional draping methodology, Phase B, 2026-08-04 — see §7f)

Full-screen, self-contained, three phases:

**Phase 1 — selfie**: front `CameraView` (`facing="front"`, no torch),
absoluteFill, dark `rgba(0,0,0,0.35)` veil overlay anchored bottom
(`captureOverlay`), same capture-button treatment as the wrist/hair scan
steps (72px ring, 58px white disc). Caption: "One selfie — we'll compare it
against colour drapes. Nothing leaves your phone." An `IconX` (20px, white)
top-left closes the session (cleans up first). When entered via the result
screen's **SEE ALL 12 TONES** button (§4/§5a), this phase still runs first —
it jumps straight to the grid (phase 3) afterward, skipping the 5 rounds.

**Phase 2 — 5 comparative drape rounds** (`drapeRounds.ts`'s `DRAPE_ROUNDS`),
solid dark veil (`#0E0D0C`), centered — modeled on the actual professional
draping sequence (same-hue comparative pairs, never one colour alone), each
with its own judge-prompt teaching the analyst's real criteria instead of
"which do you like":

| # | Axis | Left card (+1) | Right card (−1) | Judge prompt |
|---|------|-----------------|-------------------|--------------|
| 1 | warmth | `#D9472B` tomato red | `#B01B45` cherry red | "Which softens the shadows under your eyes?" |
| 2 | warmth | `#D6A319` mustard | `#EDE43B` lemon | "Which makes your jawline look more defined?" |
| 3 | value  | `#E8DCC8` light ivory | `#2E2A3A` deep charcoal | "Which brightens your whole face — without washing it out?" |
| 4 | chroma | `#C2185B` clear bright | `#A89AA4` soft mauve | "Which makes your eyes look brighter?" |
| 5 | metal  | `#D4AF37` gold lamé | `#C6C9D2` silver lamé | "Which makes your skin glow, not grey?" |

Each card: a 150px-wide colored backing panel (`drapeCard`, 14px padding, 2px
`rgba(255,255,255,0.9)` hairline border) containing the selfie `Image`
(160px tall, `resizeMode="cover"`) — the coloured panel IS the "drape," the
selfie sits inside it. Cards sit side by side, 12px gap, centered
(`cardsRow`). Round counter ("DRAPE N OF 5") above the prompt; below the
prompt, a smaller one-line educational sub-caption (the analyst's rule):
"Look at your face, not the colours." A **CAN'T TELL — SKIP** text link
advances the round without calling `applyDrape`. Picking a card calls
`applyDrape(axis, direction)` then advances; round 5 (metal) ALSO reports
the picked metal via the `onMetal` prop (guarded upstream so it never
overwrites an existing manual metal answer — see §5a's hook note). After
round 5, the session cleans up and calls `onDone()`. On round 5's screen
only, a second text link — **SEE ALL 12 TONES** — sits below the skip link,
jumping straight to phase 3 without finishing the round.

All colours above are **CALIBRATION-PENDING** draft swatches (matches the
`TONE12_PALETTES` disclaimer in `tone12.ts`) — not yet colourist-reviewed.

**Privacy**: the captured selfie URI lives only in `DrapeSession`'s local
state, never persisted or uploaded. It's deleted via
`FileSystem.deleteAsync(uri, { idempotent: true })` on session completion, on
the X/back close, and (belt-and-braces) on unmount — whichever fires first;
idempotent delete makes the overlap harmless. Unchanged by Phase B — the new
grid phase (§5a) reuses the SAME selfie, no new capture.

**Camera permission**: reuses `useCameraPermissions`; requests once
automatically if not yet granted and re-askable. If denied, renders a plain
dark-veil fallback message + a **CLOSE** text button instead of the camera.

## 5a. "SEE ALL 12 TONES" grid compare (Phase B, 2026-08-04)

**Phase 3** of `DrapeSession` — a 3-column × 4-row grid of all 12
`ColorTone12` values, same dark veil. Each cell: the captured selfie
(`cover`, ~92px tall) inside a backing panel of that tone's signature drape
colour (`TONE12_DRAPE_HEX`, `tone12.ts`), same 2px `rgba(255,255,255,0.9)`
hairline border as a drape card, tone's short EN label beneath in a tiny
white label. The currently-classified tone's cell (`currentTone` prop, fed
live from the result screen's `result.tone12`) gets a small white dot marker
in its top-right corner — no new colours, luxury-minimal.

Tapping a cell that ISN'T the current tone opens a full-width compare view
(same card layout as a drape round): the current tone's card on the left,
the tapped ("challenger") tone's card on the right, prompt "Which looks more
alive?" Picking the LEFT card dismisses back to the grid unchanged; picking
the RIGHT card calls `onNudgeToward(currentTone, challengerTone)` — which
runs `nudgeTowardTone` (`tone12.ts`) — then returns to the grid. The
marker's position updates automatically on the next render since
`currentTone` is derived from the live `result` memo, not local state.
Tapping the current tone's OWN cell is a no-op (nothing to compare against
itself).

Two entry points (both documented in §4/§5): the "SEE ALL 12 TONES" text
link on the last drape round's screen, and a new secondary button on the
result screen beneath **REFINE WITH DRAPING** — entering via the button
still runs the phase-1 selfie capture first, then jumps straight to this
grid (`DrapeSession`'s `startAtGrid` prop), skipping all 5 rounds.

X still closes the whole session with the usual cleanup (§5), from any
phase.

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

## 7. Personal Colour v3 Phase A — face scan, screen-flash UX, leaning label
(2026-08-04)

Full technical rationale: `docs/personal-color-v3-research.md` and
`docs/personal-color-v3-phase-a-instruction.md`. Summary of what changed
visually (the underlying colour-math/capture pipeline is documented in
`plan.md`'s Phase A changelog entry, not here).

### 7a. Camera path step order

`face-scan → wrist-scan → (fallback questions) → result` — replaces v2's
`wrist-scan → hair-scan → …`. The dedicated hair-scan step is retired: hair
now reads from the face selfie's `hairBand` region (the band of the frame
above the detected face box), falling back to the manual "hair" question only
if that read didn't land. The wrist stays as the SECONDARY undertone site
(still makeup-free, still useful as a cross-check) — it no longer branches to
its own hair step, it branches straight to whichever fallback question(s) are
still needed (or `result`).

### 7b. `FaceScanStep` (defined inline in each screen, same pattern as
`WristScanStep`)

Front `CameraView`, full-height slot (same convention as the wrist/hair scan
steps — "camera steps get their own full-height views outside the scroll").
An oval guide frame (`scanFrameFace` — 190×240, `borderRadius: 120`,
positioned higher than the rectangular wrist/hair `scanFrame`) replaces the
rectangular guide for this step only.

**Screen-flash sequence** on capture tap (the phone has no front-facing torch,
so the screen itself stands in for one, matching the wrist's flash/ambient
capture shape so `analyzeFace` can run the same per-pixel subtraction):
1. A full-screen white `View` (`flashOverlayWhite`, `#FFFFFF`, absolute-fill,
   `pointerEvents="none"`) renders over the camera preview, screen brightness
   is pushed to 1.0 via `expo-brightness`, then after ~300ms photo #1 (flash
   frame) is taken.
2. The overlay swaps to `flashOverlayDim` (`#050505`, near-black — not pure
   black, so the preview doesn't fully vanish) for ~350ms, then photo #2
   (ambient frame) is taken.
3. `onCapture(flashUri, ambientUri)` fires; prior screen brightness is
   restored in a `finally` block and again on unmount (belt-and-braces, same
   pattern as `DrapeSession`'s selfie cleanup).

A `busyRef` guards re-entrancy (the sequence takes ~650ms+ and isn't
reentrant), matching the wrist step's existing guard.

Caption: "Bare face, glasses off, hair back if you can. Two quick shots — the
screen will flash white. Nothing leaves your phone."
(`onboardingPersonalColor_faceScanCaption`).

**iPad note**: unlike the wrist's rear-camera torch (see backlog.md §G —
no iPad has one), the screen-flash technique works on any device with a
screen, iPad included — this is the mitigation noted against that backlog
entry.

### 7c. `WristScanStep` now carries the "analysing" spinner

Since hair no longer has its own scan step, the gating point for "have both
scans settled, and do we need a fallback question next?" moved to
`wrist-scan` (previously it was `hair-scan`). `WristScanStep` gained the same
`analyzing` prop treatment `HairScanStep` used to have: an `ActivityIndicator`
+ caption (`onboardingPersonalColor_wristScanAnalyzing`, "Reading your
colours…") over the live camera, capture button disabled while `analyzing`.

### 7d. Skin/hair fallback steps' reference photo

Both `SkinStep` and `HairStep` now show the FACE scan's flash-frame photo
(`facePhotoUri`, not a separate wrist/hair photo) as the reference thumbnail
under the same `photoThumb` style, captioned
`onboardingPersonalColor_facePhotoCaption` ("Your face scan — use as
reference").

### 7e. Result screen — "leaning" secondary tone + low-confidence nudge

Directly under the existing 12-tone `seasonLabel` line, when
`result.secondaryLabel` is non-null, a second line in the SAME `seasonLabel`
style reads `LEANING {SECONDARY LABEL}` (e.g. "LEANING TRUE SUMMER") — the
12-tone axes model's lowest-margin axis, flipped, landing on a different
tone. No new visual language; it's just another `seasonLabel`-styled line.

Below the existing "REFINE WITH DRAPING" button, when
`result.confidence === 'low'`, a one-line nudge appears in the existing
`caption` style (11px, tertiary, centered): "A quick drape session will
sharpen this." — reuses the button's own section, no new component.

Both are session-local (not persisted — `savePersonalColor`'s payload is
unchanged in this phase, per the Phase A contract's hard constraint).

### 7f. Phase B (2026-08-04) — see §5/§5a above

`DrapeSession` was rebuilt on the professional draping methodology (5
comparative rounds with judge-prompts, a gold/silver metal round, and a new
12-tone grid compare) — fully documented in §5 and §5a above rather than
repeated here. Full rationale: `docs/personal-color-v3-research.md` §2 and
`docs/personal-color-v3-phase-b-instruction.md`.

## 8. Personal Colour v3 Phase C — "BEYOND THE WARDROBE" (2026-08-04)

Full rationale: `docs/personal-color-v3-research.md` §2 and
`docs/personal-color-v3-phase-c-instruction.md`. New section on both result
screens, directly below "BETTER TO SKIP" (§3a) and above the "Detected /
answered inputs" section (§7d covers its own photo reference, not this).
Data entirely from `TONE12_BEAUTY[result.tone12]`
(`src/features/personal-color/tone12Beauty.ts`) via the shared
`<BeyondTheWardrobeSection tone12={result.tone12} />` component
(`src/features/personal-color/components/BeyondTheWardrobeSection.tsx`, same
self-contained-styles independence pattern as `DrapeSession`). Luxury
minimal — no new visual language, every size/style below is an existing
token or an existing screen convention reused:

- **Outer label** — `BEYOND THE WARDROBE`, same tiny-caps style as every
  other section sublabel (`onboardingPersonalColor_beyondWardrobeLabel`).
- **WOW COLOURS** — sublabel, then a wrapping row of the 4 `wow` swatches at
  **44×44** (same size as the existing "this season's edit" swatches — "the
  highlights" treatment), then a caption line (existing 11px tertiary
  caption style): "Small doses. Maximum effect — a scarf, a lip, a bag."
  (`onboardingPersonalColor_wowColoursLabel` / `_wowColoursCaption`).
- **METALS** — sublabel, then one text-only line (no swatches — same
  `skipListText` treatment as "BETTER TO SKIP"): "Gold · Bronze" (gold
  tones), "Silver · Platinum" (silver tones), or "Gold or Silver — both sit
  well on you." (`soft_summer`/`soft_autumn` bridge tones)
  (`onboardingPersonalColor_metalsLabel` +
  `_metalGoldLine`/`_metalSilverLine`/`_metalBothLine`, keyed off
  `TONE12_BEAUTY[tone12].metal`).
- **MAKEUP** — sublabel, then three rows in order LIPS → CHEEKS → EYES, each
  a tiny 9px sublabel (`onboardingPersonalColor_makeupLipsLabel`/
  `_makeupCheeksLabel`/`_makeupEyesLabel`) above a row of that family's 2
  swatches at **28×28** (same size as the NEUTRALS/CORE/ACCENTS palette
  chips).
- **HAIR** / **GLASSES** — one sublabel + one `skipListText`-styled line
  each, reading `personalColor_hair_<hairKey>` /
  `personalColor_glasses_<glassesKey>` from `TONE12_BEAUTY[tone12]`
  (`onboardingPersonalColor_hairLabel` / `_glassesLabel` for the sublabels).

All wow/makeup hexes are **CALIBRATION-PENDING** draft picks (same
disclaimer as every other hex in this feature) — see `tone12Beauty.ts`'s
header and each tone's inline reasoning comment for which 4 of the 6 board
accents were kept as "wow" and why.

**Scope cut (Fable, 2026-08-04)**: no engine wiring in this phase — the
generate-outfits accessory scoring does not consume `metal`, only display.
Item metadata has no gold/silver distinction (only a generic 'metallic'
colour), and `supabase/functions` carries unrelated uncommitted work in a
single-production-env project, so wiring the metal preference into live
scoring is deferred to backlog (see backlog.md, "Engine metal wiring").

## 9. UX-simplify — guided flow + de-black-boxed result (2026-08-06)

Full rationale: `docs/personal-color-ux-simplify-instruction.md`. Classification
math (`tone12.ts` axes/classify, `colorMath.ts`, `analyzePhoto.ts`) is
UNCHANGED by this pass — everything below is UX shell only: step order, a new
"prepare" screen, explicit failure states, the result screen's section order,
and one new shared component (`AxisMeters`). `ResultStep`'s duplicated JSX in
both result screens is retired in favour of one shared
`src/features/personal-color/components/ResultView.tsx`.

### 9a. Camera path step order

`intro → prepare → face-scan → wrist-scan → (fallback questions) → result` —
adds a one-tap **prepare** step between intro and the first camera
(`usePersonalColorDetection`'s `DetectionStep` union + `next()`'s new
`'prepare'` case). Manual path is unchanged (`intro → skin → hair → eye →
metal → result`, still shows the 4-dot progress row) — `prepare` never
appears there.

**Prepare screen** (`PrepareStep`, defined inline in each screen next to
`IntroStep` — same duplication convention every other step component in
these two files already follows, so no new shared file): H1 "Three things
before we shoot.", three checklist rows (a 28px hairline-bordered circle with
a small `IconCheck` + one line of text each — bare face/no makeup, glasses
off+hair back, stand near a window), a caption, and a single `PrimaryButton`
("I'M READY") that calls `next()` to advance to `face-scan`. No step counter
on this screen (it's the only untimed step).

**Step counter**: `face-scan` and `wrist-scan` each gained a small overline
label above their existing white `scanTitle` — `personalColor_stepLabel`
("STEP 1 OF 2" / "STEP 2 OF 2") — same `type.ui`, dimmer
(`rgba(255,255,255,0.6)`), smaller (9px) than the title beneath it.

### 9b. Explicit failure states

Three previously-silent failure paths now render visible copy instead of
nothing:

1. **Camera permission denied** (onboarding `personal-color.tsx` only — the
   edit screen already surfaced an `Alert` on denial, so it was left as-is).
   `handleCameraStart` now tracks a `cameraDenied` boolean: when the request
   comes back denied and `canAskAgain` is still true, `IntroStep` renders
   `onboardingPersonalColor_cameraPermissionCaption` under the scan button;
   when `canAskAgain` is false, the same caption sits above the manual-only
   START button (both branches already existed — this only adds the text).
2. **Photo-read fallback** — when the camera path lands on the `skin` or
   `hair` question step because a scan didn't produce a confident auto-read,
   `SkinStep`/`HairStep` take a new `isFallback` prop (`path === 'camera'`)
   and render `onboardingPersonalColor_photoFallbackReason` as a small
   overline above the H1. Never shown on the manual path (there it's just
   the normal quiz, not a fallback).
3. **Save error** — `usePersonalColorDetection`'s `state.error` was already
   computed but never rendered. `ResultView` now takes a `saveError` prop
   (both screens pass the hook's `error` straight through) and renders
   `onboardingPersonalColor_saveErrorCaption` under the save button,
   re-tappable (`onPress={onSave}`) when present.

### 9c. AxisMeters (`src/features/personal-color/components/AxisMeters.tsx`)

The "de-black-boxing" element — makes the three continuous axes
(`ToneAxes` — warmth/value/chroma, each already computed by `computeAxes` and
carried on `result.axes`, no hook/math change needed to surface them) legible
without jargon. Three rows, each: small-caps end labels (negative end left,
positive end right — COOL↔WARM, DEEP↔LIGHT, SOFT↔CLEAR), a 1px hairline
track (`T.color.hairline`) spanning the row, and a 7px filled dot
(`T.color.primary`) positioned at `left = (clamp(axis,-1,1)+1)/2 * 100%`. A
caption below the three rows reads "These three axes decide your tone." No
animation, no gradients/shadows — mount-only render, same restraint as every
other element in this feature. Self-contained styles/i18n (own
`useTranslation` call), same independence pattern as `DrapeSession.tsx`.

### 9d. Result screen restructure — `ResultView.tsx`

`src/features/personal-color/components/ResultView.tsx` replaces the
duplicated `ResultStep` functions that used to live separately in
`app/(onboarding)/personal-color.tsx` and `app/personal-color-edit.tsx`. Both
screens now render the SAME component, parameterised only for what's
genuinely different: `saveLabel`/`savingLabel` ("SAVE TO PROFILE" vs "SAVE"),
`discardLabel` ("Continue without saving" vs "Discard changes"), and
`onSave`/`onDiscard` callbacks. Everything else — including the live
recompute on `setSkin`/`setHair`/`setEye`/`setMetal` — is identical between
the two contexts, driven by the same `usePersonalColorDetection` hook
instance each screen already owns.

New section order (was: 12-tone label → 4-season prose → NEUTRALS → CORE →
ACCENTS → season's edit → BETTER TO SKIP → BEYOND THE WARDROBE → detected
answers → refine → drape buttons):

1. **Hero** — 12-tone label, `LEANING {tone}` when present (unchanged), H1
   "Your season.", then a NEW per-tone one-liner
   (`tone12Desc_<tone>` in en.json/vi.json, resolved via `TONE12_DESC_KEY`
   in `tone12.ts` — a plain string-key mapping, not a math change) REPLACES
   the old 4-season `SEASON_DESC` prose here. `SEASON_DESC` itself is
   untouched in `colorSeasonData.ts` — `personal-color-edit.tsx`'s
   "CURRENT" season badge (shown on its `intro` step, not the result step)
   still reads it.
2. **AxisMeters** (§9c) — directly under the hero.
3. **WEAR THESE** (`onboardingPersonalColor_wearTheseLabel`) — the CORE 12
   swatches, promoted above the fold under their old bare "CORE" label.
4. **BETTER TO SKIP** — unchanged content, moved up to sit right after
   WEAR THESE (previously near the bottom, after NEUTRALS/CORE/ACCENTS).
5. Collapsible **FULL PALETTE** (`onboardingPersonalColor_fullPaletteLabel`,
   default collapsed): NEUTRALS row + a new caption ("Base colours — jeans,
   blazers, coats"), ACCENTS row + a new caption ("Accents — scarves, bags,
   small pieces"), then the existing "THIS SEASON'S EDIT · {season}" block
   moved inside (unchanged content/logic).
6. Collapsible **BEYOND THE WARDROBE** (default collapsed) — wraps the
   existing `BeyondTheWardrobeSection` unchanged, EXCEPT that component
   gained one new optional prop, `showLabel` (default `true`, so every other
   caller is unaffected) — `ResultView` passes `showLabel={false}` since the
   collapsible's own header already reads "BEYOND THE WARDROBE" and the
   component would otherwise repeat that exact label immediately below it.
7. Collapsible **ADJUST THE RESULT** (`onboardingPersonalColor_
   adjustResultLabel`, default collapsed) — houses what used to be two
   separate always-visible sections: "DETECTED FROM YOUR SCAN"/"YOUR
   ANSWERS" (skin/hair chips + AUTO tag + low-confidence caption) and
   "REFINE — OPTIONAL" (eye/metal chips). Picking a chip here still calls
   the same `setSkin`/`setHair`/`setEye`/`setMetal` callbacks from the hook,
   so `result` recomputes live exactly as before — only the visual location
   moved.
8. Buttons — drape CTA renamed from "REFINE WITH DRAPING" to "TRY COLOURS ON
   YOUR FACE — 30S" (same key, `onboardingPersonalColor_
   refineWithDrapingButton`, new copy; same `onStartDrape` behaviour); "SEE
   ALL 12 TONES" unchanged (vi copy tightened to "XEM CẢ 12 TONE"); low-
   confidence nudge / RESET DRAPING link unchanged; save/discard row now
   also renders the save-error caption (§9b.3).

**Collapsible sections**: a local `CollapsibleSection` component inside
`ResultView.tsx` — hairline top border, label + `IconChevronRight` rotated
90° when open, `LayoutAnimation.configureNext(LayoutAnimation.Presets.
easeInEaseOut)` on toggle (same idiom as `app/help.tsx`'s FAQ rows — no new
animation primitive introduced). All three default to collapsed.

### 9e. Other small copy/localisation fixes

- `onboardingColors_detectCaption` (the entry CTA on `app/(onboarding)/
  colors.tsx`) updated from the stale "4 questions · under a minute" to
  "Two photos · under a minute" — the flow has been camera-first since v3
  Phase A.
- `personalColor_scanButton` renamed "SCAN MY COLOURS" → "FIND MY COLOURS"
  (vi: "TÌM MÀU CỦA TÔI").
- `DrapeSession.tsx`'s 12-tone grid/compare labels (`TONE12_LABELS[tone].en`
  hard-coded) now resolve the active app language with an English fallback
  (`toneLabel()` helper) — no other drape copy changed, round prompts were
  already good per §7f.
