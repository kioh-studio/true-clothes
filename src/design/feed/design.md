# Feed — Design Notes

## Story briefs on outfit cards (S3, 2026-07-03)

The engine groups each day's feed into 2–3 **story briefs** by outfit register:
`REFINED` (avg formality ≥ 3.2) · `EVERYDAY` (in between) · `OFF DUTY` (≤ 2.4).
Which story leads rotates daily; **order inside a story is the stylist ranking
and is never shuffled**.

### Card presentation

- The card kicker (subtitle under the editorial title in `Collage.tsx`) reads
  `story · style`, lowercase — e.g. `refined · smart casual`, `off duty ·
  minimalist`. Falls back to the legacy `style · adjective` subtitle when the
  response carries no story (older cache).
- The story also replaces `DAILY` in `Outfit.context` and in the detail-screen
  tag row (`22°C / REFINED / HIGH-LOW`).
- No new UI chrome: same type scale, same hairline aesthetic — the story is a
  label change, not a new component. Section dividers/headers between stories
  are a possible future refinement (would need pager-aware sticky labels).

Consumed from `ScoredOutfit.story` (optional string) via `useFitFeed.
scoredToOutfit`. Engine-side grouping documented in `plan.md` (2026-07-03).

## Styling tip line on the card (Way to Wear Phase B, 2026-07-03)

When the engine returns `stylingTips` (max 2, deterministic, both locales
inline), the feed hook resolves one — `stylingTips[0]`, locale-picked (`.vi`
when `i18n.language` starts with `vi`, else `.en`) — onto `Outfit.stylingTip`.

`Collage.tsx` renders it as a third line under the subtitle, only when
`showTitle` and the tip is present: lowercase, 11px sans, letter-spaced,
`T.color.tertiary` (same muted tone as the subtitle), single line with
ellipsis. No new chrome. `titleBlockH` gains +16px only when the tip is
rendered, keeping `itemsTop` correct for cards without a tip.

The real weather band (`ScoredOutfit.weatherBand`) now drives `Outfit.weather`
and the first feed tag, replacing the previous hardcoded `22°C`; falls back to
`22°C` for older cached responses without the field.

## Silhouette + colour tags on the card meta line (2026-07-12)

Two new **display-only** tags — no scoring impact — are appended to the card
meta line (`app/(tabs)/index.tsx`, `metaStyle` text) after the weather segment
and before the item count, each only rendered when present:

`STYLE · 15–22°C · STRAIGHT · NAVY · 4 items`

- **Silhouette** (`ScoredOutfit.silhouette`) — which target silhouette the
  engine built the outfit toward (`engine/silhouette.ts` `outfitSilhouetteTag`).
  Vocabulary: `fitted` · `straight` · `relaxed` · `top-volume` · `bottom-volume`,
  translated via i18n keys `outfitSilhouette_fitted` / `_straight` / `_relaxed`
  / `_topVolume` / `_bottomVolume` and uppercased to match the existing
  `style`/`weather` casing.
- **Colour tone** (`ScoredOutfit.colorTone`) — the outfit's dominant (anchor)
  colour, mirroring the "loudest piece leads" anchor rule in `generation.ts`
  (highest `statementStrength`, id tie-break; shoes/accessories excluded).
  `PrimaryColor` names (~37 values) have no translated vocabulary yet — shown
  capitalized/uppercased in both locales for now (see `backlog.md`).

Both fields are optional (absent on older cached responses / static demo
outfits), so each meta-line segment is only appended when present. Piped
through `useFitFeed.scoredToOutfit` onto `Outfit.silhouette` / `Outfit.colorTone`.

## Parallel geometric-shape tag (2026-07-12)

Added a second **display-only** tag, `ScoredOutfit.silhouetteShape`, shown as
an extra chip immediately AFTER the existing silhouette segment — both tags
are kept, neither replaces the other:

`STYLE · 15–22°C · STRAIGHT · RECTANGLE · NAVY · 4 items`

Translated via i18n keys `outfitShape_hourglass` / `_rectangle` / `_oval` /
`_invertedTriangle` / `_triangle`, uppercased like the other meta-line tags.
Optional/absent on older cached responses; no scoring impact.

### `silhouetteShape` redefined: resulting on-body silhouette (2026-07-12)

