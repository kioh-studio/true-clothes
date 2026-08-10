import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useFitEngineStore } from '../../stores/fitEngineStore';
import { Outfit } from '../../data';
import { ScoredOutfit, OutfitSlots } from '../../types/fitEngine';
import { useAppStore } from '../../stores/appStore';
import { usePremium } from '../monetization/usePremium';
import i18n from '../../i18n';

// Stable deep-comparison hook
function useStableValue<T>(value: T): T {
  const ref = useRef(value);
  const prev = JSON.stringify(ref.current);
  const next = JSON.stringify(value);
  if (prev !== next) ref.current = value;
  return ref.current;
}

function slotsToIds(slots: OutfitSlots): string[] {
  // Dedupe: a one-piece (dress/jumpsuit) fills both top and bottom slots.
  // `mid` (2026-08-10, layer worn under a true outer) appended last — mirrors
  // the server's engine/ranking.ts slotsToIds ordering.
  return [...new Set(
    [slots.top, slots.bottom, slots.shoes, slots.outwear, slots.accessory, slots.mid]
      .filter((id): id is string => id !== undefined),
  )];
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
  // Story-aware subtitle (S3): the engine groups the feed into story briefs
  // (REFINED / EVERYDAY / OFF DUTY); the card kicker reads "story · style".
  // Older responses without a story fall back to the static style subtitle.
  const styleLabel = (SUBTITLES[dominantStyle] ?? dominantStyle).split(' · ')[0];
  const subtitle = scored.story
    ? `${scored.story.toLowerCase()} · ${styleLabel}`
    : SUBTITLES[dominantStyle] ?? dominantStyle;
  const description = outfitItems.map(i => i!.name).join(', ');

  // Real warmth band from the engine, falling back to the legacy static value
  // for older responses. Resolve one styling tip in the user's locale.
  const weather = scored.weatherBand ?? '22°C';
  const tip = scored.stylingTips?.[0];
  const stylingTip = tip ? (i18n.language.startsWith('vi') ? tip.vi : tip.en) : undefined;

  // Use the full slot set (same order as fitEngineStore's outfitKey) so two
  // outfits sharing core items but differing in outwear/accessory/mid get
  // distinct ids. Absent optional slots are represented by an empty string so
  // the key remains stable regardless of undefined vs. omitted.
  const fullKey = [
    scored.slots.top    ?? '',
    scored.slots.bottom ?? '',
    scored.slots.shoes  ?? '',
    scored.slots.outwear   ?? '',
    scored.slots.accessory ?? '',
    scored.slots.mid ?? '',
  ].join('|');

  const SIL_KEY: Record<string, string> = {
    fitted: 'outfitSilhouette_fitted',
    straight: 'outfitSilhouette_straight',
    relaxed: 'outfitSilhouette_relaxed',
    'top-volume': 'outfitSilhouette_topVolume',
    'bottom-volume': 'outfitSilhouette_bottomVolume',
  };
  const silhouetteTag = scored.silhouette && SIL_KEY[scored.silhouette]
    ? i18n.t(SIL_KEY[scored.silhouette]).toUpperCase()
    : undefined;
  const SHAPE_KEY: Record<string, string> = {
    'hourglass': 'outfitShape_hourglass',
    'rectangle': 'outfitShape_rectangle',
    'oval': 'outfitShape_oval',
    'inverted-triangle': 'outfitShape_invertedTriangle',
    'triangle': 'outfitShape_triangle',
  };
  // Prefixed with a translated label ("SHAPE: HOURGLASS") so the tag reads as
  // self-explanatory wherever it's shown, not just a bare shape name lost
  // among the other tags — mirrors app/(tabs)/index.tsx's card meta line (see
  // design/feed/design.md).
  const silhouetteShapeTag = scored.silhouetteShape && SHAPE_KEY[scored.silhouetteShape]
    ? `${i18n.t('outfitShape_prefix').toUpperCase()}: ${i18n.t(SHAPE_KEY[scored.silhouetteShape]).toUpperCase()}`
    : undefined;
  const colorToneTag = scored.colorTone ? scored.colorTone.toUpperCase() : undefined;
  // Wardrobe-affinity style fallback (2026-08-02) — display-only, no i18n (a
  // proper noun style name), only present when the server's style fallback
  // fired. Style identity outranks silhouette, so it sorts before it below.
  const styleTag = scored.styleTag?.toUpperCase();

  return {
    id: `gen_${fullKey}`,
    title,
    subtitle,
    style: dominantStyle.toUpperCase().replace('_', ' '),
    context: scored.story ?? 'DAILY',
    weather,
    description,
    // Item-list fallback; the detail screen swaps in a lazy AI description on open.
    longDescription: description,
    tags: [weather, scored.story ?? 'DAILY', styleTag, silhouetteTag, silhouetteShapeTag, colorToneTag, scored.formula.toUpperCase()].filter(Boolean) as string[],
    tone: Math.round(outfitItems.reduce((sum, i) => sum + (i?.tone ?? 1), 0) / Math.max(outfitItems.length, 1)),
    itemIds: ids,
    formula: scored.formula,
    tier: scored.tier,
    stylistNote: scored.stylistNote,
    stylingTip,
    silhouette: scored.silhouette,
    silhouetteShape: scored.silhouetteShape,
    colorTone: scored.colorTone,
    styleTag: scored.styleTag,
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
//
// `store.outfits` is the single source of truth: fetchOutfits() replaces it and
// fetchMoreOutfits() appends to it. This hook subscribes to that array and maps
// it to view models, so infinite-scroll pagination (which calls fetchMoreOutfits)
// renders without the hook holding a second, stale copy of the list.
export function useFitFeed(): { outfits: Outfit[]; isGenerated: boolean; loading: boolean; refresh: () => void } {
  // Per-field selectors (not a full-store destructure): both stores are
  // written to from many unrelated screens/actions, and a full-store
  // subscription here would re-render this full-screen pager on every one
  // of those writes.
  const items = useAppStore(s => s.items);
  const fetchOutfits  = useFitEngineStore(s => s.fetchOutfits);
  const styleProfile  = useFitEngineStore(s => s.styleProfile);
  const setPremium    = useFitEngineStore(s => s.setPremium);
  const scored = useFitEngineStore(s => s.outfits);
  const { isPremium } = usePremium();

  // Keep the store's tier flag in sync so fetches gate curation correctly
  useEffect(() => { setPremium(isPremium); }, [isPremium, setPremium]);

  const stableStyles = useStableValue(styleProfile.selectedStyles);

  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchOutfits(); // updates store.outfits (the source this hook maps)
    } catch (err) {
      console.warn('[useFitFeed] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchOutfits]);

  useEffect(() => {
    load();
  }, [stableStyles, load]);

  const outfits = useMemo(
    () => scored.map((s, i) => scoredToOutfit(s, items, styleProfile.selectedStyles, i)),
    [scored, items, styleProfile.selectedStyles],
  );

  return { outfits, isGenerated: outfits.length > 0, loading, refresh: load };
}
