import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { resolveItemIds } from '../../src/data';
import { BottomSheet, PrimaryButton, TextLink } from '../../src/components/ui';
import { IconChevronLeft, IconPlus } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { useCollectionSheet } from '../../src/features/collections/useCollectionSheet';
import { useGridCardWidth } from '../../src/design/layout';
import { useTranslation } from '../../src/i18n';

export default function CollectionsScreen() {
  const CARD_W = useGridCardWidth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { collections, wardrobeItems, createCollection, collectionsError } = useAppStore();
  const sheet = useCollectionSheet();
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!sheet.name.trim()) return;
    setSaving(true);
    await createCollection(sheet.name.trim(), sheet.description.trim());
    setSaving(false);
    sheet.close();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.title}>{t('tabs_menu_collections')}</Text>
        <Pressable onPress={sheet.openCreate} style={styles.iconBtn}>
          <IconPlus size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        {collections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('collections_emptyTitle')}</Text>
            <Text style={styles.emptyCaption}>{t('collections_emptyCaption')}</Text>
            <View style={{ height: 32 }} />
            <PrimaryButton onPress={sheet.openCreate} fullWidth={false} style={{ paddingHorizontal: 48 }}>
              {t('collections_createFirstButton')}
            </PrimaryButton>
          </View>
        ) : (
          <View style={styles.grid}>
            {collections.map(c => {
              const its = resolveItemIds(c.itemIds, wardrobeItems);
              return (
                <Pressable key={c.id} onPress={() => router.push(`/collections/${c.id}`)} style={{ width: CARD_W }}>
                  <View style={[styles.collageGrid, { height: CARD_W * (4 / 3) }]}>
                    {[0, 1, 2, 3].map(i => (
                      <View key={i} style={styles.collageCell}>
                        {its[i] && its[i].imageSource != null && (
                          <Image
                            source={its[i].imageSource as any}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        )}
                      </View>
                    ))}
                  </View>
                  <View style={{ paddingTop: 12 }}>
                    <Text style={styles.collName}>{c.name}</Text>
                    <Text style={styles.collMeta}>
                      {t('collections_itemCountLabel', { count: c.itemIds.length, suffix: c.itemIds.length === 1 ? '' : 's' })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Collection Sheet */}
      <BottomSheet open={sheet.visible && sheet.mode === 'create'} onClose={sheet.close} maxHeight="60%">
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{t('collections_newSheetTitle')}</Text>
          <View style={{ height: 24 }} />

          <Text style={styles.inputLabel}>{t('collections_nameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={sheet.name}
            onChangeText={sheet.setName}
            placeholder={t('collections_namePlaceholderExample')}
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
          <PrimaryButton onPress={handleCreate} disabled={!sheet.name.trim() || saving}>
            {saving ? t('collections_creatingText') : t('collections_createButton')}
          </PrimaryButton>
          <View style={{ height: 12 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={sheet.close} color={T.color.tertiary}>{t('common_cancel')}</TextLink>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary },
  content: { padding: 24 },
  emptyState: { paddingVertical: 64, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { ...type.h2, color: T.color.primary },
  emptyCaption: { ...type.caption, marginTop: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  collageGrid: {
    borderWidth: 0.5, borderColor: T.color.hairline,
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: T.color.hairline, gap: 1,
    overflow: 'hidden',
  },
  collageCell: { width: '49.5%', height: '49.5%', backgroundColor: T.color.elevated, overflow: 'hidden' },
  collName: { fontFamily: T.font.serif, fontSize: 17, fontWeight: '400', color: T.color.primary },
  collMeta: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4 },
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
});
