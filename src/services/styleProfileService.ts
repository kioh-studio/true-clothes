// Style profile service — read/update `public.style_profiles`.
// RLS scopes every row to the authenticated user.
// Row is upserted on first save (not auto-created on signup like profiles).
import { sb } from './supabase';

// "Shape goal" (010-wardrobe-critic follow-up, 2026-08-10): the user's
// durable "desired resulting body silhouette" choice. Mirrors the engine's
// EngineContext.shapeGoal union (generate-outfits/engine/types.ts) and the DB
// check constraint (supabase/migrations/
// 20260810000002_style_profiles_shape_goal.sql). 'auto' is the default —
// treated identically to a null/missing DB value everywhere it's consumed.
export type ShapeGoal = 'auto' | 'natural' | 'hourglass' | 'rectangle' | 'oval' | 'inverted-triangle' | 'triangle';

// ── DB row shape ────────────────────────────────────────────────────────────
interface StyleProfileRow {
  user_id: string;
  selected_styles: string[];
  color_preferences: string[];
  formula_preferences: string[];
  // 4 suggestion toggles (2026-08-10) — see supabase/migrations/
  // 20260810000001_style_profiles_suggestion_toggles.sql. `not null default
  // true` on the DB side, so these should always be present, but `?? true`
  // below stays defensive against a row fetched before the migration landed
  // on this device's cached schema.
  suggest_by_style: boolean;
  suggest_by_personal_color: boolean;
  suggest_by_formula: boolean;
  suggest_by_measurements: boolean;
  // Shape goal (2026-08-10) — see supabase/migrations/
  // 20260810000002_style_profiles_shape_goal.sql. Nullable; null = 'auto'.
  shape_goal: string | null;
}

// ── App shape (matches fitEngineStore state) ────────────────────────────────
export interface StyleProfileData {
  selectedStyles: string[];
  colorPreferences: string[];
  formulaPreferences: string[];
  // 4 suggestion toggles (2026-08-10): independent opt-outs for individual
  // outfit-suggestion dimensions. Default true — unchanged behavior until the
  // user explicitly turns one off in Settings.
  suggestByStyle: boolean;
  suggestByPersonalColor: boolean;
  suggestByFormula: boolean;
  suggestByMeasurements: boolean;
  // Shape goal (2026-08-10): default 'auto' — unchanged behavior until the
  // user explicitly picks a goal on the new shape-goal screen.
  shapeGoal: ShapeGoal;
}

const SHAPE_GOAL_VALUES: ReadonlySet<string> = new Set([
  'auto', 'natural', 'hourglass', 'rectangle', 'oval', 'inverted-triangle', 'triangle',
]);

function normalizeShapeGoal(value: string | null | undefined): ShapeGoal {
  return value && SHAPE_GOAL_VALUES.has(value) ? (value as ShapeGoal) : 'auto';
}

// ── DB ↔ app conversions ────────────────────────────────────────────────────
function rowToApp(row: StyleProfileRow): StyleProfileData {
  return {
    selectedStyles:    row.selected_styles ?? [],
    colorPreferences:  row.color_preferences ?? [],
    formulaPreferences: row.formula_preferences ?? [],
    suggestByStyle:          row.suggest_by_style ?? true,
    suggestByPersonalColor:  row.suggest_by_personal_color ?? true,
    suggestByFormula:        row.suggest_by_formula ?? true,
    suggestByMeasurements:   row.suggest_by_measurements ?? true,
    shapeGoal: normalizeShapeGoal(row.shape_goal),
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function fetchMyStyleProfile(userId: string): Promise<StyleProfileData | null> {
  const { data, error } = await sb
    .from('style_profiles')
    .select('user_id, selected_styles, color_preferences, formula_preferences, suggest_by_style, suggest_by_personal_color, suggest_by_formula, suggest_by_measurements, shape_goal')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[styleProfileService] fetch failed:', error.message);
    return null;
  }
  return data ? rowToApp(data as StyleProfileRow) : null;
}

export async function upsertMyStyleProfile(
  userId: string,
  patch: Partial<StyleProfileData>,
): Promise<{ ok: boolean; message?: string }> {
  const row: Record<string, string | string[] | boolean | null> = { user_id: userId };

  if (patch.selectedStyles !== undefined)    row.selected_styles = patch.selectedStyles;
  if (patch.colorPreferences !== undefined)  row.color_preferences = patch.colorPreferences;
  if (patch.formulaPreferences !== undefined) row.formula_preferences = patch.formulaPreferences;
  if (patch.suggestByStyle !== undefined)          row.suggest_by_style = patch.suggestByStyle;
  if (patch.suggestByPersonalColor !== undefined)  row.suggest_by_personal_color = patch.suggestByPersonalColor;
  if (patch.suggestByFormula !== undefined)        row.suggest_by_formula = patch.suggestByFormula;
  if (patch.suggestByMeasurements !== undefined)   row.suggest_by_measurements = patch.suggestByMeasurements;
  // Stored as null for 'auto' (matches the DB default/meaning) rather than
  // the literal string 'auto' — both read back identically via
  // normalizeShapeGoal, but null keeps existing/reset rows indistinguishable
  // from users who never touched the feature.
  if (patch.shapeGoal !== undefined) row.shape_goal = patch.shapeGoal === 'auto' ? null : patch.shapeGoal;

  const { error } = await sb
    .from('style_profiles')
    .upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.warn('[styleProfileService] upsert failed:', error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
