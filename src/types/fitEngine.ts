// Fit Engine — client-side types only.

// ─── Wardrobe (Supabase-backed) ──────────────────────────────────────────────

// Where an item's photo physically lives (feature 003-upload-image).
//   'none'  -> no photo
//   'local' -> on-device only (free tier); photoPath is a relative device path
//   'cloud' -> Supabase private bucket (premium); photoPath is the storage path
export type PhotoStorageKind = 'none' | 'local' | 'cloud'

// Garment measurement columns the fit engine reads (cm). Subset of the DB m_* set
// that maps to a controlled measurement key (feature 006-ai-item-extraction).
export type MKey =
  | 'm_chest' | 'm_shoulder_width' | 'm_sleeves' | 'm_body_length'
  | 'm_waist' | 'm_hip' | 'm_inseam' | 'm_thigh' | 'm_rise'
  | 'm_skirt_length' | 'm_shoe_size'

// Visual enrichment đợt 2 (feature 010 follow-up, 2026-07-03 schema / 2026-08-11
// client threading) — see WardrobeItem.printScale/drape/visualInterest below.
export type PrintScale = 'micro' | 'medium' | 'large'
export type Drape = 'structured' | 'regular' | 'fluid'

// Logo / statement-strength signals captured at ingest (feature 006).
// Stored in clothing_items.graphics (jsonb); NOT read by the engine yet.
export interface LogoSignal {
  present: boolean
  size: 'small' | 'medium' | 'large' | null
  kind: 'brand_logo' | 'slogan_text' | 'graphic' | null
  text: string | null
}

export interface WardrobeItem {
  id: string
  userId: string
  photoStorage: PhotoStorageKind   // discriminator for photoPath (feature 003)
  photoUrl: string | null    // resolved signed URL (cloud) — in-memory only, never persisted
  photoLocalUri: string | null // resolved absolute device file:// uri — in-memory only
  photoPath: string | null   // persisted: relative device path (local) OR storage path {userId}/{id}.jpg (cloud)
  category: 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory' | 'dress' | 'headwear'
  type: string | null        // granular DB type (TEE/JEANS/JACKET…) — drives collage layout
  colors: string[]           // named colour strings, never hex
  sizeLabel: string | null
  brand: string | null
  notes: string | null
  createdAt: string          // ISO timestamp
  name: string | null
  primaryColor: string | null
  material: string | null
  fit: string | null            // controlled fit (slim/regular/relaxed/wide/oversized) — engine reads this
  pattern: string | null
  warmthSeason: string[]
  measurements: Partial<Record<MKey, number>> | null  // garment measurements in cm (feature 006)
  graphics: LogoSignal | null   // logo signals — captured, not scored in MVP (feature 006)
  // Dual-role layering (feature 008): this top can be worn OPEN/OVER another top
  // as a layer (overshirt/cardigan/knit-over). NULL = AUTO (engine derives by
  // rule); true/false = explicit user/AI override.
  canLayer?: boolean | null
  // Measured-hex color layer (2026-07-06) — deterministic pixel-derived
  // dominant colour(s) of the item's isolated photo (colorCluster.ts, server-
  // side). Read-only here: set by generate-item-image at ingest or by the
  // backfill-item-metadata admin tool; null until that has run for this item.
  primaryHex: string | null
  secondaryHex: string | null
  // Distressed/worn-in finish (2026-08-11) — visible INTENTIONAL wear or
  // damage (rips, tears, frayed/raw hems, heavy fading/whiskering, acid/
  // stone wash, deliberately abraded surfaces), NOT natural texture/normal
  // wash/vintage styling without damage. Read-only here: set at ingest (AI
  // extraction) or by the backfill-item-metadata admin tool; null until
  // assessed — the engine's featuresPasses treats null as "unknown", never
  // as a rejection (fail-open).
  distressed: boolean | null
  // Visual enrichment đợt 2 (2026-07-03 schema, 2026-08-11 client threading) —
  // pattern/graphic scale AS WORN, how the fabric drapes, and how visually
  // striking the piece reads. Consumed server-side by the engine
  // (statementStrength/heroScore/housePOV in generate-outfits). Read-only
  // here: set at ingest (AI extraction only — on-device extract-by-item has
  // no visual-judgment source for these) or by the backfill-item-metadata
  // admin tool; null until assessed.
  printScale: PrintScale | null
  drape: Drape | null
  visualInterest: number | null
}


