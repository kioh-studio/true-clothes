import AsyncStorage from '@react-native-async-storage/async-storage';
import { sb } from './supabase';

const CACHE_KEY = 'styles-cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// Display-sort hint only (style catalog expansion, 2026-08-10) — mirrors
// public.styles.gender_lean. NEVER read by scoring/engine code; the engine's
// own STYLE_CONFIGS has no gender_lean field at all, by design (see
// generate-outfits/engine/filtering.ts). This purely reorders what the
// client shows first.
export type StyleGenderLean = 'feminine' | 'masculine' | 'neutral';

export interface StyleCatalogItem {
  id: string;              // also the slug, e.g. 'oldmoney'
  name: string;
  description: string | null;
  imageUrl: string | null;
  popularity: number;
  neighbors: { id: string; weight: number }[];
  niches: string[];
  genderLean: StyleGenderLean;
}

interface CacheEntry { data: StyleCatalogItem[]; fetchedAt: number }

export async function fetchStyles(): Promise<StyleCatalogItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache: CacheEntry = JSON.parse(raw);
      if (Date.now() - cache.fetchedAt < CACHE_TTL && cache.data.length > 0) return cache.data;
    }
  } catch { /* cache miss */ }

  const { data, error } = await sb
    .from('styles')
    .select('id, name, description, image_url, popularity, neighbors, niches, gender_lean')
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
    genderLean:  ((r.gender_lean as StyleGenderLean | null) ?? 'neutral'),
  }));

  if (items.length > 0) {
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: items, fetchedAt: Date.now() })).catch(() => {});
  }
  return items;
}

// ─── Gender-matched display ordering (style catalog expansion, 2026-08-10) ──
// Reorders a style list so styles whose genderLean matches the user's
// profile gender surface first — the rest stay in the list, unhidden, just
// pushed after. A stable sort (Array.prototype.sort is stable per spec) so
// styles keep their relative order (popularity desc, since callers pass
// already-popularity-sorted lists) within each group.
//
// Deliberately display-only: this never touches scoring/engine inputs (no
// selectedStyles reordering, no weight change) — see filtering.ts's
// STYLE_CONFIGS, which has no gender_lean field at all.
//
// profileGender is the raw `profiles.gender` value: 'WOMAN' | 'MAN' |
// 'NON-BINARY' | 'PREFER NOT TO SAY' | '' | null | undefined. Anything other
// than 'WOMAN'/'MAN' returns the input order unchanged (no gender set, or the
// user opted for a non-binary/undisclosed value — matches the same
// binary-only gating usePremium/genderAwareStyling already uses elsewhere).
export function sortStylesByGenderLean<T extends { genderLean: StyleGenderLean }>(
  styles: T[],
  profileGender: string | null | undefined,
): T[] {
  const wantLean: StyleGenderLean | null =
    profileGender === 'WOMAN' ? 'feminine' :
    profileGender === 'MAN'   ? 'masculine' :
    null;
  if (!wantLean) return styles;
  return [...styles].sort((a, b) => {
    const aMatch = a.genderLean === wantLean ? 0 : 1;
    const bMatch = b.genderLean === wantLean ? 0 : 1;
    return aMatch - bMatch;
  });
}
