# Style Catalog — Visual & Interaction Spec

Covers `app/(onboarding)/styles.tsx` (first-run style pick) and `app/styles-edit.tsx`
(Style Preferences edit screen). Both render the same underlying style catalog; this
doc is shared between them since their grid/card/niche behavior is identical.

Per Constitution I (Luxury Minimalist Design): near-monochrome canvas, hairline
strokes, no gradients/shadows beyond the existing subtle bottom-scrim on cards.

## Catalog size: 8 → 22 (2026-08-10)

The style catalog grew from 8 styles to 22 (14 added — see plan.md "Style catalog
expansion" for the full list and reasoning). No layout change was needed:

- **Grid**: `styles.tsx`'s `styles.grid` is a `flexDirection: 'row', flexWrap: 'wrap'`
  layout inside a `ScrollView` — already unbounded in item count. `styles-edit.tsx`'s
  grid is the same pattern. Card width comes from `useGridCardWidth`/`useGridColumns`
  (responsive breakpoints, phone → iPad — see `src/design/responsive/design.md`), which
  has no dependency on total item count.
- **Scroll**: both screens already scroll the whole content column
  (`showsVerticalScrollIndicator={false}`), so 22 cards simply make the page taller —
  no pagination or "show more" was added or needed.
- **Progressive disclosure (niches)**: `styles-edit.tsx`'s "Step 02 — Refinement"
  section only renders niche chips for styles the user has already selected in Step 01
  (`refinable = selected.filter(id => STYLE_NICHES[id]?.length > 0)`) — this scales the
  same way at 22 styles as it did at 8: the disclosed set is bounded by *selection*
  count (max 5, see `MAX_STYLES`), not catalog size. All 14 new styles have 2–3 niches
  defined in `STYLE_NICHES` (`src/data/index.ts`), matching the existing styles' 2–4.
- **Card fallback**: `Photo` renders a labelled color-tile fallback for any style
  without a real photo (`src=''`/null) — every one of the 14 new styles uses this path
  today (no branded photo asset exists yet; see backlog.md). Visually consistent with
  how the 8 original styles' DB rows already render (their `image_url` is also null;
  they only show a photo via the *client-side* `STYLES` static fallback's Unsplash
  URLs, which the 14 new styles don't have).

No new visual treatment, spacing, or motion was introduced — the catalog is still the
same 2-column (phone) hairline-bordered card grid with a bottom gradient + name/desc
label + check-circle, unchanged from `src/design/*` conventions elsewhere.

## Gender-matched ordering (2026-08-10)

Both screens now sort the style list with `sortStylesByGenderLean` (see
`src/services/stylesCatalogService.ts`) before rendering the grid: styles whose
`gender_lean` matches the signed-in user's `profiles.gender` (`WOMAN`→`feminine`,
`MAN`→`masculine`) are moved to the front; everything else follows, in its original
(popularity-ranked) order. Gender unset, `NON-BINARY`, or `PREFER NOT TO SAY` leaves the
grid in its existing popularity order — no reordering happens.

This is **purely a display-order change** — no style is hidden, disabled, grayed out,
or visually marked as "for you". A user can still scroll to and select any of the 22
styles regardless of their profile gender. There is no new UI chrome (no section
header, no divider) separating the gender-matched styles from the rest — the reorder is
the only change, keeping the screen exactly as visually quiet as before.

## Catalog size: 22 → 31 (batch 2, 2026-08-10)

9 more styles added (11 requested; 2 — `mobwife`, `modest` — stopped for a
vocabulary gap in the engine, not a design/UX decision — see plan.md). Same
mechanical growth as the 8→22 change above: `STYLES`/`STYLE_NICHES` in
`src/data/index.ts` gained 9 entries, the grid/scroll/niche-disclosure behavior is
unchanged (still an unbounded `flexWrap` grid inside a `ScrollView`, still no
pagination), and no new visual treatment was introduced.

