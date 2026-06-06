# Fit Engine — Deep Review, Issues & Improvement Plan

*Complete audit of every module in `src/services/fitEngine/`*

---

## Part 1: How the Engine Works (Explained Simply)

### The 30-Second Version

```
Your wardrobe                   Your profile
   │                               │
   ▼                               ▼
┌─────────┐    ┌──────────────────────────────┐
│ 30 items │    │ Body: chest 96, shoulder 47  │
│ in your  │    │ Style: Old Money, Minimalist │
│ closet   │    │ Colors: Cream, Navy, Olive   │
└────┬─────┘    └──────────────┬───────────────┘
     │                         │
     ▼                         │
  STEP 1: CLASSIFY             │
  Each item gets a "profile":  │
  ┌─────────────────────────┐  │
  │ Olive knit polo          │  │
  │ Category: top            │  │
  │ Color: olive, medium,    │  │
  │         muted            │  │
  │ Fabric: light, breathable│  │
  │         summer, base     │  │
  │ Style: preppy, smart     │  │
  │         casual, old money│  │
  └─────────────────────────┘  │
                               │
     ▼                         │
  STEP 2: COMBINE              │
  Try every possible outfit:   │
                               │
  Top A + Bottom 1 + Shoe X    │
  Top A + Bottom 1 + Shoe Y    │
  Top A + Bottom 2 + Shoe X    │
  Top B + Bottom 1 + Shoe X    │
  ... (up to 144 combos)       │
                               │
     ▼                         │
  STEP 3: SCORE ◄──────────────┘
  Each outfit gets 3 scores:

  ┌─────────────────────────────────────────────┐
  │  Outfit: Olive polo + Dark jeans + Loafers  │
  │                                             │
  │  Style match:  87%  ← "matches your Old     │
  │                        Money + Minimalist    │
  │                        preferences"          │
  │                                             │
  │  Color harmony: 81% ← "olive + navy + black │
  │                        = good contrast,      │
  │                        muted tones align"    │
  │                                             │
  │  Body fit:     92%  ← "polo chest 110cm vs  │
  │                        your chest 96cm =     │
  │                        14cm ease = roomy     │
  │                        but comfortable"      │
  │                                             │
  │  TOTAL: 0.40×87 + 0.35×81 + 0.25×92        │
  │       = 34.8 + 28.4 + 23.0 = 86.2%         │
  └─────────────────────────────────────────────┘

     ▼
  STEP 4: RANK & SHUFFLE
  Sort by total score → remove duplicates
  → shuffle with daily seed (same day = same order)
  → show top 24 in your feed
```

### Walk Through a Real Example

**Your wardrobe has:**
- 12 tops (tees, polos, knits, shirts)
- 7 bottoms (jeans, chinos, trousers)
- 3 shoes (loafers, sneakers, mules)
- 6 jackets
- 1 bag, 1 cap

**Your profile:**
- Body: chest 96cm, shoulders 47cm, sleeve 56cm
- Style: Old Money + Minimalist selected
- Colors: Cream, Navy, Olive, Charcoal, Black preferred

**What happens:**

1. **Classify**: Each of your 30 items gets tagged:
   - White tee → `top, white/light/muted, cotton/light/summer, [streetwear, athleisure, smartcasual, minimalist]`
   - Black chinos → `bottom, black/dark/muted, cotton/light/summer, [preppy, smartcasual, oldmoney]`
   - Black loafers → `shoes, black/dark/muted, leather/heavy/winter, [oldmoney, minimalist, smartcasual, preppy]`

2. **Combine**: 12 tops × 7 bottoms × 3 shoes = 252 base outfits, plus variations with jackets and accessories. Capped at 144 candidates.

3. **Score each**:
   - *White tee + Black chinos + Black loafers*: Style 0.78, Color 0.85, Fit 0.50 → **Total 0.72**
   - *Olive polo + Dark jeans + Loafers*: Style 0.87, Color 0.81, Fit 0.62 → **Total 0.78**
   - *Beige knit + Navy trousers + Tan mules*: Style 0.91, Color 0.88, Fit 0.55 → **Total 0.80**

