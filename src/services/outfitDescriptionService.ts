import { sb } from './supabase';

// Lazy outfit description (feature 008). The feed's curation pass only ranks and
// writes the one-line stylist note (generating 10 full descriptions at once takes
// ~10s and blocks the feed). The detail screen calls this for the ONE outfit being
// viewed (~1–2s). Results are cached in-memory by outfit id so reopening is instant.

export interface DescribeItem {
  name?: string | null;
  type?: string | null;
  color?: string | null;
  material?: string | null;
  fit?: string | null;
}

const cache = new Map<string, string>();

/**
 * Returns a 2–3 sentence AI description for the outfit, or '' on any failure
 * (the caller should fall back to its own item-list text). Cached by `outfitId`.
 */
export async function describeOutfit(
  outfitId: string,
  items: DescribeItem[],
  opts: { styles?: string[]; locale?: 'vi' | 'en'; occasion?: string } = {},
): Promise<string> {
  const locale = opts.locale ?? 'vi';
  // Cache per (outfit, locale) — the description language depends on locale, so a
  // VI result must not be served when EN is requested (and vice-versa).
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
      },
    });
    if (error) throw error;
    const description = (data as { description?: string })?.description ?? '';
    if (description) cache.set(cacheKey, description);  // only cache real results
    return description;
  } catch {
    return '';
  }
}
