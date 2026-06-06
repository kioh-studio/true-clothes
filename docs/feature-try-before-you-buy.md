# Feature Spec: "Will It Work?" — Try Before You Buy

---

## The Insight

Every wardrobe app helps you organize what you HAVE.
No app helps you decide what to BUY.

But the moment of highest anxiety in fashion isn't "what should I wear?" — it's **"should I buy this?"** Users standing in a store or browsing online are thinking:

- "Does this go with anything I own?"
- "Will this fit my body?"
- "Do I already have something like this?"
- "Is this worth the money?"

**True Clothes is the only app that can answer all four questions** — because we already have the user's body measurements, style profile, color palette, and full wardrobe.

---

## User Flows

### Flow 1: Share a Link (Online Shopping)

```
User browsing Zara/Uniqlo/ASOS on phone
  → Sees item they like
  → Taps "Share" → selects True Clothes
  → App opens with item loading screen (2-3 seconds)
  → BOOM: Full analysis appears
```

**What the app does behind the scenes:**
1. Receives URL via iOS/Android share sheet
2. Fetches page → extracts product data (name, price, images, colors, material, size chart)
3. Creates a **virtual ClothingItem** from extracted data
4. Runs fit engine with virtual item injected into wardrobe
5. Filters results to only outfits containing the virtual item
6. Computes verdict scores

### Flow 2: Snap a Photo (In-Store Shopping)

```
User in H&M, sees a jacket on a rack
  → Opens True Clothes → taps camera icon (or "Will it work?" button)
  → Takes photo of the item (on hanger, mannequin, or tag)
  → AI identifies: category, color, material, estimated style
  → App asks: "Is this a [Navy Wool Jacket]?" → user confirms/adjusts
  → BOOM: Full analysis appears
```

**What the app does behind the scenes:**
1. Vision AI analyzes photo → classifies item (category, color, pattern, material)
2. If price tag visible, OCR extracts price + brand
3. Creates virtual ClothingItem from detected attributes
4. Same fit engine pipeline as Flow 1

### Flow 3: Copy-Paste Link (Manual)

```
User copies product URL from any browser/app
  → Opens True Clothes → app detects clipboard link (or paste into search)
  → Same pipeline as Flow 1
```

### Flow 4: "What Should I Buy Next?" (Proactive)

```
User opens "Wardrobe Gaps" screen
  → App shows: "Adding a [neutral sneaker] would unlock 12 new outfits"
  → User taps → sees recommended items from partner retailers
  → Each recommendation shows outfit previews with existing wardrobe
```

---

## The Verdict Screen (Core UI)

This is the most important screen in the feature. It must feel like getting advice from a brilliant friend who knows your entire closet.

### Layout

```
┌─────────────────────────────────────┐
│         [Product Image]             │
│      Navy Wool Jacket — Zara        │
│           $89.90                    │
├─────────────────────────────────────┤
│                                     │
│   ┌──────────────────────────────┐  │
│   │     ★ WORTH IT               │  │
│   │                              │  │
│   │  This item creates           │  │
│   │  8 NEW OUTFITS               │  │
│   │  from your wardrobe          │  │
│   │                              │  │
│   │  Avg match score: 84%        │  │
│   │  Est. cost per wear: $4.50   │  │
│   └──────────────────────────────┘  │
│                                     │
│  FIT FOR YOUR BODY          92%  ●● │
│  ├ Shoulders               great    │
│  ├ Chest                   good     │
│  └ Sleeve length           check    │
│                                     │
│  STYLE MATCH                87%  ●● │
│  Aligns with: Old Money, Minimalist │
│                                     │
│  COLOR HARMONY              81%  ●● │
│  Works with 14 of your 22 items     │
│                                     │
├─────────────────────────────────────┤
│  OUTFITS WITH THIS ITEM             │
│                                     │
│  [Outfit 1]  [Outfit 2]  [Outfit 3] │
│  Score: 91%  Score: 87%  Score: 84% │
│                                     │
│  ← swipe for 5 more →              │
│                                     │
├─────────────────────────────────────┤
│  ⚠ HEADS UP                         │
│                                     │
│  You already own 2 similar jackets: │
│  [MA-1 Navy] [Harrington]           │
│  This adds variety but overlaps     │
│  with existing outerwear.           │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [  ADD TO WARDROBE  ]  ← bought it │
│  [  SAVE FOR LATER   ]  ← wishlist  │
│  [  SKIP             ]              │
│                                     │
└─────────────────────────────────────┘
```

