# Style Suggestion Logic

## Overview

True Clothes suggests fashion styles to users through a **hierarchical style catalog** and a **hybrid recommendation engine**. The system starts by presenting popular broad categories to new users (cold start), then progressively refines suggestions as the user picks styles they resonate with.

All logic runs **locally on-device**. Neither age nor gender influences style suggestions — the system is entirely preference-driven.

---

## 1. Style Selection Methodology

The fashion world contains hundreds of named aesthetics — from Streetwear to Cottagecore to Sartorial to Emo. We cannot show them all. This section defines **how we choose which styles enter the catalog** and **how we rank them for cold-start presentation**.

### 1.1 Foundation: The 7 Style Essences

Our broad categories are grounded in the **7 Style Essences** framework, a system established in the 1930s by Belle Northrup and refined by fashion professionals (Harriet McJimsey, John Kitchener, David Kibbe). It classifies personal style along a yin/yang spectrum:

| Essence     | Character                                | Our Mapping           |
|-------------|------------------------------------------|-----------------------|
| Dramatic    | Bold, angular, theatrical, statement     | → **Edgy**, **Luxury**|
| Natural     | Relaxed, organic, effortless, earthy     | → **Casual**, **Bohemian** |
| Classic     | Timeless, polished, symmetrical, refined | → **Classic**, **Minimalist** |
| Gamine      | Youthful, playful, rebellious, energetic | → **Streetwear**      |
| Romantic    | Soft, curved, ornate, feminine           | → **Romantic**        |
| Creative    | Eclectic, experimental, unconventional   | → **Artsy**           |
| Sporty      | Athletic, functional, dynamic            | → **Sporty**          |

This mapping ensures our broad categories are **rooted in established fashion psychology** rather than arbitrary grouping. Every recognized aesthetic in the fashion world (Old Money, Dark Academia, Techwear, Y2K, etc.) maps into one of these archetypal families.

### 1.2 Selection Criteria — Which Styles Enter the Catalog

Not every named aesthetic earns a place in the catalog. A style must pass **four filters** to be included:

| # | Criterion                | Question It Answers                                                     | Threshold                                             |
|---|--------------------------|-------------------------------------------------------------------------|-------------------------------------------------------|
| 1 | **Distinctiveness**      | Does this style look and feel clearly different from others already in the catalog? | Must not be >80% attribute-similar to an existing entry |
| 2 | **Longevity**            | Is this an enduring aesthetic or a micro-trend that may vanish in months? | Must have existed as a recognized style for **>3 years** |
| 3 | **Wardrobe Buildability**| Can someone construct complete outfits (head-to-toe) in this style?     | Must cover at least 4 garment categories (top, bottom, outerwear, footwear) |
| 4 | **Recognition**          | Would a typical user understand or relate to this style name?           | Must appear in mainstream fashion media (not just niche subcultures) |

**Examples of styles that pass all four:**
- Old Money — distinct from Classic (more opulent), 5+ years longevity, full wardrobe, widely recognized
- Dark Academia — distinct from Preppy (darker/scholarly), 5+ years, full wardrobe, mainstream TikTok/Pinterest presence
- Techwear — distinct from Sporty (futuristic/functional), 7+ years, full wardrobe, recognized in fashion media

**Examples of styles that fail:**
- "Barbiecore" — fails **longevity** (peaked in 2023, already fading)
- "Fairycore" — fails **wardrobe buildability** (mostly accessories and accents, not complete outfits)
- "Twee" — fails **recognition** (niche term unfamiliar to most users)

### 1.3 Cold-Start Ranking — How We Score Popularity

The "popularity score" is **not arbitrary**. It is a composite of four measurable metrics:

| Metric                  | Weight | How It Is Measured                                                          |
|-------------------------|--------|----------------------------------------------------------------------------|
| **Cultural Reach**      | 0.30   | Google Trends search volume (normalized 0–1 against the top style)          |
| **Market Size**         | 0.25   | Approximate commercial market size of clothing in this style (relative)     |
| **Versatility**         | 0.25   | Number of edges in the curated graph (more connections = more versatile)    |
| **Accessibility**       | 0.20   | How easy it is for a newcomer to adopt (availability × price range)        |

