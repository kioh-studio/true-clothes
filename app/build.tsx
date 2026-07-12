import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  FlatList, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { BottomSheet, PrimaryButton, SecondaryButton, TextLink, Tag, Field } from '../src/components/ui';
import {
  IconChevronLeft, IconShuffle, IconPlus, IconCheck,
  IconSparkle, IconX,
} from '../src/components/icons';
import { useAppStore } from '../src/stores/appStore';
import { STYLES, COLORS, OCCASIONS, ClothingItem } from '../src/data';
import { OutfitCollage } from '../src/components/outfit/Collage';
import { useTranslation } from '../src/i18n';


const BUILDER_BUCKETS = [
  { key: 'TOPS',      types: ['TEE', 'KNIT', 'POLO', 'SHIRT', 'BLOUSE', 'HENLEY', 'SWEATER', 'CARDIGAN', 'VEST', 'CAMISOLE', 'CROP', 'BODYSUIT', 'TUNIC', 'CORSET'] },
  { key: 'BOTTOMS',   types: ['JEANS', 'TROUSERS', 'CHINOS', 'SHORTS', 'SKIRT', 'LEGGINGS'] },
  { key: 'DRESS',     types: ['DRESS', 'JUMPSUIT', 'OVERALLS', 'GOWN'] },
  { key: 'OUTERWEAR', types: ['JACKET', 'BLAZER', 'COAT', 'OVERCOAT', 'HOODIE', 'PARKA', 'CAPE', 'KIMONO'] },
  { key: 'SHOES',     types: ['LOAFERS', 'SNEAKERS', 'BOOTS', 'HEELS', 'SANDALS', 'OXFORDS', 'MULES', 'FLATS', 'WEDGES'] },
  { key: 'BAGS',      types: ['BAG'] },
] as const;

type BucketKey = typeof BUILDER_BUCKETS[number]['key'];
type Selection = Record<BucketKey, string | null>;

// Bucket keys above are stable internal ids (Selection type keys, pool lookups)
// — this maps each to its translated display label, same pattern as the
// FILTER_LABEL_KEYS / SHAPE_LABEL_KEYS maps in earlier batches.
const BUCKET_LABEL_KEYS: Record<BucketKey, string> = {
  TOPS: 'build_bucketTops',
  BOTTOMS: 'build_bucketBottoms',
  DRESS: 'build_bucketDress',
  OUTERWEAR: 'build_bucketOuterwear',
  SHOES: 'build_bucketShoes',
  BAGS: 'build_bucketBags',
};

// Color-lean filter values are stable ids matching COLORS[].tag in src/data
// (used to bucket wardrobe items by tag) — keep the id, translate the label.
const COLOR_FILTER_LABEL_KEYS: Record<string, string> = {
  'WARM NEUTRAL': 'build_colorWarmNeutral',
  'EARTH': 'build_colorEarth',
  'NEUTRAL': 'build_colorNeutral',
  'DARK NEUTRAL': 'build_colorDarkNeutral',
  'COOL': 'build_colorCool',
};

const TITLE_WORD_KEYS = [
  'build_titleWordEdit', 'build_titleWordCompose', 'build_titleWordRotation',
  'build_titleWordLayered', 'build_titleWordQuiet',
];

// A one-piece (DRESS) fills the top+bottom roles, so it is mutually exclusive
// with TOPS/BOTTOMS — the slot picker enforces this in `pick`/`generateOutfits`.
const EMPTY_SEL: Selection = { TOPS: null, BOTTOMS: null, DRESS: null, OUTERWEAR: null, SHOES: null, BAGS: null };

function BuilderTile({ item, selected, onPress }: { item: ClothingItem; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tile, selected && styles.tileSelected]}>
      {item.png ? (
        <Image
          source={item.png}
          style={styles.tileImg}
          resizeMode="contain"
        />
      ) : (
        <Text style={styles.tileFallback}>{item.type}</Text>
      )}
      {selected && (
        <View style={styles.tileCheck}>
          <IconCheck size={10} color={T.color.canvas} strokeWidth={2} />
        </View>
      )}
    </Pressable>
  );
}

