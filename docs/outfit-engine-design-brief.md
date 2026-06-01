# Outfit Engine — Design Brief

*A summary of the design decisions made so far for the closet-based outfit recommendation engine.*

---

## 1. What we're building

An engine that takes a user's **existing closet** as its data source and, given a context (chosen style, occasion, weather, body measurements, color preference), assembles several complete, ranked outfits from items the user already owns.

The core insight, validated against how professional stylists and fashion KOLs actually work:

- Outfits are built by **role** (base → hero → support → layer → shoes → accessories), not as flat random sets.
- A **style/aesthetic** (e.g. Old Money) is not a vibe — it is a concrete bundle of constraints that can *override* the user's stated preferences.
- Proportion and color rules (rule of thirds, 3-color rule, monochrome/tonal, contrast volume) are **math**, not taste — so they can be checked and scored.

---

## 2. The pipeline (how it works end to end)

```
Closet items  +  User context  +  Style config
                     |
              CONTEXT RESOLVER      ← merges inputs, applies override priority
                     |
              CANDIDATE FILTER      ← hard constraints DELETE non-matching items
                     |
              COMBINATION GEN       ← assemble by role (base/hero/support/...)
                     |
              SCORING ENGINE        ← soft rules RANK the survivors
                     |
              RANK + DIVERSIFY      ← top N, deduplicated so they vary
                     |
                Outfit results
```

The single most important architectural decision:

> **Separate rules that DELETE options (hard filters) from rules that RANK options (soft scorers).**
> Weather and the style palette delete. Proportion and color harmony rank.

---

## 3. Conflict resolution — the override cascade

When the three inputs disagree (e.g. favorite color = red, but Old Money bans red), a strict priority order decides who wins. The priority is applied **per axis**, not globally.

| Priority | Source | Behavior |
|----------|--------|----------|
| 1 (highest) | **Hard context** — weather safety, occasion formality | Never overridden |
| 2 | **Active style** — e.g. Old Money palette/fit/fabric | Overrides user preferences |
| 3 | **User preferences** — favorite color, preferred fit | Apply only where the style didn't lock the axis |
| 4 (lowest) | **Defaults** | Fallback |

Key rules:

- The style **overrides** the user's preferences (color, fit) — but only on the axes its config declares.
- **Hard context still beats the style.** Old Money wants a linen blazer, but it's 14°C and raining → context bumps it to wool. Comfort/safety always wins.
- Every override is **logged and made visible**, so the UI can explain: *"Swapped your usual red for the Old Money palette."* The explanation is half the product.

---

## 4. The item data model (~10 stored attributes)

Each closet item stores a small, fixed set of attributes, grouped by what each one is for.

**Identity**
1. `category` — top / bottom / outerwear / footwear / accessory / full-body
2. `subtype` — oxford shirt, wide-leg trouser, loafer

**Filtering (decide if it survives the cut)**
3. `colors` — primary + optional secondary, stored as **HSL/Lab numbers**, not names
4. `fabric` — cotton, wool, linen, polyester…
5. `warmth` — 1–5 (drives weather filtering)
6. `formality` — 1–5 (drives occasion filtering)
7. `aesthetic_tags` — multi-tag: [oldmoney, streetwear, minimal…]
8. `season` — usually **derived** from fabric + warmth, not entered by hand

**Assembly (decide how it combines & what role it can play)**
9. `fit` — slim / regular / relaxed / wide / oversized
10. `pattern` — solid / stripe / check / print, plus scale (micro / macro)
11. `role_eligible` — which slots it may fill, e.g. plain tee = [base, support]; bold jacket = [hero]

> Storing color as Lab/HSL (not names) is what makes monochrome / tonal / complementary
> rules computable instead of requiring a giant lookup table.

### How the role (HERO / BASE) is decided

The role is **not** a fixed stored value — it is computed **per outfit**:

- An item's **statement strength** is derived from `pattern` + `colors` + `subtype` (a bold print blazer is loud; a plain tee is quiet).
- `role_eligible` is the guardrail (a plain tee can never be the hero).
- Within one candidate outfit: loudest eligible item → **HERO**, quietest neutral → **BASE**, bridging items → **SUPPORT**.

This is why the same navy overshirt is a *hero* next to plain basics, but *support* next to a louder jacket — strength is fixed, but "loudest in this group" is relative.

### Tagging pipeline (the real-world hard part)

Ten fields × dozens of items typed by hand = nobody does it. So:

- **Vision auto-fills** the visual fields (category, colors, pattern, fit, often fabric/subtype).
- **User confirms/corrects** with one tap, only where Vision is unsure.
- Some fields are **derived by rules** and never asked (e.g. "wool + coat → warmth 5", "tee → role_eligible [base, support]").

Goal: add an item with **one photo and maybe one correction**, while the engine still gets all attributes.

---

## 5. The style config (the "recipe")

Item attributes describe the *ingredients*; a style config describes *what a style demands and forbids*. The engine reads configs generically, so **adding a new style is just writing a new config file — no engine code changes.**

A config has three parts:

**1. Hard constraints (the deletes)** — palette, fabrics required/banned, allowed fits, formality range, banned features.

**2. Override power** — which of the user's preferences this style is allowed to clobber.

**3. Scoring weights** — the dials that tune how survivors are ranked.

### Example — Old Money

```
OldMoney {
  // hard constraints
  palette:          [navy, cream, camel, beige, white, gray]
  palette_accents:  [burgundy, olive]          // sparingly
  fabrics_required: [wool, cashmere, cotton, linen, silk]
  fabrics_banned:   [polyester, nylon, spandex-heavy]
  allowed_fits:     [relaxed, tailored]         // NOT slim, NOT wide
  formality_range:  [2, 5]
  banned_features:  [loud_logo, macro_print]

  // override power
  overrides:        [favorite_color, preferred_fit]

  // scoring weights
  weights: {
    texture_variety:     HIGH,
    formality_coherence: HIGH,
    color_harmony:       HIGH,   // tonal / monochrome rewarded
    contrast_volume:     LOW,
    pattern_tolerance:   LOW
  }
}
```

