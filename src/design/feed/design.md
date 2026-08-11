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
  `PrimaryColor` names have a translated vocabulary as of 2026-08-11 — see
  "Colour tone i18n" below.

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

## Swipe-left "dismissed" gesture + `viewed` on open (feed-signals, 2026-08-07)

Two new behaviour signals feed the server taste vector (see `plan.md`'s
generate-outfits engine notes and `engine/taste.ts`). Neither changes the
card's visual composition when idle — both are interaction-triggered.

- **`viewed`.** Fired (fire-and-forget, errors swallowed) whenever the feed
  navigates into `/outfit/[id]` — the collage tap, the sparkle action button,
  "DETAILS →", and each item thumbnail all funnel through the same `openOutfit`
  handler in `app/(tabs)/index.tsx`. Never fired for demo/static outfits
  (`isDemo`) or from any other entry point into the outfit detail screen
  (saved list, builder) — those don't touch this handler.
- **Swipe-left gesture.** Implemented with React Native's built-in
  `PanResponder`, not `react-native-gesture-handler` — that package is listed
  only as a transitive optional peer dependency in this repo, not an actual
  direct dependency, and there's no `GestureHandlerRootView` anywhere, so
  treating it as "already available" (an earlier assumption) was wrong.
  `PanResponder`'s directional lock (`|dx| > |dy| × 1.5` before the move
  is captured) does the same job as gesture-handler's
  `activeOffsetX`/`failOffsetY` — plain taps and the FlatList's own vertical
  paging are unaffected; only a clearly-horizontal, clearly-leftward drag is
  claimed. `SWIPE_MIN_DX`/`SWIPE_DIRECTION_RATIO`/`DISMISS_THRESHOLD_FRACTION`
  constants live next to `FeedCardInner`.
- **Threshold + feedback.** Crossing 35% of the screen width leftward on
  release commits the dismiss: the WHOLE card (one `Animated.View`, not just
  the collage) fades to 0.35 opacity and a centered hairline `NOT MY STYLE` /
  `KHÔNG HỢP GU` label fades in, both driven by one 450ms `Animated.timing`
  (slow, no bounce — matches the app's motion language). Below the threshold,
  the card springs back to place over 250ms. No undo in v1 — once committed,
  the outfit stays excluded (`fitEngineStore.dismissedOutfitIds`, merged into
  `exclude_ids` and NOT flushed on the shown-ids cycle reset). The card is not
  removed from the currently-rendered list; ~400ms after commit the pager
  auto-`scrollToIndex`s to the next card instead, so a user who manually
  scrolls back up during that window still sees the fading state.
- **Save is a tap, not a swipe.** Contrary to an earlier assumption, there was
  no swipe-right-to-save gesture on this card before this change — save is
  the heart `ActionBtn` (`onToggleSave`). The swipe-hint copy reflects that:
  "Swipe left — not your style. Tap the heart to save." /
  "Vuốt trái — không hợp gu. Chạm tim để lưu lại."
- **First-time hint.** A quiet caption (`tabs_home_swipeHint`), same
  text-only treatment as the style-fallback hint above, shown once — on the
  first `HomeScreen` mount after this ships — then never again
  (`AsyncStorage` flag `feed-swipe-hint-seen`, written the moment it's shown).
  Not shown over demo outfits.

## Shape-goal chip made self-explanatory (010-wardrobe-critic follow-up, 2026-08-10)

The geometric-shape chip (`silhouetteShapeTag`, e.g. `HOURGLASS`) previously
rendered bare, indistinguishable at a glance from a colour name or a style
tag sitting right next to it on the same long meta line:

`STYLE · 15–22°C · OLD MONEY · STRAIGHT · HOURGLASS · NAVY · 4 items`

It now carries a translated label prefix, same casing/format as the rest of
the line:

`STYLE · 15–22°C · OLD MONEY · STRAIGHT · SHAPE: HOURGLASS · NAVY · 4 items`
(`DÁNG: ĐỒNG HỒ CÁT` in Vietnamese)

New i18n key `outfitShape_prefix` ("Shape" / "Dáng"). Applied identically in
both `app/(tabs)/index.tsx`'s `silhouetteShapeMetaLabel` (the card meta line)
and `useFitFeed.ts`'s `scoredToOutfit` (the `Outfit.tags` array, read by the
detail screen) — same string, same place in the reading order, no new visual
chrome (still plain uppercase text, no colour/background/shadow — luxury
minimalism per `CLAUDE.md`). The other tags on this line (`silhouette`,
`colorTone`, `styleTag`) are unchanged; only the shape chip gained a label,
since it was the one users had no way to interpret unprompted (a colour name
or style name is self-evident; "HOURGLASS" alone reads as ambiguous — a style
descriptor, not obviously "this is the body shape this outfit creates").

## Shape goal — user-set desired resulting silhouette (010-wardrobe-critic follow-up, 2026-08-10)

New screen `app/shape-goal-edit.tsx`, entered via a new row in
`app/(tabs)/profile.tsx`'s `SECTIONS` (`tabs_profile_shapeGoal`, between body
measurements and location/weather). Single-select list of 7 options, same
`optionRow`/`optionRowSelected`/`checkDot` primitive `personal-color-edit.tsx`
already uses for its skin/eye/metal steps (label + short description,
hairline underline when selected, no colour/shadow) — a dirty-check +
`PrimaryButton` save bar, same shape as `formulas-edit.tsx`, rather than
save-on-tap, so a stray tap can't silently change a standing preference:

