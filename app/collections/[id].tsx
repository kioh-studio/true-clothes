import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Alert, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { resolveItemIds, CollectionDisplayItem } from '../../src/data';
import { BottomSheet, PrimaryButton, TextLink } from '../../src/components/ui';
import { IconChevronLeft, IconEdit } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { useCollectionSheet } from '../../src/features/collections/useCollectionSheet';
import { useGridCardWidth } from '../../src/design/layout';
import { useItemPhoto } from '../../src/features/wardrobe-photos';
import type { WardrobeItem } from '../../src/types/fitEngine';
import { useTranslation } from '../../src/i18n';

// resolveItemIds intentionally can't resolve a real wardrobe item's photo —
// rowToItem leaves WardrobeItem.photoUrl null by design (lazy resolve via
// useItemPhoto, same as the wardrobe grid/detail screens). For demo/catalog
// items it already has a ready-to-use static imageSource, so only wardrobe
// items go through the hook here.
function CollectionGridThumb({ demoImage, wardrobeItem }: {
  demoImage: number | { uri: string } | null;
  wardrobeItem: WardrobeItem | null;
}) {
  const photo = useItemPhoto(wardrobeItem ?? { id: 'missing', photoStorage: 'none', photoPath: null });
  const resolved = wardrobeItem ? (photo.status === 'ready' ? photo.source : null) : demoImage;
  if (!resolved) return null;
  return <Image source={resolved as any} style={StyleSheet.absoluteFillObject} resizeMode="cover" />;
}

// Add-items picker row — same lazy photo resolution as WardrobeItemCard
// (app/(tabs)/wardrobe.tsx), applied consistently here instead of reading
// item.photoUrl directly (which is always null for real wardrobe items).
function PickerCard({ item, selected, cardSize, onPress }: {
  item: WardrobeItem;
  selected: boolean;
  cardSize: number;
  onPress: () => void;
}) {
  const { source, status } = useItemPhoto(item);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pickerCard,
        { width: cardSize, height: cardSize * (4 / 3), borderColor: selected ? T.color.primary : T.color.hairline, borderWidth: selected ? 1.5 : 0.5 },
      ]}
    >
      {status === 'ready' && source ? (
        <Image source={source} style={{ width: '100%', flex: 1 }} resizeMode="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.pickerCategoryLabel}>{item.category.toUpperCase()}</Text>
        </View>
      )}
      <View style={{ padding: 8 }}>
        <Text style={styles.pickerItemLabel} numberOfLines={1}>
          {item.notes ?? item.category.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}

