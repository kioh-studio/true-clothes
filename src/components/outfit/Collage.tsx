import React, { useMemo } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Outfit } from '../../data';
import { T } from '../../design/tokens';
import { useAppStore } from '../../stores/appStore';
import { useItemPhoto } from '../../features/wardrobe-photos';
import { type Entry, type PositionedEntry, toEntry, buildLayout } from './collageLayout';

// ─── Per-item image (resolves png / local file / cloud via useItemPhoto) ──────
function CollageSlot({ entry }: { entry: PositionedEntry }) {
  const { source, status } = useItemPhoto(entry.photo);
  return (
    <View
      style={{
        position: 'absolute',
        left:   `${entry.slot.left}%` as `${number}%`,
        top:    `${entry.slot.top}%`  as `${number}%`,
        width:  `${entry.slot.w}%`    as `${number}%`,
        height: `${entry.slot.h}%`    as `${number}%`,
        zIndex: entry.slot.z,
      }}
    >
      {status === 'ready' && source ? (
        <Image source={source} style={styles.itemImage} resizeMode="contain" />
      ) : null}
    </View>
  );
}

/** Small standalone thumbnail (used by the feed meta strip). */
export function OutfitItemThumb({ id, style, imageStyle, fallbackStyle }: {
  id: string;
  style?: any;
  imageStyle?: any;
  fallbackStyle?: any;
}) {
  const wardrobeItems = useAppStore(s => s.wardrobeItems);
  const entry = useMemo(
    () => toEntry(id, new Map(wardrobeItems.map(w => [w.id, w]))),
    [id, wardrobeItems],
  );
  // Always call the hook (stable order); fall back to an empty input if unknown.
  const { source, status } = useItemPhoto(entry?.photo ?? { id, photoStorage: 'none', photoPath: null });
  return (
    <View style={style}>
      {status === 'ready' && source ? (
        <Image source={source} style={imageStyle} resizeMode="contain" />
      ) : (
        <Text style={fallbackStyle}>{entry?.type ?? ''}</Text>
      )}
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
interface CollageProps {
  outfit: Outfit;
  showTitle?: boolean;
  bg?: string;
  compact?: boolean;
  titleTop?: number;
  containerHeight?: number;
}

export function OutfitCollage({
  outfit,
  showTitle = true,
  bg = T.color.canvas,
  compact = false,
  titleTop,
  containerHeight = 400,
}: CollageProps) {
  const wardrobeItems = useAppStore(s => s.wardrobeItems);
  const wardrobeById = useMemo(() => new Map(wardrobeItems.map(w => [w.id, w])), [wardrobeItems]);
  const positioned = useMemo(() => {
    const entries = outfit.itemIds
      .map(id => toEntry(id, wardrobeById))
      .filter((e): e is Entry => e != null);
    return buildLayout(entries);
  }, [outfit.itemIds, wardrobeById]);

  const hasTip = showTitle && !!outfit.stylingTip;
  const titleY = titleTop != null ? titleTop : (compact ? 16 : 24);
  const titleBlockH = (compact ? 52 : 72) + (hasTip ? 16 : 0);
  const itemsTop = showTitle ? titleY + titleBlockH : 0;

  return (
    <View style={[styles.container, { backgroundColor: bg, height: containerHeight }]}>
      {showTitle && (
        <View style={[styles.titleBlock, { top: titleY }]} pointerEvents="none">
          <Text style={[styles.title, { fontSize: compact ? 20 : 24 }]}>
            {outfit.title.toUpperCase()}
          </Text>
          <Text style={[styles.subtitle, { fontSize: compact ? 12 : 14 }]}>
            {(outfit.subtitle || outfit.context).toLowerCase()}
          </Text>
          {hasTip && (
            <Text style={styles.tip} numberOfLines={1}>
              {outfit.stylingTip!.toLowerCase()}
            </Text>
          )}
        </View>
      )}

      {/* Items area: absolute from below title to near bottom */}
      <View style={[styles.itemsArea, { top: itemsTop }]}>
        {positioned.map(entry => (
          <CollageSlot key={entry.id} entry={entry} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  titleBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  title: {
    fontFamily: T.font.serif,
    fontWeight: '400',
    letterSpacing: 1.5,
    color: T.color.primary,
    textAlign: 'center',
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: T.font.serif,
    fontWeight: '400',
    fontStyle: 'italic',
    color: T.color.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  tip: {
    fontFamily: T.font.sans,
    fontSize: 11,
    letterSpacing: 0.6,
    color: T.color.tertiary,
    marginTop: 6,
    textAlign: 'center',
  },
  itemsArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
});
