// Engine-internal types — all measurements in centimeters.

export type ItemCategory = 'top' | 'bottom' | 'outwear' | 'shoes' | 'accessory' | 'onepiece';

// ─── Color Profile ───────────────────────────────────────────────────────────

export type PrimaryColor =
  | 'black' | 'white' | 'navy' | 'beige' | 'gray' | 'brown' | 'olive'
  | 'blue' | 'red' | 'purple' | 'green' | 'yellow' | 'pink' | 'orange'
  | 'cream' | 'ivory' | 'camel' | 'tan' | 'taupe' | 'khaki' | 'charcoal'
  | 'burgundy' | 'teal' | 'metallic' | 'multicolor' | 'natural';

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
  styleCoherence: number;
  colorHarmony: number;
  fitScore: number;
  proportionBalance: number;
  formalityConsistency: number;
  seasonMatch: number;
  textureInterest: number;
  totalScore: number;
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
  colorSeason?: string;
  intent?: IntentContext;
  scoringWeights?: ScoringWeights;
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
  measurements?: Array<{ label: string; value: string | number; unit?: string }>;
}
