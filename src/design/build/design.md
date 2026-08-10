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

## Catch-all bucket relabeled BAGS → ACCESSORIES (2026-08-11)

`assignBucketKey` (`src/features/wardrobe-build/toBuilderItem.ts`) is a total function by
design — a wardrobe item whose granular `type` isn't in any `BUILDER_BUCKETS` entry still
must appear somewhere in the picker, never silently drop out. That catch-all bucket used
to be literally named `'BAGS'` (`types: ['BAG']`), so headwear items (`category:
'headwear'` → `type: 'CAP'`, per `CATEGORY_TYPE` in `collageLayout.ts`) rendered under a
category strip labeled "BAGS" — same correct *behavior*, wrong *label*, confusing for
anyone with a hat/cap in their wardrobe.

Renamed the bucket key to `'ACCESSORIES'` — a bag reads as an accessory, so the existing
catch-all just needed a name that's true for everything that lands in it (headwear,
belts, scarves, ties, sunglasses, rings, bracelets — none of which have their own
`BUILDER_BUCKETS` entry today), rather than adding a second dedicated bucket. No visual
change beyond the label text and its i18n key (`build_bucketBags` → the correctly-named
`build_bucketAccessories`, "ACCESSORIES" / "PHỤ KIỆN") — same `CategoryStrip` component,
same tile grid, same optional-in-shuffle treatment (was `b.key === 'BAGS'`, now
`b.key === 'ACCESSORIES'`, in `generateOutfits`'s `optional` check).

`BUILDER_BUCKETS`/`BUILDER_FALLBACK_BUCKET`/`BUCKET_LABEL_KEYS` moved out of
`app/build.tsx` into `src/features/wardrobe-build/buckets.ts` so the totality guarantee
(every type resolves to a bucket, nothing vanishes) is asserted directly in a Jest test
against the real config, not just a fixture — see
`src/features/wardrobe-build/__tests__/buckets.test.ts`.
