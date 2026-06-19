// ItemCard.tsx — One extracted garment card in the Review step.
// Shows isolated image, editable fields, type-aware measurements, tags.
// All edits flow through editItem / removeItem passed from the parent.

import React from 'react';
import {
  View, Text, TextInput, Image, Pressable, StyleSheet,
} from 'react-native';
import { T, type } from '../../../design/tokens';
import {
  TYPE_OPTIONS, COLOR_OPTIONS, MATERIAL_OPTIONS, FIT_OPTIONS,
  PATTERN_OPTIONS, WARMTH_OPTIONS, swatchFor, titleCase, warmthLabel,
} from '../vocab';
import { measureGroupForType, MEASURE_FIELDS } from '../measureSchema';
import { MKey } from '../../../types/fitEngine';
import type { ExtractedItem } from '../types';
import { FieldRow } from './FieldRow';
import { MeasureField } from './MeasureField';
import { TagEditor } from './TagEditor';

interface Props {
  item: ExtractedItem;
  index: number;
  onEdit: (patch: Partial<ExtractedItem>) => void;
  onRemove: () => void;
}

export function ItemCard({ item, index, onEdit, onRemove }: Props) {
  const group = measureGroupForType(item.type);
  const measureFields = MEASURE_FIELDS[group];

  const setMeasure = (key: MKey, val: number | undefined) => {
    const next: Partial<Record<MKey, number>> = { ...item.measurements };
    if (val === undefined) {
      delete next[key];
    } else {
      next[key] = val;
    }
    onEdit({ measurements: next });
  };

  const groupLabel: Record<typeof group, string> = {
    top: 'TOP',
    bottom: 'BOTTOM',
    shoe: 'FOOTWEAR',
    other: '',
  };

  return (
    <View style={styles.card}>
      {/* top: photo + name + fields */}
      <View style={styles.topRow}>
        {/* thumbnail */}
        <View style={styles.thumbContainer}>
          {item.localImageUri ? (
            <Image source={{ uri: item.localImageUri }} style={styles.thumbImg} resizeMode="contain" />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.thumbPlaceholderText}>{titleCase(item.type)}</Text>
            </View>
          )}
          <View style={styles.indexBadge}>
            <Text style={styles.indexBadgeText}>{String(index + 1).padStart(2, '0')}</Text>
          </View>
        </View>

        {/* fields */}
        <View style={styles.fields}>
          <View style={styles.nameRow}>
            <TextInput
              value={item.name}
              onChangeText={(v) => onEdit({ name: v })}
              style={styles.nameInput}
              placeholderTextColor={T.color.tertiary}
              placeholder="Item name"
            />
            <Pressable onPress={onRemove} hitSlop={8}>
              <Text style={styles.removeText}>REMOVE</Text>
            </Pressable>
          </View>

          <FieldRow
            mode="picker"
            label="CATEGORY"
            value={item.type}
            options={TYPE_OPTIONS}
            onChange={(v) => onEdit({ type: v })}
          />
          <FieldRow
            mode="picker"
            label="COLOUR"
            value={item.color}
            options={COLOR_OPTIONS}
            swatch={swatchFor}
            onChange={(v) => onEdit({ color: v })}
          />
          <FieldRow
            mode="picker"
            label="FABRIC"
            value={item.material ?? ''}
            options={MATERIAL_OPTIONS}
            onChange={(v) => onEdit({ material: v || null })}
          />
          {item.fit !== null && (
            <FieldRow
              mode="picker"
              label="FIT"
              value={item.fit ? titleCase(item.fit) : ''}
              options={FIT_OPTIONS.map(titleCase)}
              onChange={(v) => onEdit({ fit: v.toLowerCase() || null })}
            />
          )}
          {item.pattern !== null && (
            <FieldRow
              mode="picker"
              label="PATTERN"
              value={item.pattern ? titleCase(item.pattern) : ''}
              options={PATTERN_OPTIONS.map(titleCase)}
              onChange={(v) => onEdit({ pattern: v.toLowerCase() || null })}
            />
          )}
          {item.warmthSeason !== null && (
            <FieldRow
              mode="picker"
              label="SEASON"
              value={item.warmthSeason ? warmthLabel(item.warmthSeason) : ''}
              options={WARMTH_OPTIONS.map(warmthLabel)}
              onChange={(v) => {
                const raw = WARMTH_OPTIONS.find((w) => warmthLabel(w) === v) ?? null;
                onEdit({ warmthSeason: raw });
              }}
            />
          )}
          <FieldRow
            mode="text"
            label="BRAND"
            value={item.brand}
            placeholder="Add brand"
            onChange={(v) => onEdit({ brand: v })}
          />
          <FieldRow
            mode="text"
            label="LINK"
            value={item.link}
            placeholder="Paste product link"
            onChange={(v) => onEdit({ link: v })}
          />
        </View>
      </View>

      {/* measurements (type-aware) */}
      {measureFields.length > 0 && (
        <View style={styles.measureSection}>
          <View style={styles.measureHeader}>
            <Text style={styles.sectionLabel}>MEASUREMENTS</Text>
            <Text style={styles.sectionLabel}>{groupLabel[group]}</Text>
          </View>
          <View style={styles.measureGrid}>
            {measureFields.map(({ key, label }) => (
              <View key={key} style={styles.measureCell}>
                <MeasureField
                  label={label}
                  value={item.measurements[key]}
                  onCommit={(v) => setMeasure(key, v)}
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* tags */}
      <View style={styles.tagsSection}>
        <Text style={styles.sectionLabel}>TAGS</Text>
        <View style={{ height: 10 }} />
        <TagEditor tags={item.tags} onChange={(t) => onEdit({ tags: t })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 12,
    backgroundColor: T.color.canvas,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
  },
  thumbContainer: {
    width: 92,
    height: 116,
    flexShrink: 0,
    backgroundColor: T.color.elevated,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  thumbPlaceholderText: {
    ...type.micro,
    fontSize: 9,
    color: T.color.tertiary,
    textAlign: 'center',
  },
  indexBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(26,24,21,0.62)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  indexBadgeText: {
    ...type.ui,
    fontSize: 8,
    color: T.color.canvas,
  },
  fields: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  nameInput: {
    flex: 1,
    fontFamily: T.font.serif,
    fontSize: 18,
    fontWeight: '400',
    color: T.color.primary,
    padding: 0,
  },
  removeText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.error,
    flexShrink: 0,
    paddingTop: 2,
  },
  measureSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  measureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  measureCell: {
    width: '47%',
  },
  tagsSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
});
