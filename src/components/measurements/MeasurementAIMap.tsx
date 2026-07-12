// MeasurementAIMap — feature 009 (inline).
// An inline field placed directly BELOW the per-measurement edit grid: the user
// types/pastes a shop's raw measurements (any naming/language/unit) and Gemini
// maps them onto the app's canonical m_* fields, auto-filling the grid above.
//
// Shared by wardrobe-add ItemCard (add review + item-edit) and try-on ResultScreen
// (Constitution VI: shared components live in src/components/, no cross-feature imports).

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import { T, type } from '../../design/tokens';
import { measureGroupForType, MEASURE_FIELDS } from '../../features/wardrobe-add/measureSchema';
import type { MKey } from '../../types/fitEngine';
import type { MeasurementMapResult, MappedMeasure } from '../../types/measurementMap';
import { mapMeasurements } from '../../services/measurementMapService';
import { useTranslation } from '../../i18n';
import type { TFunction } from 'i18next';

interface Props {
  garmentType: string;
  currentMeasurements: Partial<Record<MKey, number>>;
  /** Merge the AI-mapped values into the item's measurements. */
  onApply: (m: Partial<Record<MKey, number>>) => void;
}

/** Human label for an MKey from the type's MEASURE_FIELDS; falls back to the key. */
function labelForKey(key: MKey, garmentType: string): string {
  const fields = MEASURE_FIELDS[measureGroupForType(garmentType)];
  return fields.find((f) => f.key === key)?.label ?? key;
}

/** Short conversion note for a mapped row, or null when nothing was converted. */
function conversionNote(conversion: MappedMeasure['conversion'], t: TFunction): string | null {
  switch (conversion) {
    case 'doubled':            return t('measurementAIMap_convertedDoubled');
    case 'inch_to_cm':         return t('measurementAIMap_convertedInchToCm');
    case 'inch_to_cm+doubled': return t('measurementAIMap_convertedInchToCmDoubled');
    default:                   return null;
  }
}

export function MeasurementAIMap({ garmentType, currentMeasurements, onApply }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MeasurementMapResult | null>(null);

  // Accessories carry no body measurements → no mapping field.
  if (MEASURE_FIELDS[measureGroupForType(garmentType)].length === 0) return null;

  const handleMap = async () => {
    const raw = text.trim();
    if (!raw || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await mapMeasurements(raw, garmentType);
      setResult(res);
      // Auto-fill the grid above with whatever mapped (unless a multi-size table).
      if (!res.multipleSizes && res.mapped.length > 0) {
        const merged: Partial<Record<MKey, number>> = {};
        for (const row of res.mapped) merged[row.key] = row.value;
        onApply(merged);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('measurementAIMap_mappingFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('measurementAIMap_label')}</Text>
      <Text style={styles.hint}>
        {t('measurementAIMap_hint')}
      </Text>

      <TextInput
        style={styles.input}
        multiline
        placeholder={t('measurementAIMap_placeholder')}
        placeholderTextColor={T.color.tertiary}
        value={text}
        onChangeText={setText}
        textAlignVertical="top"
        autoCorrect={false}
        spellCheck={false}
        editable={!loading}
      />

      <Pressable
        style={[styles.mapBtn, (loading || !text.trim()) && styles.mapBtnDisabled]}
        onPress={handleMap}
        disabled={loading || !text.trim()}
        hitSlop={4}
      >
        {loading
          ? <ActivityIndicator size="small" color={T.color.canvas} />
          : <Text style={styles.mapBtnLabel}>{t('measurementAIMap_mapButton')}</Text>}
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {result ? (
        <View style={styles.resultBlock}>
          {result.multipleSizes ? (
            <Text style={styles.warnText}>
              {t('measurementAIMap_multipleSizes')}
            </Text>
          ) : result.mapped.length > 0 ? (
            <>
              <Text style={styles.resultLabel}>{t('measurementAIMap_filledIn')}</Text>
              {result.mapped.map((row) => {
                const note = conversionNote(row.conversion, t);
                return (
                  <View key={row.key} style={styles.resultRow}>
                    <Text style={styles.resultName}>{labelForKey(row.key, garmentType)}</Text>
                    <View style={styles.resultRight}>
                      {note ? <Text style={styles.resultNote}>{note}</Text> : null}
                      {row.confidence < 0.5 ? <Text style={styles.resultNote}>{t('measurementAIMap_lowConfidence')}</Text> : null}
                      <Text style={styles.resultValue}>
                        {row.key === 'm_shoe_size' ? `EU ${row.value}` : `${row.value} cm`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <Text style={styles.warnText}>{t('measurementAIMap_noneRecognised')}</Text>
          )}

          {!result.multipleSizes && result.unmapped.length > 0 ? (
            <Text style={styles.unmappedText}>
              {t('measurementAIMap_notMapped', { list: result.unmapped.map((u) => u.label).join(', ') })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    gap: 8,
  },
  label: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  hint: { ...type.caption, fontSize: 11, color: T.color.tertiary, lineHeight: 16 },
  input: {
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    fontFamily: T.font.sans,
    fontSize: 13,
    color: T.color.primary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 64,
    lineHeight: 20,
  },
  mapBtn: {
    backgroundColor: T.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  mapBtnDisabled: { opacity: 0.4 },
  mapBtnLabel: { ...type.ui, fontSize: 9, color: T.color.canvas, letterSpacing: 2 },
  errorText: { ...type.caption, fontSize: 12, color: T.color.error },
  resultBlock: { gap: 4 },
  resultLabel: { ...type.ui, fontSize: 8.5, color: T.color.tertiary },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  resultName: { fontFamily: T.font.sans, fontSize: 13, color: T.color.secondary },
  resultRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultNote: { ...type.micro, fontSize: 8, color: T.color.tertiary, textTransform: 'none', letterSpacing: 0 },
  resultValue: { fontFamily: T.font.serif, fontSize: 14, color: T.color.primary },
  warnText: { ...type.caption, fontSize: 12, color: T.color.warning },
  unmappedText: { ...type.caption, fontSize: 11, color: T.color.tertiary, lineHeight: 16 },
});