### The Verdict System

The verdict is the hero element — a single word that answers "should I buy this?"

| Verdict | Condition | Visual |
|---|---|---|
| **WORTH IT** | Creates 5+ new outfits, avg score > 75%, no close duplicates | Green badge, large |
| **GOOD ADD** | Creates 3-4 new outfits OR fills a wardrobe gap | Blue badge |
| **THINK TWICE** | Creates < 3 outfits OR close duplicate exists | Amber badge |
| **SKIP IT** | Creates 0-1 outfits AND duplicate exists AND low style match | Red badge, subtle |

The verdict is honest. Sometimes the answer is "don't buy this." That honesty builds trust that no shopping app can match.

---

## Scoring: How "Will It Work?" Uses the Existing Fit Engine

### Current Architecture (Already Built)

```
wardrobe[] → toFitItem() → generateCandidates() → rankCandidates() → ScoredOutfit[]
                                                         │
                                                    scores each by:
                                                    - styleCoherence (40%)
                                                    - colorHarmony (35%)
                                                    - fitScore (25%)
```

### "Will It Work?" Extension (New)

```
wardrobe[] + virtualItem → toFitItem() → generateCandidates() → rankCandidates() → ScoredOutfit[]
                                                                        │
                                                                   FILTER: only outfits
                                                                   containing virtualItem
                                                                        │
                                                                   COMPUTE:
                                                                   - newOutfitCount
                                                                   - avgMatchScore
                                                                   - bodyFitBreakdown
                                                                   - duplicateCheck
                                                                   - wardrobeGapFill
                                                                   - estCostPerWear
                                                                        │
                                                                   VERDICT → UI
```

### New Functions Needed

```typescript
// ─── Virtual Item Creation ──────────────────────────────────────────────────

interface ScrapedProduct {
  url?: string;
  name: string;
  brand?: string;
  price?: number;
  currency?: string;
  imageUrl: string;
  category?: string;        // detected or scraped
  colors?: string[];         // detected or scraped
  material?: string;         // scraped from product page
  sizeChart?: SizeChartEntry[];  // scraped measurement table
  sizes?: string[];          // available sizes
}

interface VirtualClothingItem extends ClothingItem {
  isVirtual: true;           // flag: not in real wardrobe
  source: 'link' | 'photo' | 'manual';
  sourceUrl?: string;
  scrapedAt: string;         // ISO timestamp
}

function scrapedToClothingItem(product: ScrapedProduct): VirtualClothingItem;

// ─── Try-Before-You-Buy Analysis ────────────────────────────────────────────

interface TryOnVerdict {
  verdict: 'worth_it' | 'good_add' | 'think_twice' | 'skip_it';
  newOutfitCount: number;        // outfits possible WITH this item that weren't before
  avgMatchScore: number;         // average totalScore of new outfits
  topOutfits: ScoredOutfit[];    // best 8 outfits containing this item
  
  // Body fit
  bodyFitScore: number;          // 0-1, from fitMatcher
  bodyFitBreakdown: FitPoint[];  // per-measurement fit details
  
  // Style analysis
  styleMatchScore: number;       // how well it fits user's style profile
  matchingStyles: string[];      // which user styles this aligns with
  
  // Color analysis
  colorHarmonyScore: number;     // how well it works with wardrobe colors
  compatibleItemCount: number;   // items in wardrobe it pairs with
  totalWardrobeItems: number;    // for "works with X of Y items"
  
  // Duplicate detection
  similarItems: ClothingItem[];  // existing items in same category + similar color
  isDuplicate: boolean;          // true if very close match exists
  
  // Value analysis
  estimatedCostPerWear?: number; // price ÷ estimated wears (based on similar items' wear rate)
  wardrobeGapFilled?: string;    // e.g., "neutral shoe" if this fills a detected gap
}

function analyzeVirtualItem(
  virtualItem: VirtualClothingItem,
  wardrobe: ClothingItem[],
  ctx: EngineContext,
): TryOnVerdict;
```

### Duplicate Detection Logic

