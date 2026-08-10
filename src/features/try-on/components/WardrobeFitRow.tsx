// Try On (feature 008) — Wardrobe-fit signal row.
// Presentational; mirrors DimScore's layout (header label + value, 3px track
// bar, explanation line). Driven entirely by WardrobeFitInfo — no store access.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import type { WardrobeFitInfo } from '../wardrobeFit';
import { useTranslation } from '../../../i18n';

interface Props {
  fit: WardrobeFitInfo | null;
  loading?: boolean;
}

export function WardrobeFitRow({ fit, loading = false }: Props) {
  const { t } = useTranslation();
  const barPct = fit ? fit.barPct : 0;

  const explanationText = loading
    ? t('wardrobeFitRow_loading')
    : fit
      ? t(fit.explanationKey, fit.explanationParams)
      : t('wardrobeFitRow_noData');

  return (
    <View style={styles.container}>
      {/* Header row: WARDROBE label + count value */}
      <View style={styles.header}>
        <Text style={styles.label}>{t('wardrobeFitRow_label')}</Text>
        {fit ? (
          <View style={styles.valueRow}>
            <Text style={styles.valueNumber}>{fit.highCount}</Text>
            <Text style={styles.valueUnit}>{t('wardrobeFitRow_matches')}</Text>
          </View>
        ) : (
          <Text style={styles.valuePlaceholder}>—</Text>
        )}
      </View>

      {/* Score bar */}
      <View style={styles.trackContainer}>
        <View style={[styles.trackFill, { width: `${barPct}%` as `${number}%` }]} />
      </View>

      {/* Explanation / loading hint */}
      <Text style={[styles.explanation, loading && styles.explanationLoading]}>
        {explanationText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: T.s(2),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
    flex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  valueNumber: {
    fontFamily: T.font.serif,
    fontSize: 17,
    color: T.color.primary,
  },
  valueUnit: {
    ...type.ui,
    fontSize: 8,
    color: T.color.tertiary,
  },
  valuePlaceholder: {
    fontFamily: T.font.serif,
    fontSize: 17,
    color: T.color.muted,
  },
  trackContainer: {
    height: 3,
    backgroundColor: T.color.hairline,
    marginTop: T.s(2),
    position: 'relative',
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: T.color.primary,
  },
  explanation: {
    ...type.caption,
    fontSize: 11,
    color: T.color.tertiary,
    marginTop: T.s(1.5),
  },
  explanationLoading: {
    color: T.color.muted,
    fontStyle: 'italic',
  },
});