```
popularityScore(style) =
    0.30 × culturalReach +
    0.25 × marketSize +
    0.25 × versatility +
    0.20 × accessibility
```

#### Metric Details

**Cultural Reach (0.30):**
Based on Google Trends data. Casual dominates with a peak interest score of 77 (Dec 2025), compared to Streetwear at 25. Normalized so the highest = 1.0.

| Style      | Trend Volume (approx.) | Normalized |
|------------|------------------------|------------|
| Casual     | 77                     | 1.00       |
| Classic    | 55                     | 0.71       |
| Minimalist | 50                     | 0.65       |
| Sporty     | 45                     | 0.58       |
| Streetwear | 25                     | 0.32       |
| Romantic   | 20                     | 0.26       |
| Bohemian   | 18                     | 0.23       |
| Luxury     | 30                     | 0.39       |
| Edgy       | 15                     | 0.19       |
| Artsy      | 12                     | 0.16       |

**Market Size (0.25):**
The casual wear market alone is projected at $791.4B by 2034 (from $580.7B in 2025). Other styles' relative market sizes are estimated against casual as the baseline (1.0).

| Style      | Relative Market Size |
|------------|---------------------|
| Casual     | 1.00                |
| Sporty     | 0.80                |
| Classic    | 0.70                |
| Streetwear | 0.55                |
| Minimalist | 0.45                |
| Luxury     | 0.40                |
| Romantic   | 0.30                |
| Bohemian   | 0.25                |
| Edgy       | 0.20                |
| Artsy      | 0.15                |

**Versatility (0.25):**
Counted from the curated relationship graph — how many other broad categories this style connects to with edge weight ≥ 0.4.

| Style      | Graph Connections (≥0.4) | Normalized |
|------------|--------------------------|------------|
| Casual     | 4                        | 0.80       |
| Classic    | 4                        | 0.80       |
| Edgy       | 3                        | 0.60       |
| Bohemian   | 3                        | 0.60       |
| Streetwear | 3                        | 0.60       |
| Sporty     | 3                        | 0.60       |
| Minimalist | 2                        | 0.40       |
| Luxury     | 3                        | 0.60       |
| Romantic   | 2                        | 0.40       |
| Artsy      | 3                        | 0.60       |

**Accessibility (0.20):**
A qualitative assessment (1–5 scale, normalized) of how easy it is for someone to start dressing in this style. Considers: average price point, availability in mainstream stores, and wardrobe entry barrier.

| Style      | Score (1-5) | Normalized |
|------------|-------------|------------|
| Casual     | 5           | 1.00       |
| Sporty     | 5           | 1.00       |
| Classic    | 4           | 0.80       |
| Minimalist | 4           | 0.80       |
| Streetwear | 3           | 0.60       |
| Bohemian   | 3           | 0.60       |
| Romantic   | 3           | 0.60       |
| Edgy       | 2           | 0.40       |
| Luxury     | 1           | 0.20       |
| Artsy      | 2           | 0.40       |

### 1.4 Computed Popularity Scores

Applying the formula `0.30 × culturalReach + 0.25 × marketSize + 0.25 × versatility + 0.20 × accessibility`:

| Style      | Cultural (×0.30) | Market (×0.25) | Versatile (×0.25) | Access (×0.20) | **Total** |
|------------|------------------|----------------|--------------------|----------------|-----------|
| Casual     | 0.300            | 0.250          | 0.200              | 0.200          | **0.950** |
| Classic    | 0.213            | 0.175          | 0.200              | 0.160          | **0.748** |
| Sporty     | 0.174            | 0.200          | 0.150              | 0.200          | **0.724** |
| Minimalist | 0.195            | 0.113          | 0.100              | 0.160          | **0.568** |
| Streetwear | 0.096            | 0.138          | 0.150              | 0.120          | **0.504** |
| Luxury     | 0.117            | 0.100          | 0.150              | 0.040          | **0.407** |
| Bohemian   | 0.069            | 0.063          | 0.150              | 0.120          | **0.402** |
| Romantic   | 0.078            | 0.075          | 0.100              | 0.120          | **0.373** |
| Edgy       | 0.057            | 0.050          | 0.150              | 0.080          | **0.337** |
| Artsy      | 0.048            | 0.038          | 0.150              | 0.080          | **0.316** |

