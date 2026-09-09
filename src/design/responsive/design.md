# Responsive layout — phone to iPad Pro 13"

## Scope

Portrait-only. iPad support (`ios.supportsTablet: true` in app.json) means the
app now runs full-screen on iPad instead of iPhone-compatibility-mode letterboxed,
but there is **no landscape support and no master-detail layout** — every screen
keeps its existing single-column information architecture, just scaled and
bounded for wider portrait viewports. Landscape orientation is explicitly out of
scope (see backlog.md).

## Breakpoints

`src/design/layout.ts` exports `BP = { tablet: 600, tabletLg: 1024 }` (portrait
width, pt). Reference devices: iPad mini ~744, iPad 10.9 ~820, iPad Pro 11 ~834,
iPad Pro 13 ~1024.

```
phone:     width < 600
tablet:    600 <= width < 1024
tabletLg:  width >= 1024
```

`useResponsive()` reads live `useWindowDimensions()` and returns `{ width,
height, bp, isTablet }` — never a module-level `Dimensions.get()` snapshot, so
it stays correct across resize, split-screen, and foldables (same rule the
rest of the app already followed).

## Adaptive grid columns

`useGridColumns(phone = 2, tablet = 3, tabletLg = 4)` maps the current
breakpoint to a column count. Used by every item/outfit grid screen so cards
don't get stuck at a fixed 2-up on a 1024pt-wide screen:

- Default 2 / 3 / 4 mapping: wardrobe grid, collections grid + add-items
  picker, saved outfits, schedule's outfit picker, worn history, style
  preference editor (styles-edit.tsx).
- Colour-swatch grid (onboarding colours.tsx) uses `useGridColumns(3, 4, 5)`
  instead — swatches are small enough that the default mapping would make
  them oversized on tablet.

`useGridCardWidth(cols, pad, gap)` derives a card's pixel width from the
column count, `useWindowDimensions()`, and the screen's own padding/gutter
values — clamped so cards never get absurd on very wide screens
(`Math.min(width, CONTENT_MAX * 2)`).

FlatList grids (wardrobe, collections add-items picker) additionally need
`key={`grid-${cols}`}` on the `<FlatList>` — React Native requires a full
remount when `numColumns` changes at runtime (e.g. iPad split-screen resize),
otherwise it throws.

## Bounded content columns

`<Bounded>` (`src/components/ui/Bounded.tsx`) centers its children at
`CONTENT_MAX` (640pt) on wide screens and is full-width on phones — the same
idea as a max-width reading column on the web. Wraps the primary scrolling
content column (forms, text, item-detail rows, settings lists) on:

- Onboarding: basics (personal info), measurements, style quiz, complete,
  account, location, OTP, wardrobe intro (text/CTA block only — the closet
  illustration stays full-bleed), personal colour (step content only), and the
  welcome screen's brand/CTA block (not its full-bleed hero photo).
- Outfit detail (content below the hero — breakdown/tags/items; the hero
  itself is sized separately, see below), item detail, outfit builder,
  profile, settings.
- Edit screens: formulas, measurements, item, profile, shape goal, personal
  colour.
- Utility screens: help, notifications, paywall, wardrobe report, try-on wear,
  measurements scan (guidance/message blocks only).
