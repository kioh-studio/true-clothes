# Fit Engine — MIEN

How the app collects user data, characterizes clothing items, suggests styles, composes outfits, and scores fit compatibility.

---

## 1. Overview

The fit engine is a **local-first recommendation system** that:

1. Collects body measurements and style/color preferences during onboarding.
2. Characterizes each wardrobe item by measurements, color profile, graphics, fabric, and style tags.
3. Suggests style aesthetics via a hybrid recommendation engine (curated graph + attribute similarity).
4. Composes outfit candidates from the user's wardrobe using a brute-force combinatorial approach.
5. Ranks candidates by fit compatibility, style coherence, and color harmony.
6. Presents a daily-shuffled feed of top-ranked outfits.

Neither age nor gender influences style suggestions — the system is entirely preference-driven. All logic runs on-device.

---

## 2. User Data Collection

### 2.1 Body Measurements

Collected during onboarding across three forms. All values stored internally in **centimeters (CM)**; UI accepts CM or IN and converts at save time (`cm = in × 2.54`).

#### General

| Key | Label | How to measure |
|-----|-------|----------------|
| `body_height` | Height | Standing straight, head to floor |
| `body_weight` | Weight (kg) | Optional |

#### Upper Body

| Key | Label | How to measure |
|-----|-------|----------------|
| `body_bust` | Chest / Bust | Around fullest part of bust/chest, under armpits, tape parallel to ground |
| `body_waist` | Natural Waist | Around narrowest part of torso, just above belly button |
| `body_shoulder_width` | Shoulder width | From one shoulder point to the other across top of back |
| `body_sleeve_length` | Sleeve length | From shoulder socket, along outer arm (slightly bent) to wrist |
| `body_upper_body_length` | Back waist length | From prominent bone at base of neck down to natural waistline |
| `body_upper_arm` | Upper arm | Around widest section of upper arm |
| `body_neck` | Neck | Around base of neck, just above collar bone |

#### Lower Body

| Key | Label | How to measure |
|-----|-------|----------------|
| `body_hip` | Hip | Around fullest part of hips, ~18–23 cm below waistline |
| `body_inseam` | Inseam | From crotch down inner leg to ankle bone |
| `body_thigh` | Thigh | Around fullest part of thigh, just below crotch |
| `body_rise` | Rise (crotch depth) | Sitting on flat surface: waist to seat |

#### Feet

| Key | Label | How to measure |
|-----|-------|----------------|
| `body_foot_length` | Foot length | Heel to longest toe, standing on paper |
| `body_foot_width` | Foot width | Widest part of foot, standing on paper |

### 2.2 Style Preferences

Collected via a browsing-first interface (not a quiz). The user picks from a hierarchical style catalog:

**10 Broad Categories** (sorted by popularity score for cold-start):

| # | Category | Popularity | Essences |
|---|----------|-----------|----------|
| 1 | Casual | 0.950 | Natural |
| 2 | Classic | 0.748 | Classic |
| 3 | Sporty | 0.724 | Sporty |
| 4 | Minimalist | 0.568 | Classic |
| 5 | Streetwear | 0.504 | Gamine |
| 6 | Luxury | 0.407 | Dramatic |
| 7 | Bohemian | 0.402 | Natural |
| 8 | Romantic | 0.373 | Romantic |
| 9 | Edgy | 0.337 | Dramatic |
| 10 | Artsy | 0.316 | Creative |

Each broad category contains **3–6 sub-styles** (e.g. Minimalist → Scandinavian Minimal, Japanese Minimal, Monochrome, Quiet Luxury).

### 2.3 Color Palette

User selects dominant color tones grouped by tag (Warm Neutral, Earth, Neutral, Dark Neutral, Cool, Warm, Accent). Stored as a list of named color values — not hex.

---

## 3. Clothing Item Model

### 3.1 Item Types & Categories

```
enum ItemType:
  topItem        → T-shirts, shirts, polos, blouses
  bottomItem     → Pants, jeans, shorts
  skirt          → Skirts, skorts
  outerwear      → Jackets, coats, blazers, hoodies
  shoes          → All footwear
  accessory      → Belts, hats, scarves, jewelry
  bag            → Backpacks, totes, crossbody, clutches
```

