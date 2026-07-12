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
  isLayerableTopType, CAN_LAYER_OPTIONS, canLayerToLabel, labelToCanLayer,
} from '../vocab';
import { measureGroupForType, MEASURE_FIELDS } from '../measureSchema';
import { MKey } from '../../../types/fitEngine';
import type { ExtractedItem } from '../types';
import { FieldRow } from './FieldRow';
import { MeasureField } from '../../../components/measurements/MeasureField';
import { TagEditor } from './TagEditor';
import { MeasurementAIMap } from '../../../components/measurements/MeasurementAIMap';
import { useTranslation } from '../../../i18n';

interface Props {
  item: ExtractedItem;
  index: number;
  onEdit: (patch: Partial<ExtractedItem>) => void;
  onRemove: () => void;
}

export function ItemCard({ item, index, onEdit, onRemove }: Props) {
  const { t } = useTranslation();
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
    top: t('itemCard_groupTop'),
    bottom: t('itemCard_groupBottom'),
    shoe: t('tabs_wardrobe_filterFootwear'),
    other: '',
  };

  return (
    <View style={styles.card}>
      {item.usedFallback && (
        <Text style={styles.fallbackHint}>
          {t('itemCard_fallbackHint')}
        </Text>
      )}
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
              placeholder={t('itemCard_namePlaceholder')}
            />
            <Pressable onPress={onRemove} hitSlop={8}>
              <Text style={styles.removeText}>{t('uploadStep_remove')}</Text>
            </Pressable>
          </View>

          <FieldRow
            mode="picker"
            label={t('resultScreen_chipCategory')}
            value={item.type}
            options={TYPE_OPTIONS}
            onChange={(v) => onEdit({ type: v })}
          />
          <FieldRow
            mode="picker"
            label={t('itemCard_colourLabel')}
            value={item.color}
            options={COLOR_OPTIONS}
            swatch={swatchFor}
            onChange={(v) => onEdit({ color: v })}
          />
          <FieldRow
            mode="picker"
            label={t('dimScore_fabric')}
            value={item.material ?? ''}
            options={MATERIAL_OPTIONS}
            onChange={(v) => onEdit({ material: v || null })}
          />
          {item.fit !== null && (
            <FieldRow
              mode="picker"
              label={t('dimScore_fit')}
              value={item.fit ? titleCase(item.fit) : ''}
              options={FIT_OPTIONS.map(titleCase)}
              onChange={(v) => onEdit({ fit: v.toLowerCase() || null })}
            />
          )}
          {item.pattern !== null && (
            <FieldRow
              mode="picker"
              label={t('resultScreen_chipPattern')}
              value={item.pattern ? titleCase(item.pattern) : ''}
              options={PATTERN_OPTIONS.map(titleCase)}
              onChange={(v) => onEdit({ pattern: v.toLowerCase() || null })}
            />
          )}
          {item.warmthSeason !== null && (
            <FieldRow
              mode="picker"
              label={t('resultScreen_chipSeason')}
              value={item.warmthSeason ? warmthLabel(item.warmthSeason) : ''}
              options={WARMTH_OPTIONS.map(warmthLabel)}
              onChange={(v) => {
                const raw = WARMTH_OPTIONS.find((w) => warmthLabel(w) === v) ?? null;
                onEdit({ warmthSeason: raw });
              }}
            />
          )}
          {isLayerableTopType(item.type) && (
            <FieldRow
              mode="picker"
              label={t('itemCard_layerLabel')}
              value={canLayerToLabel(item.canLayer)}
              options={CAN_LAYER_OPTIONS}
              onChange={(v) => onEdit({ canLayer: labelToCanLayer(v) })}
            />
          )}
          <FieldRow
            mode="text"
            label={t('itemCard_brandLabel')}
            value={item.brand}
            placeholder={t('itemCard_brandPlaceholder')}
            onChange={(v) => onEdit({ brand: v })}
          />
          <FieldRow
            mode="text"
            label={t('itemCard_linkLabel')}
            value={item.link}
            placeholder={t('itemCard_linkPlaceholder')}
            onChange={(v) => onEdit({ link: v })}
          />
        </View>
      </View>

      {/* measurements (type-aware) */}
      {measureFields.length > 0 && (
        <View style={styles.measureSection}>
          <View style={styles.measureHeader}>
            <Text style={styles.sectionLabel}>{t('itemDetail_measurementsLabel')}</Text>
            <Text style={styles.sectionLabel}>{groupLabel[group]}</Text>
          </View>
          <View style={styles.measureGrid}>
            {measureFields.map(({ key, label }) => (
              <View key={key} style={styles.measureCell}>
                <MeasureField
                  label={label}
                  value={item.measurements[key]}
                  onCommit={(v) => setMeasure(key, v)}
                  unit={key === 'm_shoe_size' ? 'EU' : 'cm'}
                />
              </View>
            ))}
          </View>

          {/* Inline AI mapping — paste shop sizes; AI fills the fields above. */}
          <MeasurementAIMap
            garmentType={item.type}
            currentMeasurements={item.measurements}
            onApply={(m) => onEdit({ measurements: { ...item.measurements, ...m } })}
          />
        </View>
      )}

      {/* tags */}
      <View style={styles.tagsSection}>
        <Text style={styles.sectionLabel}>{t('itemCard_tagsLabel')}</Text>
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
  fallbackHint: {
    fontFamily: T.font.sans,
    fontSize: 11,
    color: T.color.warning,
    marginBottom: 10,
    lineHeight: 16,
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
