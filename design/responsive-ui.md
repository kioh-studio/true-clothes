# Responsive UI: principles (cross-platform)

This document is **framework-neutral**. Use it for Flutter, web, or other stacks. The legacy Android app used the same ideas with `dp`/`sp` and a theme-provided scale factor.

## dp, sp, and px in screen `design.md` (Flutter conversion)

Specs use **Android-style names** on purpose: they map cleanly to **density-independent layout** and **scalable typography**. When you build in Flutter, treat them as **design-token numbers at the reference width**, not as raw device pixels.

| In the spec | Meaning | In Flutter (typical) |
|---------------|---------|----------------------|
| **`dp`** (e.g. `padding_horizontal_dp`, `min_height_dp`) | Layout/spacing/corners at the **reference width** | Scale then use as **logical pixels** in `SizedBox`, `EdgeInsets`, `BorderRadius`, etc. `1 dp` in the spec ≈ `1.0` logical pixel **after** you apply width scale (see below). |
| **`sp`** (e.g. `size_sp`, `font_size_sp`) | Text size at the **reference width** | Scale like `dp`, then pass to `TextStyle.fontSize`. Optionally multiply by `MediaQuery.textScalerOf(context)` (or respect `textScaleFactor`) so **system font size** accessibility still works. |
| **`px`** in SVG / YAML `size_px` | Coordinates on the **design artboard** (often 402×874) | Use for **ratios** and spacing relative to the artboard, or convert with the same **scale = screenWidth / referenceWidth** as `dp`. Do not hard-code artboard pixels on the device. |

**Reference width for True Clothes onboarding/home mocks:** **402** logical units wide (matches the SVG artboard width where noted in specs).

**Core formula (width-based responsiveness):**

```text
scale = clamp( screenLogicalWidth / referenceWidth, minScale, maxScale )   // optional clamp
layoutValueOnDevice = designDp * scale
fontSizeOnDevice    = designSp * scale   // then apply text scaler if you want OS accessibility
```

**Minimal Flutter pattern** (no extra packages): hold `referenceWidth` (402), read `MediaQuery.sizeOf(context).width`, compute `scale`, use `final pad = 24.0 * scale` for a `24` “dp” token from the spec.

**Packages that encode the same idea:** [flutter_screenutil](https://pub.dev/packages/flutter_screenutil) (`ScreenUtil().setWidth`, `.setSp`), or a small `ThemeExtension<AppSpacing>` that stores precomputed `scale` and helpers `double d(double designDp) => designDp * scale`.

**Why keep `dp`/`sp` in YAML instead of renaming to “logical px”?**  
Teams and tools still speak in **dp/sp**; the important part is that **every** screen uses the **same** `referenceWidth` and **one** scale function so onboarding, home, and components stay visually consistent.

## Critical ideas

1. **One source of truth**  
   Define layout dimensions (padding, spacing, font sizes, corner radii) in one place (design tokens / theme). Derive on-screen values from the current **logical size** context. Avoid literals that ignore available width.

2. **Scale from a reference**  
   Pick a reference width (e.g. the width at which the design was drawn, such as 402). For each device, compute **scale = currentWidth / referenceWidth**. Map design numbers to actual layout units so proportions stay consistent.

3. **Density-independent layout units**  
   Use the platform’s logical units (Flutter: `dp`-equivalent via `MediaQuery` / `DevicePixelRatio`; iOS: points). Responsiveness is about **layout size**, not raw physical pixels.

4. **Proportion over fixed size**  
   “Same look” means the same **relative** layout: padding as a fraction of width, text size relative to touch targets. Prefer scaling from the reference rather than fixed numbers on every widget.

## When layout should adapt

- **Width** — Primary driver; scale factor is often width-based so narrow and wide layouts stay proportional.
- **Height** — Use when content scrolls or when short vs tall layouts need different structure (e.g. list vs grid).
- **Configuration changes** — Rotation, fold, multi-window: recompute scale and layout from the new constraints.
- **Breakpoints (optional)** — On large widths, switch structure (e.g. one column vs two) instead of only scaling. Base breakpoints on logical width (e.g. compact &lt; 600, medium 600–840, expanded &gt; 840).

## Implementation pattern

1. **Choose a reference width** — All design numbers are defined at that width (e.g. 402).
2. **Expose scale in the widget tree** — Read window/orientation constraints at the app or theme root, compute `scale`, and provide it (Flutter: `InheritedWidget` / `ThemeExtension` / provider) so screens do not duplicate logic.
3. **Avoid raw layout literals in screens** — Prefer `scale * designPadding` (or a small helper) instead of fixed numbers that ignore device class.
4. **Shared components use the same scale** — Buttons, modals, progress bars, and cards share the same scaling so they stay visually consistent.
5. **Test multiple widths** — e.g. ~320, 360, 400, 600, 840 logical pixels and both orientations.
6. **Optional: clamp scale** — Avoid oversized UI on very large surfaces (e.g. clamp scale to ~0.85–1.25) and enforce minimum touch targets (e.g. ~48 logical pixels).

## Flutter mapping (short)

- **Reference + scale** — `MediaQuery.sizeOf(context).width`, optional `ThemeExtension` or `ResponsiveScale` holding `scaleDp(n)` / `scaleSp(n)`.
- **Scroll + fixed footer** — `Expanded` + `SingleChildScrollView` (or `ListView`) for body; footer outside the scroll so it does not overlap content.
- **Text** — After scaling `sp` from the spec, apply `textScaler` / `MediaQuery.textScalerOf(context)` so **user font size** settings still apply; keep **minimum touch targets** (e.g. 48×48) even when text is small.

## Relationship to screen specs

Screen `design.md` files may reference SVG geometry in **pixels** at a fixed artboard size. Treat those as **proportional references**, not mandatory absolute positions. See each screen’s `responsive_layout` section.

YAML fields named `*_dp`, `*_sp`, or `size_px` / `font size_px` are **design measurements**: convert them with the **dp/sp/px** rules above—never paste artboard `px` directly as Flutter layout values without scaling.