- **Automatic** (default) — "Balances to flatter your shape" / "Cân đối theo
  dáng của bạn". Byte-for-byte the pre-feature behavior — see `plan.md`.
- **Keep my natural shape** — no shape correction, neutral garment volume.
- The 5 geometric shapes (`hourglass` / `rectangle` / `oval` /
  `inverted-triangle` / `triangle`), reusing the SAME `outfitShape_*` i18n
  labels the feed chip above already uses, so "Hourglass" reads identically
  everywhere in the app — plus a new one-line description per shape
  (`shapeGoal_*_desc`).

State lives in `fitEngineStore.shapeGoal` (`'auto' | 'natural' |
OutfitSilhouetteShape`), persisted server-side via
`styleProfileService`/`style_profiles.shape_goal` — same table/row and
hydrate/reset pattern as `formulaPreferences`/the 4 suggestion toggles. No
request-body wiring needed: `generate-outfits` reads the column directly off
`style_profiles` (already fetched with `select('*')`), same reasoning as the
suggestion toggles (see `plan.md`).

Engine side: a new cascade tier in `engine/silhouette.ts`'s
`resolveTargetSilhouette` (`intent > shapeGoal > style silhouette >
body_shape > neutral`) plus a small additive `shapeGoalDelta` in `ranking.ts`
that rewards outfits whose actual `resultingBodySilhouette` matches the goal.
Full reasoning and the `outfitWaistDefinition` fix that makes a `hourglass`
goal reachable for non-hourglass body shapes: `plan.md`.

## Collage item z-order: outer → mid → inner (2026-08-10)

`Collage.tsx`'s visual stacking of secondary items (everything on the card
besides the anchor bottom/dress and shoes/bag accessories) now follows the
garment's layer role, front-to-back: **outer shell → mid layer → base/inner
top → anything unclassified**. This keeps the card in sync with the engine's
`mid` slot (a hoodie/sweater/cardigan/knit/vest/kimono worn under a true
outer, e.g. a blazer over a thin hoodie) — before this fix those mid-layer
types had no z-order bucket at all and rendered LAST (behind the base layer),
which read backwards once outfits with a real `mid` slot started appearing.

No new chrome — same absolute-position zone layout as before, only the
ordering that feeds it changed. The classification sets
(`OUTER_TOPS`/`MID_TOPS`/`INNER_TOPS`) live in
`src/components/outfit/collageLayout.ts` and are a manually-synced duplicate
of the engine's `LAYER_ROLE_BY_TYPE`
(`supabase/functions/generate-outfits/engine/enrichment.ts`) — see that
file's comment before changing either side. Full rationale (including why
`KIMONO` was moved to the mid group to match the engine) is in `plan.md`.

## Demo-feed label for empty-wardrobe users (2026-08-11, merged same day)

A brand-new user with an empty wardrobe sees `app/(tabs)/index.tsx`'s 2
curated `DEMO_OUTFITS` (`OUTFITS.slice(0, 2)`, T022 —
`specs/001-app-baseline/tasks.md`) instead of an empty feed — they're someone
else's pre-built outfits from the 32-item mock catalog in `src/data`, shown
so a first-time user immediately sees what the app can do.