// Engine-internal types (FitItem, StyleConfig, FormulaPool, etc.) have moved
// to the generate-outfits Edge Function in supabase/functions/.
// All measurements in centimeters.

// ─── Body Measurements ───────────────────────────────────────────────────────

export type PreferredFit = 'SLIM' | 'REGULAR' | 'RELAXED' | 'OVERSIZED';

export type { BodyShape } from './measurements';

export interface BodyMeasurements {
  body_height?: number;
  body_weight?: number;
  body_bust?: number;
  body_waist?: number;
  body_shoulder_width?: number;
  body_sleeve_length?: number;
  body_upper_body_length?: number;
  body_upper_arm?: number;
  body_neck?: number;
  body_hip?: number;
  body_inseam?: number;
  body_thigh?: number;
  body_rise?: number;
  body_foot_length?: number;
  body_foot_width?: number;
  // Derived from bust/waist/hip via computeBodyShape() at save time; persisted
  // so the try-on prompt and future features can read it without re-deriving.
  // `null` explicitly clears the stored value (derivation measurements are no
  // longer on file); `undefined` leaves whatever is already saved untouched —
  // see measurementService.bodyToRow().
  bodyShape?: import('./measurements').BodyShape | null;
  preferredFit?: PreferredFit;
  // Onboarding consent + provenance flags. Historically dropped by
  // measurementService.bodyToRow() (never reached `public.body_measurements`,
  // both columns NOT NULL DEFAULT false) — kept here so that boundary can map
  // them through instead of silently discarding what the user chose.
  poseEstimated?: boolean;
  measurementsConsent?: boolean;
}

// ─── Style Profile ───────────────────────────────────────────────────────────

export interface UserStyleProfile {
  selectedStyles: string[];
  computedAttributes?: StyleAttributes;
}

export type ColorPalette = 'neutral' | 'earth' | 'bold' | 'pastel' | 'dark' | 'monochrome';
export type Silhouette = 'relaxed' | 'structured' | 'bodycon' | 'oversized' | 'tailored';
export type Mood = 'playful' | 'serious' | 'romantic' | 'edgy' | 'clean' | 'artistic';

// Mirrors engine/types.ts PrimaryColor (generate-outfits Edge Function) — kept
// in sync manually. Only used client-side for ScoredOutfit.colorTone (display).
export type PrimaryColor =
  | 'black' | 'white' | 'navy' | 'beige' | 'gray' | 'brown' | 'olive'
  | 'blue' | 'red' | 'purple' | 'green' | 'yellow' | 'pink' | 'orange'
  | 'cream' | 'ivory' | 'camel' | 'tan' | 'taupe' | 'khaki' | 'charcoal'
  | 'burgundy' | 'teal' | 'metallic' | 'multicolor' | 'natural'
  | 'mustard' | 'rust' | 'coral' | 'mint' | 'lavender' | 'sage'
  | 'terracotta' | 'mauve' | 'wine' | 'fuchsia' | 'denim';

export interface StyleAttributes {
  formality: number;
  colorPalette: ColorPalette[];
  silhouette: Silhouette[];
  patternLevel: number;
  textureRichness: number;
  mood: Mood[];
}

// ─── Outfit (from Edge Function response) ────────────────────────────────────

export interface OutfitSlots {
  top: string;
  bottom: string;
  shoes: string;
  outwear?: string;
  accessory?: string;
  // Mid layer (2026-08-10) — mirrors engine/types.ts OutfitSlots.mid. A
  // layerRole:'mid' garment (hoodie/sweater/cardigan/knit/vest/kimono) worn
  // UNDER a true outer in `outwear` (e.g. blazer over a thin hoodie). Only
  // ever set alongside `outwear`; absent for every pre-existing outfit shape.
  mid?: string;
}