4. **Rank**: Sort by total. Remove outfits that share the same top+bottom. Shuffle with today's seed.

5. **Feed**: You see "Beige knit + Navy trousers + Mules" first, then "Olive polo + Dark jeans + Loafers", etc.

---

## Part 2: Every Bug, Issue & Risk Found

### CRITICAL — These Break the Engine's Core Promise

---

#### BUG 1: Candidate Generation is Biased — Later Items Get Excluded

**File**: `outfitCompositor.ts:13-47`

**The problem**: The brute-force loop iterates in fixed order (first top → first bottom → first shoe), and stops at `GENERATION_CAP = 144`. With a large wardrobe, items near the END of the array never appear in any candidate outfit.

**Example**: You have 12 tops, 7 bottoms, 3 shoes.
- 12 × 7 × 3 = 252 base combos (already exceeds 144 cap)
- Loop breaks after generating combos for the first ~7 tops
- Tops 8-12 (including items you just added!) NEVER appear

**Impact**: New items added to the wardrobe are systematically excluded from suggestions. Users will think the AI ignores their clothes — exactly the complaint Acloset users have: *"Shows the same 2-3 items repeatedly, never utilizing accessories."*

**Fix**: Randomize item order before generation, or use stratified sampling to ensure every item appears in at least some candidates.

---

#### BUG 2: Outerwear + Accessory Combos Are Impossible

**File**: `outfitCompositor.ts:29-38`

```typescript
// Current logic:
candidates.push({ top, bottom, shoes });           // bare outfit
for (outer) candidates.push({ top, bottom, shoes, outwear });   // + jacket
for (acc)   candidates.push({ top, bottom, shoes, accessory }); // + accessory
// MISSING: { top, bottom, shoes, outwear, accessory }  ← NEVER GENERATED
```

**Impact**: A complete outfit (shirt + pants + shoes + jacket + bag) is IMPOSSIBLE to generate. The engine will never suggest wearing a jacket AND carrying a bag together.

**Fix**: Add a fourth loop level, or generate all slot permutations.

---

#### BUG 3: Bottom Half Fit Scoring is ALWAYS 0.5 (Neutral)

**File**: `fitMatcher.ts:89-93` + `measurements.ts:19-27`

`REAL_BODY_MEASUREMENTS` only has upper body data:
```typescript
{
  body_height: 175, body_weight: 76,
  body_bust: 96, body_shoulder_width: 47,
  body_sleeve_length: 56, body_upper_arm: 32,
  body_upper_body_length: 42
  // MISSING: body_waist, body_hip, body_inseam, body_thigh, body_rise
}
```

When `scoreItemFit()` checks pants, ALL body values are `undefined` → every measurement point is skipped → returns `score: 0.5`.

**Impact**: The engine literally cannot tell if pants fit the user. Every pair of pants scores identically (0.5). The "body-aware outfit filtering" — our #1 differentiator — doesn't actually work for the bottom half.

**Fix**: Collect full body measurements during onboarding (waist, hip, inseam, thigh are already in the `BodyMeasurements` type — just not populated).

---

### HIGH — These Produce Bad Outfit Suggestions

---

#### ISSUE 4: No Proportion/Silhouette Balancing

**What real stylists do**: The #1 rule in outfit construction is **volume balancing**:
- Baggy top → slim bottom (or vice versa)
- Oversized on top + oversized on bottom = "drowning in fabric"
- Fitted top + fitted bottom = works only on certain body types

**What our engine does**: Silhouette data exists in the style catalog (`relaxed`, `structured`, `oversized`, `tailored`) but is **NEVER used in outfit composition or scoring**.

A baggy hoodie + wide-leg trousers scores the same as a fitted tee + wide-leg trousers. Real stylists would flag the first as a proportion disaster.

**Fix**: Add a `proportionScore()` to the ranker that rewards contrasting volumes between top and bottom.

---

#### ISSUE 5: No Formality Consistency Check