An earlier pass this same day briefly split this into two separate
indicators (a header-strip hint plus T022's existing bottom-card banner),
which turned out to say close to the same thing from two places with two
different destinations (header → `/add-item`; T022 banner → the Wardrobe
tab). Consolidated back to **one** indicator: T022's sticky banner at the
bottom of the demo card, position and CTA-button structure unchanged,
carrying updated copy that states plainly these aren't the user's own
clothes:

- **Placement (unchanged from T022).** Sticky to the bottom of the active
  demo card (`styles.demoBanner`), only rendered while that card is active
  (`isDemo && active`) — the spot the user's thumb is already near, with a
  real tappable CTA button, not just a passive header line.
- **Style (unchanged from T022).** Hairline top border, `T.color.canvas`
  background, serif-light body text (`demoBannerText`) plus a small
  uppercase CTA line (`demoBannerCta`, `type.ui` at 10px,
  `T.color.primary`) — no color beyond existing tokens, no icon, no
  pill/background, no border-radius, no shadow.
- **Copy.** `tabs_home_demoBannerText` — "Styled example, not your
  wardrobe" / "Ví dụ minh họa, chưa phải đồ của bạn" — states plainly these
  are example outfits, not the user's own. `tabs_home_demoBannerCta` —
  "ADD YOUR FIRST PIECE →" / "THÊM MÓN ĐẦU TIÊN →".
- **CTA destination.** Tapping anywhere on the banner (`onAddItems`) now
  routes to `/add-item` — the exact route `app/build.tsx`'s own
  empty-wardrobe CTA uses (`router.push('/add-item' as any)`). Previously
  routed to the Wardrobe tab; changed so both empty-wardrobe entry points
  in the app land the user on the same next step.
- **Gating (unchanged from T022).** Shown only while `isDemo`
  (`wardrobeItems.length === 0`) and only on the currently-active card.
  Disappears entirely the moment the user has any wardrobe item.

The separate header-strip hint (`tabs_home_demoHint`, `topOverlay`) from the
earlier pass is removed — no second indicator, no orphaned i18n key. No
changes to `isDemo`'s definition, the demo outfit count, or any
engine/scoring logic.

## Share sheet anchored on iPad (2026-08-11)

Both share entry points (`app/(tabs)/index.tsx`'s feed card `ActionBtn` and
`app/outfit/[id].tsx`'s detail-screen share icon) called `Share.share(...)`
with no `anchor` — a `backlog.md` item from 2026-07-22. On iPad the share
popover has no button to point at, so it appeared from an arbitrary default
corner of the screen instead of the tapped icon.

No new visual chrome; this is purely wiring an anchor onto UI that already
existed:

- **Feed card.** `ActionBtn` (the small pill wrapping each of the feed
  card's action icons — heart, sparkle, share) converted from a plain
  function component to `React.forwardRef<View, ...>` so it can expose a
  ref on its underlying `Pressable`. The share button's `ActionBtn` takes a
  new `shareBtnRef`; `findNodeHandle(shareBtnRef.current)` is resolved at
  tap time and passed as `Share.share({ message }, { anchor })` — falls
  back to no `anchor` option at all if the handle doesn't resolve (never
  passes a bad value).
- **Outfit detail.** Same pattern: a new `shareBtnRef` on the detail
  screen's existing share `Pressable` (`styles.iconBtn`), same
  `findNodeHandle` + conditional `anchor` at tap time.

iPhone/Android are unaffected — the `anchor` option is iPad-only in
`Share.share`'s platform contract (iPhone's share sheet is a bottom sheet
with no anchor concept).

## Colour tone i18n (2026-08-11)

RESOLVED (`backlog.md` 2026-07-12 item): the feed card's colour-tone tag
(`colorToneTag`, see "Silhouette + colour tags" above) previously rendered
the raw `PrimaryColor` enum value upper-cased in both locales (e.g. `OLIVE`,
`BURGUNDY`) — a Vietnamese-locale user saw English colour names. `PrimaryColor`
(`src/types/fitEngine.ts`, mirrored in
`supabase/functions/generate-outfits/engine/types.ts`) currently has **37**
values (it grew by +11 in an earlier session — see that type's inline
comment); the "~37" figure in the old backlog text was already approximate,
not a hard count to trust.

New i18n namespace, one key per `PrimaryColor` value, same
`colorTone_<value>` shape as the existing `outfitSilhouette_*`/`outfitShape_*`
sets: `colorTone_black`, `colorTone_white`, `colorTone_navy`, `colorTone_beige`,
`colorTone_gray`, `colorTone_brown`, `colorTone_olive`, `colorTone_blue`,
`colorTone_red`, `colorTone_purple`, `colorTone_green`, `colorTone_yellow`,
`colorTone_pink`, `colorTone_orange`, `colorTone_cream`, `colorTone_ivory`,
`colorTone_camel`, `colorTone_tan`, `colorTone_taupe`, `colorTone_khaki`,
`colorTone_charcoal`, `colorTone_burgundy`, `colorTone_teal`,
`colorTone_metallic`, `colorTone_multicolor`, `colorTone_natural`,
`colorTone_mustard`, `colorTone_rust`, `colorTone_coral`, `colorTone_mint`,
`colorTone_lavender`, `colorTone_sage`, `colorTone_terracotta`,
`colorTone_mauve`, `colorTone_wine`, `colorTone_fuchsia`, `colorTone_denim`.
EN values are the plain sentence-case colour name (`"Black"`, `"Burgundy"`,
`"Terracotta"`...) — capitalization is NOT baked in, since the render path
still upper-cases at display time (see below), same convention as
`outfitShape_*`. VI values are natural, commonly-written Vietnamese colour
names (`"đỏ booc-đô"`, `"xanh ô liu"`, `"xanh cổ vịt"` for teal, `"đất nung"`
for terracotta...); a handful of loanwords Vietnamese fashion retail
normally keeps as-is are kept (`"Kaki"` for khaki, `"Denim"` for denim,
`"Xanh navy"` for navy) rather than forced into an awkward literal
translation.

`app/(tabs)/index.tsx`'s `colorToneMetaLabel` now takes `t` and resolves the
enum value through a `COLOR_TONE_I18N_KEYS` lookup map (same pattern as
`SILHOUETTE_I18N_KEYS`/`SHAPE_I18N_KEYS` above), then upper-cases the
translated string — visually identical output to before for every value that
existed at ship time, in both locales. **Fail-soft**: a `colorTone` value
with no entry in the map (a future `PrimaryColor` addition that lands before
its i18n key does) falls back to the raw upper-cased value — today's old
behaviour — rather than ever rendering a raw i18n key string to the user.

No other call site in the app renders a `PrimaryColor`/colour-tone value
raw-uppercased — grepped for `primaryColor`/`colorTone` usage; the only other
user-facing colour text is `app/item/[id].tsx`'s `colorText` (wardrobe item
detail attribute row), which renders `WardrobeItem.colors` — a free-form,
user-entered string array, not the `PrimaryColor` enum — already in natural
case, not upper-cased. Left alone; it's a different data shape and a
different design question, not a mechanical swap onto these new keys.

