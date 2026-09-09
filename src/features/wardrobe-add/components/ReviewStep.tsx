// ReviewStep.tsx — Step 3: editable item cards grouped by source photo.
// Items are grouped by srcId (PhotoEntry.id) and shown with a small photo header per group.

import React from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet,
} from 'react-native';
import { T, type } from '../../../design/tokens';
import { Bounded } from '../../../components/ui/Bounded';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { IconSparkle, IconDashedSquare } from '../../../components/icons';
import type { ExtractedItem, PhotoEntry, ExtractMethod } from '../types';
import { ItemCard } from './ItemCard';
import { useTranslation } from '../../../i18n';

interface Props {
  items: ExtractedItem[];
  photos: PhotoEntry[];
  onEditItem: (id: string, patch: Partial<ExtractedItem>) => void;
  onRemoveItem: (id: string) => void;
  onConfirm: () => void;
  saving: boolean;
  error: string | null;
}

function MethodBadge({ method }: { method: ExtractMethod }) {
  const { t } = useTranslation();
  const isAI = method === 'ai';
  return (
    <View style={[styles.badge, isAI ? styles.badgeAI : styles.badgeItem]}>
      {isAI
        ? <IconSparkle size={10} strokeWidth={1.6} color={T.color.canvas} />
        : <IconDashedSquare size={10} strokeWidth={1.6} color={T.color.primary} />
      }
      <Text style={[styles.badgeText, isAI ? styles.badgeTextAI : styles.badgeTextItem]}>
        {isAI ? t('methodBadge_byAi') : t('methodBadge_byItem')}
      </Text>
    </View>
  );
}

export function ReviewStep({ items, photos, onEditItem, onRemoveItem, onConfirm, saving, error }: Props) {
  const { t } = useTranslation();
  // Build groups: photos with at least one item
  const groups = photos
    .map((photo, gi) => ({
      photo,
      photoIndex: gi,
      items: items.filter((it) => it.srcId === photo.id),
    }))
    .filter((g) => g.items.length > 0);

  let runningIndex = 0;
  const untypedCount = items.filter((it) => !it.type).length;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Bounded>
        <Text style={styles.h1}>{t('reviewStep_reviewCount', { count: items.length, suffix: items.length === 1 ? '' : 's' })}</Text>
        <Text style={styles.caption}>
          {t('reviewStep_fromPhotos', { count: groups.length, suffix: groups.length === 1 ? '' : 's' })}
        </Text>
        <View style={{ height: 20 }} />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('reviewStep_nothingToSave')}</Text>
            <Text style={styles.emptyCaption}>{t('reviewStep_removedAll')}</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.photo.id} style={styles.group}>
              {/* source photo header */}
              <View style={styles.groupHeader}>
                <View style={styles.groupThumb}>
                  <Image
                    source={{ uri: g.photo.uri }}
                    style={styles.groupThumbImg}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.groupHeaderText}>
                  <Text style={styles.groupPhotoLabel}>
                    {t('reviewStep_photoLabel', { index: String(g.photoIndex + 1).padStart(2, '0') })}
                  </Text>
                  <Text style={styles.groupItemCount}>
                    {t('reviewStep_piecesFound', { count: g.items.length, suffix: g.items.length === 1 ? '' : 's' })}
                  </Text>
                </View>
                <MethodBadge method={g.photo.method} />
              </View>

              {/* item cards in this group */}
              {g.items.map((item) => {
                const idx = runningIndex++;
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    index={idx}
                    onEdit={(patch) => onEditItem(item.id, patch)}
                    onRemove={() => onRemoveItem(item.id)}
                  />
                );
              })}
            </View>
          ))
        )}
        <View style={{ height: 16 }} />
        </Bounded>
      </ScrollView>

      <View style={styles.cta}>
        <Bounded>
        {untypedCount > 0 && items.length > 0 && (
          <Text style={styles.ctaHint}>
            {t('reviewStep_chooseCategoryHint', { count: untypedCount, suffix: untypedCount === 1 ? '' : 's' })}
          </Text>
        )}
        <PrimaryButton
          onPress={onConfirm}
          disabled={items.length === 0 || saving || untypedCount > 0}
        >
          {saving
            ? t('reviewStep_saving')
            : items.length === 0
              ? t('reviewStep_nothingToSaveButton')
              : untypedCount > 0
                ? t('reviewStep_chooseCategoryButton')
                : t('reviewStep_confirmAll', { count: items.length })}
        </PrimaryButton>
        </Bounded>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },

  h1: {
    ...type.h1,
    fontSize: 28,
    color: T.color.primary,
  },
  caption: {
    ...type.caption,
    marginTop: 10,
  },

  errorBanner: {
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.error,
    padding: 14,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: T.font.sans,
    fontSize: 13,
    color: T.color.error,
    lineHeight: 18,
  },

  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyTitle: {
    ...type.h3,
    color: T.color.primary,
  },
  emptyCaption: {
    fontFamily: T.font.sans,
    fontSize: 12,
    color: T.color.tertiary,
    marginTop: 8,
    textAlign: 'center',
  },

  group: {
    marginBottom: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingBottom: 14,
  },
  groupThumb: {
    width: 40,
    height: 50,
    flexShrink: 0,
    overflow: 'hidden',
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
  },
  groupThumbImg: {
    width: '100%',
    height: '100%',
  },
  groupHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  groupPhotoLabel: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
  },
  groupItemCount: {
    fontFamily: T.font.sans,
    fontSize: 12,
    color: T.color.tertiary,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  badgeAI: {
    backgroundColor: T.color.accent,
  },
  badgeItem: {
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    backgroundColor: 'transparent',
  },
  badgeText: {
    ...type.ui,
    fontSize: 8,
  },
  badgeTextAI: {
    color: T.color.canvas,
  },
  badgeTextItem: {
    color: T.color.primary,
  },

  cta: {
    flexShrink: 0,
    paddingHorizontal: 24,
    paddingVertical: 14,
    paddingBottom: 28,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    backgroundColor: T.color.canvas,
  },
  ctaHint: {
    fontFamily: T.font.sans,
    fontSize: 12,
    color: T.color.tertiary,
    marginBottom: 10,
    textAlign: 'center',
  },
});
