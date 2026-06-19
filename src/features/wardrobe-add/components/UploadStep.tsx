// UploadStep.tsx — Step 1: list of added photos, per-photo note, add/remove, analyse CTA.
// Also shows upgrade notice when AI credits are exhausted.

import React from 'react';
import {
  View, Text, TextInput, Image, Pressable,
  ScrollView, StyleSheet,
} from 'react-native';
import { T, type } from '../../../design/tokens';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { IconPlus, IconSparkle, IconDashedSquare, IconX } from '../../../components/icons';
import type { PhotoEntry, ExtractMethod } from '../types';

interface Props {
  photos: PhotoEntry[];
  upgrade: boolean;
  error: string | null;
  onSetNote: (id: string, note: string) => void;
  onRemovePhoto: (id: string) => void;
  onAddPhoto: () => void;
  onAnalyse: () => void;
}

function MethodBadge({ method }: { method: ExtractMethod }) {
  const isAI = method === 'ai';
  return (
    <View style={[styles.badge, isAI ? styles.badgeAI : styles.badgeItem]}>
      {isAI
        ? <IconSparkle size={10} strokeWidth={1.6} color={T.color.canvas} />
        : <IconDashedSquare size={10} strokeWidth={1.6} color={T.color.primary} />}
      <Text style={[styles.badgeText, isAI ? styles.badgeTextAI : styles.badgeTextItem]}>
        {isAI ? 'BY AI' : 'BY ITEM'}
      </Text>
    </View>
  );
}

function PhotoRow({
  entry, index, onRemove, onSetNote,
}: {
  entry: PhotoEntry;
  index: number;
  onRemove: () => void;
  onSetNote: (note: string) => void;
}) {
  return (
    <View style={styles.photoRow}>
      {/* thumbnail */}
      <View style={styles.thumb}>
        <Image source={{ uri: entry.uri }} style={styles.thumbImg} resizeMode="cover" />
        <View style={styles.thumbBadge}>
          <Text style={styles.thumbBadgeText}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
      </View>

      {/* method badge + note */}
      <View style={styles.photoMeta}>
        <View style={styles.photoMetaTop}>
          <MethodBadge method={entry.method} />
          <Pressable onPress={onRemove} hitSlop={8}>
            <Text style={styles.removeText}>REMOVE</Text>
          </Pressable>
        </View>
        <TextInput
          value={entry.note}
          onChangeText={onSetNote}
          placeholder={entry.method === 'ai' ? 'e.g. the jacket is vintage…' : 'e.g. brand, fit notes…'}
          placeholderTextColor={T.color.tertiary}
          multiline
          style={styles.noteInput}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

export function UploadStep({
  photos, upgrade, error, onSetNote, onRemovePhoto, onAddPhoto, onAnalyse,
}: Props) {
  const n = photos.length;
  const aiCount = photos.filter((p) => p.method === 'ai').length;
  const itemCount = n - aiCount;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>Your photos.</Text>
        <Text style={styles.caption}>
          Add as many as you like — each one extracted by AI or as a single item.
        </Text>
        <View style={{ height: 20 }} />

        {/* upgrade notice */}
        {upgrade && (
          <View style={styles.upgradeBanner}>
            <Text style={styles.upgradeText}>
              You're out of free AI extractions. Upgrade to continue using AI on photos.
            </Text>
          </View>
        )}

        {/* error notice */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {n === 0 ? (
          <View style={styles.emptyState}>
            <IconPlus size={26} strokeWidth={1.3} color={T.color.tertiary} />
            <View style={{ height: 14 }} />
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyCaption}>Tap below to add your first photo.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.photoCount}>
              {n} {n === 1 ? 'PHOTO' : 'PHOTOS'}
              {aiCount > 0 && itemCount > 0 ? ` · ${aiCount} AI · ${itemCount} ITEM` : ''}
            </Text>
            <View style={{ height: 12 }} />
            {photos.map((entry, i) => (
              <PhotoRow
                key={entry.id}
                entry={entry}
                index={i}
                onRemove={() => onRemovePhoto(entry.id)}
                onSetNote={(note) => onSetNote(entry.id, note)}
              />
            ))}
          </>
        )}

        {/* add button */}
        <Pressable onPress={onAddPhoto} style={styles.addBtn}>
          <IconPlus size={16} strokeWidth={1.5} color={T.color.primary} />
          <Text style={styles.addBtnText}>ADD {n === 0 ? 'A' : 'ANOTHER'} PHOTO</Text>
        </Pressable>

        <Text style={styles.hint}>
          Notes help label colours and brands more accurately.
        </Text>
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* sticky CTA */}
      <View style={styles.cta}>
        <PrimaryButton onPress={onAnalyse} disabled={n === 0 || upgrade}>
          <View style={styles.ctaInner}>
            <IconSparkle size={15} strokeWidth={1.5} color={T.color.canvas} />
            <Text style={styles.ctaText}>
              {n === 0 ? 'ADD A PHOTO TO START' : `ANALYSE ${n} ${n === 1 ? 'PHOTO' : 'PHOTOS'}`}
            </Text>
          </View>
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 0 },

  h1: {
    ...type.h1,
    fontSize: 30,
    color: T.color.primary,
  },
  caption: {
    ...type.caption,
    marginTop: 10,
  },

  upgradeBanner: {
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.warning,
    padding: 14,
    marginBottom: 14,
  },
  upgradeText: {
    fontFamily: T.font.sans,
    fontSize: 13,
    color: T.color.warning,
    lineHeight: 18,
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
    padding: 40,
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

  photoCount: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },

  photoRow: {
    flexDirection: 'row',
    gap: 14,
    padding: 12,
    marginBottom: 12,
    backgroundColor: T.color.canvas,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
  },
  thumb: {
    width: 96,
    height: 120,
    flexShrink: 0,
    backgroundColor: T.color.elevated,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(26,24,21,0.62)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  thumbBadgeText: {
    ...type.ui,
    fontSize: 8,
    color: T.color.canvas,
  },
  photoMeta: {
    flex: 1,
    minWidth: 0,
  },
  photoMetaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeAI: {
    backgroundColor: T.color.accent,
    borderWidth: 0,
  },
  badgeItem: {
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
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
  removeText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.error,
  },
  noteInput: {
    flex: 1,
    minHeight: 64,
    padding: 12,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    fontFamily: T.font.sans,
    fontSize: 14,
    lineHeight: 21,
    color: T.color.primary,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 18,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  addBtnText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.primary,
  },

  hint: {
    fontFamily: T.font.sans,
    fontSize: 12,
    color: T.color.tertiary,
    marginTop: 12,
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
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaText: {
    ...type.ui,
    color: T.color.canvas,
  },
});
