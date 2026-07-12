// Try On (feature 008) — T018
// One criterion row: score bar + explanation when available;
// "Not enough info" prompt when available:false.
// Visual reference: screens/try-on-temp/scan-result-export/new/scan-result.jsx → DimScore

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { CriterionScore, CriterionKey } from '../../../types/tryOn';
import { useTranslation } from '../../../i18n';

interface Props {
  criterion: CriterionScore;
}

const LABEL_KEYS: Record<CriterionKey, string> = {
  color:       'dimScore_color',
  style:       'dimScore_style',
  fit:         'dimScore_fit',
  measurement: 'dimScore_measurement',
  fabric:      'dimScore_fabric',
};

export function DimScore({ criterion }: Props) {
  const { t } = useTranslation();
  const label = t(LABEL_KEYS[criterion.key]);
  const { available, score, explanation } = criterion;

  return (
    <View style={styles.container}>
      {/* Header row: label + score (or unavailable marker) */}
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {available && score !== null ? (
          <View style={styles.scoreRow}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreUnit}>/100</Text>
          </View>
        ) : (
          <Text style={styles.unavailableMarker}>—</Text>
        )}
      </View>

      {/* Score bar */}
      <View style={styles.trackContainer}>
        <View
          style={[
            styles.trackFill,
            { width: available && score !== null ? `${score}%` : '0%' },
            !available && styles.trackFillUnavailable,
          ]}
        />
      </View>

      {/* Explanation / prompt */}
      <Text style={[styles.explanation, !available && styles.explanationUnavailable]}>
        {available
          ? explanation
          : explanation || t('dimScore_notEnoughInfo')}
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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  scoreValue: {
    fontFamily: T.font.serif,
    fontSize: 17,
    color: T.color.primary,
  },
  scoreUnit: {
    ...type.ui,
    fontSize: 8,
    color: T.color.tertiary,
  },
  unavailableMarker: {
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
  trackFillUnavailable: {
    backgroundColor: T.color.muted,
  },
  explanation: {
    ...type.caption,
    fontSize: 11,
    color: T.color.tertiary,
    marginTop: T.s(1.5),
  },
  explanationUnavailable: {
    color: T.color.muted,
    fontStyle: 'italic',
  },
});
