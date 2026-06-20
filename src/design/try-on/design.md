# Try On — Visual & Interaction Spec (feature 008)

Source of truth for the Try On flow UI. Layout follows the "True Clothes Try On"
v2 reference; criteria/content follow `specs/008-try-on/spec.md` (five criteria,
not the mock's three). All screens use `src/design/tokens.ts` only.

## Screens

### Scan (`ScanScreen`)
- Large serif headline, eyebrow `TRY ON`, caption. Primary "TAKE A PHOTO",
  secondary "CHOOSE FROM LIBRARY". Progress + recoverable error/upgrade banners.

### Scan Result (`ResultScreen`)
Single scrolling screen, in order:
1. **Item on white** (`ItemOnWhite`) — AI-isolated cut-out on a pure-white ground
   (`#FFFFFF` is structural here, not a token, matching the product-shot intent).
2. **Identity** — serif name + uppercase brand.
3. **Attribute grid** — 2-col hairline grid: category, color, material, fit,
   season, pattern.
4. **Mix & match CTA** — full-width `T.color.primary` block with hairline icon
   frame, serif title, and outfit count when known.
5. **Verdict** (`VerdictPanel` → five `DimScore` rows) — overall score +
   recommendation label; each criterion shows a score bar + explanation, or
   "Not enough info" + a link to the relevant profile section when unavailable.
6. **Sticky decision bar** — `ADD TO WARDROBE` primary + underlined "Not for me"
   (discard). After Add, a centered success card ("Added to your wardrobe" +
   `VIEW WARDROBE`) overlays the screen.

### Mix & Match (`MixMatchFeed` → `MatchFeedCard`)
- Full-bleed vertical swipe pager (Home-feed feel), one outfit per page.
- Each card: a collage with the scanned item **framed and tagged `CONSIDERING`**
  as the anchor, surrounded by up to three owned wardrobe cut-outs; a large serif
  `MATCH SCORE`; a serif title; a one-line rationale; and a thumbnail strip
  (candidate, then `+`, then the closet pieces).
- Floating top overlay: round back chip + `MATCHING / <item>` chip. Vertical page
  dots on the right. Bottom "BACK TO RESULT" bar.
- States: loading ("Building outfits around this…"), recoverable error (retry),
  and sparse ("Nothing to pair yet") when the wardrobe can't complete an outfit.

## Motion & tone
Slow, intentional. No bouncy animation. Hairline strokes; full-bleed imagery;
near-monochrome base with the user's palette only as accent. Decision scrim uses
a low-opacity warm-black wash.

## Navigation entry (bottom nav)
The global `BottomNav` is now four equal-weight hairline tabs:
**Home · Wardrobe · Scan (camera) · Profile** — no floating center button.
- The previous black circular "⋯" center button (which opened the menu sheet)
  was removed. The menu now lives as a hamburger (`IconMenu`) in the Home
  header, beside the bell.
- The **Scan** tab is the direct entry to Try On: it pushes `/try-on`
  (`ScanScreen`), which previously was only reachable from the Options menu.
- `ScanScreen` is a pushed stack screen (`headerShown: false`), so it carries
  its own close (`IconX`, top-right) for an explicit way back.
