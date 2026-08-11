import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Outfit } from '../../data';
import { T } from '../../design/tokens';
import { useAppStore } from '../../stores/appStore';
import {
  useItemPhoto, resolveItemPhotoSource, photoSourceUri, contentBoundsFromUri, isAssetRef,
  type ContentMeasure,
} from '../../features/wardrobe-photos';
import { type Entry, type PositionedEntry, toEntry, buildLayout } from './collageLayout';

// ─── Per-item image (resolves png / local file / cloud via useItemPhoto) ──────
// `measure`, when present, is the on-device measured content-bounds crop for
// this item's photo (real wardrobe photos carry background margins a
// bundled catalog PNG never has) — see Collage.tsx's `useEntryAspects` and
// contentBounds.ts. Present → render only that rect, filling the slot
// (no letterboxing, since buildLayout already sized the slot to the
// measured aspect). Absent (bundled art, or measurement not ready/failed)
// → unchanged `resizeMode="contain"` fallback.
function CollageSlot({ entry, measure }: { entry: PositionedEntry; measure: ContentMeasure | null }) {
  const { source, status } = useItemPhoto(entry.photo);
  const outerStyle = {
    position: 'absolute' as const,
    left:   `${entry.slot.left}%` as `${number}%`,
    top:    `${entry.slot.top}%`  as `${number}%`,
    width:  `${entry.slot.w}%`    as `${number}%`,
    height: `${entry.slot.h}%`    as `${number}%`,
    zIndex: entry.slot.z,
    ...(measure ? { overflow: 'hidden' as const } : null),
  };
  return (
    <View style={outerStyle}>
      {status === 'ready' && source ? (
        measure ? (
          <Image
            source={source}
            resizeMode="stretch"
            style={{
              position: 'absolute',
              left:   `${-(measure.rect.x / measure.rect.w) * 100}%` as `${number}%`,
              top:    `${-(measure.rect.y / measure.rect.h) * 100}%` as `${number}%`,
              width:  `${(1 / measure.rect.w) * 100}%` as `${number}%`,
              height: `${(1 / measure.rect.h) * 100}%` as `${number}%`,
            }}
          />
        ) : (
          <Image source={source} style={styles.itemImage} resizeMode="contain" />
        )
      ) : null}
    </View>
  );
}

// ─── Measured content-bounds aspect per entry ─────────────────────────────────
// Resolves each entry's photo source and runs the on-device content-bounds
// crop measurement (contentBoundsUri.ts — session-cached there, so remounts
// don't re-measure). Bundled catalog art (png / `asset:` ref) is already
// tight-cropped and is never measured. Populates incrementally as
// measurements land; a brief reflow while they do is acceptable.
function useEntryAspects(entries: Entry[]): Map<string, ContentMeasure> {
  const [measures, setMeasures] = useState<Map<string, ContentMeasure>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const toMeasure = entries.filter(e => e.photo.png == null && !isAssetRef(e.photo.photoPath));

    toMeasure.forEach(entry => {
      resolveItemPhotoSource(entry.photo).then(resolved => {
        if (cancelled || resolved.status !== 'ready') return;
        const uri = photoSourceUri(resolved.source);
        if (!uri) return;
        contentBoundsFromUri(uri).then(measure => {
          if (cancelled || !measure) return;
          setMeasures(prev => {
            if (prev.has(entry.id)) return prev;
            const next = new Map(prev);
            next.set(entry.id, measure);
            return next;
          });
        });
      });
    });

    return () => { cancelled = true; };
    // Re-measure only when the entry set itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return measures;
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
  const [areaSize, setAreaSize] = useState<{ w: number; h: number } | null>(null);
  const areaAspect = areaSize && areaSize.h > 0 ? areaSize.w / areaSize.h : undefined;
  const rawEntries = useMemo(() => {
    return outfit.itemIds
      .map(id => toEntry(id, wardrobeById))
      .filter((e): e is Entry => e != null);
  }, [outfit.itemIds, wardrobeById]);
  const measures = useEntryAspects(rawEntries);
  const positioned = useMemo(() => {
    const withAspect = rawEntries.map(e => ({ ...e, aspect: measures.get(e.id)?.aspect }));
    return buildLayout(withAspect, areaAspect);
  }, [rawEntries, measures, areaAspect]);

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
      <View
        style={[styles.itemsArea, { top: itemsTop }]}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setAreaSize({ w: width, h: height });
        }}
      >
        {positioned.map(entry => (
          <CollageSlot key={entry.id} entry={entry} measure={measures.get(entry.id) ?? null} />
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