```typescript
function findSimilarItems(
  virtualItem: FitItem,
  wardrobeItems: FitItem[],
): { item: FitItem; similarity: number }[] {
  // Score similarity based on:
  // 1. Same category (must match)
  // 2. Color distance (primaryColor + lightness + saturation)
  // 3. Fabric similarity (weight + season)
  // 4. Style tag overlap
  // 
  // Threshold: > 0.75 similarity = "similar item exists"
  // Threshold: > 0.90 similarity = "you basically own this already"
}
```

### Wardrobe Gap Detection Logic

```typescript
interface WardrobeGap {
  description: string;          // "neutral sneaker", "dark outerwear"
  category: ItemCategory;
  missingAttributes: Partial<ColorProfile & FabricProfile>;
  outfitsUnlocked: number;      // how many new outfits this gap blocks
}

function detectWardrobeGaps(
  wardrobe: FitItem[],
  ctx: EngineContext,
): WardrobeGap[];

// Then when analyzing a virtual item:
function fillsGap(
  virtualItem: FitItem,
  gaps: WardrobeGap[],
): WardrobeGap | undefined;
```

---

## Product Data Extraction

### From Links (Web Scraping / Structured Data)

**Primary approach: Structured data parsing (validated via research)**
Over 50% of major online retailers embed JSON-LD `schema.org/Product` markup in their HTML. This gives us name, price, brand, description, color, material, images, and offers — structured and free.

```typescript
// Priority order for extraction:
// 1. JSON-LD Product schema (richest data: name, price, color, material, images, brand)
// 2. Open Graph tags (name, image, price)
// 3. Meta tags (supplemental)
// 4. Claude Vision analysis of product image (fallback for missing attributes)
// 5. Diffbot Product API (last resort, $299/mo — defer until scale)
```

**Supported retailers (priority order for launch):**

| Tier | Retailers | Why |
|---|---|---|
| Tier 1 | Uniqlo, Zara, H&M, ASOS | Core demographic, good structured data |
| Tier 2 | Nike, Adidas, COS, & Other Stories | Style-conscious shoppers |
| Tier 3 | Nordstrom, SSENSE, Mr Porter, NET-A-PORTER | Premium/luxury segment |
| Tier 4 | Amazon, generic product pages | Broad coverage |

**Edge function approach:**
```
User shares link → App sends URL to Supabase Edge Function
  → Edge function fetches page HTML
  → Parses JSON-LD / OG / meta (covers 80-90% of major retailers)
  → Downloads product image
  → Sends image to Claude Vision for color/category confirmation
  → Returns ScrapedProduct to app
```

**Fallback for JS-rendered pages:** If static fetch fails (SPAs), use ScrapingBee/Scrapfly headless browser proxy (~$50/mo). Defer until needed — most product pages server-render for SEO.

### Share Sheet Integration (Validated)

**Library: `expo-share-intent`** — drop-in Expo config plugin.

```bash
npx expo install expo-share-intent
```

```typescript
// In root layout:
import { useShareIntent } from 'expo-share-intent';

const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
// shareIntent contains the shared URL/text/files
// On iOS: creates a Share Extension target
// On Android: registers intent filters
```

Works with Expo Router. User shares from Safari/Chrome/Instagram → True Clothes appears in share sheet → app opens with URL → analysis begins.

**Note:** Requires EAS Build (not Expo Go) for native share extension.

### From Photos (Vision AI — Validated)

**Primary: Claude Vision API** (already in our stack dependency chain)
Claude Vision can classify garments directly from photos — no custom ML model or training needed. Works with real-world photos (hangers, mannequins, flat-lays, rack shots).

**Production scale alternative:** Ximilar Fashion Tagging API — dedicated fashion classification returning category, subcategory, color, material, pattern, design, style tags. Usage-based pricing. Evaluate at >10K analyses/month.

**Visual search (find product online from photo):** Google Lens via SerpApi (`engine=google_lens`) — returns visual matches with product links and prices. Useful for in-store: snap photo → find exact product online → scrape full details.

```
User takes photo → Send to Claude Vision API via Supabase Edge Function
  → Prompt: "Classify this clothing item. Return JSON:
     - category (top/bottom/outerwear/shoes/accessory)
     - primary color
     - secondary color (if any)
     - pattern (solid/striped/plaid/etc)
     - material (best guess: cotton/wool/denim/leather/etc)
     - garment type (tee/jacket/jeans/etc)
     - estimated formality (1-5)
     - brand (if visible)"
  → Returns structured classification
  → User confirms/adjusts
  → Creates VirtualClothingItem
```

