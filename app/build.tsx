import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  FlatList, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { BottomSheet, PrimaryButton, TextLink, Tag, Field } from '../src/components/ui';
import {
  IconChevronLeft, IconShuffle, IconPlus, IconCheck,
  IconSparkle, IconX,
} from '../src/components/icons';
import { useAppStore } from '../src/stores/appStore';
import { STYLES, COLORS, OCCASIONS, ClothingItem } from '../src/data';
import { OutfitCollage } from '../src/components/outfit/Collage';


const BUILDER_BUCKETS = [
  { key: 'TOPS',      types: ['TEE', 'KNIT', 'POLO', 'SHIRT'] },
  { key: 'BOTTOMS',   types: ['JEANS', 'TROUSERS', 'CHINOS'] },
  { key: 'OUTERWEAR', types: ['JACKET', 'BLAZER', 'COAT'] },
  { key: 'SHOES',     types: ['LOAFERS', 'SNEAKERS'] },
  { key: 'BAGS',      types: ['BAG'] },
] as const;

type BucketKey = typeof BUILDER_BUCKETS[number]['key'];
type Selection = Record<BucketKey, string | null>;

const EMPTY_SEL: Selection = { TOPS: null, BOTTOMS: null, OUTERWEAR: null, SHOES: null, BAGS: null };

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
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={styles.stripHeader}>
        <Text style={styles.stripLabel}>{label}</Text>
        <Text style={styles.stripCount}>{items.length} AVAILABLE</Text>
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
  items, anchorIds, styleFilter, colorFilter, occasionFilter,
}: {
  items: ClothingItem[];
  anchorIds: string[];
  styleFilter: string | null;
  colorFilter: string | null;
  occasionFilter: string | null;
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
    for (const b of BUILDER_BUCKETS) {
      if (sel[b.key]) continue;
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
    const titleParts: string[] = [];
    if (styleName) titleParts.push(styleName);
    if (anchorItems.length) titleParts.push(`with ${anchorItems[0].color || anchorItems[0].name}`);
    else titleParts.push(['Edit', 'Compose', 'Rotation', 'Layered', 'Quiet'][i % 5]);

    const rationaleParts: string[] = [];
    if (anchorItems.length) rationaleParts.push(`Built around ${anchorItems.slice(0, 2).map((a) => a.name.toLowerCase()).join(' and ')}`);
    if (colorFilter) rationaleParts.push(`leaning ${colorFilter.toLowerCase()}`);
    if (styleName) rationaleParts.push(styleName.toLowerCase());

    const tags: string[] = [];
    if (occasionFilter) tags.push(occasionFilter);
    if (colorFilter) tags.push(colorFilter);
    if (styleName) tags.push(styleName.toUpperCase());
    if (tags.length === 0) tags.push('SUGGESTED', 'DAYTIME');

    results.push({
      id: `sug_${i}`,
      title: titleParts.join(' · ') || 'Composed outfit',
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
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [occasionFilter, setOccasionFilter] = useState<string | null>(null);
  const [phase, setPhase] = useState<'configure' | 'generating' | 'results'>('configure');
  const [results, setResults] = useState<ReturnType<typeof generateOutfits>>([]);

  const anchors = anchorIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ClothingItem[];

  const generate = () => {
    setPhase('generating');
    setTimeout(() => {
      setResults(generateOutfits({ items, anchorIds, styleFilter, colorFilter, occasionFilter }));
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
            <Text style={styles.sheetTitle}>Suggest outfits.</Text>
          </View>
          <Text style={styles.sheetSub}>
            We'll compose outfits that work with what you've picked. Filters are optional.
          </Text>

          <Text style={[styles.filterLabel, { marginTop: 28 }]}>
            ANCHOR PIECES {anchors.length === 0 ? '(NONE — WE\'LL START FROM SCRATCH)' : ''}
          </Text>
          {anchors.length === 0 ? (
            <View style={styles.anchorEmpty}>
              <Text style={styles.anchorEmptyText}>
                Tip — pick a piece on the canvas first, and we'll build around it.
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
              <Text style={styles.filterLabel}>STYLE</Text>
              <Text style={styles.filterHint}>OPTIONAL</Text>
            </View>
            <View style={[styles.tagRow, { marginTop: 10 }]}>
              <Tag size="sm" selected={styleFilter === null} onPress={() => setStyleFilter(null)}>ANY</Tag>
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
              <Text style={styles.filterLabel}>COLOR LEAN</Text>
              <Text style={styles.filterHint}>OPTIONAL</Text>
            </View>
            <View style={[styles.tagRow, { marginTop: 10 }]}>
              {[null, 'WARM NEUTRAL', 'EARTH', 'NEUTRAL', 'DARK NEUTRAL', 'COOL'].map((t) => (
                <Tag key={t ?? 'any'} size="sm" selected={colorFilter === t} onPress={() => setColorFilter(t ?? null)}>
                  {t ?? 'ANY'}
                </Tag>
              ))}
            </View>
          </View>

          {/* Occasion filter */}
          <View style={{ marginTop: 24 }}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>OCCASION</Text>
              <Text style={styles.filterHint}>OPTIONAL</Text>
            </View>
            <View style={[styles.tagRow, { marginTop: 10 }]}>
              <Tag size="sm" selected={occasionFilter === null} onPress={() => setOccasionFilter(null)}>ANY</Tag>
              {OCCASIONS.map((o) => (
                <Tag key={o} size="sm" selected={occasionFilter === o} onPress={() => setOccasionFilter(o)}>
                  {o}
                </Tag>
              ))}
            </View>
          </View>

          <View style={{ height: 32 }} />
          <PrimaryButton onPress={generate}>GENERATE OUTFITS</PrimaryButton>
          <View style={{ height: 12 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={() => { reset(); onClose(); }} color={T.color.tertiary}>Cancel</TextLink>
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
          <Text style={styles.generatingTitle}>Composing outfits…</Text>
          <Text style={styles.generatingSub}>Matching anchor pieces to your style and palette.</Text>
        </View>
      )}

      {phase === 'results' && (
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.resultsHeader}>
            <Text style={styles.sheetTitle}>{results.length} composed</Text>
            <Pressable onPress={() => setPhase('configure')}>
              <Text style={styles.editFilters}>EDIT FILTERS</Text>
            </Pressable>
          </View>
          <Text style={styles.sheetSub}>Tap "Use this" to load an outfit into the canvas.</Text>
          {results.length === 0 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsTitle}>Nothing matches.</Text>
              <Text style={styles.sheetSub}>Loosen a filter and try again.</Text>
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
                  <Text style={styles.suggOption}>OPTION {String(i + 1).padStart(2, '0')}</Text>
                  <Text style={styles.suggTitle}>{r.title}</Text>
                  <Text style={styles.suggRationale} numberOfLines={2}>{r.rationale}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={styles.suggTags}>
                    {r.tags.slice(0, 3).map((t) => (
                      <Text key={t} style={styles.suggTag}>{t}</Text>
                    ))}
                  </View>
                  <View style={{ height: 10 }} />
                  <Pressable onPress={() => { onApply(r.itemIds); reset(); onClose(); }} style={styles.useBtn}>
                    <Text style={styles.useBtnText}>USE THIS →</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 8 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={generate} color={T.color.primary} arrow>Re-generate</TextLink>
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
  const { items } = useAppStore();

  const buckets = BUILDER_BUCKETS.map((b) => ({
    ...b,
    list: items.filter((i) => (b.types as readonly string[]).includes(i.type)),
  }));

  const findFirst = (types: readonly string[]) =>
    items.find((i) => types.includes(i.type) && i.png)?.id || null;

  const [sel, setSel] = useState<Selection>({
    TOPS:      findFirst(['TEE', 'KNIT', 'POLO']),
    BOTTOMS:   findFirst(['JEANS', 'TROUSERS', 'CHINOS']),
    OUTERWEAR: null,
    SHOES:     findFirst(['LOAFERS', 'SNEAKERS']),
    BAGS:      null,
  });

  const pick = (cat: BucketKey, id: string) =>
    setSel((s) => ({ ...s, [cat]: s[cat] === id ? null : id }));

  const selectedIds = Object.values(sel).filter(Boolean) as string[];
  const canSave = selectedIds.length >= 2;

  const shuffle = () => {
    const r = (arr: ClothingItem[]) => arr[Math.floor(Math.random() * arr.length)]?.id || null;
    setSel({
      TOPS:      r(buckets[0].list),
      BOTTOMS:   r(buckets[1].list),
      OUTERWEAR: Math.random() > 0.55 ? r(buckets[2].list) : null,
      SHOES:     r(buckets[3].list),
      BAGS:      Math.random() > 0.55 ? r(buckets[4].list) : null,
    });
  };

  const clear = () => setSel({ ...EMPTY_SEL });

  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState('');
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

  const tempOutfit = {
    id: 'builder_preview',
    title: name || 'New outfit',
    subtitle: 'in progress',
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
        <Text style={styles.headerTitle}>Build</Text>
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
            <Text style={styles.emptyCanvasLabel}>EMPTY CANVAS</Text>
            <Text style={styles.emptyCanvasHint}>Pick items below to compose an outfit</Text>
          </View>
        ) : (
          <OutfitCollage outfit={tempOutfit} showTitle={false} containerHeight={220} />
        )}
        {selectedIds.length > 0 && (
          <>
            <Text style={styles.canvasPieceCount}>{selectedIds.length} PIECE{selectedIds.length === 1 ? '' : 'S'}</Text>
            <Pressable onPress={clear} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>CLEAR ALL</Text>
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
              label={b.key}
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
              ? 'SUGGEST OUTFITS FOR ME'
              : `SUGGEST OUTFITS WITH ${selectedIds.length} ANCHOR${selectedIds.length === 1 ? '' : 'S'}`}
          </Text>
        </Pressable>
      </View>

      {/* Save */}
      <View style={[styles.saveRow, { paddingBottom: insets.bottom + 8 }]}>
        <PrimaryButton onPress={() => canSave && setNameOpen(true)} disabled={!canSave}>
          {canSave ? 'SAVE OUTFIT' : 'PICK AT LEAST 2 PIECES'}
        </PrimaryButton>
      </View>

      {/* Name sheet */}
      <BottomSheet open={nameOpen} onClose={() => setNameOpen(false)} maxHeight="58%">
        <View style={styles.nameSheetContent}>
          <Text style={styles.nameTitle}>Name your outfit.</Text>
          <Text style={styles.nameSub}>A short title you'll recognize in your collections.</Text>
          <View style={{ height: 32 }} />
          <Field label="OUTFIT NAME" value={name} onChange={setName} placeholder="Monday rotation" />
          <View style={{ height: 16 }} />
          <Text style={styles.nameHint}>
            {selectedIds.length} piece{selectedIds.length === 1 ? '' : 's'} ·{' '}
            {Object.entries(sel).filter(([, v]) => v).map(([k]) => k.toLowerCase()).join(' · ')}
          </Text>
          <View style={{ height: 32 }} />
          <PrimaryButton onPress={() => { setNameOpen(false); setName(''); router.back(); }}>
            SAVE TO COLLECTION
          </PrimaryButton>
          <View style={{ height: 12 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={() => setNameOpen(false)} color={T.color.tertiary}>Keep editing</TextLink>
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
