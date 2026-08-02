// Outfit Detail screen
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Share, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OUTFITS, itemById } from '../../src/data';
import { OutfitCollage } from '../../src/components/outfit/Collage';
import { PrimaryButton, SecondaryButton, Tag, BottomSheet, Divider, Bounded } from '../../src/components/ui';
import { MEDIA_MAX } from '../../src/design/layout';
import { IconX, IconHeart, IconShare, IconSparkle, IconChevronRight } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAppStore } from '../../src/stores/appStore';
import { useOutfitDescription } from '../../src/features/outfit/useOutfitDescription';
import type { DescribeItem } from '../../src/services/outfitDescriptionService';
import i18n, { useTranslation } from '../../src/i18n';

// View-model for the "ITEMS IN THIS OUTFIT" row — normalizes demo catalogue
// items (ClothingItem) and real cloud wardrobe items (WardrobeItem) to one shape.
interface ItemDisplay {
  id: string;
  type: string;
  name: string;
  addedLabel: string;
  imageSource: number | { uri: string } | null;
}

function formatAdded(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US';
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

export default function OutfitDetailScreen() {
  const { t } = useTranslation();
  const { width: W } = useWindowDimensions();
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedSet, wornSet, toggleSave, toggleWorn, toggleSchedule, collections, addItemToCollection, collectionsError } = useAppStore();
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [addedToCollectionSuccess, setAddedToCollectionSuccess] = useState(false);
  // In-flight guard — disables the collection rows while an add is pending so a
  // double-tap can't fire the same sequential-await loop twice.
  const [addingToCollection, setAddingToCollection] = useState(false);

  // Guard against malformed/oversized nav params — JSON.parse throws on
  // invalid JSON; falling through to the OUTFITS lookup prevents a crash.
  let parsedOutfit: ReturnType<typeof JSON.parse> | null = null;
  if (data) {
    try { parsedOutfit = JSON.parse(data); } catch { /* fall through */ }
  }
  const outfit = parsedOutfit ?? OUTFITS.find(o => o.id === id) ?? null;

  const saved = outfit ? savedSet.has(outfit.id) : false;

  // Resolve the outfit's garments from the REAL cloud wardrobe (same source the
  // collage uses), falling back to mock items — `itemById` alone misses generated
  // outfits whose ids are DB ids. Feeds the lazy description.
  const wardrobeItems = useAppStore(s => s.wardrobeItems);

  // "ITEMS IN THIS OUTFIT" list — same dual-source resolution as describeItems
  // below: demo catalogue OR the real cloud wardrobe. Using itemById alone left
  // outfits built from the cloud wardrobe showing 0 items here.
  const items: ItemDisplay[] = useMemo(() => {
    if (!outfit) return [];
    const byId = new Map(wardrobeItems.map(w => [w.id, w]));
    return (outfit.itemIds as string[]).map((iid): ItemDisplay | null => {
      const w = byId.get(iid);
      if (w) {
        return {
          id: iid,
          type: (w.type || w.category || '').toUpperCase(),
          name: w.name || w.notes || (w.category ? w.category.charAt(0).toUpperCase() + w.category.slice(1) : t('outfitDetail_itemFallbackName')),
          addedLabel: formatAdded(w.createdAt),
          imageSource: w.photoUrl ? { uri: w.photoUrl } : null,
        };
      }
      const m = itemById(iid);
      if (m) {
        return {
          id: iid,
          type: m.type,
          name: m.name,
          addedLabel: m.addedDate,
          imageSource: m.png ?? (m.img ? { uri: m.img } : null),
        };
      }
      return null;
    }).filter((x): x is ItemDisplay => x !== null);
  }, [outfit, wardrobeItems]);

  const describeItems: DescribeItem[] = useMemo(() => {
    if (!outfit) return [];
    const byId = new Map(wardrobeItems.map(w => [w.id, w]));
    return (outfit.itemIds as string[]).map((iid): DescribeItem | null => {
      const w = byId.get(iid);
      if (w) return { name: w.name, type: w.type, color: w.colors?.[0] ?? w.primaryColor, material: w.material, fit: w.fit };
      const m = itemById(iid);
      return m ? { name: m.name, type: m.type, color: m.color, material: m.material, fit: m.fit } : null;
    }).filter((x): x is DescribeItem => x !== null);
  }, [outfit, wardrobeItems]);

  // Lazy AI description for generated outfits. Fallback is the resolved item names
  // (longDescription is empty for cloud-wardrobe outfits).
  const fallbackDesc = outfit
    ? (outfit.longDescription || describeItems.map(i => i.name).filter(Boolean).join(', '))
    : '';
  const { description: outfitDescription, wayToWear, loading: descLoading } = useOutfitDescription(
    outfit?.id ?? '', describeItems, fallbackDesc,
    { occasion: outfit?.context, weather: outfit?.weather },
  );

  // Removed per-open debug console.log loop — would ship to production.

  const worn = outfit ? wornSet.has(outfit.id) : false;

  const heroW = Math.min(W, MEDIA_MAX);
  const HERO_H = heroW * (5 / 4);

  // T029: Share outfit via native share sheet
  const shareOutfit = () => {
    if (!outfit) return;
    const itemNames = items.slice(0, 3).map(i => i.name).join(', ');
    const message = `${outfit.style} look — ${itemNames} | MIEN`;
    Share.share({ message });
  };

  // Not-found guard — render after all hooks are safely called.
  if (!outfit) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <IconX size={20} color={T.color.primary} strokeWidth={1.4} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 }}>
          <Text style={[type.h2, { color: T.color.primary, textAlign: 'center' }]}>{t('outfitDetail_notFoundTitle')}</Text>
          <Text style={[type.caption, { marginTop: 12, textAlign: 'center' }]}>{t('outfitDetail_notFoundBody')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Nav */}
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <IconX size={20} color={T.color.primary} strokeWidth={1.4} />
          </Pressable>
          <View style={styles.navRight}>
            <Pressable onPress={() => toggleSave(outfit.id)} style={styles.iconBtn}>
              <IconHeart filled={saved} size={20} color={T.color.primary} strokeWidth={1.4} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={shareOutfit}>
              <IconShare size={20} color={T.color.primary} strokeWidth={1.4} />
            </Pressable>
          </View>
        </View>

        {/* Hero collage */}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: T.color.hairline, width: '100%', maxWidth: MEDIA_MAX, alignSelf: 'center' }}>
          <OutfitCollage outfit={outfit} compact={false} containerHeight={HERO_H} />
        </View>

        <Bounded>
        {/* AI Try-on button */}
        <View style={{ padding: 16 }}>
          <Pressable
            onPress={() => router.push({ pathname: '/try-on/wear' as any, params: { id: outfit.id, data: JSON.stringify(outfit) } })}
            style={styles.tryOnBtn}
          >
            <IconSparkle size={16} color={T.color.primary} strokeWidth={1.4} />
            <Text style={styles.tryOnText}>{t('outfitDetail_tryOnGenerate')}</Text>
          </Pressable>
          <Text style={[type.caption, { fontSize: 11, color: T.color.tertiary, textAlign: 'center', marginTop: 8 }]}>
            {t('outfitDetail_tryOnHint')}
          </Text>
        </View>

        {/* Metadata */}
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={styles.context}>{outfit.style} · {outfit.context}</Text>
          <View style={{ height: 8 }} />
          <Text style={styles.h1}>{outfit.title}</Text>
          <View style={{ height: 16 }} />
          <Text style={[styles.desc, descLoading && { opacity: 0.5 }]}>{outfitDescription}</Text>
          <View style={{ height: 24 }} />
          <View style={styles.tags}>
            {outfit.tags.map((tag: string) => <Tag key={tag}>{tag}</Tag>)}
          </View>
        </View>

        {/* How to wear — AI styling tips (generated outfits only) */}
        {wayToWear.length > 0 && (
          <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
            <Text style={styles.sectionLabel}>{t('outfit_howToWear')}</Text>
            <View style={{ height: 16 }} />
            {wayToWear.map((tip, i) => (
              <View key={`${i}-${tip}`} style={styles.tipRow}>
                <Text style={styles.tipBullet}>—</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />

        {/* Items */}
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={styles.sectionLabel}>{t('outfitDetail_itemsInOutfit', { count: items.length })}</Text>
          <View style={{ height: 16 }} />
          {items.map((item, i) => (
            <React.Fragment key={item.id}>
              <Pressable onPress={() => router.push(`/item/${item.id}`)} style={styles.itemRow}>
                <View style={styles.itemThumb}>
                  {item.imageSource != null ? (
                    <Image source={item.imageSource as any} style={styles.itemThumbImg} resizeMode="contain" />
                  ) : (
                    <Text style={styles.itemType}>{item.type}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemCat}>{item.type}</Text>
                  <View style={{ height: 4 }} />
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={{ height: 4 }} />
                  <Text style={styles.itemDate}>{t('outfitDetail_ownedAdded', { date: item.addedLabel })}</Text>
                </View>
                <IconChevronRight size={12} color={T.color.tertiary} strokeWidth={1.4} />
              </Pressable>
              {i < items.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </View>

        <View style={{ height: 40 }} />

        {/* Actions */}
        <View style={{ paddingHorizontal: 24 }}>
          <PrimaryButton onPress={() => toggleWorn(outfit.id)}>
            {worn ? t('outfitDetail_wornToday') : t('outfitDetail_wearToday')}
          </PrimaryButton>
          <View style={{ height: 12 }} />
          <SecondaryButton onPress={() => setCollectionPickerOpen(true)}>
            {addedToCollectionSuccess ? t('outfitDetail_addedToCollection') : t('outfitDetail_addToCollection')}
          </SecondaryButton>
          <View style={{ height: 12 }} />
          <SecondaryButton onPress={() => toggleSchedule(outfit.id)}>{t('outfitDetail_scheduleForAnotherDay')}</SecondaryButton>
          {/* "Generate a variation" (item swap) is not yet implemented — hidden
              until the regenerate feature is built to avoid dead UI. */}
        </View>
        </Bounded>

        <View style={{ height: insets.bottom + 48 }} />
      </ScrollView>

      {/* Collection picker sheet */}
      <BottomSheet open={collectionPickerOpen} onClose={() => setCollectionPickerOpen(false)} maxHeight="70%">
        <View style={{ padding: 24 }}>
          <Text style={styles.h3}>{t('outfitDetail_saveToCollectionTitle')}</Text>
          <Text style={[type.caption, { marginTop: 8, marginBottom: 24 }]}>
            {t('outfitDetail_saveToCollectionHint')}
          </Text>
          {collections.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={[type.caption, { textAlign: 'center' }]}>{t('outfitDetail_noCollectionsYet')}</Text>
            </View>
          ) : (
            collections.map(col => (
              <Pressable
                key={col.id}
                disabled={addingToCollection}
                onPress={async () => {
                  setAddingToCollection(true);
                  try {
                    const uuidItems = outfit.itemIds.filter((id: string) => /^[0-9a-f]{8}-/.test(id));
                    let ok = true;
                    for (const itemId of uuidItems) {
                      if (!(await addItemToCollection(col.id, itemId))) { ok = false; break; }
                    }
                    // Only report success — and only close the sheet — when every
                    // item actually landed. On failure, keep the sheet open so the
                    // collectionsError banner below is visible instead of a false
                    // "ADDED ✓".
                    if (ok) {
                      setCollectionPickerOpen(false);
                      setAddedToCollectionSuccess(true);
                    }
                  } finally {
                    setAddingToCollection(false);
                  }
                }}
                style={[styles.itemRow, { borderBottomWidth: 0.5, borderBottomColor: T.color.hairline, opacity: addingToCollection ? 0.5 : 1 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{col.name}</Text>
                  <Text style={[type.caption, { marginTop: 2, fontSize: 11 }]}>{t('collections_itemCountLabel', { count: col.itemIds.length, suffix: col.itemIds.length === 1 ? '' : 's' })}</Text>
                </View>
                <IconChevronRight size={12} color={T.color.tertiary} strokeWidth={1.4} />
              </Pressable>
            ))
          )}
          {collectionsError ? (
            <Text style={{ ...type.caption, fontSize: 12, color: T.color.warning, textAlign: 'center', marginTop: 16 }}>
              {collectionsError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  scroll: { flex: 1 },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navRight: { flexDirection: 'row' },
  context: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  h1: { ...type.h1, color: T.color.primary },
  h2: { ...type.h2, color: T.color.primary },
  h3: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary },
  desc: { ...type.body, color: T.color.secondary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  tipBullet: { ...type.body, color: T.color.tertiary, lineHeight: 24 },
  tipText: { ...type.body, color: T.color.secondary, flex: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  itemThumb: { width: 80, height: 100, backgroundColor: T.color.elevated, borderWidth: 0.5, borderColor: T.color.hairline, alignItems: 'center', justifyContent: 'center', padding: 8 },
  itemThumbImg: { width: '100%', height: '100%' },
  itemType: { ...type.micro, fontSize: 9, color: T.color.tertiary, textAlign: 'center' },
  itemCat: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  itemName: { fontFamily: T.font.serif, fontSize: 17, fontWeight: '400', color: T.color.primary },
  itemDate: { ...type.caption, fontSize: 12, color: T.color.tertiary },
  tryOnBtn: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderWidth: 1, borderColor: T.color.primary,
  },
  tryOnText: { ...type.ui, color: T.color.primary },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: T.color.hairline },
  swapThumb: { width: 64, height: 80, borderWidth: 0.5, borderColor: T.color.hairline, overflow: 'hidden' },
});