Composition categories (for outfit slot assignment):
```
enum ItemCategory: top, bottom, outwear, shoes, accessory
```

### 3.2 Garment Measurements (per type)

All taken from the **physical item laid flat**. Half-width measurements are doubled internally for body comparison.

#### Top Item (6 fields)

| Key | Label |
|-----|-------|
| `chest` | Chest / Bust (pit-to-pit × 2) |
| `waist_top` | Waist (at natural waist × 2) |
| `shoulder_width` | Shoulder width (seam to seam) |
| `sleeves` | Sleeve length (shoulder seam to cuff) |
| `body_length` | Body length (collar to hem) |
| `upper_arm` | Upper arm circumference |

#### Bottom Item — Pants (5 fields)

| Key | Label |
|-----|-------|
| `waist` | Waist (top of waistband × 2) |
| `hip` | Hip (widest point × 2) |
| `inseam` | Inseam (crotch to hem) |
| `thigh` | Thigh (at crotch seam × 2) |
| `rise` | Rise (waistband to crotch) |

#### Bottom Item — Skirt (3 fields)

| Key | Label |
|-----|-------|
| `waist` | Waist × 2 |
| `hip` | Hip × 2 |
| `skirt_length` | Waistband to hem |

#### Outerwear (6 fields)

| Key | Label |
|-----|-------|
| `chest` | Chest (pit-to-pit × 2) |
| `waist_outer` | Waist × 2 |
| `shoulder_width` | Shoulder width |
| `sleeves` | Sleeve length |
| `body_length` | Body length |
| `upper_arm` | Upper arm circumference |

#### Shoes (2 fields)

| Key | Label |
|-----|-------|
| `shoe_size` | Size (EU / US / UK) |
| `shoe_width` | Width (cm or letter: N/M/W/XW) |

#### Bag (3 fields)

| Key | Label |
|-----|-------|
| `bag_height` | Height (excluding handles) |
| `bag_width` | Width (widest point) |
| `bag_depth` | Depth (front to back) |

#### Accessory (2 fields)

| Key | Label |
|-----|-------|
| `length` | Total length |
| `width` | Width |

### 3.3 Color Attributes

Each item carries a **three-dimensional color profile**:

| Attribute | Values | Purpose |
|-----------|--------|---------|
| `primaryColor` | 26 named hues (black, white, navy, beige, gray, brown, olive, blue, red, purple, green, yellow, pink, orange, cream, ivory, camel, tan, taupe, khaki, charcoal, burgundy, teal, metallic, multicolor, natural) | Hue family for outfit harmony |
| `colorLightness` | light, medium, dark | Value/depth within the hue |
| `colorSaturation` | muted, balanced, vivid | Chroma intensity |

Aliases are normalized at input (e.g. "grey" → gray, "wine" → burgundy, "gold" → metallic).

### 3.4 Graphics & Artwork

| Attribute | Values | Impact |
|-----------|--------|--------|
| `graphicWeight` | none, small_logo, medium_logo, large_graphic, full_print | Style-compatibility rules — heavier graphics limit pairing options |
| `artworkType` | none, brand_logo, slogan_text, graphic_illustration, all_over_print | Determines formality ceiling |
| `graphicAutoDetected` | boolean | Whether values came from ML detection vs user input |

### 3.5 Fabric & Seasonality

| Attribute | Values | Role in scoring |
|-----------|--------|-----------------|
| `pattern` | solid, striped, plaid, checkered, floral, graphic, abstract | Pattern clash avoidance |
| `fabricWeight` | light, medium, heavy | Layering compatibility |
| `breathability` | low, medium, high | Weather suitability |
| `season` | spring, summer, fall, winter, allSeason | Seasonal filtering |
| `layerRole` | base, mid, outer | Layering order validation |

---

## 4. Style Suggestion Engine

### 4.1 Cold Start — Popularity Scoring

When the user has no style data, broad categories are presented sorted by a composite popularity score:

