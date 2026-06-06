// Fit Engine — client-side types only.

// ─── Wardrobe (Supabase-backed) ──────────────────────────────────────────────

export interface WardrobeItem {
  id: string
  userId: string
  photoUrl: string | null    // signed URL (1-hour expiry)
  photoPath: string | null   // Storage path for deletion: {userId}/{id}.jpg
  category: 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory'
  colors: string[]           // named colour strings, never hex
  sizeLabel: string | null
  brand: string | null
  notes: string | null
  createdAt: string          // ISO timestamp
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