**This time the length is a real UX concern, not just a hypothetical one.** At 22
styles the grid was ~11 rows (2-col phone layout); at 31 it's ~16 rows — noticeably
more scrolling before a user reaches a lower-popularity style, and the "related
styles" horizontal strip (`onboarding_styles_youMightAlsoLike`) is now the only
way most users will discover a style outside their gender-matched front group
without a long scroll. This was checked, not assumed: `styleList` in both
`styles.tsx` and `styles-edit.tsx` is still a flat `.map()` over the full sorted
array with no truncation, so nothing breaks at 31 items — it just gets long.

**Proposed (not implemented — out of scope for a "small layout fix", per
instruction):**
1. **"Show more" after the first N tiles.** `styleList` is already sorted
   gender-matched-first, and within each group by popularity (client fallback
   `STYLES` order / DB `order('popularity', desc)`) — so the first N tiles are
   already close to "most relevant to this user first". Render the first 8–10 as
   the grid, collapse the rest behind a text affordance ("Show all 31 styles" /
   "+21 more"), consistent with the brand's restraint (no accordion animation, no
   icon-heavy disclosure chrome — a single hairline-underlined text row would fit
   the existing luxury-minimalist language). Reversible with local state only, no
   store/schema change.
2. **Group by theme** (e.g. "Refined", "Casual & Athletic", "Romantic & Feminine",
   "Dark & Alternative", "Vintage-Inspired") as scrollable section headers instead
   of one flat grid. Truer to how a stylist would present 31 aesthetics, but a
   heavier change — it needs a theme taxonomy assigned to every style (new data,
   not just a UI reorder) and touches both screens' layout structure, which is
   more than the "small layout fix" this task was scoped to make directly.

Recommendation leans toward (1): smaller diff, reuses the sort order that already
exists, and doesn't require inventing a new taxonomy. Logged in backlog.md for
anh Khôi to decide.

## "Show all N" implemented (2026-08-11)

Option (1) above, chốt and implemented as specced — no new taxonomy, no accordion.

- **Head slice**: both screens render `STYLE_CATALOG_INITIAL_VISIBLE` (10) tiles from
  the already gender-lean-sorted `styleList`, via `getInitialVisibleStyles`
  (`src/services/stylesCatalogService.ts`) — same file as `sortStylesByGenderLean`, same
  "pure display-order helper, never touches selection/scoring" contract. The count is
  never hardcoded against the catalog's current size (31, and growing the same day this
  was written) — it's `styleList.length`, read live at render time.
- **Affordance**: a single `TextLink` centered below the grid
  (`styles.showAllRow: { alignItems: 'center', marginTop: 20 }`), color
  `T.color.tertiary`, reading "Show all {{count}}" / "Xem tất cả {{count}}"
  (`styleCatalog_showAllCount`). `TextLink` already renders `type.ui` (uppercase,
  `letterSpacing: 1.5`) with a hairline underline — no new component, no icon, no filled
  button, no border-radius chrome. Tapping it flips a local `expanded` boolean to true;
  there is no collapse-back affordance (one-way reveal, matching "a single hairline-
  underlined text row" from the proposal above — nothing heavier was added).
- **Selected-style guarantee**: `getInitialVisibleStyles` keeps the first N entries of
  the sorted list PLUS any style whose id is already selected, even past the cut, in
  original relative order. This was called out as the one thing that must not regress —
  a user who picked a low-popularity/off-gender-lean style before this change (now
  sitting past position 10) must still see it checked when they return to the screen,
  not have it silently fall off scroll-visible range until they tap "Show all". No
  visual distinction is drawn between "naturally in the head slice" and "kept visible
  because selected" — same card, same grid position, consistent with the rest of this
  doc's "nothing is hidden, disabled, or visually marked" principle.
- **Unaffected**: `sortStylesByGenderLean`, `MAX_STYLES` (5), the "you might also like"
  related horizontal strip, and Step 02 niche refinement (`styles-edit.tsx`) — all still
  operate on the full/selected sets exactly as before, only the head *grid* is sliced.