```
popularityScore(style) =
    0.30 × culturalReach +    // Google Trends volume (normalized 0���1)
    0.25 × marketSize +       // Relative commercial market size
    0.25 × versatility +      // Graph connections ≥0.4 (normalized)
    0.20 × accessibility      // Entry barrier (1–5 scale, normalized)
```

### 4.2 After First Pick — Hybrid Recommendation

When user selects style **S**:

1. **Curated neighbors** — look up all styles connected to S in hand-curated relationship graph. Each edge carries weight 0.0–1.0.
2. **Attribute similarity** — compute vector similarity between S and all other styles (see §4.4).
3. **Combine:**
   ```
   combined_score = (0.6 × curated_score) + (0.4 × attribute_score)
   ```
4. **Rank** — top 6 suggestions, excluding already-picked styles.

The 60/40 split gives curated relationships (expert fashion knowledge) more influence than computed similarity.

### 4.3 Profile Building — Recency-Weighted

As user picks multiple styles, a profile vector is computed:

```
userProfile.attributes = weightedAverage(
    pickedStyles.map(s => s.attributes),
    recencyWeights
)
```

Recency decay:
```
weight(i) = 0.8 ^ (totalPicks - 1 - i)
```
Most recent pick = 1.0, previous = 0.8, then 0.64, 0.512, ...

For enum-set attributes (colorPalette, silhouette, mood):
- Sum recency-weighted contributions per enum value
- Normalize by total weight sum
- Include value in profile if normalized score > **0.3** threshold

### 4.4 Attribute Similarity Formula

Each style carries 6 attributes. Similarity between styles A and B:

```
similarity(A, B) =
    0.25 × jaccardSim(A.mood, B.mood) +
    0.20 × numericSim(A.formality, B.formality) +
    0.20 × jaccardSim(A.colorPalette, B.colorPalette) +
    0.15 × jaccardSim(A.silhouette, B.silhouette) +
    0.10 × numericSim(A.textureRichness, B.textureRichness) +
    0.10 × numericSim(A.patternLevel, B.patternLevel)
```

Where:
- `numericSim(a, b) = 1 - (|a - b| / 4)` — for 1–5 scale attributes
- `jaccardSim(A, B) = |A ∩ B| / |A ∪ B|` — for enum sets (1.0 if both empty)

### 4.5 Style Attribute Vectors

| Attribute | Type | Range | Weight |
|-----------|------|-------|--------|
| `formality` | float | 1.0–5.0 (casual → formal) | 0.20 |
| `colorPalette` | enum set | {neutral, earth, bold, pastel, dark, monochrome} | 0.20 |
| `silhouette` | enum set | {relaxed, structured, bodycon, oversized, tailored} | 0.15 |
| `patternLevel` | float | 1.0–5.0 (minimal → heavy) | 0.10 |
| `textureRichness` | float | 1.0–5.0 (plain → rich/mixed) | 0.10 |
| `mood` | enum set | {playful, serious, romantic, edgy, clean, artistic} | 0.25 |

### 4.6 Curated Relationship Graph

Bidirectional edges between styles with 0.0–1.0 weights. Static data shipped with app.

**Broad-level edges (sample):**
```
Casual ──0.7── Sporty
Casual ──0.6── Bohemian
Classic ──0.8── Minimalist
Classic ──0.5── Luxury
Streetwear ──0.7── Sporty
Streetwear ──0.6── Edgy
Minimalist ──0.5── Luxury
Bohemian ──0.6── Artsy
Bohemian ──0.5── Romantic
Romantic ──0.4── Luxury
Edgy ──0.5── Artsy
Luxury ──0.4─��� Artsy
```

**Sub-style edges (sample):**
```
Smart Casual ──0.8── Preppy
Quiet Luxury ──0.8── Old Money
Quiet Luxury ──0.7── Scandinavian Minimal
Dark Academia ──0.7── Preppy
Athleisure ──0.7── Relaxed Casual
Gorpcore ──0.6── Techwear
```

---

## 5. Outfit Composition

### 5.1 Category Slot System

An outfit occupies **5 fixed slots** mapped by `ItemCategory`:

