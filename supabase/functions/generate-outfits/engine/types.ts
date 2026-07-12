// Engine-internal types — all measurements in centimeters.

export type ItemCategory = 'top' | 'bottom' | 'outwear' | 'shoes' | 'accessory' | 'onepiece';

// ─── Color Profile ───────────────────────────────────────────────────────────

export type PrimaryColor =
  | 'black' | 'white' | 'navy' | 'beige' | 'gray' | 'brown' | 'olive'
  | 'blue' | 'red' | 'purple' | 'green' | 'yellow' | 'pink' | 'orange'
  | 'cream' | 'ivory' | 'camel' | 'tan' | 'taupe' | 'khaki' | 'charcoal'
  | 'burgundy' | 'teal' | 'metallic' | 'multicolor' | 'natural'
  // +11 vocabulary expansion (2026-07-06) — previously collapsed into a
  // nearby bucket (mustard/rust/terracotta→orange-family, wine→burgundy,
  // sage→green) or unrepresented (coral, mint, lavender, mauve, fuchsia,
  // denim). Also re-activates dead SEASON_FLATTERING/TONE12_AVOID entries
  // that already named these colours as plain strings.
  | 'mustard' | 'rust' | 'coral' | 'mint' | 'lavender' | 'sage'
  | 'terracotta' | 'mauve' | 'wine' | 'fuchsia' | 'denim';

export type ColorLightness = 'light' | 'medium' | 'dark';
export type ColorSaturation = 'muted' | 'balanced' | 'vivid';

export interface ColorProfile {
  primaryColor: PrimaryColor;
  colorLightness: ColorLightness;
  colorSaturation: ColorSaturation;
  hue?: number;
  sat: number;
  lum: number;
  undertone: 'warm' | 'cool' | 'neutral';
}

// ─── Graphics ────────────────────────────────────────────────────────────────

export type GraphicWeight = 'none' | 'small_logo' | 'medium_logo' | 'large_graphic' | 'full_print';
export type ArtworkType = 'none' | 'brand_logo' | 'slogan_text' | 'graphic_illustration' | 'all_over_print';

export interface GraphicsProfile {
  graphicWeight: GraphicWeight;
  artworkType: ArtworkType;
}

// ─── Fabric & Seasonality ────────────────────────────────────────────────────

export type Pattern = 'solid' | 'striped' | 'plaid' | 'checkered' | 'floral' | 'graphic' | 'abstract';
export type FabricWeight = 'light' | 'medium' | 'heavy';
export type Breathability = 'low' | 'medium' | 'high';
export type Season = 'spring' | 'summer' | 'fall' | 'winter' | 'allSeason';
export type LayerRole = 'base' | 'mid' | 'outer';

export interface FabricProfile {
  pattern: Pattern;
  fabricWeight: FabricWeight;
  breathability: Breathability;
  season: Season;
  layerRole: LayerRole;
}

// ─── Garment Measurements ────────────────────────────────────────────────────

export interface GarmentMeasurements {
  chest?: number;
  waist?: number;
  waist_top?: number;
  waist_outer?: number;
  hip?: number;
  shoulder_width?: number;
  sleeves?: number;
  body_length?: number;
  upper_arm?: number;
  inseam?: number;
  thigh?: number;
  rise?: number;
  skirt_length?: number;
  shoe_size?: number | string;
  shoe_width?: number | string;
}

// ─── Body Measurements ───────────────────────────────────────────────────────

export type PreferredFit = 'SLIM' | 'REGULAR' | 'RELAXED' | 'OVERSIZED';

export type BodyShape = 'hourglass' | 'rectangle' | 'triangle' | 'inverted_triangle' | 'apple';

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
  preferredFit?: PreferredFit;
  body_shape?: BodyShape;
}

// ─── Style Attribute Vectors ─────────────────────────────────────────────────