export interface ScoredOutfit {
  slots: OutfitSlots;
  formula: string;
  tier: 1 | 2;
  stylistNote?: string;
  /** Story brief this outfit belongs to in today's feed (S3):
   *  'REFINED' | 'EVERYDAY' | 'OFF DUTY'. Optional for older responses. */
  story?: string;
  /** Deterministic rule-derived styling tips (Way to Wear Phase B) — both
   *  locales inline; the client picks one. Max 2. Optional for older responses. */
  stylingTips?: Array<{ key: string; en: string; vi: string }>;
  /** Real warmth band derived from the outfit's fabrics/layers — replaces the
   *  client's hardcoded '22°C'. One of '<15°C' | '15–22°C' | '22–28°C' | '28°C+'. */
  weatherBand?: string;
  /** Display-only tags (2026-07-12), mirrors engine/types.ts ScoredOutfit —
   *  not scoring inputs. `silhouette` is the target silhouette family the
   *  engine built this outfit toward; `colorTone` is the outfit's anchor
   *  (dominant) colour. Optional for older responses. */
  silhouette?: 'fitted' | 'straight' | 'relaxed' | 'top-volume' | 'bottom-volume';
  /** Geometric-shape tag for the RESULTING BODY silhouette — the user's
   *  body_shape baseline as modified by the outfit's garment volume, NOT a
   *  relabel of `silhouette` (2026-07-12, see engine/silhouette.ts
   *  resultingBodySilhouette). Display-only, additive — kept alongside
   *  `silhouette` (the garment-volume tag), never replacing it. */
  silhouetteShape?: 'hourglass' | 'rectangle' | 'oval' | 'inverted-triangle' | 'triangle';
  colorTone?: PrimaryColor;
  /** Wardrobe-affinity style fallback (2026-08-02): display-only style label
   *  (e.g. "Old Money", "Streetwear") — only present when the user has no
   *  selected styles and the server's wardrobe-affinity style fallback fired
   *  (see supabase/functions/generate-outfits ScoredOutfit.styleTag). The
   *  style name is shown as-is — it's a proper noun, no i18n. Not a scoring
   *  input. */
  styleTag?: string;
  styleCoherence: number;
  colorHarmony: number;
  fitScore: number;
  proportionBalance: number;
  formalityConsistency: number;
  seasonMatch: number;
  textureInterest: number;
  totalScore: number;
}

// generate-outfits response envelope (has_more/curated live inline in
// fitEngineStore's two fetch call sites — named here so style_fallback has a
// single documented home instead of a third inline duplicate).
export interface GenerateOutfitsResponse {
  outfits: ScoredOutfit[];
  has_more?: boolean;
  curated?: boolean;
  /** Wardrobe-affinity style fallback envelope (2026-08-02): present only
   *  when the user had no selected styles and the server's wardrobe-affinity
   *  style fallback fired (see generate-outfits `responseBody.style_fallback`).
   *  Response-level mirror of the same event that sets each outfit's
   *  `styleTag` above. Consumed by fitEngineStore into `styleFallback` for
   *  the feed hint. Absent (not the empty array) when the fallback didn't
   *  fire — old clients that don't know this key are unaffected. */
  style_fallback?: { applied: boolean; styles: Array<{ id: string; name: string }> };
}

// ─── Intent Context (Chat AI → Edge Function) ──────────────────────────────

export type ColorScheme = 'monochrome' | 'analogous' | 'complementary' | 'neutral_accent' | 'tonal';
export type BodyGoal = 'elongation' | 'broaden_shoulders' | 'define_waist' | 'balanced';
export type OccasionTag = 'daily' | 'date_night' | 'business' | 'weekend' | 'event' | 'travel';
export type Season = 'spring' | 'summer' | 'fall' | 'winter' | 'allSeason';

export interface IntentContext {
  styles?: string[];
  mood?: Mood[];
  colorScheme?: ColorScheme;
  maxColors?: number;
  proportionRule?: 'rule_of_thirds' | 'balanced' | 'oversized_top' | 'oversized_bottom';
  bodyGoal?: BodyGoal;
  formalityRange?: [number, number];
  occasion?: OccasionTag;
  seasonOverride?: Season;
  requireOuterwear?: boolean;
  requireAccessory?: boolean;
  weightOverrides?: Partial<ScoringWeights>;
  rawInput?: string;
}

export interface ScoringWeights {
  style: number;
  color: number;
  fit: number;
  proportion: number;
  formality: number;
  season: number;
  texture: number;
}
