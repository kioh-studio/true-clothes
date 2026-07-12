import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { describeOutfit, DescribeItem } from '../../services/outfitDescriptionService';
import { useFitEngineStore } from '../../stores/fitEngineStore';

// Lazily fetches the AI outfit description + "how to wear" tips for the detail
// screen (feature 008 / Way to Wear Phase A). Only generated outfits (id `gen_…`)
// get one; mock/sample outfits keep their copy and have no tips. Starts from
// `fallback` (the item-list text) and swaps in the AI result when it arrives, so
// the screen is never blank and degrades gracefully on failure.
export function useOutfitDescription(
  outfitId: string,
  items: DescribeItem[],
  fallback: string,
  meta?: { occasion?: string; weather?: string },
): { description: string; wayToWear: string[]; loading: boolean } {
  const styles = useFitEngineStore(s => s.styleProfile.selectedStyles);
  const { i18n } = useTranslation();
  const locale: 'vi' | 'en' = i18n.language?.startsWith('vi') ? 'vi' : 'en';
  const [description, setDescription] = useState(fallback);
  const [wayToWear, setWayToWear] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const occasion = meta?.occasion;
  const weather = meta?.weather;

  useEffect(() => {
    if (!outfitId.startsWith('gen_') || items.length === 0) {
      setDescription(fallback);
      setWayToWear([]);
      return;
    }
    let cancelled = false;
    setDescription(fallback);
    setWayToWear([]);
    setLoading(true);
    describeOutfit(outfitId, items, { styles, locale, occasion, weather })
      .then(r => {
        if (cancelled) return;
        if (r.description) setDescription(r.description);
        setWayToWear(r.wayToWear);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // Re-run when the outfit changes, when items first become available (the cloud
    // wardrobe may hydrate after mount), or when the app language changes.
    // describeOutfit caches by (id, locale), so a repeat call is a cache hit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfitId, items.length, locale]);

  return { description, wayToWear, loading };
}