export type ColorPalette = 'neutral' | 'earth' | 'bold' | 'pastel' | 'dark' | 'monochrome';
export type Silhouette = 'relaxed' | 'structured' | 'bodycon' | 'oversized' | 'tailored';
export type Mood = 'playful' | 'serious' | 'romantic' | 'edgy' | 'clean' | 'artistic';

export interface StyleAttributes {
  formality: number;
  colorPalette: ColorPalette[];
  silhouette: Silhouette[];
  patternLevel: number;
  textureRichness: number;
  mood: Mood[];
}

// ─── Style Catalog Entry ─────────────────────────────────────────────────────

export interface StyleDef {
  id: string;
  name: string;
  popularity: number;
  attributes: StyleAttributes;
  neighbors: Array<{ styleId: string; weight: number }>;
}

// ─── Style Config ────────────────────────────────────────────────────────────

export type ItemFit = 'slim' | 'regular' | 'relaxed' | 'wide' | 'oversized';
export type FabricName =
  | 'cotton' | 'wool' | 'linen' | 'cashmere' | 'silk' | 'denim'
  | 'leather' | 'suede' | 'nylon' | 'polyester' | 'canvas' | 'corduroy'
  | 'tweed' | 'flannel' | 'jersey' | 'fleece' | 'velvet';
export type BannedFeature = 'loud_logo' | 'macro_print' | 'full_print' | 'neon_color' | 'distressed';
export type ColorGrade = 'perfect' | 'allowed' | 'accent' | 'banned';

export interface StyleConfig {
  id: string;
  name: string;
  palette: Partial<Record<PrimaryColor, ColorGrade>>;
  fabricsAllowed: FabricName[];
  fabricsBanned: FabricName[];
  allowedFits: ItemFit[];
  formalityRange: [number, number];
  bannedFeatures: BannedFeature[];
  overrides: Array<'favorite_color' | 'preferred_fit'>;
  weights: ScoringWeights;
  attributes: StyleAttributes;
  neighbors: Array<{ styleId: string; weight: number }>;
  popularity: number;
}

// ─── Enriched Clothing Item ──────────────────────────────────────────────────

// Per-field provenance: true when the value came from a real stored DB attribute,
// false when enrichment had to DEFAULT it (NULL in DB). Lets ranking drop the
// dimensions that are scoring on guesses rather than letting near-constant defaults
// add noise that flattens score separation (see ranking.ts confidence weighting).
export interface ItemProvenance {
  fit: boolean;          // clothing_items.fit was set
  material: boolean;     // clothing_items.material was set (drives fabricWeight/season/breathability)
  pattern: boolean;      // clothing_items.pattern was set (drives texture/statement)
  warmthSeason: boolean; // clothing_items.warmth_season was set (drives fabricWeight/season)
}

export interface FitItem {
  id: string;
  category: ItemCategory;
  typeName: string;          // normalized garment type, e.g. 'TEE', 'BLAZER'
  colorProfile: ColorProfile;
  graphics: GraphicsProfile;
  fabric: FabricProfile;
  garmentMeasurements?: GarmentMeasurements;
  styleTags: string[];
  fit: ItemFit;
  warmth: number;
  formality: number;
  statementStrength: number;
  fabricName?: FabricName;
  // Dual-role layering (2026-07-03): this top can be worn OPEN/OVER another
  // top as a layer (overshirt/cardigan/knit-over). Rule-derived in enrichment;
  // optional so hand-built test fixtures stay valid (undefined = false).
  canLayer?: boolean;
  // Visual enrichment đợt 2 — only present when the image carried the signal.
  drape?: 'structured' | 'regular' | 'fluid';
  visualInterest?: number; // 0..1 — how striking the piece reads
  provenance: ItemProvenance;
}

// ─── Outfit Composition ──────────────────────────────────────────────────────

export interface OutfitSlots {
  top: string;
  bottom: string;
  shoes: string;
  outwear?: string;
  accessory?: string;
}

export interface OutfitCandidate {
  slots: OutfitSlots;
  formula?: string;
}