function CategoryStrip({
  label, items, selectedId, onSelect,
}: {
  label: string; items: ClothingItem[];
  selectedId: string | null; onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={styles.stripHeader}>
        <Text style={styles.stripLabel}>{label}</Text>
        <Text style={styles.stripCount}>{t('build_stripCount', { count: items.length })}</Text>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripList}
        renderItem={({ item }) => (
          <BuilderTile
            item={item}
            selected={selectedId === item.id}
            onPress={() => onSelect(item.id)}
          />
        )}
      />
    </View>
  );
}

// Simple outfit suggestion engine
function generateOutfits({
  items, anchorIds, styleFilter, colorFilter, occasionFilter, t,
}: {
  items: ClothingItem[];
  anchorIds: string[];
  styleFilter: string | null;
  colorFilter: string | null;
  occasionFilter: string | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const colorBuckets = COLORS.reduce<Record<string, string[]>>((acc, c) => {
    (acc[c.tag] ||= []).push(c.name);
    return acc;
  }, {});
  const preferredColors = colorFilter ? colorBuckets[colorFilter] : null;
  const matchesColor = (item: ClothingItem) => !preferredColors || preferredColors.includes(item.color);

  const anchorItems = anchorIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ClothingItem[];
  const pools: Record<string, ClothingItem[]> = {};
  for (const b of BUILDER_BUCKETS) {
    pools[b.key] = items.filter((i) => (b.types as readonly string[]).includes(i.type) && !anchorIds.includes(i.id));
  }

  const results: Array<{ id: string; title: string; rationale: string; tags: string[]; style: string; context: string; tone: number; itemIds: string[] }> = [];
  for (let i = 0; i < 5; i++) {
    const sel: Record<string, string | null> = {};
    for (const a of anchorItems) {
      const b = BUILDER_BUCKETS.find((bb) => (bb.types as readonly string[]).includes(a.type));
      if (b) sel[b.key] = a.id;
    }
    // A one-piece replaces the top+bottom pair. Honor the anchor: if a dress is
    // pinned use it; if a top/bottom is pinned never use a dress; otherwise build
    // some variants as dresses when the wardrobe has any (every 3rd option).
    const anchorHasDress = !!sel.DRESS;
    const anchorHasTwoPiece = !!sel.TOPS || !!sel.BOTTOMS;
    const useDress = anchorHasDress
      || (!anchorHasTwoPiece && (pools.DRESS?.length ?? 0) > 0 && i % 3 === 0);
    for (const b of BUILDER_BUCKETS) {
      if (sel[b.key]) continue;
      // Skip the role the chosen composition doesn't use, so a dress and a
      // top/bottom never coexist in the same suggestion.
      if (useDress && (b.key === 'TOPS' || b.key === 'BOTTOMS')) continue;
      if (!useDress && b.key === 'DRESS') continue;
      const pool = pools[b.key] || [];
      if (pool.length === 0) continue;
      const optional = b.key === 'OUTERWEAR' || b.key === 'BAGS';
      if (optional && Math.random() > 0.55) continue;
      const preferred = pool.filter(matchesColor);
      const list = preferred.length > 0 ? preferred : pool;
      sel[b.key] = list[(i * 3 + b.key.length) % list.length]?.id || null;
    }
    const itemIds = Object.values(sel).filter(Boolean) as string[];
    if (itemIds.length < 2) continue;

    const styleName = styleFilter ? STYLES.find((s) => s.id === styleFilter)?.name : null;
    const colorLabel = colorFilter ? t(COLOR_FILTER_LABEL_KEYS[colorFilter] ?? colorFilter) : null;
    const titleParts: string[] = [];
    if (styleName) titleParts.push(styleName);
    if (anchorItems.length) titleParts.push(t('build_titleWith', { item: anchorItems[0].color || anchorItems[0].name }));
    else titleParts.push(t(TITLE_WORD_KEYS[i % 5]));

    const rationaleParts: string[] = [];
    if (anchorItems.length) rationaleParts.push(t('build_rationaleBuiltAround', { items: anchorItems.slice(0, 2).map((a) => a.name.toLowerCase()).join(` ${t('build_and')} `) }));
    if (colorLabel) rationaleParts.push(t('build_rationaleLeaning', { color: colorLabel.toLowerCase() }));
    if (styleName) rationaleParts.push(styleName.toLowerCase());

    const tags: string[] = [];
    if (occasionFilter) tags.push(occasionFilter);
    if (colorLabel) tags.push(colorLabel);
    if (styleName) tags.push(styleName.toUpperCase());
    if (tags.length === 0) tags.push(t('build_tagSuggested'), t('build_tagDaytime'));

    results.push({
      id: `sug_${i}`,
      title: titleParts.join(' · ') || t('build_composedFallbackTitle'),
      rationale: rationaleParts.join(' · ') + '.',
      tags,
      style: styleName || 'CUSTOM',
      context: occasionFilter || 'CASUAL',
      tone: i % 5,
      itemIds,
    });
  }

  const seen = new Set<string>();
  return results.filter((r) => {
    const k = [...r.itemIds].sort().join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function SuggestSheet({
  open, onClose, items, anchorIds, onApply,
}: {
  open: boolean; onClose: () => void;
  items: ClothingItem[]; anchorIds: string[];
  onApply: (itemIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [occasionFilter, setOccasionFilter] = useState<string | null>(null);
  const [phase, setPhase] = useState<'configure' | 'generating' | 'results'>('configure');
  const [results, setResults] = useState<ReturnType<typeof generateOutfits>>([]);

  const anchors = anchorIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ClothingItem[];

  const generate = () => {
    setPhase('generating');
    setTimeout(() => {
      setResults(generateOutfits({ items, anchorIds, styleFilter, colorFilter, occasionFilter, t }));
      setPhase('results');
    }, 1400);
  };

  const reset = () => {
    setPhase('configure');
    setResults([]);
    setStyleFilter(null);
    setColorFilter(null);
    setOccasionFilter(null);
  };

  return (
    <BottomSheet open={open} onClose={() => { reset(); onClose(); }} maxHeight="92%">
      {phase === 'configure' && (
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sheetTitleRow}>
            <IconSparkle size={18} color={T.color.primary} strokeWidth={1.4} />
            <Text style={styles.sheetTitle}>{t('build_suggestSheetTitle')}</Text>
          </View>
          <Text style={styles.sheetSub}>
            {t('build_suggestSheetSub')}
          </Text>

          <Text style={[styles.filterLabel, { marginTop: 28 }]}>
            {t('build_anchorPiecesLabel')} {anchors.length === 0 ? t('build_anchorPiecesNone') : ''}
          </Text>
          {anchors.length === 0 ? (
            <View style={styles.anchorEmpty}>
              <Text style={styles.anchorEmptyText}>
                {t('build_anchorEmptyText')}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {anchors.map((item) => (
                <View key={item.id} style={styles.anchorThumb}>
                  {item.png && (
                    <Image source={item.png} style={styles.anchorImg} resizeMode="contain" />
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          {/* Style filter */}
          <View style={{ marginTop: 24 }}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t('build_styleLabel')}</Text>
              <Text style={styles.filterHint}>{t('build_optional')}</Text>
            </View>
            <View style={[styles.tagRow, { marginTop: 10 }]}>
              <Tag size="sm" selected={styleFilter === null} onPress={() => setStyleFilter(null)}>{t('build_any')}</Tag>
              {STYLES.slice(0, 6).map((s) => (
                <Tag key={s.id} size="sm" selected={styleFilter === s.id} onPress={() => setStyleFilter(s.id)}>
                  {s.name.toUpperCase()}
                </Tag>
              ))}
            </View>
          </View>

          {/* Color filter */}
          <View style={{ marginTop: 24 }}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t('build_colorLeanLabel')}</Text>
              <Text style={styles.filterHint}>{t('build_optional')}</Text>
            </View>
            <View style={[styles.tagRow, { marginTop: 10 }]}>
              {[null, 'WARM NEUTRAL', 'EARTH', 'NEUTRAL', 'DARK NEUTRAL', 'COOL'].map((ct) => (
                <Tag key={ct ?? 'any'} size="sm" selected={colorFilter === ct} onPress={() => setColorFilter(ct ?? null)}>
                  {ct ? t(COLOR_FILTER_LABEL_KEYS[ct]) : t('build_any')}
                </Tag>
              ))}
            </View>
          </View>

          {/* Occasion filter */}
          <View style={{ marginTop: 24 }}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t('build_occasionLabel')}</Text>
              <Text style={styles.filterHint}>{t('build_optional')}</Text>
            </View>
            <View style={[styles.tagRow, { marginTop: 10 }]}>
              <Tag size="sm" selected={occasionFilter === null} onPress={() => setOccasionFilter(null)}>{t('build_any')}</Tag>
              {OCCASIONS.map((o) => (
                <Tag key={o} size="sm" selected={occasionFilter === o} onPress={() => setOccasionFilter(o)}>
                  {o}
                </Tag>
              ))}
            </View>
          </View>

          <View style={{ height: 32 }} />
          <PrimaryButton onPress={generate}>{t('build_generateOutfitsButton')}</PrimaryButton>
          <View style={{ height: 12 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={() => { reset(); onClose(); }} color={T.color.tertiary}>{t('common_cancel')}</TextLink>
          </View>
          <View style={{ height: 16 }} />
        </ScrollView>
      )}

      {phase === 'generating' && (
        <View style={styles.generating}>
          <View style={styles.generatingIcon}>
            <IconSparkle size={24} color={T.color.primary} strokeWidth={1.2} />
          </View>
          <View style={{ height: 24 }} />
          <Text style={styles.generatingTitle}>{t('build_generatingTitle')}</Text>
          <Text style={styles.generatingSub}>{t('build_generatingSub')}</Text>
        </View>
      )}

      {phase === 'results' && (
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.resultsHeader}>
            <Text style={styles.sheetTitle}>{t('build_composedCount', { count: results.length })}</Text>
            <Pressable onPress={() => setPhase('configure')}>
              <Text style={styles.editFilters}>{t('build_editFilters')}</Text>
            </Pressable>
          </View>
          <Text style={styles.sheetSub}>{t('build_useThisHint')}</Text>
          {results.length === 0 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsTitle}>{t('build_noResultsTitle')}</Text>
              <Text style={styles.sheetSub}>{t('build_looseFilterHint')}</Text>
            </View>
          ) : (
            results.map((r, i) => (
              <View key={r.id} style={styles.suggCard}>
                <View style={styles.suggThumb}>
                  {/* Placeholder since Collage needs full outfit data */}
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: T.color.elevated, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={styles.suggNum}>0{i + 1}</Text>
                  </View>
                </View>
                <View style={styles.suggInfo}>
                  <Text style={styles.suggOption}>{t('build_optionLabel', { num: String(i + 1).padStart(2, '0') })}</Text>
                  <Text style={styles.suggTitle}>{r.title}</Text>
                  <Text style={styles.suggRationale} numberOfLines={2}>{r.rationale}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={styles.suggTags}>
                    {r.tags.slice(0, 3).map((tag) => (
                      <Text key={tag} style={styles.suggTag}>{tag}</Text>
                    ))}
                  </View>
                  <View style={{ height: 10 }} />
                  <Pressable onPress={() => { onApply(r.itemIds); reset(); onClose(); }} style={styles.useBtn}>
                    <Text style={styles.useBtnText}>{t('build_useThisButton')}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 8 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={generate} color={T.color.primary} arrow>{t('build_regenerateLink')}</TextLink>
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </BottomSheet>
  );
}

export default function OutfitBuilderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { items, createCollection, addItemToCollection, collectionsError } = useAppStore();

  const buckets = BUILDER_BUCKETS.map((b) => ({
    ...b,
    list: items.filter((i) => (b.types as readonly string[]).includes(i.type)),
  }));

  const findFirst = (types: readonly string[]) =>
    items.find((i) => types.includes(i.type) && i.png)?.id || null;

  const [sel, setSel] = useState<Selection>({
    ...EMPTY_SEL,
    TOPS:      findFirst(['TEE', 'KNIT', 'POLO']),
    BOTTOMS:   findFirst(['JEANS', 'TROUSERS', 'CHINOS']),
    SHOES:     findFirst(['LOAFERS', 'SNEAKERS']),
  });

  // Picking a one-piece clears the top+bottom pair (and vice versa) — they fill
  // the same body region and can't both be worn.
  const pick = (cat: BucketKey, id: string) =>
    setSel((s) => {
      const togglingOff = s[cat] === id;
      const next: Selection = { ...s, [cat]: togglingOff ? null : id };
      if (!togglingOff) {
        if (cat === 'DRESS') { next.TOPS = null; next.BOTTOMS = null; }
        else if (cat === 'TOPS' || cat === 'BOTTOMS') next.DRESS = null;
      }
      return next;
    });

  const selectedIds = Object.values(sel).filter(Boolean) as string[];
  const canSave = selectedIds.length >= 2;

  const listFor = (key: BucketKey) => buckets.find((b) => b.key === key)?.list ?? [];

  const shuffle = () => {
    const r = (arr: ClothingItem[]) => arr[Math.floor(Math.random() * arr.length)]?.id || null;
    // Build a one-piece look ~35% of the time when dresses exist; otherwise a
    // two-piece top+bottom look. The two are never combined.
    const dresses = listFor('DRESS');
    const useDress = dresses.length > 0 && Math.random() < 0.35;
    setSel({
      ...EMPTY_SEL,
      TOPS:      useDress ? null : r(listFor('TOPS')),
      BOTTOMS:   useDress ? null : r(listFor('BOTTOMS')),
      DRESS:     useDress ? r(dresses) : null,
      OUTERWEAR: Math.random() > 0.55 ? r(listFor('OUTERWEAR')) : null,
      SHOES:     r(listFor('SHOES')),
      BAGS:      Math.random() > 0.55 ? r(listFor('BAGS')) : null,
    });
  };

  const clear = () => setSel({ ...EMPTY_SEL });

  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const applySuggestion = (itemIds: string[]) => {
    const next: Selection = { ...EMPTY_SEL };
    for (const id of itemIds) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      const bucket = BUILDER_BUCKETS.find((b) => (b.types as readonly string[]).includes(item.type));
      if (bucket && !next[bucket.key]) next[bucket.key] = id;
    }
    setSel(next);
  };

  // Shared by the name-sheet hint and the saved collection description — both
  // render "N piece(s) · bucket, bucket" from the current selection.
  const pieceSummary = () => t('build_pieceHint', {
    count: selectedIds.length,
    suffix: selectedIds.length === 1 ? '' : 's',
    list: Object.entries(sel).filter(([, v]) => v).map(([k]) => t(BUCKET_LABEL_KEYS[k as BucketKey]).toLowerCase()).join(' · '),
  });

  const tempOutfit = {
    id: 'builder_preview',
    title: name || t('build_defaultOutfitNameNew'),
    subtitle: t('build_inProgress'),
    style: 'CUSTOM',
    context: 'NEW',
    weather: '',
    description: '',
    longDescription: '',
    tags: [],
    tone: 0 as 0 | 1 | 2 | 3 | 4,
    itemIds: selectedIds,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('build_title')}</Text>
        <Pressable onPress={shuffle} style={styles.iconBtn}>
          <IconShuffle size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      {/* Canvas */}
      <View style={styles.canvas}>
        {selectedIds.length === 0 ? (
          <View style={styles.emptyCanvas}>
            <View style={styles.emptyCanvasIcon}>
              <IconPlus size={18} color={T.color.tertiary} strokeWidth={1.4} />
            </View>
            <Text style={styles.emptyCanvasLabel}>{t('build_emptyCanvasLabel')}</Text>
            <Text style={styles.emptyCanvasHint}>{t('build_emptyCanvasHint')}</Text>
          </View>
        ) : (
          <OutfitCollage outfit={tempOutfit} showTitle={false} containerHeight={220} />
        )}
        {selectedIds.length > 0 && (
          <>
            <Text style={styles.canvasPieceCount}>
              {t('build_pieceCount', { count: selectedIds.length, suffix: selectedIds.length === 1 ? '' : 'S' })}
            </Text>
            <Pressable onPress={clear} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>{t('build_clearAll')}</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Pickers */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        {buckets.map((b) =>
          b.list.length > 0 ? (
            <CategoryStrip
              key={b.key}
              label={t(BUCKET_LABEL_KEYS[b.key])}
              items={b.list}
              selectedId={sel[b.key]}
              onSelect={(id) => pick(b.key, id)}
            />
          ) : null
        )}
      </ScrollView>

      {/* Suggest CTA */}
      <View style={styles.suggestRow}>
        <Pressable onPress={() => setSuggestOpen(true)} style={styles.suggestBtn}>
          <IconSparkle size={14} color={T.color.primary} strokeWidth={1.4} />
          <Text style={styles.suggestBtnText}>
            {selectedIds.length === 0
              ? t('build_suggestForMe')
              : t('build_suggestWithAnchors', { count: selectedIds.length, suffix: selectedIds.length === 1 ? '' : 'S' })}
          </Text>
        </Pressable>
      </View>

      {/* Save + AI try-on */}
      <View style={[styles.saveRow, { paddingBottom: insets.bottom + 8 }]}>
        {canSave && (
          <>
            <SecondaryButton
              onPress={() => router.push({
                pathname: '/try-on/wear' as any,
                params: {
                  id: 'builder_preview',
                  data: JSON.stringify({
                    id: 'builder_preview',
                    title: name || t('build_defaultOutfitNameNew'),
                    style: 'CUSTOM',
                    context: 'BUILDER',
                    itemIds: selectedIds,
                  }),
                },
              })}
            >
              {t('build_seeItOnYouButton')}
            </SecondaryButton>
            <View style={{ height: 8 }} />
          </>
        )}
        <PrimaryButton onPress={() => canSave && setNameOpen(true)} disabled={!canSave}>
          {canSave ? t('build_saveOutfitButton') : t('build_pickAtLeast2')}
        </PrimaryButton>
      </View>

      {/* Name sheet */}
      <BottomSheet open={nameOpen} onClose={() => setNameOpen(false)} maxHeight="58%">
        <View style={styles.nameSheetContent}>
          <Text style={styles.nameTitle}>{t('build_nameYourOutfitTitle')}</Text>
          <Text style={styles.nameSub}>{t('build_nameYourOutfitSub')}</Text>
          <View style={{ height: 32 }} />
          <Field label={t('build_outfitNameLabel')} value={name} onChange={setName} placeholder={t('build_outfitNamePlaceholder')} />
          <View style={{ height: 16 }} />
          <Text style={styles.nameHint}>
            {pieceSummary()}
          </Text>
          <View style={{ height: 32 }} />
          <PrimaryButton
            disabled={saving}
            onPress={async () => {
              setSaving(true);
              try {
                const label = name.trim() || t('build_defaultOutfitName');
                const description = pieceSummary();
                // createCollection returns the collection it actually created (or
                // null on failure) — never fall back to collections[0], which is
                // the OLD first collection and would silently receive these items.
                const created = await createCollection(label, description);
                if (!created) {
                  // collectionsError in the store holds the user-facing message;
                  // keep the sheet open so the user can see it and retry.
                  return;
                }
                for (const id of selectedIds) {
                  const ok = await addItemToCollection(created.id, id);
                  if (!ok) {
                    // Abort — keep the sheet open so the collectionsError banner
                    // (set by the store) is visible instead of closing silently.
                    return;
                  }
                }
                setNameOpen(false);
                setName('');
                router.back();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? t('addItem_savingText') : t('build_saveToCollectionButton')}
          </PrimaryButton>
          {collectionsError ? (
            <Text style={{ ...type.caption, fontSize: 12, color: T.color.warning, textAlign: 'center', marginTop: 8 }}>
              {collectionsError}
            </Text>
          ) : <View style={{ height: 12 }} />}
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={() => setNameOpen(false)} color={T.color.tertiary}>{t('build_keepEditingLink')}</TextLink>
          </View>
        </View>
      </BottomSheet>

      {/* Suggest sheet */}
      <SuggestSheet
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        items={items}
        anchorIds={selectedIds}
        onApply={applySuggestion}
      />
    </View>
  );
}

const CANVAS_H = 220;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: { ...type.h3, color: T.color.primary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Canvas
  canvas: {
    height: CANVAS_H,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    backgroundColor: T.color.canvas,
    position: 'relative',
    overflow: 'hidden',
  },
  emptyCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyCanvasIcon: {
    width: 48,
    height: 48,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCanvasLabel: { ...type.micro, color: T.color.tertiary },
  emptyCanvasHint: { ...type.caption, fontSize: 12, color: T.color.tertiary },
  canvasPieceCount: {
    position: 'absolute',
    top: 12,
    left: 16,
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },
  clearBtn: { position: 'absolute', top: 8, right: 16 },
  clearBtnText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
    textDecorationLine: 'underline',
  },

  // Category strip
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  stripLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  stripCount: { ...type.ui, fontSize: 9, color: T.color.tertiary, opacity: 0.6 },
  stripList: { paddingHorizontal: 24, gap: 10, paddingBottom: 4 },

  // Builder tile
  tile: {
    width: 84,
    height: 104,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tileSelected: { borderWidth: 1, borderColor: T.color.primary },
  tileImg: { width: '100%', height: '100%' },
  tileFallback: { ...type.micro, fontSize: 9, color: T.color.tertiary, textAlign: 'center' },
  tileCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: T.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Suggest CTA
  suggestRow: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 0 },
  suggestBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
  },
  suggestBtnText: { ...type.ui, fontSize: 10, color: T.color.primary },

  // Save row
  saveRow: { paddingHorizontal: 24, paddingTop: 12 },

  // Name sheet
  nameSheetContent: { padding: 24, paddingBottom: 32 },
  nameTitle: { ...type.h2, color: T.color.primary },
  nameSub: { ...type.caption, marginTop: 8 },
  nameHint: { ...type.caption, fontSize: 12, color: T.color.tertiary },

  // Suggest sheet
  sheetContent: { padding: 24, paddingBottom: 24 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitle: { ...type.h2, color: T.color.primary },
  sheetSub: { ...type.caption, marginTop: 8 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  filterLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  filterHint: { ...type.ui, fontSize: 9, color: T.color.tertiary, opacity: 0.7 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  anchorEmpty: {
    marginTop: 12,
    padding: 20,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  anchorEmptyText: { ...type.caption, fontSize: 12, color: T.color.tertiary, textAlign: 'center' },
  anchorThumb: {
    width: 76,
    height: 92,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    padding: 6,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorImg: { width: '100%', height: '100%' },
  generating: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  generatingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatingTitle: { ...type.h3, color: T.color.primary, textAlign: 'center' },
  generatingSub: { ...type.caption, textAlign: 'center', marginTop: 12 },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editFilters: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
    textDecorationLine: 'underline',
  },
  noResults: {
    padding: 40,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    borderStyle: 'dashed',
    marginTop: 24,
  },
  noResultsTitle: { ...type.h3, color: T.color.primary },
  suggCard: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    padding: 12,
    gap: 12,
    marginTop: 12,
  },
  suggThumb: {
    width: 96,
    aspectRatio: 3 / 4,
    backgroundColor: T.color.elevated,
    overflow: 'hidden',
  },
  suggNum: {
    fontFamily: T.font.serif,
    fontSize: 28,
    fontWeight: '300',
    color: T.color.tertiary,
  },
  suggInfo: { flex: 1, minWidth: 0 },
  suggOption: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  suggTitle: {
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.primary,
    marginTop: 4,
    lineHeight: 20,
  },
  suggRationale: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4 },
  suggTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  suggTag: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  useBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: T.color.primary,
  },
  useBtnText: { ...type.ui, fontSize: 10, color: T.color.canvas },
});