### Size Chart → Body Fit

When a product page has a size chart:
```
Scrape size chart table → Parse into structured measurements
  → User's selected size → extract garment measurements
  → Feed into fitMatcher.scoreItemFit() against user's body
  → Return per-measurement fit breakdown
```

When no size chart available:
```
Use category + brand defaults + user's body measurements
  → Estimate fit based on typical sizing for brand/category
  → Flag: "Fit estimate — no size chart available for this item"
```

---

## Where This Feature Lives in the App

### Entry Points (Multiple, All Low-Friction)

1. **Share sheet** — Share any URL to True Clothes from any app/browser
2. **Camera button** — Dedicated "Will it work?" camera on home screen
3. **Clipboard detection** — Open app with product URL copied → "Analyze this item?"
4. **Wardrobe screen** — "+" button gets new option: "Check an item before buying"
5. **Wardrobe gaps screen** — "Find items to fill this gap" → browse + analyze

### Navigation

```
Any entry point → Loading screen (extracting item data)
  → Verdict screen (the main analysis)
  → Tap outfit → Outfit detail (with virtual item highlighted)
  → "Add to wardrobe" → Item moves from virtual to real
  → "Save for later" → Goes to wishlist
```

### Wishlist (New Sub-Feature)

Items analyzed but not purchased go to a **Wishlist**:
- Stored with full verdict data
- Can re-analyze if wardrobe changes
- Price drop tracking (re-scrape periodically)
- "Items on your wishlist that went on sale" notification

---

## Growth Impact: Why This Feature Changes Everything

### It Shifts the Value Proposition

**Before this feature:**
> "True Clothes helps you style what you already own"
> (Utility app — nice to have, open a few times a week)

**After this feature:**
> "True Clothes helps you make smarter fashion decisions"
> (Decision tool — open EVERY TIME you shop, which is often)

### Usage Frequency Multiplier

| Trigger | Frequency | Current App Opens | With "Will It Work?" |
|---|---|---|---|
| Getting dressed | Daily | 1/day | 1/day |
| Online shopping | 3-5x/week | 0 | 3-5/week |
| In-store shopping | 1-2x/week | 0 | 1-2/week |
| Browsing Instagram/TikTok | Daily | 0 | 1-3/day (see item → check it) |

**Potential 3-5x increase in daily app opens.**

### Viral Mechanics

| Moment | Viral Potential |
|---|---|
| "This app told me NOT to buy something and I'm grateful" | High — contrarian, trustworthy, shareable story |
| "This app showed me 8 outfits I could make with one jacket" | High — visual, satisfying, Instagram-friendly |
| "I saved $200 this month because the app said I already had similar items" | High — money-saving stories go viral |
| "Worth It" verdict screenshot shared before purchase | Medium — social validation of purchase decision |
| "My wardrobe gap was a neutral shoe — app found the perfect one" | Medium — personalized, relatable |

### Monetization Alignment

| Revenue Stream | How "Will It Work?" Enables It |
|---|---|
| **Affiliate links** | User sees outfit previews → decides to buy → app earns commission on purchase via affiliate link in "Buy" button |
| **Brand partnerships** | Brands pay to be "recommended" when filling wardrobe gaps — but ONLY if they genuinely score well (trust preserved) |
| **Premium tier** | Free: 3 analyses/month. Premium: unlimited + price tracking + wishlist + "What should I buy next?" proactive recommendations |
| **Data insights** | Anonymized purchase intent data is valuable to retailers (what people almost bought, what they skipped and why) |

---

## Competitive Moat

**Why no competitor can copy this easily:**

1. **Requires body measurements** — no other wardrobe app collects these
2. **Requires a working fit engine** — our 3-metric scorer with style + color + body is unique
3. **Requires a full wardrobe** — the analysis is only valuable if the app knows what you own
4. **Requires user trust** — telling someone NOT to buy something requires a relationship where the user believes the app has their interest at heart, not the retailer's

This feature is the natural culmination of everything True Clothes already does. Competitors would need to rebuild from scratch.

---

## Staged Rollout