export interface ScoredOutfit {
  slots: OutfitSlots;
  formula: string;
  tier: 1 | 2;
  stylistNote?: string;
  // Story brief the outfit belongs to in today's feed (S3): 'REFINED' |
  // 'EVERYDAY' | 'OFF DUTY'. Assigned at presentation time from the outfit's
  // register; the feed groups by story and preserves rank order inside one.
  story?: string;
  // Deterministic rule-derived styling tips (Way to Wear Phase B) — both
  // locales inline; the client picks. Max 2.
  stylingTips?: Array<{ key: string; en: string; vi: string }>;
  // Real warmth band derived from the outfit's fabrics/layers — replaces the
  // client's hardcoded '22°C'. One of '<15°C' | '15–22°C' | '22–28°C' | '28°C+'.
  weatherBand?: string;
  // Display-only tags (2026-07-12). Not scoring inputs — assigned in index.ts's
  // per-outfit tagging loop from engine/silhouette.ts (outfitSilhouetteTag) and
  // engine/scoring.ts (outfitDominantColor). Inline union (not imported from
  // silhouette.ts) to avoid a types.ts <-> silhouette.ts import cycle.
  silhouette?: 'fitted' | 'straight' | 'relaxed' | 'top-volume' | 'bottom-volume';
  // Geometric-shape tag for the RESULTING BODY silhouette — the user's
  // body_shape baseline as modified by the outfit's garment volume, NOT a
  // relabel of `silhouette` (2026-07-12, see engine/silhouette.ts
  // resultingBodySilhouette). Display-only, additive — kept alongside
  // `silhouette` (the garment-volume tag), never replacing it.
  silhouetteShape?: 'hourglass' | 'rectangle' | 'oval' | 'inverted-triangle' | 'triangle';
  colorTone?: PrimaryColor;
  styleCoherence: number;
  colorHarmony: number;
  fitScore: number;
  proportionBalance: number;
  formalityConsistency: number;
  seasonMatch: number;
  textureInterest: number;
  totalScore: number;
}

// ─── Target Silhouette (silhouette-first resolution, 2026-07-12) ────────────
// A small set of preferred (top volume, bottom volume) pairs — see
// engine/silhouette.ts for derivation. Consumed as a BIAS + SCORING term by
// generation/ranking, never a hard filter: `confidence` gates how strongly it
// pulls (0 for a fully-guessed wardrobe = no-op, saturating toward 1 as real
// fit/measurement coverage grows). `source` names the cascade level that
// produced it (explainability). Volume scale: VOLUME map in scoring.ts
// (slim=1 … oversized=5).
export interface TargetSilhouette {
  targets: Array<{ topVol: number; bottomVol: number; weight: number; label: string }>;
  confidence: number; // 0..1
  source: string;
}

// ─── Engine Context ──────────────────────────────────────────────────────────

export interface UserStyleProfile {
  selectedStyles: string[];
  computedAttributes?: StyleAttributes;
}

export interface EngineContext {
  bodyMeasurements: BodyMeasurements;
  styleProfile: UserStyleProfile;
  colorPreferences: string[];
  colorSeason?: string;       // personal colour analysis (skin undertone) — static
  // 12-tone refinement of colorSeason (e.g. 'deep_autumn', 'bright_winter'). The
  // prefix before the first '_' ('light'|'deep'|'bright'|'soft'|'true') drives
  // tone12QualityBonus in scoring.ts; 'true_*' carries no extra signal (undertone
  // is already handled by seasonCompatibilityBonus).
  colorTone12?: string;
  weatherSeason?: Season;     // current real-world season (date + hemisphere) — drives
                              // seasonal colour bias + fabric-season matching
  intent?: IntentContext;
  scoringWeights?: ScoringWeights;
  // Opt-in gender-aware styling (feature: backlog #3). Only set when the user
  // turned the setting on AND their profile gender is a binary value; NON-BINARY /
  // PREFER NOT TO SAY / unset leave this undefined so scoring stays gender-blind.
  gender?: 'WOMAN' | 'MAN';
  // Per-user taste vector learned from saved/worn outfits (lever L2). Undefined
  // until the user has positive history; the bonus is confidence-scaled so a tiny
  // sample barely nudges and zero samples is a no-op.
  tasteVector?: TasteVector;
  // Silhouette-first bias (engine/silhouette.ts), resolved once in index.ts
  // after the style filter and threaded into generation + ranking. Degradable:
  // strong pull when items carry real fit data, weak nudge when guessed, never
  // eliminates an item.
  targetSilhouette?: TargetSilhouette;
}