### Example — Streetwear (same fields, different values)

```
Streetwear {
  palette:          []                  // open / user's choice
  fabrics_banned:   []
  allowed_fits:     [relaxed, oversized, wide]
  formality_range:  [1, 3]
  overrides:        [preferred_fit]     // respects favorite_color
  weights: {
    contrast_volume:     HIGH,
    pattern_tolerance:   HIGH,
    formality_coherence: LOW,
    texture_variety:     MEDIUM
  }
}
```

---

## 6. Vocabulary by axis (not a flat term bag)

A tempting idea was to define every concept (Cream, Wool, Beach, Oversize, Luxury) as one flat list of "terms" and combine outfits by set **intersection**. We rejected the flat version because:

- The terms live on **different axes** (Cream = color, Wool = fabric, Beach = occasion, Oversize = fit). A flat bag loses the structure the engine needs to say "lock the color axis, leave pattern open."
- **Intersection is binary**, but styling is *degrees* — beige is a perfect Old Money match, olive is "allowed sparingly", red is "banned". That's three states, not two. And harmony/proportion aren't membership at all — they're scores.
- Flat terms have **no priority**, so they can't resolve "Luxury vs Beach" conflicts.

The kept version: **one small controlled vocabulary per axis**, with the **right operator per axis**. Items, styles, occasions and weather all speak the same vocabulary on each axis.

| Axis | Vocabulary (examples) | Operator |
|------|----------------------|----------|
| Color | cream, navy, beige, camel, white, gray, red, olive… | Graded match (perfect / allowed / banned) |
| Fabric | cotton, wool, linen, cashmere, silk, polyester… | Graded match |
| Fit | slim, regular, relaxed, wide, oversized | Graded match |
| Formality | 1–5 | Range overlap |
| Warmth | 1–5 | Range overlap |
| Pattern | solid / stripe / check / print × micro / macro | Scorer |
| Proportion | (derived from fit combos) | Scorer |

**Why this matters — example query: Old Money + Beach + Hot day.**
On the *fabric* axis, Old Money allows {wool, cotton, linen, silk}; Hot weather requires warmth ≤ 2; the overlap is naturally {linen, light cotton, silk}. Wool is excluded **because the warmth axis filtered it**, not by a lucky set collision. The structure does the reasoning. A flat bag couldn't even express "style wins on color, weather wins on warmth" — but that is literally a per-axis priority statement.

---

## 7. The scoring engine (soft rules)

Each candidate outfit gets a weighted score; weights come from the active style config.

```
score = w1·color_harmony       // monochrome / tonal / complementary / 3-color rule
      + w2·proportion          // rule of thirds, contrast volume (tight + wide)
      + w3·formality_coherence // pieces within ±1 formality of each other
      + w4·texture_variety     // reward mixing cashmere / cotton / silk
      + w5·aesthetic_fidelity  // how well it matches the active style
      + w6·weather_fit
      - penalty·rule_violations // >3 colors, clashing macro-patterns, etc.
```

Concrete checkable rules:

- **3-color rule** — count distinct color families; penalize > 3.
- **Monochrome / tonal** — reward low hue variance with varied lightness.
- **Rule of thirds** — the visual break (waist tuck) should give ~1:2 split, not 1:1.
- **Pattern clash** — two macro-patterns = penalty; one macro + solids = fine.
- **Contrast volume** — fitted top + wide bottom = bonus; wide + wide = penalty (unless the style allows it).

Then **rank + diversify**: sort by score, penalize candidates that share too many items with an already-picked higher-ranked outfit, return the top 5–8 so the user sees genuine variety.

---

## 8. Build priority (what matters most, in order)

1. **Garment tagging quality** — everything downstream dies if tags are wrong. Hardest real-world problem; lean on the Vision pipeline + one-tap user correction + rule-derived fields.
2. **The constraint resolver with visible overrides** — the differentiator. Nail the per-axis cascade and the explanation layer.
3. **Color math in Lab space** — unlocks harmony rules cheaply.
4. **Role-based assembly** — keeps the search tractable and stylist-like.
5. **Per-style scoring weights** — start hand-tuned; learn later from thumbs up/down.

---

## 9. What stylists / KOLs do that we're borrowing

- **Base → hero → support framework** — baked directly into role assembly.
- **3-color rule + warm/cool undertone matching** — taught as the two core "math" skills of styling; both are trivial scorers.
- **Aesthetics as strict bundles** (Old Money = locked palette + natural fibers + tailored fit + no logos) — confirmed almost exactly as designed; becomes the override library.
- **"Limiting yourself to one silhouette is the common mistake"** — why the diversify step matters; don't just return the comfort zone.
- **Texture mixing** to keep neutral/monochrome looks from going flat — a soft-score bonus weighted up for Old Money / Minimal.

---

## 10. Open decisions / notes for later

- **How many styles ship in v1?** Recommend 4–6 hand-authored configs (Old Money, Minimal, Streetwear, Smart Casual, Athleisure, +1).
- **User-editable configs?** Not at first — a contradictory config ("Old Money but neon, slim, synthetic") produces bad outfits and the user blames the engine. Open it to power users once defaults prove out.
- **The hardest validation problem is taste, not rules.** Two outfits can satisfy every rule and one still looks better. That's where eventual learning-from-feedback (thumbs up/down adjusting weights, or a small preference model) earns its place — but not in v1.