**What real stylists do**: Every item has a formality level. Mixing formal + casual is an advanced move that requires skill. A blazer + gym shorts is almost always wrong.

**What our engine does**: Formality exists in `StyleAttributes` (1.0-5.0 scale) but is **never compared between items in an outfit**. Each item's formality is only compared against the USER's style profile average.

Dress loafers (formality 4.5) + gym shorts (formality 1.5) → no penalty, because both are scored individually against the user's average.

**Fix**: Add a `formalityConsistencyScore()` that penalizes high variance between item formality levels within an outfit.

---

#### ISSUE 6: Color Harmony Has No Color Wheel Logic

**File**: `colorHarmony.ts`

**What real stylists do**: Use color relationships:
- **Complementary**: blue + orange, purple + yellow (high contrast, energetic)
- **Analogous**: blue + teal + green (harmonious, cohesive)
- **Monochromatic**: different shades of navy/blue (sophisticated)
- **Neutral + one pop**: all black + red bag (intentional accent)
- **Clashing**: red + pink, red + orange (risky, usually bad)

**What our engine does**: Four checks, none involving color relationships:
1. Are colors in user's palette? (40%)
2. Is there lightness variety? (25%)
3. Are saturations consistent? (25%)
4. Max 1 heavy graphic? (10%)

**Example failure**: Navy shirt + orange pants = a GREAT complementary combo, but scores low if orange isn't in the user's palette. Meanwhile, navy + black + charcoal = monotone bore, but scores high because all are in the palette.

The engine rewards "safe" over "styled."

**Fix**: Add color relationship scoring based on primary color wheel positions. Reward complementary/analogous combos. Penalize clashing combos.

---

#### ISSUE 7: Saturation Rule is Too Binary

**File**: `colorHarmony.ts:15-19`

```typescript
function saturationConsistency(profiles: ColorProfile[]): number {
  const hasMuted = profiles.some(p => p.colorSaturation === 'muted');
  const hasVivid = profiles.some(p => p.colorSaturation === 'vivid');
  return hasMuted && hasVivid ? 0.5 : 1.0;
}
```

ANY mix of muted + vivid = 0.5 penalty. But a muted outfit with ONE vivid accent (red bag, gold watch) is excellent styling. The rule should consider the RATIO, not the mere presence.

**Fix**: Penalize only when vivid items are 40%+ of the outfit. One vivid out of 4-5 muted items should score HIGH (intentional accent).

---

#### ISSUE 8: Style Tags Are Type-Only — Color and Material Ignored

**File**: `itemClassifier.ts:114-143`

A white cotton polo and an olive wool polo get **identical style tags** (`[preppy, smartcasual, oldmoney]`). But in reality:
- White polo = preppy, minimalist, smart casual
- Olive polo = smart casual, military-inspired, earth-tone casual
- Black polo = could be streetwear, minimalist, or formal

Style is not just garment TYPE — it's type × color × material.

**Fix**: Modify `styleTagsOf()` to accept color and material as inputs and adjust tag weights. Dark colors shift toward formal/minimalist. Bold colors shift toward streetwear/y2k.

---

#### ISSUE 9: Pattern and Graphics Are Always Hardcoded

**File**: `itemClassifier.ts:104,153`

```typescript
pattern: 'solid',                                    // ALWAYS solid
graphics: { graphicWeight: 'none', artworkType: 'none' }, // ALWAYS none
```

The `ClothingItem` type has no `pattern` or `graphics` fields. So:
- A plaid flannel shirt = treated as solid
- A graphic tee with a huge print = treated as no graphics
- The `graphicDensityPenalty()` in colorHarmony NEVER triggers

Pattern mixing rules (no plaid + stripes in one outfit) exist conceptually but are completely non-functional.

**Fix**: Add `pattern` and `graphicWeight` fields to `ClothingItem`. Classify during item upload (AI can detect this from photos).

---

#### ISSUE 10: No Season/Weather Filtering

