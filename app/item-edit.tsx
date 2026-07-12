// Edit an existing wardrobe item. Reuses the add-wizard `ItemCard` editor so the
// edit UI and the controlled vocabulary match the Add flow exactly (Constitution I/V).
// Only real wardrobe items are editable (demo catalogue items aren't persisted).

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton, TextLink } from '../src/components/ui';
import { IconChevronLeft } from '../src/components/icons';
import { useAppStore } from '../src/stores/appStore';
import { useItemPhoto, photoSourceUri } from '../src/features/wardrobe-photos';
import { ItemCard } from '../src/features/wardrobe-add/components';
import type { ExtractedItem } from '../src/features/wardrobe-add/types';
import type { WardrobeItem } from '../src/types/fitEngine';
import type { UpdateItemInput } from '../src/services/wardrobeService';
import { useTranslation } from '../src/i18n';

// WardrobeItem → the editable ExtractedItem shape ItemCard expects.
function toEditable(w: WardrobeItem): ExtractedItem {
  return {
    id: w.id,
    srcId: w.id,
    method: 'ai',
    localImageUri: w.photoLocalUri ?? w.photoUrl ?? null,
    type: (w.type ?? '').toUpperCase(),
    name: w.name ?? '',
    color: w.primaryColor ?? w.colors[0] ?? '',
    material: w.material,
    fit: w.fit,
    pattern: w.pattern,
    warmthSeason: w.warmthSeason?.[0] ?? null,
    canLayer: w.canLayer ?? null,
    measurements: w.measurements ?? {},
    brand: w.brand ?? '',
    link: '',
    tags: [],
    graphics: w.graphics,
    confidence: 1,
    // Measured-hex (2026-07-06): read-only carry — no edit UI, and toPatch
    // deliberately omits it (edit never rewrites the measured hex).
    primaryHex: w.primaryHex ?? null,
    secondaryHex: w.secondaryHex ?? null,
  };
}

// Editable state → the patch sent to updateWardrobeItem. Empty/cleared values map
// to '' / [] so the service clears the column (it coerces those to NULL).
function toPatch(e: ExtractedItem): UpdateItemInput {
  return {
    name: e.name.trim(),
    type: e.type,
    primaryColor: e.color,
    colors: e.color ? [e.color] : [],
    material: e.material ?? '',
    ...(e.fit ? { fit: e.fit } : {}),
    ...(e.pattern ? { pattern: e.pattern } : {}),
    warmthSeason: e.warmthSeason ? [e.warmthSeason] : [],
    canLayer: e.canLayer,
    brand: e.brand,
    measurements: e.measurements,
  };
}

export default function ItemEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { wardrobeItems, updateWardrobeItem, wardrobeError } = useAppStore();

  const original = useMemo(() => wardrobeItems.find((i) => i.id === id) ?? null, [wardrobeItems, id]);
  const [draft, setDraft] = useState<ExtractedItem | null>(() => (original ? toEditable(original) : null));
  const [saving, setSaving] = useState(false);

  // Resolve the real photo (photoLocalUri/photoUrl are unset in the store; the
  // image lives at photoPath and resolves via useItemPhoto — cloud/local/asset).
  const photo = useItemPhoto(original ?? { id: 'missing', photoStorage: 'none', photoPath: null });
  const resolvedUri = photoSourceUri(photo.source);

  if (!original || !draft) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
          </Pressable>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('itemEdit_notFoundTitle')}</Text>
          <Text style={[type.caption, { marginTop: 12, textAlign: 'center' }]}>
            {t('itemEdit_notFoundCaption')}
          </Text>
        </View>
      </View>
    );
  }

  const onEdit = (patch: Partial<ExtractedItem>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const onSave = async () => {
    setSaving(true);
    await updateWardrobeItem(original.id, toPatch(draft));
    setSaving(false);
    // updateWardrobeItem sets wardrobeError on failure; only leave on success.
    if (!useAppStore.getState().wardrobeError) router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.navTitle}>{t('itemEdit_title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {wardrobeError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{wardrobeError}</Text>
          </View>
        ) : null}

        {/* The same editable card used in the Add review step. Remove is handled
            from the detail screen, so the card's remove is a no-op here. The
            thumbnail uses the resolved photo uri (draft only holds the unset one). */}
        <ItemCard
          item={{ ...draft, localImageUri: resolvedUri ?? draft.localImageUri }}
          index={0}
          onEdit={onEdit}
          onRemove={() => {}}
        />

        <View style={{ height: 24 }} />
        <PrimaryButton disabled={saving} onPress={onSave}>
          {saving ? t('addItem_savingText') : t('profileEdit_saveButton')}
        </PrimaryButton>
        <View style={{ height: 16 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink onPress={() => router.back()} color={T.color.tertiary}>{t('common_cancel')}</TextLink>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
  },
  navTitle: { ...type.h3, color: T.color.primary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  errorBanner: {
    backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.error,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  errorText: { ...type.caption, color: T.color.error },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 80 },
  emptyTitle: { ...type.h2, color: T.color.primary },
});
