// Outfit Detail screen
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Share, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OUTFITS, itemById } from '../../src/data';
import { OutfitCollage } from '../../src/components/outfit/Collage';
import { PrimaryButton, SecondaryButton, TextLink, Tag, BottomSheet, Divider, Photo } from '../../src/components/ui';
import { IconX, IconHeart, IconShare, IconSparkle, IconChevronRight } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAppStore } from '../../src/stores/appStore';
import { useOutfitDescription } from '../../src/features/outfit/useOutfitDescription';
import type { DescribeItem } from '../../src/services/outfitDescriptionService';

export default function OutfitDetailScreen() {
  const { width: W } = useWindowDimensions();
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedSet, wornSet, scheduledSet, toggleSave, toggleWorn, toggleSchedule, collections, addItemToCollection } = useAppStore();
  const [variationOpen, setVariationOpen] = useState(false);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [addedToCollectionSuccess, setAddedToCollectionSuccess] = useState(false);

  const outfit = (data ? JSON.parse(data) : null) ?? OUTFITS.find(o => o.id === id) ?? OUTFITS[0];
  const items = outfit.itemIds.map(itemById).filter(Boolean) as NonNullable<ReturnType<typeof itemById>>[];
  const saved = savedSet.has(outfit.id);

  // Resolve the outfit's garments from the REAL cloud wardrobe (same source the
  // collage uses), falling back to mock items — `itemById` alone misses generated
  // outfits whose ids are DB ids. Feeds the lazy description.
  const wardrobeItems = useAppStore(s => s.wardrobeItems);
  const describeItems: DescribeItem[] = useMemo(() => {
    const byId = new Map(wardrobeItems.map(w => [w.id, w]));
    return (outfit.itemIds as string[]).map((iid): DescribeItem | null => {
      const w = byId.get(iid);
      if (w) return { name: w.name, type: w.type, color: w.colors?.[0] ?? w.primaryColor, material: w.material, fit: w.fit };
      const m = itemById(iid);
      return m ? { name: m.name, type: m.type, color: m.color, material: m.material, fit: m.fit } : null;
    }).filter((x): x is DescribeItem => x !== null);
  }, [outfit.itemIds, wardrobeItems]);

  // Lazy AI description for generated outfits. Fallback is the resolved item names
  // (longDescription is empty for cloud-wardrobe outfits).
  const fallbackDesc = outfit.longDescription || describeItems.map(i => i.name).filter(Boolean).join(', ');
  const { description: outfitDescription, loading: descLoading } = useOutfitDescription(
    outfit.id, describeItems, fallbackDesc,
  );

  useEffect(() => {
    console.log('[OutfitDetail] Opened outfit:', { id: outfit.id, title: outfit.title, style: outfit.style, tags: outfit.tags });
    console.log(`[OutfitDetail] Items (${items.length}):`);
    items.forEach((item, i) => {
      const itemTags = [item.color, item.material, item.fit].filter(Boolean).join(', ');
      console.log(`  [${i + 1}] id=${item.id} | type=${item.type} | name=${item.name} | tags=${itemTags}`);
    });
  }, [outfit.id]);
  const worn = wornSet.has(outfit.id);

  const HERO_H = W * (5 / 4);

  // T029: Share outfit via native share sheet
  const shareOutfit = () => {
    const itemNames = items.slice(0, 3).map(i => i.name).join(', ');
    const message = `${outfit.style} look — ${itemNames} | MIEN`;
    Share.share({ message });
  };

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
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: T.color.hairline }}>
          <OutfitCollage outfit={outfit} compact={false} containerHeight={HERO_H} />
        </View>

        {/* AI Try-on button */}
        <View style={{ padding: 16 }}>
          <Pressable
            onPress={() => router.push({ pathname: '/try-on/wear' as any, params: { id: outfit.id, data: JSON.stringify(outfit) } })}
            style={styles.tryOnBtn}
          >
            <IconSparkle size={16} color={T.color.primary} strokeWidth={1.4} />
            <Text style={styles.tryOnText}>GENERATE ON YOU</Text>
          </Pressable>
          <Text style={[type.caption, { fontSize: 11, color: T.color.tertiary, textAlign: 'center', marginTop: 8 }]}>
            Render this outfit on your frame using your measurements.
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
            {outfit.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}
          </View>
        </View>

        <View style={{ height: 32 }} />

        {/* Items */}
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={styles.sectionLabel}>ITEMS IN THIS OUTFIT ({items.length})</Text>
          <View style={{ height: 16 }} />
          {items.map((item, i) => (
            <React.Fragment key={item.id}>
              <Pressable onPress={() => router.push(`/item/${item.id}`)} style={styles.itemRow}>
                <View style={styles.itemThumb}>
                  {item.png ? (
                    <Image source={item.png} style={styles.itemThumbImg} resizeMode="contain" />
                  ) : (
                    <Text style={styles.itemType}>{item.type}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemCat}>{item.type}</Text>
                  <View style={{ height: 4 }} />
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={{ height: 4 }} />
                  <Text style={styles.itemDate}>Owned · Added {item.addedDate}</Text>
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
            {worn ? '✓  WORN TODAY' : 'WEAR TODAY'}
          </PrimaryButton>
          <View style={{ height: 12 }} />
          <SecondaryButton onPress={() => setCollectionPickerOpen(true)}>
            {addedToCollectionSuccess ? 'ADDED TO COLLECTION ✓' : 'ADD TO COLLECTION'}
          </SecondaryButton>
          <View style={{ height: 12 }} />
          <SecondaryButton onPress={() => toggleSchedule(outfit.id)}>SCHEDULE FOR ANOTHER DAY</SecondaryButton>
          <View style={{ height: 24 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={() => setVariationOpen(true)} color={T.color.primary} arrow>Generate a variation</TextLink>
          </View>
        </View>

        <View style={{ height: insets.bottom + 48 }} />
      </ScrollView>

      {/* Variation sheet */}
      <BottomSheet open={variationOpen} onClose={() => setVariationOpen(false)} maxHeight="78%">
        <View style={{ padding: 24 }}>
          <Text style={styles.h3}>Swap an item.</Text>
          <Text style={[type.caption, { marginTop: 8 }]}>Tap any item to see alternatives from your wardrobe.</Text>
          <View style={{ height: 24 }} />
          {items.map(item => (
            <View key={item.id} style={styles.swapRow}>
              <View style={[styles.swapThumb, { alignItems: 'center', justifyContent: 'center', padding: 6 }]}>
                {item.png ? (
                  <Image source={item.png} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                ) : (
                  <Text style={styles.itemCat}>{item.type}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemCat}>{item.type}</Text>
                <Text style={[styles.itemName, { marginTop: 4 }]}>{item.name}</Text>
              </View>
              <TextLink color={T.color.primary}>SWAP</TextLink>
            </View>
          ))}
          <View style={{ height: 24 }} />
          <PrimaryButton onPress={() => setVariationOpen(false)}>APPLY CHANGES</PrimaryButton>
        </View>
      </BottomSheet>

      {/* Collection picker sheet */}
      <BottomSheet open={collectionPickerOpen} onClose={() => setCollectionPickerOpen(false)} maxHeight="70%">
        <View style={{ padding: 24 }}>
          <Text style={styles.h3}>Save to collection.</Text>
          <Text style={[type.caption, { marginTop: 8, marginBottom: 24 }]}>
            Wardrobe items from this outfit will be added.
          </Text>
          {collections.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={[type.caption, { textAlign: 'center' }]}>No collections yet. Create one from Your Wardrobe.</Text>
            </View>
          ) : (
            collections.map(col => (
              <Pressable
                key={col.id}
                onPress={async () => {
                  const uuidItems = outfit.itemIds.filter((id: string) => /^[0-9a-f]{8}-/.test(id));
                  for (const itemId of uuidItems) {
                    await addItemToCollection(col.id, itemId);
                  }
                  setCollectionPickerOpen(false);
                  setAddedToCollectionSuccess(true);
                }}
                style={[styles.itemRow, { borderBottomWidth: 0.5, borderBottomColor: T.color.hairline }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{col.name}</Text>
                  <Text style={[type.caption, { marginTop: 2, fontSize: 11 }]}>{col.itemIds.length} items</Text>
                </View>
                <IconChevronRight size={12} color={T.color.tertiary} strokeWidth={1.4} />
              </Pressable>
            ))
          )}
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