This produces a **defensible ranking** grounded in real data rather than gut feeling.

### 1.5 Why Not a Style Quiz Instead?

Recent research (NLDL 2025) proposes "Style-Quiz" — showing visual pairs and asking "which do you prefer?" to cluster users via hierarchical embeddings. This is a valid alternative that converges faster to the user's taste.

We chose **popular-first browsing** over a quiz for v1 because:
- Lower friction: no mandatory quiz before the user can explore
- Discovery-oriented: users may not know what they like until they see it
- Simpler implementation: no image clustering pipeline needed locally

A quiz can be added later as an **optional** onboarding step to accelerate cold-start convergence. The underlying engine (attribute vectors, similarity, profile building) would remain the same — the quiz simply provides initial picks faster.

### 1.6 Refreshing the Data

The popularity metrics (cultural reach, market size) shift over time. The catalog should be **reviewed every 6–12 months** with updated Google Trends data and market reports. Sub-styles are more volatile than broad categories — a sub-style that drops below the longevity threshold should be deprecated and replaced.

---

## 2. Hierarchical Style Catalog

Styles are organized in two tiers:

### 2.1 Broad Categories

The top level contains approximately 10 broad fashion archetypes. Each represents a distinct aesthetic family:

| # | Category    | Description                                                        |
|---|-------------|--------------------------------------------------------------------|
| 1 | Casual      | Everyday comfort-first dressing; relaxed fits and easy pieces      |
| 2 | Classic     | Timeless, polished wardrobe staples; clean lines and neutral tones |
| 3 | Streetwear  | Urban-influenced; graphic tees, sneakers, bold logos               |
| 4 | Minimalist  | Pared-back, intentional; monochrome and simple silhouettes         |
| 5 | Bohemian    | Free-spirited; flowing fabrics, earthy tones, layered accessories  |
| 6 | Sporty      | Athletic-inspired; activewear crossover, functional fabrics        |
| 7 | Romantic    | Soft, feminine details; florals, lace, flowing shapes              |
| 8 | Edgy        | Dark palette, leather, asymmetry, rebellious undertones            |
| 9 | Luxury      | High-end, glamorous; rich fabrics, statement pieces, opulence      |
| 10| Artsy       | Eclectic, creative expression; unexpected combinations and prints  |

### 2.2 Sub-Styles

Each broad category contains 3–6 fine-grained sub-styles. Sub-styles inherit the broad category's general character but add specificity:

| Broad Category | Sub-Styles                                                             |
|----------------|------------------------------------------------------------------------|
| Casual         | Relaxed Casual, Smart Casual, Resort Casual, Coastal                   |
| Classic        | Preppy, Old Money, Business Classic, Ivy League                        |
| Streetwear     | Hypebeast, Skater, Techwear, Y2K                                       |
| Minimalist     | Scandinavian Minimal, Japanese Minimal, Monochrome, Quiet Luxury        |
| Bohemian       | Boho Chic, Hippie, Cottagecore, Festival                                |
| Sporty         | Athleisure, Gorpcore, Retro Sport, Performance                         |
| Romantic       | Soft Feminine, Dark Romance, Cottagecore Romantic, Balletcore           |
| Edgy           | Punk, Grunge, Gothic, Biker, Dark Academia                             |
| Luxury         | High Fashion, Red Carpet Glam, Quiet Luxury, Resort Luxe               |
| Artsy          | Avant-Garde, Art Teacher, Maximalist, Vintage Eclectic                 |

> **Note:** Some sub-styles (e.g. "Quiet Luxury") appear under multiple broad categories. This is intentional — they sit at the intersection of aesthetics and serve as natural bridges in the recommendation graph.

---

## 3. Style Attributes

Every style (broad and sub) carries an **attribute vector** that numerically describes its aesthetic properties. These vectors power the similarity computation.

### 3.1 Attribute Definitions