**Current state**: Each item gets a `season` attribute (`summer`, `winter`, `allSeason`) from fabric weight. But this data is **never used** in the compositor or ranker.

A heavy wool coat can appear in a "summer" outfit. Light linen pants can be suggested for a freezing day.

This is exactly the bug that killed Cladwell: *"At 100°F, nearly every outfit suggested is paired with a cardigan."*

**Fix**: Add weather context to `EngineContext`. Filter candidates by season compatibility OR add a season-mismatch penalty to scoring.

---

### MEDIUM — These Reduce Quality

---

#### ISSUE 11: Shuffler Destroys Ranking

**File**: `shuffler.ts`

After carefully scoring and ranking all outfits, `dailyShuffle()` completely randomizes the order. The best outfit (score 0.95) might appear last, while a mediocre one (score 0.65) appears first.

The intent (same user + same day = same order) is good, but the method destroys the value of scoring.

**Fix**: Use a weighted shuffle — keep high-scoring outfits near the top with some randomness. E.g., divide into tiers (top 8, middle 8, bottom 8) and shuffle within tiers.

---

#### ISSUE 12: Dedup is Too Aggressive

**File**: `outfitRanker.ts:17-19`

```typescript
function isDuplicate(a: OutfitSlots, b: OutfitSlots): boolean {
  return a.top === b.top && a.bottom === b.bottom;
}
```

If two outfits share the same top+bottom but have different shoes, only the first is kept. But swapping loafers for sneakers fundamentally changes an outfit from "old money" to "smart casual."

**Fix**: Consider shoes in dedup check: `a.top === b.top && a.bottom === b.bottom && a.shoes === b.shoes`.

---

#### ISSUE 13: Style Coherence Averages Out to Meaningless Middle

**File**: `styleCoherence.ts:72-92`

`itemAttributes()` averages ALL style tag attributes. A tee with tags `[streetwear, athleisure, smartcasual, minimalist]` produces the AVERAGE of 4 very different style vectors. This results in a bland, middling profile that doesn't represent any real style.

Every top converges to a similar "average" profile because they all carry 3-4 diverse style tags.

**Fix**: Weight the primary style tag higher (first in the list = most dominant), or use max-pooling instead of averaging.

---

#### ISSUE 14: No Texture/Material Harmony

**What stylists do**: Materials should have intentional relationships:
- Silk + denim = interesting contrast (intentional)
- Wool + linen = seasonal mismatch (unintentional)
- Leather + leather + leather = try-hard
- Cotton + cotton + canvas = boring but safe

**What our engine does**: Fabric data (weight, breathability, season) exists but is only used for season classification. Material harmony between items is never evaluated.

**Fix**: Add a `textureHarmony()` scorer that evaluates material weight consistency and intentional contrast.

---

### LOW — Quality of Life / Performance

---

#### ISSUE 15: useFitFeed — JSON.stringify in Dependency Array

**File**: `useFitFeed.ts:27-28`

```typescript
JSON.stringify(styleProfile.selectedStyles),
JSON.stringify(colorPreferences),
JSON.stringify(bodyMeasurements),
```

`JSON.stringify` runs every render, creating new strings that may trigger unnecessary re-computation of the entire outfit pipeline.

**Fix**: Use a stable hash or `useRef`-based deep comparison.

---

#### ISSUE 16: fitEngineStore — Race Condition in Persist

**File**: `fitEngineStore.ts:42-46`

```typescript
setBodyMeasurements: async (m) => {
  const next = { ...get().bodyMeasurements, ...m };
  set({ bodyMeasurements: next });
  await persist({ ...get(), bodyMeasurements: next });  // get() may be stale
},
```

Rapid successive calls could cause persist to save stale state because `get()` reads the store at call time, not after `set()`.

**Fix**: Pass the full desired state to persist directly instead of re-reading from store.

---

#### ISSUE 17: GENERATION_CAP Too Low for Large Wardrobes

**File**: `outfitCompositor.ts:5`

`GENERATION_CAP = 144` (24 × 6). With 15+ tops and 7+ bottoms, only ~40% of possible base combos are generated. Combined with BUG 1 (fixed iteration order), this severely limits outfit diversity.