## Collage flow layout — hierarchy & fit-to-frame (2026-08-12)

`src/components/outfit/collageLayout.ts`'s `buildLayout` replaced the old
static-zone collage (fixed `ANCHOR_ZONE`/`SEC_ZONES`/`ACC_ZONES` lookup
tables, one fixed arrangement per item count) with a flow layout that
enforces a strict visual hierarchy across three priority tiers:

- **#1 anchor** — the bottom/one-piece item (dress, trousers, jeans, skirt…)
  is always the BIGGEST item on the card: left side, top-aligned. When the
  outfit has an anchor but zero secondaries, the anchor is horizontally
  centered on the card instead (no column to share the row with), and the
  accessory row(s) below it are centered on the anchor's own horizontal
  centerline either way, so they always read as attached to it rather than
  floating loose.
- **#2 secondaries** — tops/outerwear form a column to the anchor's right,
  each smaller than the anchor, stacked downward starting at the anchor's
  top Y (so the anchor and the first secondary always begin at the same
  height), ordered outer → mid → inner as before.
- **#3 accessories/shoes** — the smallest tier, laid out in row(s) below the
  lowest bottom edge of the anchor+secondaries. Each row is centered on the
  anchor's horizontal centerline (clamped so it never spills past the frame
  margins — not left-aligned or evenly-spread across the full width; a lone
  shoe pair used to land dead-center of the whole card and read as
  detached from the outfit above it), items packed left→right within the
  row with a fixed gap between them. A row wraps onto a new row once the
  next item wouldn't fit on the current line — no more hard cap of 3
  accessories; up to 8 are laid out.