- Add-to-wardrobe wizard (`src/features/wardrobe-add/components/`): the
  stepper (`AddWizard`'s header stays full-bleed) and each step's content —
  upload, processing, review, done. `MethodChooser`'s bottom sheet is capped
  via `width/maxWidth/alignSelf` on its `sheet` style instead of `<Bounded>`,
  since it isn't a scrolling content column.
- Try-on scan and result screens (`src/features/try-on/components/`):
  `ScanScreen` (content below the close button) and `ResultScreen` (body +
  sticky decide bar). `MatchFeedCard`'s bottom meta strip is likewise capped
  via style props on `styles.meta`, not `<Bounded>`. The Mix & Match feed
  itself (`MixMatchFeed`) stays full-bleed, same as the home feed — only its
  bottom "back to result" bar is bounded.

Screens with a **sticky footer CTA** wrap the footer's *inner* row in `Bounded`
and leave the footer `View` itself full-bleed, so the bar still spans the screen
while the button stops at 640. Where the footer style carried
`flexDirection: 'row'` those props moved onto the `Bounded` — `alignSelf:
'center'` centres on the cross axis, so inside a row-flex parent it would
otherwise centre vertically instead of horizontally.

**Anything inside a `Bounded` must size off the bounded width, not the window.**
`useWindowDimensions()` still reports 1024 on an iPad while the column is 640, so
components that compute tile widths take `Math.min(width, CONTENT_MAX)` at the
call site (personal-colour intro + hair steps in both the onboarding and edit
flows).

It does **not** wrap full-bleed backgrounds, sticky nav/headers, the bottom
tab bar, or FABs — only the scrolling content column itself. Grid screens
already made responsive via adaptive columns (see above) are intentionally
left unwrapped, since a 640pt cap would fight the grid's own tablet-width
scaling.

## Media sizing — no fixed pt cap (2026-09-08)

`MEDIA_MAX` (a hard 520pt) is **gone**. It left the feed's outfit collage as a
narrow strip stranded in dead space on a 1024pt-wide iPad. Media is now sized
from the viewport it lives in:

- **Home feed card** (`app/(tabs)/index.tsx`): the collage is **full-bleed at
  every width** — each card owns the whole screen, TikTok-style, and the collage
  slots are percentage-based so they simply widen (item photos keep their own
  measured aspect inside their slot; nothing stretches). Only the bottom meta
  block (stylist note / tags / thumbnails) stays centered, now at `CONTENT_MAX`
  (640) so a one-line meta row doesn't span 1024pt end to end.
- **Outfit detail hero** (`app/outfit/[id].tsx`): full-bleed in width, height is
  a **share of the viewport** — `HERO_H = winH * 0.58`. No aspect ratio, no pt
  cap: the hero occupies the same proportion of the screen on every device
  (iPhone 15 393 × 494, iPhone SE 375 × 387, iPad Pro 13 1024 × 792), which is
  what a fixed 4:5 portrait could not do — it made the hero dominate a phone and
  shrink into dead space on a tablet. 0.58 is what the old phone hero already
  worked out to (491 / 852). The collage lays out on percentage slots, so it
  simply fills whatever box it is given.
- **Item detail hero** (`app/item/[id].tsx`): same rule — moved *out* of
  `<Bounded>` and given `height: winH * 0.58` instead of a 4:5 box capped at
  `CONTENT_MAX`. Inside `Bounded` it sat at 640 × 800 on an iPad Pro, leaving
  the photo stranded with 190pt of empty canvas either side. The image is
  `resizeMode="contain"`, so widening the box never crops or stretches it.

Card art inside **grids** (wardrobe, saved, history, schedule, builder, try-on
match cards) keeps its fixed `aspectRatio` — a grid card's width already comes
from the column count, so the aspect is what keeps rows even. The camera and
processing previews (`ScanScreen`, `ProcessingStep`, `ItemOnWhite`, the
`CameraView` + pose overlay in measurements-scan, `FaceScanStep`/`WristScanStep`,
and try-on's `photoZone`) keep theirs too: those match the capture/model aspect,
and forcing a viewport share would just letterbox them.

`DrapeSession`'s 12-tone grid is the one full-screen grid outside the tab
screens: it now uses `useGridColumns(3, 4, 4)` + `useGridCardWidth(cols,
GRID_PAD, GRID_GAP)`. At three fixed columns off a 1024pt screen each swatch came
out 320pt and the four rows ran off the bottom of the iPad.

## Files

- `src/design/layout.ts` — `BP`, `useResponsive`, `useGridColumns`,
  `useGridCardWidth`, `CONTENT_MAX`.
- `src/components/ui/Bounded.tsx` — the bounded/centered column primitive.
