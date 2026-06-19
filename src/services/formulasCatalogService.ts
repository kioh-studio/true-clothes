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
      if (Date.now() - cache.fetchedAt < CACHE_TTL) return cache.data;
    }
  } catch { /* cache miss */ }

  const { data, error } = await sb
    .from('formulas')
    .select('id, slug, name, name_vi, description, display_order')
    .eq('is_active', true)
    .order('display_order');

  if (error) throw error;

  const items: FormulaCatalogItem[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id:          r.id as string,
    slug:        r.slug as string,
    name:        r.name as string,
    nameVi:      (r.name_vi as string | null) ?? null,
    description: r.description as string,
    displayOrder: (r.display_order as number) ?? 0,
  }));

  AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: items, fetchedAt: Date.now() })).catch(() => {});
  return items;
}
