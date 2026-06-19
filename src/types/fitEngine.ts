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
}


// Engine-internal types (FitItem, StyleConfig, FormulaPool, etc.) have moved
// to the generate-outfits Edge Function in supabase/functions/.
// All measurements in centimeters.

// ─── Body Measurements ───────────────────────────────────────────────────────

export type PreferredFit = 'SLIM' | 'REGULAR' | 'RELAXED' | 'OVERSIZED';

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
}

// ─── Style Profile ───────────────────────────────────────────────────────────

export interface UserStyleProfile {
  selectedStyles: string[];
  computedAttributes?: StyleAttributes;
}

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

// ─── Outfit (from Edge Function response) ────────────────────────────────────

export interface OutfitSlots {
  top: string;
  bottom: string;
  shoes: string;
  outwear?: string;
  accessory?: string;
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
