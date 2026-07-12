import { sb } from './supabase';

// Lazy outfit description + "how to wear" tips (feature 008 / Way to Wear Phase A).
// The feed's curation pass only ranks and writes the one-line stylist note
// (generating 10 full descriptions at once takes ~10s and blocks the feed). The
// detail screen calls this for the ONE outfit being viewed (~1–2s). It returns
// both an editorial description and a short list of styling tips (wayToWear).
// Results are cached in-memory by (outfit id, locale) so reopening is instant.

export interface DescribeItem {
  name?: string | null;
  type?: string | null;
  color?: string | null;
  material?: string | null;
  fit?: string | null;
}

export interface OutfitDescription {
  description: string;
  wayToWear: string[];
}

const cache = new Map<string, OutfitDescription>();

/**
 * Returns the AI description + wayToWear tips for the outfit, or empty values on
 * any failure (the caller should fall back to its own item-list text). Cached by
 * `(outfitId, locale)`.
 */
export async function describeOutfit(
  outfitId: string,
  items: DescribeItem[],
  opts: { styles?: string[]; locale?: 'vi' | 'en'; occasion?: string; weather?: string } = {},
): Promise<OutfitDescription> {
  const locale = opts.locale ?? 'vi';
  // Cache per (outfit, locale) — the copy language depends on locale, so a VI
  // result must not be served when EN is requested (and vice-versa).
  const cacheKey = `${outfitId}::${locale}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const { data, error } = await sb.functions.invoke('describe-outfit', {
      body: {
        items: items.map(i => ({
          name: i.name ?? undefined,
          type: i.type ?? undefined,
          color: i.color ?? undefined,
          material: i.material ?? undefined,
          fit: i.fit ?? undefined,
        })),
        styles: opts.styles,
        locale,
        occasion: opts.occasion,
        weather: opts.weather,
      },
    });
    if (error) throw error;
    const d = data as { description?: string; wayToWear?: string[] };
    const result: OutfitDescription = {
      description: d?.description ?? '',
      wayToWear: Array.isArray(d?.wayToWear)
        ? d.wayToWear.filter(x => typeof x === 'string' && x.trim().length > 0)
        : [],
    };
    // Only cache real results (description OR tips present).
    if (result.description || result.wayToWear.length > 0) cache.set(cacheKey, result);
    return result;
  } catch {
    return { description: '', wayToWear: [] };
  }
}