`silhouetteShape` no longer relabels `silhouette` 1-to-1. `silhouette` stays a
pure **garment-volume** description of the outfit itself (unchanged — read
from the outfit's own top/bottom volumes via `engine/silhouette.ts`
`outfitSilhouetteTag`).

`silhouetteShape` now models the geometric silhouette the **user's body**
reads as *after putting the outfit on*: it starts from the user's `body_shape`
baseline (a coarse top/bottom width pair, or a neutral 3/3 column when
`body_shape` is unknown/suppressed under body-neutral mode) and shifts it by
how much volume the garments add over a neutral piece — a voluminous top
widens the top read, a voluminous bottom widens the bottom read, worn
outerwear counts toward the top read. Computed by `engine/silhouette.ts`
`resultingBodySilhouette(items, bodyShape)`. Vocabulary unchanged: `hourglass`
· `rectangle` · `oval` · `inverted-triangle` · `triangle`. Still display-only,
no scoring impact.

## Wardrobe-affinity style fallback tag on the card meta line (2026-08-02)

A third display-only tag, `ScoredOutfit.styleTag`, is appended to the meta
line, positioned BEFORE the silhouette segment (style identity outranks
silhouette in the reading order):

`STYLE · 15–22°C · OLD MONEY · STRAIGHT · RECTANGLE · NAVY · 4 items`

Only present when the user had no selected styles and the server's wardrobe-
affinity style fallback fired (`generate-outfits` auto-picked fallback styles
from wardrobe coverage — see `plan.md` "Wardrobe-affinity style fallback in
generate-outfits (2026-08-02)"); `undefined` otherwise, same as the other
optional meta tags. Unlike silhouette/shape/colour, the value is a proper
noun style name (e.g. "Old Money", "Streetwear") straight from the server —
no i18n lookup, rendered as-is and uppercased to match the casing of the
neighbouring tags on this line. Consumed from `ScoredOutfit.styleTag` via
`useFitFeed.scoredToOutfit` onto `Outfit.styleTag`, and also included in the
feed's `tags` array (before the silhouette tag).

### Top-level style-fallback feed hint (2026-08-02)

The response envelope's `style_fallback: { applied, styles }` (typed as
`GenerateOutfitsResponse` in `src/types/fitEngine.ts`) is now surfaced as a
quiet, text-only hint on the home feed (`app/(tabs)/index.tsx`), separate from
the per-outfit `styleTag` chip above.

- **Trigger.** `fitEngineStore.styleFallback` (`Array<{ id, name }> | null`)
  is set from `response.style_fallback?.styles ?? null` on the two feed-
  facing call sites — `fetchOutfits` (initial/refresh) and `fetchMoreOutfits`
  (pagination) — and reset to `null` on `reset()` (sign-out). Mix & Match
  (`fetchMixMatchOutfits`) never touches it: that flow pins a scanned item and
  searches the whole wardrobe around it, not the daily feed. Ephemeral —
  matches the store's convention for other display-only server state
  (`outfits`, `feedError`): not persisted to `AsyncStorage`.
- **Placement.** Inside `topOverlay`, directly below the brand/weather row —
  the same absolutely-positioned header strip the error banner and weather
  label live in. Rendered only when `styleFallback` is non-null and
  non-empty. Text-only, no pill/banner background, no icon, no shadow —
  `type.micro` at 10px in `T.color.tertiary`, matching `weatherLabel`'s
  styling exactly (same size/weight/colour token), single line with
  ellipsis (`numberOfLines={1}`).
- **Copy.** `{t('tabs_home_styleFallbackHint')} — {styles.map(s =>
  s.name).join(' · ')}` — e.g. "Style gợi ý từ tủ đồ của bạn — Old Money ·
  Streetwear". The prefix is localized (`tabs_home_styleFallbackHint` in
  `en.json`/`vi.json`); the style names are appended programmatically as-is
  (proper nouns, no i18n), matching how `styleTag` is rendered on the card.
- **Tap action.** Navigates to `/styles-edit` (same route
  `profile.tsx`/`ScanScreen.tsx` use for style preferences). No dismiss
  control — the hint disappears on its own once the user picks real styles,
  because the server stops firing the fallback once `selectedStyles` is
  non-empty.