| Attribute         | Type        | Range / Values                                      | Description                              |
|-------------------|-------------|-----------------------------------------------------|------------------------------------------|
| `formality`       | float       | 1.0 – 5.0                                          | 1 = very casual, 5 = very formal         |
| `colorPalette`    | enum set    | neutral, earth, bold, pastel, dark, monochrome       | Dominant color tendencies                |
| `silhouette`      | enum set    | relaxed, structured, bodycon, oversized, tailored    | Typical garment shapes                   |
| `patternLevel`    | float       | 1.0 – 5.0                                          | 1 = minimal patterns, 5 = heavy patterns |
| `textureRichness` | float       | 1.0 – 5.0                                          | 1 = plain fabrics, 5 = rich/mixed        |
| `mood`            | enum set    | playful, serious, romantic, edgy, clean, artistic    | Emotional tone of the aesthetic          |

### 3.2 Example Attribute Vectors

**Minimalist (broad):**
```
formality:       3.0
colorPalette:    {neutral, monochrome}
silhouette:      {structured, tailored}
patternLevel:    1.5
textureRichness: 2.0
mood:            {clean, serious}
```

**Bohemian (broad):**
```
formality:       1.5
colorPalette:    {earth, pastel}
silhouette:      {relaxed, oversized}
patternLevel:    4.0
textureRichness: 4.5
mood:            {playful, romantic, artistic}
```

**Dark Academia (sub-style under Edgy):**
```
formality:       3.5
colorPalette:    {earth, dark}
silhouette:      {structured, tailored}
patternLevel:    2.5
textureRichness: 3.5
mood:            {serious, romantic}
```

---

## 4. Curated Relationship Graph

In addition to computed attribute similarity, a **hand-curated graph** defines explicit relationships between styles. Each edge has a **weight** from 0.0 to 1.0 representing how strongly two styles are related.

### 4.1 Why Both Curated and Computed?

- **Curated relationships** capture expert fashion knowledge that attribute vectors alone may miss (e.g. "Streetwear and Skater share cultural roots" even if their attribute profiles differ somewhat).
- **Attribute similarity** catches connections that curators might overlook or that emerge from the data (e.g. "Dark Academia and Preppy have surprisingly close attribute vectors").
- The hybrid approach is more robust than either alone.

### 4.2 Graph Structure

The graph is **bidirectional** — if Minimalist relates to Classic at 0.8, Classic also relates to Minimalist at 0.8.

Curated edges exist at **both** the broad and sub-style levels. Broad-to-broad edges capture family-level affinity. Sub-to-sub edges capture finer connections.

**Broad-level edges (sample):**

```
Casual      --0.7-- Sporty
Casual      --0.6-- Bohemian
Classic     --0.8-- Minimalist
Classic     --0.5-- Luxury
Streetwear  --0.7-- Sporty
Streetwear  --0.6-- Edgy
Minimalist  --0.5-- Luxury
Bohemian    --0.6-- Artsy
Bohemian    --0.5-- Romantic
Romantic    --0.4-- Luxury
Edgy        --0.5-- Artsy
Luxury      --0.4-- Artsy
```

**Sub-style edges (sample):**

```
Smart Casual     --0.8-- Preppy
Smart Casual     --0.7-- Scandinavian Minimal
Quiet Luxury     --0.8-- Old Money
Quiet Luxury     --0.7-- Scandinavian Minimal
Dark Academia    --0.7-- Preppy
Dark Academia    --0.6-- Gothic
Cottagecore      --0.8-- Cottagecore Romantic
Athleisure       --0.7-- Relaxed Casual
Gorpcore         --0.6-- Techwear
Y2K              --0.5-- Retro Sport
Avant-Garde      --0.6-- High Fashion
Vintage Eclectic --0.6-- Boho Chic
```

### 4.3 Graph Maintenance

The graph is **static data** shipped with the app. When new sub-styles are added (e.g. trend-driven styles), new edges are curated and added to the dataset. The graph does not change at runtime based on user behavior.

---

## 5. Suggestion Algorithm

### 5.1 Phase 1 — Cold Start (No User Data)

When a user has not yet picked any styles:

