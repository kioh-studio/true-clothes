import { sb } from './supabase';
import type { ColorSeason } from '../types/profile';

export interface PersonalColorRow {
  color_season: ColorSeason | null;
  personal_palette: string[] | null;
}

export async function fetchPersonalColor(userId: string): Promise<PersonalColorRow | null> {
  const { data, error } = await sb
    .from('profiles')
    .select('color_season, personal_palette')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as PersonalColorRow;
}

export async function savePersonalColor(
  userId: string,
  season: ColorSeason,
  palette: string[],
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await sb
    .from('profiles')
    .update({ color_season: season, personal_palette: palette })
    .eq('id', userId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
