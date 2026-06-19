# True Clothes — New Screens

A focused export of the screens added in this iteration:

## Outfits
- **Build an Outfit** — manual builder (canvas + category strips + shuffle)
- **Build · Suggest engine** — same screen with the AI suggestion sheet open. Anchor pieces from current selection, optional style/colour/occasion filters, generates 3–5 outfit proposals you can apply to the canvas.
- **Schedule outfits** — week pager, day cards with weather strip and outfit slots, picker sheet that surfaces saved outfits first.
- **Saved outfits** — bookmarked feed outfits as a grid; quick un-save.

## Preferences
- **Style preferences** — two numbered steps. **01 Aesthetics** grid + **02 Refine** with niche sub-styles tailored to each top-level pick (Ivy League · European Heritage · Scandinavian · Margiela / Lemaire · etc.)
- **Color palette** — current palette strip + grouped swatches by tag.
- **Size & Measurements** — basics + body + preferred fit, with sticky Save / Discard bar.

## Menu + Onboarding
- **Menu** — full-screen replacement for the bottom-sheet menu, grouped into Create / Discover / You / Support.
- **Wardrobe Intro** — final onboarding step (after "All set"), prompts to add the first item or skip.

## Files

| File | Purpose |
|---|---|
| `True Clothes — New Screens.html` | Standalone showcase — open this in a browser. Pan / zoom the canvas, drag-reorder artboards, click any card to focus it fullscreen. |
| `extras.jsx` | Source for all the screens above. Drop into a project that already has the `T` theme tokens, icon set, `STYLES` / `COLORS` / `OUTFITS` / `ITEMS` / `STYLE_NICHES` data and the `OutfitCollage` component, plus `StyleCard` and the `useTweaks` helpers exposed on `window`. |
| `assets/items/` | Transparent product cutouts used in the wardrobe + collage. |

## Notes

The showcase renders each screen inside an iPhone bezel inside an artboard.
Handlers (back, save, navigate) are wired to no-ops so each artboard is
self-contained — sheets and pickers still open inside their own artboard.
