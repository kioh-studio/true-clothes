# Build an Outfit — Design Notes

## Real wardrobe, empty state (2026-08-10)

`app/build.tsx` now composes outfits from the user's own wardrobe
(`wardrobeItems`, adapted via `src/features/wardrobe-build/`), not the
bundled 32-item demo catalog. When the wardrobe has no items yet, the screen
shows a dedicated empty state instead of an empty picker area — never a
silent fallback to demo clothes:

- **Header** — back chevron stays; the shuffle icon is replaced by an
  invisible spacer of the same size (keeps the title centered), since there
  is nothing to shuffle.
- **Canvas** — the existing "empty canvas" treatment (dashed icon square),
  with a wardrobe-specific label (`build_emptyWardrobeCanvasLabel`,
  "NOTHING TO BUILD WITH YET") instead of the generic "pick items below"
  hint, since there is nothing below to pick.
- **Picker area** — replaces the category strips with a centered block:
  serif title (`build_emptyWardrobeTitle`), caption
  (`build_emptyWardrobeCaption`), and a `PrimaryButton` CTA
  (`build_emptyWardrobeCta`) that navigates to `/add-item`. Same visual
  pattern as `app/(tabs)/wardrobe.tsx`'s own empty state (icon-less variant —
  the canvas above already carries the icon).
- **Suggest CTA row / Save row** — hidden entirely (nothing to suggest from,
  nothing to save).

Luxury-minimalism constraints unchanged: no new iconography beyond the
existing hairline set, same type scale (`type.h2`/`type.caption`), same
`PrimaryButton` treatment as every other empty state in the app.

## Item tiles resolve real photos (2026-08-10)

Builder tiles (`BuilderTile`) and the "Suggest outfits" sheet's anchor
thumbnails now resolve item photos through the existing `useItemPhoto` hook
(`src/features/wardrobe-photos/`) — the same resolver `app/(tabs)/wardrobe.tsx`
and `Collage.tsx` already use for local/cloud/bundled photos — instead of a
bundled `png` require() asset. Loading/missing states fall back to the
type-label text tile that already existed, no new visual treatment.
