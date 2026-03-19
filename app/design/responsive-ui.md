# Responsive UI: critical ideas, conditions, and approach

## Critical ideas

1. **One source of truth**  
   Define every layout dimension (padding, spacing, font size, radius) in one place and derive on-screen values from the current context. Do not hardcode `dp`/`sp` that ignore screen size.

2. **Scale from a reference**  
   Pick a reference width (e.g. the width at which the design was drawn). For every device, compute **scale = currentWidth / referenceWidth**. Use this scale to turn design values into actual `dp`/`sp` so proportions stay the same.

3. **Density-independent units**  
   Use `dp` for layout and `sp` for text so size is consistent across densities. Responsiveness is then about **screen size** (width/height in dp), not raw pixels.

4. **Proportion over fixed size**  
   “Same look” means same relative layout: same padding as a fraction of width, same text size relative to touch targets. Achieve that by scaling from the reference, not by fixed numbers everywhere.

## Conditions (when layout should adapt)

- **Screen width**  
  Primary driver. Scale factor is usually width-based so narrow and wide devices get proportional layout.
- **Screen height**  
  Use when content is scroll-dependent or when you need different layouts for short vs tall screens (e.g. list vs grid, different spacing).
- **Configuration changes**  
  Rotation, fold, multi-window: recompute scale and layout from the new `Configuration` (e.g. new `screenWidthDp` / `screenHeightDp`).
- **Breakpoints (optional)**  
  For large screens you may switch layout (e.g. single column vs two columns) instead of only scaling. Base breakpoints on `screenWidthDp` (e.g. compact &lt; 600, medium 600–840, expanded &gt; 840).

## Way to develop responsive UI

1. **Choose a reference**  
   Decide the width (in dp) at which the design is specified. All design values are defined at that width.

2. **Expose scale in the tree**  
   At app/theme root, read `Configuration` (e.g. `LocalConfiguration.current`), compute scale, and provide it via `CompositionLocal` (or equivalent) so every screen can use it without prop drilling.

3. **No raw layout constants in screens**  
   In composables, do not use literal `48.dp` or `16.sp` for layout. Use the provided scale: e.g. `scale.scaleDp(48f)`, `scale.scaleSp(16f)`, so the same design number is scaled for the current device.

4. **Shared components use the same scale**  
   Buttons, modals, progress bars, cards, etc. should use the same scale (same `CompositionLocal`) for padding, text size, and size so they stay consistent with the rest of the app.

5. **Test across sizes**  
   Run the app (or previews) at several widths (e.g. 360, 400, 600, 840 dp) and in different orientations to confirm proportions and readability.

6. **Optional: clamp scale**  
   To avoid oversized UI on very large screens, clamp scale (e.g. `coerceIn(0.85f, 1.25f)`). To avoid tiny UI on very small screens, use a minimum scale or minimum touch targets (e.g. 48.dp).

In this project, the reference width is a constant; scale is provided by the theme and consumed via `LocalResponsiveScale`. All screens and shared components use `scaleDp` / `scaleSp` so the same design is rendered proportionally on every device.