| Slot | Category | Required | Role |
|------|----------|----------|------|
| 1 | `bottom` (pants/skirt) | Yes | Anchor — largest visual element |
| 2 | `outwear` (jacket/coat) | No | Secondary — optional layering piece |
| 3 | `top` (shirt/tee/knit) | Yes | Secondary — core garment |
| 4 | `accessory` (bag) | No | Accent — fixed small size |
| 5 | `shoes` | Yes | Accent — fixed small size |

**Rules:**
- No positional fallback — empty slots stay empty (never reuse another category's piece)
- Main items (slots 1–3) participate in dynamic scaling for composition rendering
- Accent items (slots 4–5) render at fixed small size
- Minimum viable outfit: top + bottom + shoes (3 pieces)

### 5.2 Composition Layout (Visual Canvas)

Fixed 5-slot layout (500 × 570 px reference):

| Slot | Position | Size | Item |
|------|----------|------|------|
| 1 | (0, 0) | 350 × 468 | Pants (anchor) |
| 2 | (350, 0) | 150 × 206 | Jacket |
| 3 | (350, 206) | 150 × 206 | Shirt |
| 4 | (350, 412) | 102 × 140 | Bag |
| 5 | (0, 468) | 102 × 102 | Shoes |

Canvas scales uniformly to fit available screen width.

### 5.3 Outfit Coordinator Pipeline

```
OutfitSuggestionCoordinator
├── source: BruteForceOutfitCandidateSource(topN: 24)
│   └── Generates all valid top+bottom+shoes combinations
│       with optional outerwear/accessory additions
├── ranking: score each candidate (fit, style, color)
├── dedupe: remove near-identical candidates
└── presentation: ShuffledPresentation()
    └── Deterministic daily shuffle: hash(userId + date)
```

**Pipeline steps:**
1. Load user's wardrobe items from local storage
2. Load body measurements and color preference
3. Generate candidate outfits (brute-force combinatorial, capped at topN=24)
4. Score and rank candidates using `OutfitRankingContext`:
   - `colourPreferenceId` — user's palette choice
   - `favouriteStyleTags` — user's style picks (e.g. ['old money', 'quiet luxury'])
   - `styleConfigId` — active style configuration
5. Deduplicate similar candidates
6. Apply daily shuffle (same user + calendar day → same order)
7. Return ranked list for UI feed

---

## 6. Fit Matching

### 6.1 Body ↔ Garment Comparison

| Body Measurement | Compared With (garment) | Fit Insight |
|------------------|------------------------|-------------|
| `body_bust` | Top/Outerwear `chest` | Chest room — snug, standard, roomy |
| `body_shoulder_width` | Top/Outerwear `shoulder_width` | Shoulder fit — too narrow, fitted, relaxed, oversized |
| `body_waist` | Top `waist_top` / Bottom `waist` / Outerwear `waist_outer` | Waist fit |
| `body_hip` | Bottom `hip` | Hip room |
| `body_upper_arm` | Top/Outerwear `upper_arm` | Sleeve tightness |
| `body_sleeve_length` | Top/Outerwear `sleeves` | Sleeve length — too short, correct, long |
| `body_upper_body_length` | Top/Outerwear `body_length` | Garment length — cropped, regular, longline |
| `body_inseam` | Bottom `inseam` | Trouser length — ankle, full, cropped |
| `body_thigh` | Bottom `thigh` | Thigh room — slim, standard, relaxed |
| `body_foot_length` | Shoes `shoe_size` | Shoe size accuracy |

### 6.2 Ease Calculation

```
ease = garment_dimension - body_dimension
```

Positive ease = room/space. Negative ease = garment is smaller than body (tight fit).

### 6.3 Fit Categories (thresholds per measurement point)

| Category | Ease Range | Character |
|----------|-----------|-----------|
| Snug | 0–2 cm | Body-hugging, no extra room |
| Standard | 2–6 cm | Comfortable, slight room |
| Roomy | 6–12 cm | Relaxed, intentional space |
| Oversized | 12+ cm | Deliberately loose |

Negative ease (garment < body) flags a **fit warning** — item may not fit comfortably.

Thresholds vary by measurement point (shoulders are tighter tolerance than chest, etc.) — detailed per-point thresholds defined in implementation.

---

## 7. Ranking & Scoring

### 7.1 Style Coherence Score

Measures how well all items in the outfit align with the user's style profile:

- Compute attribute vector for each item based on its style tags
- Compare against `userProfile.computedAttributes` using the similarity formula (§4.4)
- Average across all items in the outfit

### 7.2 Color Harmony Score

Factors:
- **Palette alignment** — do item colors fall within the user's selected color palette?
- **Lightness contrast** — avoid all-same-lightness (monotone); prefer 2–3 lightness levels
- **Saturation consistency** — muted items pair better with muted; vivid with vivid
- **Graphic density** — max 1 item with `large_graphic` or `full_print` per outfit

### 7.3 Fit Score

Per-item fit score based on ease thresholds:
- Each measurement point scored 0.0–1.0 (1.0 = ideal ease for the garment type)
- Items with no measurements get neutral score (0.5)
- Outfit fit score = weighted average across all measured items

### 7.4 Combined Ranking

```
outfitScore = w_style × styleCoherence +
              w_color × colorHarmony +
              w_fit   × fitScore
```

Weights are tunable; initial values TBD based on user testing. Expected starting point:
- `w_style` = 0.40 (style alignment is the primary signal)
- `w_color` = 0.35 (color harmony is highly visible)
- `w_fit` = 0.25 (fit matters but many items lack measurements initially)

---

## 8. Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ONBOARDING                                       │
│  Body measurements → Style picks → Color palette → First wardrobe item  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      LOCAL STORAGE                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────────┐ │
│  │ Body Profile  │  │ Style Profile │  │ Wardrobe Items (with measures) │ │
│  └──────────────┘  └──────────────┘  └──────────��─────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  OUTFIT SUGGESTION COORDINATOR                            │
│                                                                          │
│  1. BruteForceOutfitCandidateSource                                     │
│     → Generate all valid top+bottom+shoes combos (+ optional layers)    │
│     → Cap at topN=24 candidates                                         │
│                                                                          │
│  2. Score & Rank                                                         │
│     → Style coherence (0.40)                                            │
│     → Color harmony (0.35)                                              │
│     → Fit score (0.25)                                                  │
��                                                                          ���
│  3. Deduplicate                                                          │
│     → Remove near-identical item sets                                   │
│                                                                          │
│  4. ShuffledPresentation                                                 │
│     → Deterministic daily shuffle: hash(userId + date)                  │
└─────────────��──────────────────────┬─────────────────────────────���──────┘
                                     │
                                     ▼
┌──────────────���──────────────────────────────────────────────────────────┐
│                        HOME FEED                                          │
│  Vertical pager — one outfit per page — TikTok-style scroll             │
│  Each card: 5-slot composition + title + style tag + weather             │
└────��───────────────────────────────────���────────────────────────────────┘
```

---

## 9. Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Body measurement collection | Implemented | `lib/features/onboarding/*_form.dart` |
| Item measurement schema | Implemented | `lib/features/wardrobe/add_item_models.dart` |
| Style catalog (data) | Specified | `docs/suggest-style-logic.md` |
| Style suggestion algorithm | Specified (no code) | `docs/suggest-style-logic.md` §5–6 |
| Outfit coordinator | API defined, not implemented | Referenced in `home_main_screen.dart` |
| Fit comparison (ease) | Specified (no code) | `design/reference/measurement.md` §3 |
| Color harmony rules | Planned | Not yet documented in detail |
| Combined ranking formula | Planned | Weights TBD |

---

## 10. Key Design Decisions

1. **Local-first** — all logic runs on-device. No server dependency for outfit generation.
2. **Preference-driven** — no gender/age bias in style suggestions.
3. **Brute-force generation** — enumerate combinations rather than ML-based generation (simpler, deterministic, explainable).
4. **Daily shuffle** — same user sees same order all day (prevents decision fatigue from constant reordering).
5. **Measurements optional per item** — system gracefully handles items without measurement data (neutral fit score).
6. **Half-width convention** — garment measurements taken flat (half circumference); system doubles internally.
7. **Hierarchical styles** — broad categories for discovery, sub-styles for refinement.
8. **Curated + computed hybrid** — expert fashion knowledge (graph edges) weighted above raw vector similarity (60/40 split).