export default function CollectionDetailScreen() {
  const CARD_W = useGridCardWidth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { collections, wardrobeItems, updateCollection, deleteCollection, addItemToCollection, removeItemFromCollection, collectionsError } = useAppStore();
  const sheet = useCollectionSheet();
  const [saving, setSaving] = useState(false);

  // Add items picker state
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // In-flight guard — handleAddItems awaits each selected item sequentially;
  // without this a double-tap on "ADD N ITEMS" re-runs the whole batch.
  const [addingItems, setAddingItems] = useState(false);

  const collection = collections.find(c => c.id === id);

  if (!collection) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
          </Pressable>
          <Text style={styles.navTitle}>{t('collectionDetail_headerFallbackTitle')}</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>{t('collectionDetail_notFoundText')}</Text>
        </View>
      </View>
    );
  }

  const its = resolveItemIds(collection.itemIds, wardrobeItems);
  const wardrobeById = new Map(wardrobeItems.map(w => [w.id, w]));

  // Items available to add (wardrobeItems not already in this collection)
  const availableToAdd = wardrobeItems.filter(w => !collection.itemIds.includes(w.id));

  const handleSaveEdit = async () => {
    if (!sheet.name.trim() || !sheet.editingId) return;
    setSaving(true);
    const ok = await updateCollection(sheet.editingId, { name: sheet.name.trim(), description: sheet.description.trim() });
    setSaving(false);
    // Only close on success — closing unconditionally hid the collectionsError
    // banner above (it renders inside this sheet) the instant it appeared.
    if (ok) sheet.close();
  };

  const handleDelete = () => {
    Alert.alert(
      t('collectionDetail_deleteAlertTitle'),
      t('collectionDetail_deleteAlertMessage'),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('common_delete'), style: 'destructive',
          onPress: async () => {
            await deleteCollection(collection.id);
            router.back();
          },
        },
      ],
    );
  };

  const togglePickerItem = (itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const handleAddItems = async () => {
    setAddingItems(true);
    try {
      let ok = true;
      for (const itemId of selectedIds) {
        if (!(await addItemToCollection(collection.id, itemId))) { ok = false; break; }
      }
      // Only clear the selection and close on full success — on failure, keep
      // the sheet open so the collectionsError banner below is visible instead
      // of closing silently mid-batch.
      if (ok) {
        setSelectedIds(new Set());
        setAddPickerOpen(false);
      }
    } finally {
      setAddingItems(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.navTitle}>{collection.name}</Text>
        <Pressable onPress={() => sheet.openEdit(collection)} style={styles.iconBtn}>
          <IconEdit size={18} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ paddingBottom: 24 }}>
          <Text style={styles.h1}>{collection.name}</Text>
          <Text style={[type.caption, { marginTop: 12 }]}>{collection.description}</Text>
          <Text style={[type.ui, { fontSize: 10, color: T.color.tertiary, marginTop: 16 }]}>
            {t('collectionDetail_itemCountLabel', { count: its.length, suffix: its.length === 1 ? '' : 'S', date: collection.createdDate })}
          </Text>
        </View>

        <View style={styles.grid}>
          {its.map(it => (
            <Pressable
              key={it.id}
              onLongPress={() => {
                Alert.alert(
                  t('collectionDetail_removeItemAlertTitle'),
                  t('collectionDetail_removeItemAlertMessage', { name: it.name }),
                  [
                    { text: t('common_cancel'), style: 'cancel' },
                    {
                      text: t('extraction_removeButton'),
                      style: 'destructive',
                      onPress: () => removeItemFromCollection(collection.id, it.id),
                    },
                  ],
                );
              }}
              delayLongPress={400}
              style={{ width: CARD_W, height: CARD_W * (4 / 3), borderWidth: 0.5, borderColor: T.color.hairline, overflow: 'hidden', position: 'relative', backgroundColor: T.color.elevated }}
            >
              <CollectionGridThumb demoImage={it.imageSource} wardrobeItem={wardrobeById.get(it.id) ?? null} />
              <View style={styles.cardGradient} />
              <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                <Text style={{ ...type.ui, fontSize: 9, color: 'rgba(242,237,228,0.8)' }}>{it.categoryLabel}</Text>
                <Text style={{ fontFamily: T.font.serif, fontSize: 15, color: T.color.canvas, marginTop: 4 }} numberOfLines={1}>{it.name}</Text>
              </View>
              {/* Long-press hint badge — shown on first load to teach the gesture */}
              <View style={styles.longPressHint}>
                <Text style={styles.longPressHintText}>{t('collectionDetail_holdToRemoveHint')}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Add Items button */}
        <View style={{ marginTop: 24 }}>
          <Pressable onPress={() => setAddPickerOpen(true)} style={styles.addItemsBtn}>
            <Text style={styles.addItemsBtnText}>{t('collectionDetail_addItemsButton')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit Collection Sheet */}
      <BottomSheet open={sheet.visible && sheet.mode === 'edit'} onClose={sheet.close} maxHeight="70%">
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{t('collectionDetail_editSheetTitle')}</Text>
          <View style={{ height: 24 }} />

          <Text style={styles.inputLabel}>{t('collections_nameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={sheet.name}
            onChangeText={sheet.setName}
            placeholder={t('collectionDetail_namePlaceholder')}
            placeholderTextColor={T.color.tertiary}
            maxLength={60}
            autoFocus
          />

          <View style={{ height: 16 }} />

          <Text style={styles.inputLabel}>{t('collections_descriptionLabel')}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={sheet.description}
            onChangeText={sheet.setDescription}
            placeholder={t('collections_descriptionPlaceholder')}
            placeholderTextColor={T.color.tertiary}
            maxLength={200}
            multiline
          />

          {collectionsError ? (
            <Text style={styles.errorText}>{collectionsError}</Text>
          ) : null}

          <View style={{ height: 24 }} />
          <PrimaryButton onPress={handleSaveEdit} disabled={!sheet.name.trim() || saving}>
            {saving ? t('addItem_savingText') : t('common_save')}
          </PrimaryButton>
          <View style={{ height: 16 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={handleDelete} color="#B0413E">{t('collectionDetail_deleteCollectionLink')}</TextLink>
          </View>
        </View>
      </BottomSheet>

      {/* Add Items Picker Sheet */}
      <BottomSheet open={addPickerOpen} onClose={() => { setAddPickerOpen(false); setSelectedIds(new Set()); }} maxHeight="85%">
        <View style={{ flex: 1 }}>
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>{t('collectionDetail_addItemsSheetTitle')}</Text>
            <Text style={[type.caption, { marginTop: 8 }]}>{t('collectionDetail_selectFromWardrobeCaption')}</Text>
          </View>

          {availableToAdd.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={[type.caption, { textAlign: 'center' }]}>
                {wardrobeItems.length === 0
                  ? t('collectionDetail_addItemsFirstText')
                  : t('collectionDetail_allItemsAddedText')}
              </Text>
              {wardrobeItems.length === 0 && (
                <>
                  <View style={{ height: 16 }} />
                  <TextLink onPress={() => { setAddPickerOpen(false); router.push('/add-item' as any); }} color={T.color.primary} arrow>{t('collectionDetail_goToWardrobeLink')}</TextLink>
                </>
              )}
            </View>
          ) : (
            <FlatList
              data={availableToAdd}
              keyExtractor={item => item.id}
              numColumns={2}
              contentContainerStyle={{ padding: 24, paddingTop: 0, gap: 12 }}
              columnWrapperStyle={{ gap: 12 }}
              renderItem={({ item }) => (
                <PickerCard
                  item={item}
                  selected={selectedIds.has(item.id)}
                  cardSize={CARD_W}
                  onPress={() => togglePickerItem(item.id)}
                />
              )}
            />
          )}

          {availableToAdd.length > 0 && (
            <View style={[styles.pickerFooter, { paddingBottom: insets.bottom + 12 }]}>
              {collectionsError ? (
                <Text style={[styles.errorText, { marginBottom: 12 }]}>{collectionsError}</Text>
              ) : null}
              <PrimaryButton onPress={handleAddItems} disabled={selectedIds.size === 0 || addingItems}>
                {addingItems
                  ? t('collectionDetail_addingText')
                  : selectedIds.size === 0
                    ? t('collectionDetail_selectItemsButton')
                    : t('collectionDetail_addCountButton', { count: selectedIds.size, suffix: selectedIds.size === 1 ? '' : 'S' })}
              </PrimaryButton>
            </View>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary },
  content: { padding: 24 },
  h1: { fontFamily: T.font.serif, fontSize: 36, fontWeight: '300', color: T.color.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%',
    backgroundColor: 'rgba(26,24,21,0.5)',
  },
  longPressHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(26,24,21,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  longPressHintText: {
    fontFamily: T.font.sansMedium,
    fontSize: 7,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(242,237,228,0.75)',
  },
  addItemsBtn: {
    height: 48, borderWidth: 0.5, borderColor: T.color.hairlineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  addItemsBtnText: { ...type.ui, fontSize: 11, color: T.color.primary },
  sheetContent: { padding: 24 },
  sheetTitle: { fontFamily: T.font.serif, fontSize: 28, fontWeight: '300', color: T.color.primary },
  inputLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 8 },
  input: {
    fontFamily: T.font.serif,
    fontSize: 17,
    color: T.color.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  errorText: { ...type.caption, fontSize: 12, color: '#B0413E', marginTop: 8 },
  pickerCard: { overflow: 'hidden', backgroundColor: T.color.elevated },
  pickerCategoryLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  pickerItemLabel: { fontFamily: T.font.serif, fontSize: 13, color: T.color.primary },
  pickerFooter: { padding: 24, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: T.color.hairline },
});