### Stage 1 (Beta — Week 8-10): Photo Analysis Only
- Camera capture → AI classification → basic verdict (outfit count + style match)
- No link scraping yet (simpler to build, tests core value)
- No size chart parsing (use body + category estimation)
- Verdict: simplified (Good Add / Think Twice)
- Goal: validate that users actually use it and find it valuable

### Stage 2 (Launch — Week 14-16): Link Sharing + Full Verdict
- Share sheet integration (receive URLs from any app)
- JSON-LD / OG scraping for Tier 1 retailers
- Full verdict screen with all scores
- Duplicate detection
- Wishlist (save for later)
- Goal: 10%+ of active users analyze at least 1 item/week

### Stage 3 (Growth — Month 6-8): Proactive Recommendations
- Wardrobe gap detection → "What should I buy next?"
- Price drop tracking for wishlist items
- Affiliate integration for "Buy" buttons
- "Friends analyzed this item too" social proof
- Clipboard detection for effortless link capture
- Goal: feature becomes the #1 reason new users download

### Stage 4 (Monetization — Month 10+): Premium Intelligence
- Unlimited analyses (free tier: 5/month)
- "Smart shopping list" — AI-curated items that fill gaps, match style, within budget
- Brand-specific fit predictions ("Zara runs small in shoulders for your build")
- Purchase history analytics ("You've spent $X this year, here's your ROI per item")
- Goal: highest-converting premium feature

---

## User Messaging & Positioning

### The Tagline

> **"Your wardrobe has an opinion. Ask it."**

Or:

> **"Shop with your closet, not against it."**

Or:

> **"Every outfit this item could become — before you buy."**

### App Store Description Addition

> **Will It Work?** — Share any product link or snap a photo in-store. True Clothes instantly shows you how many outfits you can build with this item, whether it fits your body, matches your style, and if you already own something similar. Stop buying clothes that sit in your closet. Start buying clothes that work.

### The Sustainability Story

This feature is the most concrete sustainability feature any fashion app has ever built. It doesn't just tell users to "buy less" — it gives them a **decision tool** that naturally reduces impulse purchases by making the value (or lack thereof) of every potential purchase objectively visible.

> "True Clothes users make 40% fewer impulse purchases because they can see exactly how a new item fits their existing wardrobe before buying."

(Target metric — to be validated.)

---

## Technical Requirements Summary

| Component | Technology | Effort | Priority |
|---|---|---|---|
| Share sheet receiver | `expo-linking` + `expo-share-intent` | 2 days | P0 |
| Product page scraper | Supabase Edge Function + cheerio/parse5 | 1 week | P0 |
| Vision AI classifier | Claude Vision API / GPT-4V via edge function | 3 days | P0 |
| Virtual item creation | Extension of existing `ClothingItem` type | 1 day | P0 |
| "Outfits with this item" filter | Extension of `generateOutfits()` | 2 days | P0 |
| Duplicate detection | New module in fit engine | 2 days | P1 |
| Wardrobe gap detection | New module in fit engine | 3 days | P1 |
| Verdict screen UI | New screen following design system | 3 days | P0 |
| Wishlist storage | Supabase table + local cache | 2 days | P1 |
| Size chart parser | Edge function + structured extraction | 1 week | P2 |
| Price tracking | Cron job re-scraping wishlist URLs | 3 days | P2 |
| Affiliate link wrapping | URL rewriting via affiliate networks | 2 days | P2 |
| Clipboard detection | `expo-clipboard` listener on app foreground | 1 day | P1 |

**Total estimated effort: 4-5 weeks for full feature, 2 weeks for MVP (photo + basic verdict)**

---

## Why This Feature Is THE Feature

Every wardrobe app in existence is a **backward-looking tool**: organize what you already have.

"Will It Work?" makes True Clothes a **forward-looking advisor**: guide what you should acquire.

This single feature:
1. **Increases usage frequency 3-5x** (every shopping moment becomes an app-open moment)
2. **Creates the strongest viral mechanic** ("this app saved me from a bad purchase" stories)
3. **Enables sustainable monetization** (affiliate commissions on purchases users DO make)
4. **Deepens the moat** (requires body data + wardrobe data + fit engine — can't be copied easily)
5. **Aligns with user values** (sustainability, mindful consumption, buy less but better)
6. **Differentiates from every competitor** (nobody does this)

It transforms True Clothes from "a wardrobe app" into **"the fashion decision engine."**
