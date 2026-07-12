// Try On (feature 008) — T019
// Overall score dial + recommendation label + five DimScore rows.
// Handles the all-unavailable "complete your profile" empty state.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { T, type } from '../../../design/tokens';
import { Verdict, Recommendation } from '../../../types/tryOn';
import { DimScore } from './DimScore';
import { WardrobeFitRow } from './WardrobeFitRow';
import type { WardrobeFitInfo } from '../wardrobeFit';
import { useTranslation } from '../../../i18n';

interface Props {
  verdict: Verdict;
  /** Client-side wardrobe-fit signal (NOT part of the server /100 score). */
  wardrobeFit?: WardrobeFitInfo | null;
  wardrobeFitLoading?: boolean;
  /** Invoked from the all-unavailable empty state so the user can jump straight
   *  to the profile section that unblocks scoring (never a dead end). */
  onCompleteProfile?: () => void;
}

// Human-readable label keys for each recommendation band
const RECOMMENDATION_LABEL_KEYS: Record<Recommendation, string> = {
  great:    'verdictPanel_recGreat',
  worth_it: 'verdictPanel_recWorthIt',
  maybe:    'verdictPanel_recMaybe',
  skip:     'verdictPanel_recSkip',
};

const RECOMMENDATION_DESCRIPTION_KEYS: Record<Recommendation, string> = {
  great:    'verdictPanel_recGreatDesc',
  worth_it: 'verdictPanel_recWorthItDesc',
  maybe:    'verdictPanel_recMaybeDesc',
  skip:     'verdictPanel_recSkipDesc',
};

export function VerdictPanel({ verdict, wardrobeFit, wardrobeFitLoading, onCompleteProfile }: Props) {
  const { t } = useTranslation();
  const allUnavailable = verdict.criteria.every((c) => !c.available);
  const { overallScore, recommendation, criteria } = verdict;

  return (
    <View style={styles.container}>
      {/* Section header */}
      <Text style={styles.sectionLabel}>{t('verdictPanel_sectionLabel')}</Text>

      {/* Overall score + recommendation headline */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryText}>
          {recommendation ? (
            <>
              <Text style={styles.recommendationHeadline}>
                {t(RECOMMENDATION_LABEL_KEYS[recommendation])}
              </Text>
              <Text style={styles.recommendationDesc}>
                {t(RECOMMENDATION_DESCRIPTION_KEYS[recommendation])}
              </Text>
            </>
          ) : (
            <Text style={styles.recommendationHeadline}>
              {allUnavailable ? t('verdictPanel_completeProfile') : t('verdictPanel_evaluating')}
            </Text>
          )}
          {allUnavailable && (
            <>
              <Text style={styles.profilePrompt}>
                {t('verdictPanel_profilePrompt')}
              </Text>
              {onCompleteProfile && (
                <Pressable onPress={onCompleteProfile} hitSlop={8} style={styles.profileCta}>
                  <Text style={styles.profileCtaText}>{t('verdictPanel_completeProfileCta')}</Text>
                </Pressable>
              )}
            </>
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

      {/* Wardrobe-fit signal — client-side, NOT part of the /100 server score.
          Shown only when the prefetch has fired (loading or results present). */}
      {(wardrobeFit || wardrobeFitLoading) ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.wardrobeSectionLabel}>{t('verdictPanel_wardrobeSectionLabel')}</Text>
          <WardrobeFitRow fit={wardrobeFit ?? null} loading={wardrobeFitLoading} />
        </>
      ) : null}

      {/* AI fit note — grounded summary of where it fits / doesn't, to aid the
          buy decision. Only when the LLM produced one (best-effort, may be null). */}
      {verdict.fitNote ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>{t('verdictPanel_fitNoteLabel')}</Text>
          <Text style={styles.noteBody}>{verdict.fitNote.trim()}</Text>
        </View>
      ) : null}
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
  profileCta: {
    alignSelf: 'flex-start',
    marginTop: T.s(3),
  },
  profileCtaText: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
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
  wardrobeSectionLabel: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    marginBottom: T.s(2),
  },
  noteBlock: {
    marginTop: T.s(4),
    paddingTop: T.s(4),
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  noteLabel: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    marginBottom: T.s(2),
  },
  noteBody: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 20,
    color: T.color.secondary,
  },
});
