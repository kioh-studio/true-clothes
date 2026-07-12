import AsyncStorage from '@react-native-async-storage/async-storage';
import { sb } from './supabase';

const CACHE_KEY = 'styles-cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export interface StyleCatalogItem {
  id: string;              // also the slug, e.g. 'oldmoney'
  name: string;
  description: string | null;
  imageUrl: string | null;
  popularity: number;
  neighbors: { id: string; weight: number }[];
  niches: string[];
}

interface CacheEntry { data: StyleCatalogItem[]; fetchedAt: number }

export async function fetchStyles(): Promise<StyleCatalogItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache: CacheEntry = JSON.parse(raw);
      if (Date.now() - cache.fetchedAt < CACHE_TTL) return cache.data;
    }
  } catch { /* cache miss */ }

  const { data, error } = await sb
    .from('styles')
    .select('id, name, description, image_url, popularity, neighbors, niches')
    .eq('active', true)
    .order('popularity', { ascending: false });

  if (error) throw error;

  const items: StyleCatalogItem[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id:          r.id as string,
    name:        r.name as string,
    description: (r.description as string | null) ?? null,
    imageUrl:    (r.image_url as string | null) ?? null,
    popularity:  (r.popularity as number) ?? 0,
    neighbors:   (r.neighbors as { id: string; weight: number }[]) ?? [],
    niches:      (r.niches as string[]) ?? [],
  }));

  AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: items, fetchedAt: Date.now() })).catch(() => {});
  return items;
}
