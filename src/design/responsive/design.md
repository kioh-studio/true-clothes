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
  and the welcome screen's brand/CTA block (not its full-bleed hero photo).
- Outfit detail (content below the hero — breakdown/tags/items; the hero
  itself is capped separately, see below), item detail, outfit builder,
  profile, settings.

It does **not** wrap full-bleed backgrounds, sticky nav/headers, the bottom
tab bar, or FABs — only the scrolling content column itself. Grid screens
already made responsive via adaptive columns (see above) are intentionally
left unwrapped, since a 640pt cap would fight the grid's own tablet-width
scaling.

## Capped media width

`MEDIA_MAX` (520pt) bounds full-bleed photo/collage content that would
otherwise stretch into a very wide, sparse image on a large tablet:

- Home feed card (`app/(tabs)/index.tsx`): the outfit collage and the meta
  block beneath it (style/tags/thumbnails) are each centered at `MEDIA_MAX`
  inside the still-full-bleed card background.
- Outfit detail hero (`app/outfit/[id].tsx`): hero width is
  `Math.min(windowWidth, MEDIA_MAX)`, height keeps the original 5:4 aspect
  ratio off that capped width, and the hero is centered.

## Files

- `src/design/layout.ts` — `BP`, `useResponsive`, `useGridColumns`,
  `useGridCardWidth`, `CONTENT_MAX`, `MEDIA_MAX`.
- `src/components/ui/Bounded.tsx` — the bounded/centered column primitive.