The whole composition is then **scaled down to fit** the items area (about
its horizontal center line) if it overflows vertically, and **vertically
centered** if it underflows — so both a sparse 2-item outfit and a heavy
9-item outfit read as a deliberate composition rather than clipped or
floating in a corner.

Sizing is computed in "width units" (1 wu = 1% of the items-area width); the
area's real aspect ratio (`areaAspect = width / height`, measured via
`onLayout` on the items-area `View` in `Collage.tsx`) converts wu to a
vertical axis (`H = 100 / areaAspect`) before layout math runs, so the
composition adapts to the actual pixel shape of the card rather than
assuming a fixed ratio. `Collage.tsx` passes `areaAspect` (`undefined` until
the first layout pass, which falls back to `buildLayout`'s default) into
`buildLayout`, included in the `useMemo` deps that already track
`outfit.itemIds`/`wardrobeById`.

All layout constants (gaps, column bounds, per-tier max size fractions) live
in one exported `COLLAGE` object in `collageLayout.ts` rather than the old
per-count zone tables. `collageLayout.ts` keeps its zero-React-Native-import
constraint (type-only imports only) so it stays testable from plain
ts-jest/node — see `__tests__/collageLayout.test.ts`'s `buildLayout — flow
layout hierarchy` block for the anchor/secondary/accessory ordering and
fit-to-frame assertions.

### Measured content-bounds crop for real wardrobe photos (2026-08-12)

A real DB-backed wardrobe photo (e.g. a phone shot of a pair of jeans) rides
inside whatever frame the user photographed — large empty background
margins, an arbitrary bitmap aspect — where a curated catalog PNG is already
a tight crop of just the garment. Sizing the collage box from the static
`ASPECT` table and rendering with `resizeMode="contain"` meant a real photo's
actual garment shrank to fit around its own margins, reading noticeably
smaller than catalog art in the same slot. Fixed at the root: the garment's
tight content bounds are now measured on-device, once per photo, and both
the layout sizing and the rendered crop use that measurement instead.

- **Measurement.** `src/features/wardrobe-photos/contentBounds.ts` (pure,
  jest-testable, same zero-RN-import discipline as `collageLayout.ts`)
  estimates the photo's background colour from its border-pixel median, then
  finds the bounding box of pixels that differ from it by more than a
  Manhattan-RGB threshold. `contentBoundsUri.ts` wraps it for a real `uri`
  (expo-image-manipulator downscale → jpeg-js decode, same pipeline as the
  dominant-colour reader in `wardrobe-add/colorClusterUri.ts`) and
  session-caches the result per uri, since feed cards remount constantly as
  the pager scrolls.
- **Fallback to null everywhere.** An unusable measurement — too little
  content (noise), a box already filling ≥96% of both dimensions (nothing
  to gain from cropping, or a busy non-plain background), or an implausibly
  thin box — resolves to `null`, not a bad guess. Bundled catalog art (a
  `png` require-asset, or an `asset:<key>` reference) is never measured at
  all — it's already tight. Every consumer treats `null` as "render exactly
  like before this existed": the static `ASPECT[type]` fallback for sizing,
  `resizeMode="contain"` for rendering.
- **Layout.** `collageLayout.ts`'s `Entry.aspect` (optional) carries the
  measured aspect through to `buildLayout`, which now resolves every item's
  aspect as `entry.aspect ?? ASPECT[type] ?? <fallback>` at all three tiers
  (anchor/secondary/accessory) — a garment with a wide measured aspect gets
  a wide box, sized correctly instead of guessed from its coarse type.
- **Rendering.** `Collage.tsx`'s `CollageSlot` still falls back to the old
  `resizeMode="contain"` `<Image>` when there's no measurement. With one,
  the slot `View` clips (`overflow: hidden`) and an absolutely-positioned
  `<Image resizeMode="stretch">` inside it is scaled/offset so only the
  measured rect fills the slot — since the slot was already sized to the
  measured aspect, this crops out the background margin with no distortion.
  A small local hook, `useEntryAspects`, resolves each entry's photo source
  and runs the measurement per outfit card, keyed by item id.