// Aggregate outfit character over a set of outfits — used both for the user's
// POSITIVE history (saved/worn) and for their EXPOSURE history (impressions).
export interface TasteAggregate {
  sampleCount: number;          // # outfits that contributed (drives confidence)
  meanFormality: number;        // 1–5
  meanStatement: number;        // 0–5 — loud vs quiet lean
  meanLightnessSpread: number;  // 0–100 — tonal (low) vs high-contrast (high) lean
  colorWeight: Record<string, number>; // primaryColor → normalized frequency
}

// Behaviour-learned preference signal (lever L2 + lift upgrade 2026-07-02).
// Positive fields aggregate saved + worn outfits. `exposure` (optional)
// aggregates what the feed SHOWED the user (impression rows): with it, the
// bonus rewards how a candidate resembles the user's saves RELATIVE to the
// average feed — a save that looks exactly like everything shown carries no
// information, a save that deviates from the feed reveals real taste. Absent
// (too few impressions), scoring falls back to the raw positive affinity.
export interface TasteVector extends TasteAggregate {
  exposure?: TasteAggregate;
}

// ─── Intent Context ──────────────────────────────────────────────────────────

export type ColorScheme = 'monochrome' | 'analogous' | 'complementary' | 'neutral_accent' | 'tonal';
export type BodyGoal = 'elongation' | 'broaden_shoulders' | 'define_waist' | 'balanced';
export type OccasionTag = 'daily' | 'date_night' | 'business' | 'weekend' | 'event' | 'travel';

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

// ─── Fit Result ──────────────────────────────────────────────────────────────

export type FitCategory = 'tight' | 'snug' | 'standard' | 'roomy' | 'oversized';

export interface FitPoint {
  key: string;
  ease: number;
  category: FitCategory;
  score: number;
}

export interface ItemFitResult {
  itemId: string;
  points: FitPoint[];
  score: number;
  warnings: string[];
  /** true when at least one real fit measurement was scored; false when the
   *  score is a defaulted 0.5 neutral (no garment measurements or no body/
   *  garment key overlap). Only measured items contribute to outfit-level
   *  fit averaging — see scoreOutfitFit. */
  measured: boolean;
}

// ─── DB Clothing Item (shape from Supabase) ──────────────────────────────────

export interface ClothingItemRow {
  id: string;
  type: string;
  name: string;
  color: string;
  material?: string;
  fit?: string;
  pattern?: string | null;        // ingest-time attribute (AI extraction / manual)
  warmthSeason?: string | null;   // 'lightweight_summer' | 'midweight_transitional' | 'warm_winter' | 'all_season'
  canLayer?: boolean | null;      // stored can_layer (AI/user); null → engine derives by rule
  // Visual enrichment đợt 2 (2026-07-03) — ingest-time visual attributes.
  printScale?: string | null;     // 'micro' | 'medium' | 'large'
  drape?: string | null;          // 'structured' | 'regular' | 'fluid'
  visualInterest?: number | null; // 0..1
  measurements?: Array<{ label: string; value: string | number; unit?: string }>;
  // Measured-hex color layer (2026-07-06) — deterministic pixel-derived
  // dominant colour(s) of the item's isolated photo (colorCluster.ts), set by
  // generate-item-image at ingest or backfill-item-metadata after the fact.
  // Refines colorProfile's hue/sat/lum in enrichment.ts; the categorical
  // primaryColor NAME still comes from `color` (avoid-lists match by name).
  primary_hex?: string | null;
  secondary_hex?: string | null;
}
