import AsyncStorage from '@react-native-async-storage/async-storage';
import { sb } from './supabase';

const CACHE_KEY = 'formulas-cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export interface FormulaCatalogItem {
  id: string;
  slug: string;
  name: string;
  nameVi: string | null;
  description: string;
  displayOrder: number;
}

interface CacheEntry { data: FormulaCatalogItem[]; fetchedAt: number }

export async function fetchFormulas(): Promise<FormulaCatalogItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache: CacheEntry = JSON.parse(raw);
      if (Date.now() - cache.fetchedAt < CACHE_TTL && cache.data.length > 0) return cache.data;
    }
  } catch { /* cache miss */ }

  // Schema drift: the live `formulas` table has only id/name/description/short_desc/active —
  // there is no slug, name_vi, display_order, or is_active column. The `id` column IS the
  // slug-style identifier (e.g. "contrast_pairing", "tonal_gradient") that the fit engine's
  // FormulaId type and formulaPreferences already use, so we map slug <- id here.
  const { data, error } = await sb
    .from('formulas')
    .select('id, name, description, short_desc, active')
    .eq('active', true)
    .order('name');

  if (error) throw error;

  const items: FormulaCatalogItem[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id:          r.id as string,
    slug:        r.id as string,
    name:        r.name as string,
    nameVi:      null,
    description: r.description as string,
    displayOrder: 0,
  }));

  if (items.length > 0) {
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: items, fetchedAt: Date.now() })).catch(() => {});
  }
  return items;
}