**Fix**: Increase cap or use smarter sampling. Even 500 candidates scored in <100ms on modern phones.

---

#### ISSUE 18: `CAP` Type Not in Category Map

**File**: `itemClassifier.ts:10-17`

The wardrobe has a `CAP` item (`debase_cap_plaid`), but `CAP` is not in `CATEGORY_MAP`. It falls through to `'accessory'` via the default, which works but is implicit. Other missing types: `CARDIGAN`, `SWEATER` (would map to `KNIT`), `MULES` (mapped via `LOAFERS`).

**Fix**: Add explicit mappings for all known item types.

---

## Part 3: How Real Stylists Build Outfits vs. Our Engine

### The Stylist's Mental Framework (From Research)

Based on research into how Allison Bornstein, Law Roach, Tan France, Tim Dessaint, Brittany Bathgate, and other professional stylists actually work:

```
1. IDENTITY FILTER (top-down, not bottom-up)
   │  Allison Bornstein's "Three-Word Method": pick 3 adjectives
   │  (one practical, one aspirational, one emotional)
   │  Every outfit decision filters through those words.
   │  Law Roach: "figure out who the client IS first"
   │
   ▼
2. ONE HERO PIECE — "There is only ONE hero in a given outfit"
   │  The item with the most visual weight (color/pattern/texture/structure)
   │  Everything else is a "sidekick" — simpler, quieter, supporting
   │  Sidekicks should NOT compete with the hero
   │  Rachel Zoe: build everything around one showstopper
   │
   ▼
3. PROPORTION / VOLUME BALANCE (hard rule)
   │  Volume goes to top OR bottom, NEVER both
   │  - Baggy top → slim bottom
   │  - Fitted top → wide bottom
   │  - Oversized coat → slim trousers
   │  - NEVER: oversized top + oversized bottom
   │  Rule of Thirds: 1/3 to 2/3 split is most pleasing
   │  Always define ONE body point (waist, wrist, or ankle)
   │  Tan France's "French tuck" = creates waist break
   │
   ▼
4. COLOR SYSTEM (three rules, pick one)
   │
   │  The 60/30/10 Rule:
   │    60% = dominant color (largest garments: trousers, coat)
   │    30% = secondary color (blazer, cardigan)
   │    10% = accent (shoes, bag, scarf)
   │
   │  The 80/20 Rule:
   │    80% neutrals (navy, charcoal, black, white, beige, olive)
   │    20% accent — ONE decisive color, not a chaotic mix
   │
   │  Color Wheel Schemes:
   │    Monochromatic: one hue, vary shade (+ Rule of 3 Textures)
   │    Analogous: adjacent colors (blue + teal + green)
   │    Complementary: opposites (blue + orange, purple + yellow)
   │    MUST match undertones: warm with warm, cool with cool
   │
   ▼
5. FORMALITY ALIGNMENT (hard rule)
   │  7 levels: Casual → Smart Casual → Business Casual →
   │            Business Pro → Cocktail → Semi-Formal → Black Tie
   │  Items within 1 level pair naturally
   │  Items 2+ levels apart = clash
   │  Marker: brighter colors = more casual, shinier fabric = more formal
   │
   ▼
6. TEXTURE MIX (Rule of Three Textures)
   │  Monochrome outfits especially need: matte + shine + texture
   │  Weight balance: heavy/structured + light/flowy
   │  Avoid two bold textures at the same scale
   │  Neutral base for texture play (limit to 2-3 colors)
   │  Great pairings: suede+cotton, leather+cashmere, denim+silk
   │
   ▼
7. PATTERN MIXING (hard rules)
   │  Max 2 patterns per outfit
   │  If 2 patterns: MUST differ in scale (large + small)
   │  If 2 patterns: MUST share at least one common color
   │  Use a solid-color buffer between two patterned pieces
   │  Bold print = max 30% of outfit (never the dominant 60%)
```

