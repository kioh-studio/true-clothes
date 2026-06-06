// Style profile service — read/update `public.style_profiles`.
// RLS scopes every row to the authenticated user.
// Row is upserted on first save (not auto-created on signup like profiles).
import { sb } from './supabase';

// ── DB row shape ────────────────────────────────────────────────────────────
interface StyleProfileRow {
  user_id: string;
  selected_styles: string[];
  color_preferences: string[];
  formula_preferences: string[];
}

// ── App shape (matches fitEngineStore state) ────────────────────────────────
export interface StyleProfileData {
  selectedStyles: string[];
  colorPreferences: string[];
  formulaPreferences: string[];
}

// ── DB ↔ app conversions ────────────────────────────────────────────────────
function rowToApp(row: StyleProfileRow): StyleProfileData {
  return {
    selectedStyles:    row.selected_styles ?? [],
    colorPreferences:  row.color_preferences ?? [],
    formulaPreferences: row.formula_preferences ?? [],
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function fetchMyStyleProfile(userId: string): Promise<StyleProfileData | null> {
  const { data, error } = await sb
    .from('style_profiles')
    .select('user_id, selected_styles, color_preferences, formula_preferences')
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
  const row: Record<string, string | string[]> = { user_id: userId };

  if (patch.selectedStyles !== undefined)    row.selected_styles = patch.selectedStyles;
  if (patch.colorPreferences !== undefined)  row.color_preferences = patch.colorPreferences;
  if (patch.formulaPreferences !== undefined) row.formula_preferences = patch.formulaPreferences;

  const { error } = await sb
    .from('style_profiles')
    .upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.warn('[styleProfileService] upsert failed:', error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
