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

export default function CollectionDetailScreen() {
  const CARD_W = useGridCardWidth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collections, wardrobeItems, updateCollection, deleteCollection, addItemToCollection, collectionsError } = useAppStore();
  const sheet = useCollectionSheet();
  const [saving, setSaving] = useState(false);

  // Add items picker state
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const collection = collections.find(c => c.id === id) || collections[0];

  if (!collection) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
          </Pressable>
          <Text style={styles.navTitle}>Collection</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>This collection no longer exists.</Text>
        </View>
      </View>
    );
  }

  const its = resolveItemIds(collection.itemIds, wardrobeItems);

  // Items available to add (wardrobeItems not already in this collection)
  const availableToAdd = wardrobeItems.filter(w => !collection.itemIds.includes(w.id));

  const handleSaveEdit = async () => {
    if (!sheet.name.trim() || !sheet.editingId) return;
    setSaving(true);
    await updateCollection(sheet.editingId, { name: sheet.name.trim(), description: sheet.description.trim() });
    setSaving(false);
    sheet.close();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete collection?',
      'This cannot be undone. Items in your wardrobe are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
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
    for (const itemId of selectedIds) {
      await addItemToCollection(collection.id, itemId);
    }
    setSelectedIds(new Set());
    setAddPickerOpen(false);
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
            {its.length} {its.length === 1 ? 'ITEM' : 'ITEMS'} · {collection.createdDate}
          </Text>
        </View>

        <View style={styles.grid}>
          {its.map(it => (
            <View key={it.id} style={{ width: CARD_W, height: CARD_W * (4 / 3), borderWidth: 0.5, borderColor: T.color.hairline, overflow: 'hidden', position: 'relative', backgroundColor: T.color.elevated }}>
              {it.imageSource != null && (
                <Image
                  source={it.imageSource as any}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              )}
              <View style={styles.cardGradient} />
              <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                <Text style={{ ...type.ui, fontSize: 9, color: 'rgba(242,237,228,0.8)' }}>{it.categoryLabel}</Text>
                <Text style={{ fontFamily: T.font.serif, fontSize: 15, color: T.color.canvas, marginTop: 4 }} numberOfLines={1}>{it.name}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Add Items button */}
        <View style={{ marginTop: 24 }}>
          <Pressable onPress={() => setAddPickerOpen(true)} style={styles.addItemsBtn}>
            <Text style={styles.addItemsBtnText}>ADD ITEMS</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit Collection Sheet */}
      <BottomSheet open={sheet.visible && sheet.mode === 'edit'} onClose={sheet.close} maxHeight="70%">
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Edit collection.</Text>
          <View style={{ height: 24 }} />

          <Text style={styles.inputLabel}>NAME</Text>
          <TextInput
            style={styles.input}
            value={sheet.name}
            onChangeText={sheet.setName}
            placeholder="Collection name"
            placeholderTextColor={T.color.tertiary}
            maxLength={60}
            autoFocus
          />

          <View style={{ height: 16 }} />

          <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={sheet.description}
            onChangeText={sheet.setDescription}
            placeholder="What's this collection for?"
            placeholderTextColor={T.color.tertiary}
            maxLength={200}
            multiline
          />

          {collectionsError ? (
            <Text style={styles.errorText}>{collectionsError}</Text>
          ) : null}

          <View style={{ height: 24 }} />
          <PrimaryButton onPress={handleSaveEdit} disabled={!sheet.name.trim() || saving}>
            {saving ? 'SAVING…' : 'SAVE'}
          </PrimaryButton>
          <View style={{ height: 16 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={handleDelete} color="#B0413E">Delete collection</TextLink>
          </View>
        </View>
      </BottomSheet>

      {/* Add Items Picker Sheet */}
      <BottomSheet open={addPickerOpen} onClose={() => { setAddPickerOpen(false); setSelectedIds(new Set()); }} maxHeight="85%">
        <View style={{ flex: 1 }}>
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Add items.</Text>
            <Text style={[type.caption, { marginTop: 8 }]}>Select from your wardrobe.</Text>
          </View>

          {availableToAdd.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={[type.caption, { textAlign: 'center' }]}>
                {wardrobeItems.length === 0
                  ? 'Add items to your wardrobe first.'
                  : 'All wardrobe items are already in this collection.'}
              </Text>
              {wardrobeItems.length === 0 && (
                <>
                  <View style={{ height: 16 }} />
                  <TextLink onPress={() => { setAddPickerOpen(false); router.push('/add-item' as any); }} color={T.color.primary} arrow>Go to wardrobe</TextLink>
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
              renderItem={({ item }) => {
                const selected = selectedIds.has(item.id);
                return (
                  <Pressable
                    onPress={() => togglePickerItem(item.id)}
                    style={[
                      styles.pickerCard,
                      { width: CARD_W, height: CARD_W * (4 / 3), borderColor: selected ? T.color.primary : T.color.hairline, borderWidth: selected ? 1.5 : 0.5 },
                    ]}
                  >
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={{ width: '100%', flex: 1 }} resizeMode="cover" />
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
              }}
            />
          )}

          {availableToAdd.length > 0 && (
            <View style={[styles.pickerFooter, { paddingBottom: insets.bottom + 12 }]}>
              <PrimaryButton onPress={handleAddItems} disabled={selectedIds.size === 0}>
                {selectedIds.size === 0 ? 'SELECT ITEMS' : `ADD ${selectedIds.size} ${selectedIds.size === 1 ? 'ITEM' : 'ITEMS'}`}
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
