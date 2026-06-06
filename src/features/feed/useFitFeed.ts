import { useEffect, useState, useRef, useCallback } from 'react';
import { useFitEngineStore } from '../../stores/fitEngineStore';
import { Outfit } from '../../data';
import { ScoredOutfit, OutfitSlots } from '../../types/fitEngine';
import { useAppStore } from '../../stores/appStore';

// Stable deep-comparison hook
function useStableValue<T>(value: T): T {
  const ref = useRef(value);
  const prev = JSON.stringify(ref.current);
  const next = JSON.stringify(value);
  if (prev !== next) ref.current = value;
  return ref.current;
}

function slotsToIds(slots: OutfitSlots): string[] {
  return [slots.top, slots.bottom, slots.shoes, slots.outwear, slots.accessory]
    .filter((id): id is string => id !== undefined);
}

const OUTFIT_TITLES = [
  'The Quiet Edit', 'A Clean Composition', 'Considered Dressing',
  'Understated Authority', 'Edited Simplicity', 'The Right Balance',
  'Restrained Elegance', 'Deliberate Choices', 'Tonal Harmony', 'The Daily Standard',
];

const SUBTITLES: Record<string, string> = {
  oldmoney:   'old money · refined',
  minimalist: 'minimalist · deliberate',
  streetwear: 'streetwear · urban',
  smartcasual:'smart casual · polished',
  preppy:     'preppy · clean',
  athleisure: 'athleisure · active',
  y2k:        'y2k · playful',
  bohemian:   'bohemian · flowing',
};

function scoredToOutfit(scored: ScoredOutfit, items: ReturnType<typeof useAppStore.getState>['items'], userStyles: string[], index: number): Outfit {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const ids = slotsToIds(scored.slots);
  const outfitItems = ids.map(id => itemMap.get(id)).filter(Boolean);

  const dominantStyle = userStyles[0] ?? 'minimalist';
  const title = OUTFIT_TITLES[index % OUTFIT_TITLES.length];
  const subtitle = SUBTITLES[dominantStyle] ?? dominantStyle;
  const description = outfitItems.map(i => i!.name).join(', ');

  return {
    id: `gen_${ids.join('_')}`,
    title,
    subtitle,
    style: dominantStyle.toUpperCase().replace('_', ' '),
    context: 'DAILY',
    weather: '22°C',
    description,
    longDescription: '',
    tags: ['22°C', 'DAILY', scored.formula.toUpperCase()],
    tone: Math.round(outfitItems.reduce((sum, i) => sum + (i?.tone ?? 1), 0) / Math.max(outfitItems.length, 1)),
    itemIds: ids,
    formula: scored.formula,
    tier: scored.tier,
    scores: {
      totalScore: scored.totalScore,
      styleCoherence: scored.styleCoherence,
      colorHarmony: scored.colorHarmony,
      fitScore: scored.fitScore,
      proportionBalance: scored.proportionBalance,
      formalityConsistency: scored.formalityConsistency,
      seasonMatch: scored.seasonMatch,
      textureInterest: scored.textureInterest,
    },
  };
}

// Returns a ranked daily outfit feed from the Edge Function.
export function useFitFeed(): { outfits: Outfit[]; isGenerated: boolean; loading: boolean; refresh: () => void } {
  const { items } = useAppStore();
  const { fetchOutfits, styleProfile } = useFitEngineStore();

  const stableStyles = useStableValue(styleProfile.selectedStyles);

  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const scored = await fetchOutfits();
      if (scored.length > 0) {
        setOutfits(scored.map((s, i) => scoredToOutfit(s, items, styleProfile.selectedStyles, i)));
      } else {
        setOutfits([]);
      }
    } catch (err) {
      console.warn('[useFitFeed] Error:', err);
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  }, [fetchOutfits, items, styleProfile.selectedStyles]);

  useEffect(() => {
    load();
  }, [stableStyles, load]);

  return { outfits, isGenerated: outfits.length > 0, loading, refresh: load };
}
