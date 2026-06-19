// Try On (feature 008) — T019
// Overall score dial + recommendation label + five DimScore rows.
// Handles the all-unavailable "complete your profile" empty state.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { Verdict, Recommendation } from '../../../types/tryOn';
import { DimScore } from './DimScore';

interface Props {
  verdict: Verdict;
}

// Human-readable labels for each recommendation band
const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  great:    'Great pick',
  worth_it: 'Worth it',
  maybe:    'Maybe',
  skip:     'Pass on it',
};

const RECOMMENDATION_DESCRIPTIONS: Record<Recommendation, string> = {
  great:    'This item fits your profile exceptionally well.',
  worth_it: 'A good match for your wardrobe and style.',
  maybe:    'Could work, but there are a few trade-offs.',
  skip:     'This item doesn\'t align with your profile.',
};

export function VerdictPanel({ verdict }: Props) {
  const allUnavailable = verdict.criteria.every((c) => !c.available);
  const { overallScore, recommendation, criteria } = verdict;

  return (
    <View style={styles.container}>
      {/* Section header */}
      <Text style={styles.sectionLabel}>IS IT WORTH IT?</Text>

      {/* Overall score + recommendation headline */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryText}>
          {recommendation ? (
            <>
              <Text style={styles.recommendationHeadline}>
                {RECOMMENDATION_LABELS[recommendation]}
              </Text>
              <Text style={styles.recommendationDesc}>
                {RECOMMENDATION_DESCRIPTIONS[recommendation]}
              </Text>
            </>
          ) : (
            <Text style={styles.recommendationHeadline}>
              {allUnavailable ? 'Complete your profile' : 'Evaluating…'}
            </Text>
          )}
          {allUnavailable && (
            <Text style={styles.profilePrompt}>
              Add body measurements and style preferences to get a personalised verdict.
            </Text>
          )}
        </View>

        {/* Score dial */}
        {overallScore !== null && !allUnavailable && (
          <View style={styles.scoreDial}>
            <Text style={styles.scoreNumber}>{overallScore}</Text>
            <Text style={styles.scoreLabel}>/100</Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Five criterion rows */}
      <View style={styles.criteriaList}>
        {criteria.map((criterion) => (
          <DimScore key={criterion.key} criterion={criterion} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: T.s(4),
  },
  sectionLabel: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    marginBottom: T.s(3),
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.s(3),
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  recommendationHeadline: {
    fontFamily: T.font.serif,
    fontSize: 28,
    fontWeight: '300',
    color: T.color.primary,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  recommendationDesc: {
    ...type.caption,
    marginTop: T.s(2),
  },
  profilePrompt: {
    ...type.caption,
    color: T.color.warning,
    marginTop: T.s(2),
  },
  scoreDial: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    flexShrink: 0,
  },
  scoreNumber: {
    fontFamily: T.font.serif,
    fontSize: 28,
    fontWeight: '300',
    color: T.color.primary,
    lineHeight: 32,
  },
  scoreLabel: {
    ...type.micro,
    color: T.color.tertiary,
  },
  divider: {
    height: 0.5,
    backgroundColor: T.color.hairline,
    marginVertical: T.s(4),
  },
  criteriaList: {
    gap: T.s(4),
  },
});