1. Each broad category has a **popularity score** computed from the methodology in Section 1.3 (cultural reach, market size, versatility, accessibility).
2. Present all broad categories sorted by popularity score (highest first).
3. The user browses the list and picks one.

The computed popularity scores (see Section 1.4 for the full breakdown):

| Rank | Category   | Score |
|------|------------|-------|
| 1    | Casual     | 0.950 |
| 2    | Classic    | 0.748 |
| 3    | Sporty     | 0.724 |
| 4    | Minimalist | 0.568 |
| 5    | Streetwear | 0.504 |
| 6    | Luxury     | 0.407 |
| 7    | Bohemian   | 0.402 |
| 8    | Romantic   | 0.373 |
| 9    | Edgy       | 0.337 |
| 10   | Artsy      | 0.316 |

These scores are refreshed periodically (see Section 1.6). A future backend-enabled version can incorporate aggregate user engagement data as an additional metric.

### 5.2 Phase 2 — After First Pick

When the user selects a style **S**:

**Step 1: Gather curated neighbors**
- Look up all styles connected to S in the relationship graph.
- Each neighbor gets a `curated_score` equal to the edge weight (0.0 – 1.0).
- Styles not in S's adjacency list get `curated_score = 0.0`.

**Step 2: Compute attribute similarity**
- Calculate the similarity between S's attribute vector and every other style's attribute vector (see Section 6 for the formula).
- Each style gets an `attribute_score` between 0.0 and 1.0.

**Step 3: Combine scores**

```
combined_score = (0.6 × curated_score) + (0.4 × attribute_score)
```

The 0.6 / 0.4 split gives curated relationships more influence, since they encode expert fashion knowledge.

**Step 4: Rank and present**
- Sort all styles by `combined_score` descending.
- Exclude already-picked styles.
- Return the top N results (recommended: **6 suggestions** per round).
- The results should include a mix of sub-styles within S's broad category and styles from neighboring broad categories.

### 5.3 Phase 3 — Building a Preference Profile

As the user picks multiple styles over time, a **User Style Profile** is constructed:

**Profile vector computation:**

```
userProfile.attributes = weightedAverage(
    pickedStyles.map(s => s.attributes),
    recencyWeights
)
```

Where `recencyWeights` assigns higher weight to more recently picked styles. A simple decay:

```
weight(i) = decayFactor ^ (totalPicks - 1 - i)
```

With `decayFactor = 0.8`, the most recent pick gets weight 1.0, the previous gets 0.8, then 0.64, and so on.

**Suggestion computation with profile:**

When the user has picked multiple styles (P1, P2, ... Pn):

1. **Curated neighbors**: Union of all curated neighbors of P1...Pn. If a style appears as a neighbor of multiple picked styles, sum (and cap at 1.0) the edge weights.
2. **Attribute similarity**: Compute similarity between the `userProfile` vector and all candidate styles.
3. **Combined score**: Same formula — `(0.6 × curated_score) + (0.4 × attribute_score)`.
4. **Rank, filter, present** as before.

---

## 6. Similarity Computation

### 6.1 Formula

For two styles **A** and **B**:

```
similarity(A, B) =
    w_form      × numericSim(A.formality, B.formality) +
    w_color     × jaccardSim(A.colorPalette, B.colorPalette) +
    w_silhouette × jaccardSim(A.silhouette, B.silhouette) +
    w_pattern   × numericSim(A.patternLevel, B.patternLevel) +
    w_texture   × numericSim(A.textureRichness, B.textureRichness) +
    w_mood      × jaccardSim(A.mood, B.mood)
```

### 6.2 Numeric Similarity

For numeric attributes on a 1–5 scale:

```
numericSim(a, b) = 1 - (|a - b| / 4)
```

The denominator is 4 (max possible difference on a 1–5 scale). This yields:
- Identical values → 1.0
- Maximum difference (1 vs 5) → 0.0

### 6.3 Jaccard Similarity

For enum-set attributes:

```
jaccardSim(setA, setB) = |setA ∩ setB| / |setA ∪ setB|
```

- Both sets identical → 1.0
- No overlap → 0.0
- Partial overlap → proportional value