### Key Insight: Stylists Work Top-Down, Our Engine Works Bottom-Up

**Stylists**: Identity → Occasion → Silhouette → Color → Specific items
**Our engine**: All items simultaneously → Score each combination → Pick best

This fundamental difference is why algorithmic outfits feel "correct but uninspired." The engine finds items that all score well individually but has no concept of visual hierarchy, narrative, or the one-hero principle.

### Gap Analysis: Stylist Methodology vs. Our Engine

| Stylist Rule | Our Engine | Status | Gap |
|---|---|---|---|
| 1. Identity filter (3-word method) | Style quiz selects broad categories | PARTIAL | We have style selection, but no emotional/aspirational dimension. Bornstein's method is deeper than "Old Money." |
| 2. One hero piece | No concept | MISSING | All items weighted equally. No visual hierarchy. No hero/sidekick classification. |
| 3. Proportion: volume top ↔ bottom | Silhouette data exists but UNUSED | MISSING | Oversized hoodie + wide trousers = no penalty. Double-oversized is a cardinal sin in styling. |
| 4. Rule of Thirds | No concept | MISSING | No garment length awareness. No 1/3-2/3 proportion scoring. |
| 5. 60/30/10 color distribution | No concept | MISSING | No color weight by garment size. A colorful shoe (10% of body) treated same as colorful coat (60%). |
| 6. 80/20 neutral/accent ratio | Binary saturation check | WEAK | One vivid accent in muted outfit = PENALIZED. Should be REWARDED (it's the 20% accent). |
| 7. Color wheel relationships | Palette alignment only | WEAK | Navy + orange (complementary) scores low if orange not in palette. Navy + black + charcoal (boring monotone) scores high. |
| 8. Undertone matching | No concept | MISSING | Warm olive + cool icy blue = undertone clash. No scoring for this. |
| 9. Formality within 1 level | Formality exists but not compared between items | MISSING | Blazer (level 4) + gym shorts (level 1) = no penalty. 3-level gap. |
| 10. Texture Rule of Three | Fabric data unused for harmony | MISSING | All-cotton outfit = no penalty for boredom. Matte + shine + texture = no reward. |
| 11. Pattern mixing (scale + shared color) | Pattern hardcoded to 'solid' | BROKEN | Can't detect patterns. Can't check scale variation. Plaid + stripes possible with no penalty. |
| 12. Max 2 patterns per outfit | Pattern not tracked | BROKEN | No limit possible — patterns invisible to the engine. |
| 13. Body shape styling | Body measurements exist | PARTIAL | We score fit (tight/loose) but not body-shape-specific rules (e.g., V-neck for inverted triangle, belted for rectangle). |
| 14. Define one body point | No concept | MISSING | No awareness of cropped pants exposing ankle, French tuck defining waist, rolled sleeves showing wrist. |

### The Core Philosophical Gap

**Stylists work top-down. Our engine works bottom-up.**

- **Stylist**: "Who is this person? What's the occasion? What silhouette works? Now pick items."
- **Engine**: "Score every possible combination of items. Pick the highest number."

A stylist would never put 5 items in a room and ask "which 3 go together?" They'd start with the jacket and ask "what makes this jacket shine?"

The result is outfits that are **statistically optimized but not styled** — everything matches the user's profile, but nothing has visual intent. This is why Acloset/Whering users say *"AI suggestions feel random"* — even when the scores are high, the outfits lack the narrative structure that makes a look feel intentional.

**Tim Dessaint creates 10 outfits from 10 items not by random combination, but by choosing a tight palette (5-7 colors max), ensuring every item is within 1 formality level of every other, and varying silhouette/texture while keeping color constant.** Our engine could do this — it just doesn't yet.

---

## Part 4: Improvement Roadmap

### Priority 1: Fix the Critical Bugs (Week 1)

| Bug | Fix | Effort |
|---|---|---|
| Candidate generation bias | Randomize item order before loop, or stratified sampling | 2 hours |
| Missing outerwear+accessory combos | Add combined loop or full permutation | 1 hour |
| Bottom half always scores 0.5 | Populate all body measurements from onboarding data | 1 hour (data), already supported in code |

### Priority 2: Add Stylist-Level Intelligence (Week 2-3)

| Feature | What It Does | Effort |
|---|---|---|
| **Proportion scorer** | Compare top silhouette vs bottom silhouette. Reward contrast. Penalize double-oversized. | 1 day |
| **Formality consistency** | Compare formality levels between all items. Penalize >1.5 gap. | 0.5 day |
| **Color relationship scoring** | Map primaryColors to hue wheel positions. Score complementary/analogous/monochromatic. Penalize clashing. | 2 days |
| **Fix saturation rule** | Penalize only when vivid >40% of outfit. Reward single accent. | 1 hour |
| **Season/weather filter** | Add temperature context. Filter out winter items in summer, vice versa. | 1 day |
| **Max 3 colors rule** | Count distinct primary colors. Penalize outfits with >3 unless user's style is 'bohemian' or 'y2k'. | 2 hours |

### Priority 3: Add Depth (Week 4-6)

| Feature | What It Does | Effort |
|---|---|---|
| **Anchor piece logic** | Identify the "loudest" item (highest pattern/graphic/color saturation) and ensure supporting items are quieter. | 2 days |
| **Texture harmony** | Score material relationships. Reward interesting contrast. Penalize seasonal clashes. | 1 day |
| **Context-aware style tags** | Style tags influenced by color + material, not just garment type. Black tee ≠ white tee. | 1 day |
| **Pattern detection** | Add pattern field to ClothingItem. Penalize pattern clashes (plaid + stripes). | 1 day (type), needs AI for detection |
| **Weighted shuffle** | Keep top-scored outfits near top of feed. Shuffle within tiers. | 2 hours |
| **Less aggressive dedup** | Include shoes in duplicate check. | 30 min |

### Priority 4: Make It Learn (Month 2+)

| Feature | What It Does | Effort |
|---|---|---|
| **Feedback-adjusted weights** | User saves/skips adjust the W_STYLE/W_COLOR/W_FIT weights per user | 1 week |
| **Item frequency boost** | Items the user wears often get a small scoring boost | 2 days |
| **Negative feedback** | "Never suggest this combo" → hard exclusion list | 1 day |
| **Style drift detection** | Track how user's saves shift over time → auto-update style profile | 1 week |

---

## Part 5: Updated Scoring Formula (Proposed)

### Current: 3 Dimensions

```
totalScore = 0.40 × styleCoherence
           + 0.35 × colorHarmony
           + 0.25 × fitScore
```

### Proposed: Two-Phase Scoring (Mirrors How Stylists Actually Think)

**Phase 1: Hard Constraints (REJECT bad outfits before scoring)**

These are binary pass/fail checks. Outfits that fail are eliminated, not just penalized:

```
REJECT IF:
  × Formality gap > 2 levels between any two items
  × Both top AND bottom are oversized (volume clash)
  × 2+ bold patterns in the outfit
  × Season mismatch with weather context (wool coat in 30°C)
  × 4+ distinct primary colors (visual chaos)
```

**Phase 2: Soft Scoring (RANK surviving outfits)**

```
totalScore = 0.20 × styleCoherence       (does this match user's style?)
           + 0.20 × colorHarmony         (IMPROVED: color wheel + 60/30/10 distribution)
           + 0.15 × fitScore             (does this fit user's body?)
           + 0.15 × proportionBalance    (NEW: volume contrast top ↔ bottom)
           + 0.10 × formalityConsistency (NEW: items within 1 level of each other)
           + 0.10 × seasonMatch          (NEW: appropriate for weather/temperature)
           + 0.05 × textureInterest      (NEW: material variety, Rule of 3 Textures)
           + 0.05 × anchorClarity        (NEW: one hero piece + quiet sidekicks)
```

### Why Two Phases

Real stylists have **hard rules they never break** (no double-oversized, no extreme formality clash) and **soft preferences they optimize** (color harmony, texture interest). Our current engine treats everything as soft — it just penalizes bad combos with lower scores instead of eliminating them. This means terrible outfits still appear if other scores are high enough.

Hard constraints first = no blazer + gym shorts, ever. Then soft scoring ranks the remaining good options.

### Why These Weights

- **Style + Color remain dominant** (40% combined) — these are what users notice first
- **Fit drops from 25% to 15%** — many items lack measurements; neutral scores (0.5) currently inflate fit's influence artificially
- **Proportion + Formality (25% combined)** — these are the rules stylists enforce most strictly. A proportion disaster or formality mismatch ruins an outfit instantly, regardless of color/style match. Research confirmed: volume balance is the #1 hard rule, formality coherence is #2.
- **Season (10%)** — prevents embarrassing weather mismatches (the Cladwell killer: cardigans at 100°F)
- **Texture + Anchor (10% combined)** — these elevate outfits from "correct" to "styled." The difference between "AI suggested this" and "a stylist put this together"
- **Color harmony improvement** — the 40% allocated to color should now include: color wheel relationships (complementary/analogous scoring), 60/30/10 distribution by garment visual weight, undertone consistency, and the existing palette alignment. Not just "is this in user's palette?"

---

## Part 6: Summary of All Issues

| # | Severity | Module | Issue | Status |
|---|---|---|---|---|
| 1 | CRITICAL | outfitCompositor | Candidate bias — later items excluded | TO FIX |
| 2 | CRITICAL | outfitCompositor | No outerwear+accessory combos | TO FIX |
| 3 | CRITICAL | fitMatcher | Bottom half always scores 0.5 (no body data) | TO FIX |
| 4 | HIGH | outfitRanker | No proportion/silhouette balancing | TO ADD |
| 5 | HIGH | outfitRanker | No formality consistency check | TO ADD |
| 6 | HIGH | colorHarmony | No color wheel logic (complementary/analogous) | TO ADD |
| 7 | HIGH | colorHarmony | Saturation rule too binary | TO FIX |
| 8 | HIGH | itemClassifier | Style tags ignore color + material | TO IMPROVE |
| 9 | HIGH | itemClassifier | Pattern + graphics always hardcoded | TO FIX |
| 10 | HIGH | outfitCompositor | No season/weather filtering | TO ADD |
| 11 | MEDIUM | shuffler | Destroys ranking order | TO FIX |
| 12 | MEDIUM | outfitRanker | Dedup too aggressive (ignores shoes) | TO FIX |
| 13 | MEDIUM | styleCoherence | Style attributes average out meaninglessly | TO IMPROVE |
| 14 | MEDIUM | (missing) | No texture/material harmony | TO ADD |
| 15 | LOW | useFitFeed | JSON.stringify in dependency array | TO FIX |
| 16 | LOW | fitEngineStore | Race condition in persist | TO FIX |
| 17 | LOW | outfitCompositor | GENERATION_CAP too low for large wardrobes | TO FIX |
| 18 | LOW | itemClassifier | CAP type not in explicit category map | TO FIX |

**CRITICAL: 3** | **HIGH: 7** | **MEDIUM: 4** | **LOW: 4** = **18 total issues**

---

## The Bottom Line

The fit engine's **architecture is sound** — the pipeline (classify → compose → score → rank → shuffle) is the right approach. The code is clean, typed, and testable.

But the **intelligence is shallow**. The engine knows about style, color, and body fit as isolated dimensions. It doesn't understand how items relate TO EACH OTHER within an outfit — which is what styling actually is.

The gap between "items that individually match the user's preferences" and "items that work together as an outfit" is the gap between a database query and a stylist's eye. Closing that gap with proportion balancing, formality checking, color relationships, and anchor piece logic would put this engine meaningfully ahead of every competitor.

The critical bugs (candidate bias, missing combos, broken pants scoring) should be fixed THIS WEEK — they undermine the core promise. The stylist intelligence features (proportion, formality, color wheel) should follow in weeks 2-3. This turns a "good foundation" into a "genuine recommendation engine."