If both sets are empty, return 1.0 (both have "no" value — they agree).

### 6.4 Attribute Weights

| Attribute         | Weight | Rationale                                               |
|-------------------|--------|---------------------------------------------------------|
| `mood`            | 0.25   | Emotional resonance is the strongest style signal        |
| `formality`       | 0.20   | Defines the lifestyle context of dressing               |
| `colorPalette`    | 0.20   | Color is the most immediately visible style marker      |
| `silhouette`      | 0.15   | Shape defines how clothes feel on the body              |
| `textureRichness` | 0.10   | Texture distinguishes styles at a tactile level         |
| `patternLevel`    | 0.10   | Pattern adds personality but is less defining than mood |

Weights sum to 1.0. They are tunable — future versions can optimize these based on user engagement data.

---

## 7. User Style Profile

### 7.1 Data Structure

```
UserStyleProfile:
    pickedStyleIds:    List<String>       // ordered by pick time (oldest first)
    pickedAt:          List<DateTime>     // timestamp of each pick
    computedAttributes: StyleAttributes   // weighted-average attribute vector
    lastUpdated:       DateTime
```

### 7.2 Profile Update Logic

Every time the user picks a new style:

1. Append the style ID and timestamp to the picked lists.
2. Recompute `computedAttributes`:
   - For each numeric attribute, compute weighted average using recency weights.
   - For each enum-set attribute, collect all values from picked styles weighted by recency, and include values that exceed a threshold (e.g. total weight > 0.3).
3. Update `lastUpdated`.

### 7.3 Enum-Set Aggregation

For enum-set attributes (colorPalette, silhouette, mood), the profile aggregation works as follows:

1. For each possible enum value, sum the recency-weighted contribution from all picked styles that include that value.
2. Normalize by dividing by the sum of all recency weights.
3. Include the enum value in the profile if its normalized score exceeds **0.3** (tunable threshold).

**Example:** User picked 3 styles with recency weights [0.64, 0.8, 1.0]:
- Style 1 (weight 0.64): mood = {playful, clean}
- Style 2 (weight 0.8): mood = {clean, serious}
- Style 3 (weight 1.0): mood = {clean, edgy}

Scores per mood value:
- playful: 0.64 / 2.44 = 0.26 → below 0.3, excluded
- clean: (0.64 + 0.8 + 1.0) / 2.44 = 1.0 → included
- serious: 0.8 / 2.44 = 0.33 → included
- edgy: 1.0 / 2.44 = 0.41 → included

Profile mood = {clean, serious, edgy}

---

## 8. Data Storage

### 8.1 Static Data (Read-Only, Shipped with App)

The style catalog — categories, sub-styles, attribute vectors, curated graph edges, and popularity scores — is bundled as **static Dart data** within the app. This avoids file I/O overhead and keeps the data type-safe.

This data does not change at runtime. Updates ship with app releases.

### 8.2 User Data (Read-Write, Persisted Locally)

The user's style profile (picked styles, computed attributes, timestamps) is persisted using **SharedPreferences** (for simple key-value data) or a **local JSON file** for the full profile.

This matches the app's existing local-first pattern (e.g. `onboarding_complete` flag in SharedPreferences).

---

## 9. Algorithm Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        NEW USER                             │
│                    (no style data)                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│          COLD START: Show broad categories                  │
│          sorted by popularity score                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              USER PICKS A STYLE                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
          ┌───────┴───────┐
          ▼               ▼
┌─────────────────┐ ┌────────────────────┐
│ Update user     │ │ Compute            │
│ style profile   │ │ suggestions        │
│ (add pick,      │ │                    │
│  recompute      │ │  ┌──────────────┐  │
│  attribute      │ │  │ Curated      │  │
│  vector)        │ │  │ neighbors    │  │
│                 │ │  │ (weight 0.6) │  │
│                 │ │  └──────┬───────┘  │
│                 │ │         │           │
│                 │ │  ┌──────┴───────┐  │
│                 │ │  │ Attribute    │  │
│                 │ │  │ similarity   │  │
│                 │ │  │ (weight 0.4) │  │
│                 │ │  └──────┬───────┘  │
│                 │ │         │           │
│                 │ │  ┌──────┴───────┐  │
│                 │ │  │ Combine,     │  │
│                 │ │  │ rank, filter │  │
│                 │ │  └──────────────┘  │
└─────────────────┘ └────────┬───────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │ PRESENT TOP 6 SUGGESTED  │
              │ STYLES TO USER           │
              └─────────────┬────────────┘
                            │
                            ▼
                    (user picks again)
                    ↻ loop back to
                      "USER PICKS A STYLE"
```

---

## 10. Worked Example

### Scenario: New user picks "Minimalist"

**Step 1 — Cold start:** User sees all 10 broad categories. Casual is first (0.95), Classic second (0.90), Minimalist third (0.85). User selects **Minimalist**.

**Step 2 — Curated neighbors of Minimalist (broad):**

| Neighbor    | Edge Weight (curated_score) |
|-------------|----------------------------|
| Classic     | 0.8                        |
| Luxury      | 0.5                        |

Sub-style neighbors of Minimalist's sub-styles also contribute.

**Step 3 — Attribute similarity (top matches):**

Minimalist attributes: `formality=3.0, color={neutral, monochrome}, silhouette={structured, tailored}, pattern=1.5, texture=2.0, mood={clean, serious}`

| Style          | Attribute Similarity |
|----------------|---------------------|
| Classic        | 0.78                |
| Quiet Luxury   | 0.75                |
| Scandinavian M.| 0.92 (same family)  |
| Dark Academia  | 0.61                |
| Smart Casual   | 0.58                |
| Preppy         | 0.52                |

**Step 4 — Combined scores:**

| Style              | Curated (×0.6) | Attribute (×0.4) | Combined |
|--------------------|----------------|------------------|----------|
| Classic            | 0.48           | 0.31             | 0.79     |
| Scandinavian Min.  | 0.00*          | 0.37             | 0.37     |
| Quiet Luxury       | 0.00*          | 0.30             | 0.30     |
| Luxury             | 0.30           | 0.18             | 0.48     |
| Dark Academia      | 0.00*          | 0.24             | 0.24     |
| Smart Casual       | 0.00*          | 0.23             | 0.23     |

*These have sub-style-level curated edges that would add to their scores in a full implementation.

**Result:** Suggest Classic, Luxury, Scandinavian Minimal, Quiet Luxury, Dark Academia, Smart Casual.

### After user also picks "Dark Academia"

Profile vector shifts — formality rises (3.0 → 3.25), mood adds "romantic", colorPalette adds "dark" and "earth". Suggestions now favor styles that bridge Minimalist's clean aesthetic with Dark Academia's scholarly, darker tone — e.g. Preppy, Gothic, Old Money rise in ranking.

---

## 11. Future Implementation Files

When the logic is ready to be coded in Dart:

| File                                          | Purpose                                        |
|-----------------------------------------------|-------------------------------------------------|
| `lib/features/style/style_models.dart`        | Data classes: StyleCategory, SubStyle, StyleAttributes, CuratedEdge, UserStyleProfile |
| `lib/features/style/style_catalog.dart`       | Static data: all categories, sub-styles, attribute vectors, curated graph, popularity scores |
| `lib/features/style/style_engine.dart`        | Core logic: similarity computation, suggestion ranking, score combination |
| `lib/features/style/user_style_profile.dart`  | Profile management: update on pick, recency weighting, persistence via SharedPreferences |

---

## 12. Open Design Questions

- **Full sub-style catalog**: The exact list of sub-styles and their attribute vectors needs fashion-domain curation using the selection criteria in Section 1.2. The examples in this document are representative but not exhaustive.
- **Suggestion count**: 6 per round is recommended, but this may need tuning based on UI constraints.
- **Negative signals**: Should users be able to "dislike" a style? This would subtract from the profile vector rather than add. Not included in v1 but worth considering.
- **Placement in app flow**: Where does style suggestion appear? Options include during onboarding (after colour preferences), as a dedicated screen, or integrated into the home feed.
- **Style images**: Each style needs a representative image or mood board for the UI. Image sourcing is outside the scope of this logic document.
