// Wardrobe Critic (feature 010) — T023
// Full "Wardrobe Report" screen. Thin — all logic lives in wardrobeCriticStore;
// this screen only renders per mode ('gaps' | 'starter' | 'complete') and wires
// the pull-to-refresh / Try-On bridge / premium gating.

import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft, IconCheck } from '../src/components/icons';
import { Bounded } from '../src/components/ui';
import { GapCard } from '../src/features/wardrobe-critic/components/GapCard';
import { useWardrobeCriticStore } from '../src/stores/wardrobeCriticStore';
import { usePremium } from '../src/features/monetization/usePremium';
import { useTranslation } from '../src/i18n';
import type { TFunction } from 'i18next';

export default function WardrobeReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { isPremium } = usePremium();

  const report = useWardrobeCriticStore((s) => s.report);
  const status = useWardrobeCriticStore((s) => s.status);
  const error = useWardrobeCriticStore((s) => s.error);
  const fetchReport = useWardrobeCriticStore((s) => s.fetchReport);
  const dismiss = useWardrobeCriticStore((s) => s.dismiss);
  const setPendingGap = useWardrobeCriticStore((s) => s.setPendingGap);
  // Select RAW state and derive with useMemo — calling a getter that filters
  // inside the selector returns a fresh array every snapshot, which
  // useSyncExternalStore treats as a change → infinite render loop.
  const dismissedIds = useWardrobeCriticStore((s) => s.dismissedIds);
  const visibleRecommendations = useMemo(
    () => (report?.recommendations ?? []).filter((r) => !dismissedIds.includes(r.archetypeId)),
    [report, dismissedIds],
  );

  useEffect(() => {
    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(() => {
    fetchReport(true);
  }, [fetchReport]);

  const handleTryOn = useCallback((archetypeId: string, label: { en: string; vi: string }) => {
    setPendingGap(archetypeId, label);
    router.push('/try-on');
  }, [router, setPendingGap]);

  const isLoading = status === 'loading' && !report;
  const isRefreshing = status === 'loading' && !!report;
  const isRateLimited = status === 'error' && error === 'rate_limited';
  const isOtherError = status === 'error' && error !== 'rate_limited';

  // Bilingual data fields (recommendation labels/notes) come from the server
  // as { en, vi } pairs, not translation keys — pick the active language here.
  const vi = !!i18n.language?.startsWith('vi');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.title}>{t('wardrobeReport_title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={T.color.primary} />
        }
      >
        <Bounded>
        {isLoading && (
          <View style={styles.stateBox}>
            <ActivityIndicator size="small" color={T.color.primary} />
            <Text style={styles.stateText}>{t('wardrobeReport_loading')}</Text>
          </View>
        )}

        {isRateLimited && (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>{t('wardrobeReport_rateLimitedTitle')}</Text>
            <Text style={styles.stateText}>
              {t('wardrobeReport_rateLimitedText')}
            </Text>
          </View>
        )}

        {isOtherError && (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>{t('wardrobeReport_errorTitle')}</Text>
            <Pressable onPress={() => fetchReport(true)} hitSlop={8}>
              <Text style={styles.retryLabel}>{t('wardrobeReport_retry')}</Text>
            </Pressable>
          </View>
        )}

        {report && !isLoading && (
          <>
            {report.mode === 'gaps' && (
              <GapsBody
                report={report}
                visibleRecommendations={visibleRecommendations}
                isPremium={isPremium}
                onDismiss={dismiss}
                onTryOn={handleTryOn}
                t={t}
                vi={vi}
              />
            )}
            {report.mode === 'starter' && <StarterBody report={report} t={t} vi={vi} router={router} />}
            {report.mode === 'complete' && <CompleteBody t={t} />}
          </>
        )}
        </Bounded>
      </ScrollView>
    </View>
  );
}

// ─── mode: gaps ────────────────────────────────────────────────────────────

function GapsBody({ report, visibleRecommendations, isPremium, onDismiss, onTryOn, t, vi }: {
  report: NonNullable<ReturnType<typeof useWardrobeCriticStore.getState>['report']>;
  visibleRecommendations: ReturnType<ReturnType<typeof useWardrobeCriticStore.getState>['visibleRecommendations']>;
  isPremium: boolean;
  onDismiss: (id: string) => void;
  onTryOn: (id: string, label: { en: string; vi: string }) => void;
  t: TFunction;
  vi: boolean;
}) {
  if (visibleRecommendations.length === 0) {
    return <CompleteBody t={t} />;
  }

  return (
    <>
      <Text style={styles.contextLine}>
        {t('wardrobeReport_contextLine', { count: report.baselineQualified })}
      </Text>
      <View style={{ height: 24 }} />

      <View style={styles.cardStack}>
        {visibleRecommendations.map((rec, i) => (
          <GapCard
            key={rec.archetypeId}
            rec={rec}
            locked={!isPremium && i > 0}
            onDismiss={() => onDismiss(rec.archetypeId)}
            onTryOn={() => onTryOn(rec.archetypeId, rec.label)}
          />
        ))}
      </View>

      <View style={{ height: 32 }} />
      <RedundancySection redundancy={report.redundancy} isPremium={isPremium} t={t} vi={vi} />
    </>
  );
}

function RedundancySection({ redundancy, isPremium, t, vi }: {
  redundancy: NonNullable<ReturnType<typeof useWardrobeCriticStore.getState>['report']>['redundancy'];
  isPremium: boolean;
  t: TFunction;
  vi: boolean;
}) {
  if (!redundancy) return null;

  if (!isPremium) {
    return (
      <View style={styles.redundancyLocked}>
        <Text style={styles.redundancyLockedLabel}>{t('wardrobeReport_premium')}</Text>
        <Text style={styles.redundancyLockedText}>
          {t('wardrobeReport_redundancyLockedText')}
        </Text>
      </View>
    );
  }

  const note = vi ? redundancy.note.vi : redundancy.note.en;
  return (
    <View style={styles.redundancyCard}>
      <Text style={styles.redundancyLabel}>{t('wardrobeReport_redundancyLabel')}</Text>
      <Text style={styles.redundancyTitle}>
        {redundancy.count} × {redundancy.typeName.toLowerCase()} · {redundancy.colorFamily}
      </Text>
      {!!note && <Text style={styles.redundancyNote}>{note}</Text>}
    </View>
  );
}

// ─── mode: starter ─────────────────────────────────────────────────────────

function StarterBody({ report, t, vi, router }: {
  report: NonNullable<ReturnType<typeof useWardrobeCriticStore.getState>['report']>;
  t: TFunction;
  vi: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  if (report.starterChecklist.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>{t('wardrobeReport_emptyTitle')}</Text>
        <Text style={styles.stateText}>
          {t('wardrobeReport_emptyText')}
        </Text>
        <View style={{ height: 20 }} />
        <Pressable onPress={() => router.push('/add-item' as any)} hitSlop={8}>
          <Text style={styles.retryLabel}>{t('wardrobeReport_addFirstItem')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Text style={styles.contextLine}>
        {t('wardrobeReport_starterContextLine')}
      </Text>
      <View style={{ height: 24 }} />
      <View style={styles.checklist}>
        {report.starterChecklist.map((item, i) => (
          <View
            key={item.archetypeId}
            style={[
              styles.checklistRow,
              i === report.starterChecklist.length - 1 && styles.checklistRowLast,
            ]}
          >
            <Text style={[styles.checklistLabel, item.owned && styles.checklistLabelOwned]}>
              {vi ? item.label.vi : item.label.en}
            </Text>
            {item.owned ? (
              <IconCheck size={16} color={T.color.success} strokeWidth={1.6} />
            ) : (
              <View style={styles.checklistEmptyDot} />
            )}
          </View>
        ))}
      </View>
    </>
  );
}

// ─── mode: complete ────────────────────────────────────────────────────────

function CompleteBody({ t }: { t: TFunction }) {
  return (
    <View style={styles.completeBox}>
      <Text style={styles.completeTitle}>{t('wardrobeReport_completeTitle')}</Text>
      <Text style={styles.completeText}>
        {t('wardrobeReport_completeText')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderBottomColor: T.color.hairline,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: T.font.serif, fontSize: 15, fontWeight: '400', color: T.color.primary, letterSpacing: 1 },
  content: { padding: 24, paddingTop: 28 },

  stateBox: { paddingVertical: 64, alignItems: 'center', gap: 12 },
  stateTitle: { ...type.h2, color: T.color.primary, textAlign: 'center' },
  stateText: { ...type.caption, color: T.color.secondary, textAlign: 'center' },
  retryLabel: { ...type.ui, fontSize: 10, color: T.color.primary },

  contextLine: {
    fontFamily: T.font.serifLight,
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 27,
    color: T.color.primary,
  },
  cardStack: { gap: 20 },

  redundancyCard: {
    borderTopWidth: 0.5, borderTopColor: T.color.hairline,
    paddingTop: 20,
  },
  redundancyLabel: { ...type.ui, fontSize: 9, color: T.color.tertiary, letterSpacing: 1.5 },
  redundancyTitle: {
    fontFamily: T.font.serif, fontSize: 18, color: T.color.primary,
    marginTop: 6,
  },
  redundancyNote: {
    fontFamily: T.font.serifLight, fontStyle: 'italic', fontSize: 13,
    color: T.color.secondary, marginTop: 6, lineHeight: 18,
  },
  redundancyLocked: {
    borderTopWidth: 0.5, borderTopColor: T.color.hairline,
    paddingTop: 20, alignItems: 'flex-start', gap: 6,
  },
  redundancyLockedLabel: { ...type.micro, fontSize: 9, color: T.color.tertiary, letterSpacing: 2 },
  redundancyLockedText: { ...type.caption, color: T.color.secondary },

  checklist: { borderTopWidth: 0.5, borderTopColor: T.color.hairline },
  checklistRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 56, borderBottomWidth: 0.5, borderBottomColor: T.color.hairline,
  },
  checklistRowLast: { borderBottomWidth: 0 },
  checklistLabel: { fontFamily: T.font.serif, fontSize: 16, color: T.color.secondary },
  checklistLabelOwned: { color: T.color.primary },
  checklistEmptyDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 0.5, borderColor: T.color.hairlineStrong,
  },

  completeBox: { paddingVertical: 72, alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  completeTitle: { ...type.h1, fontFamily: T.font.serifLight, fontWeight: '300', color: T.color.primary, textAlign: 'center' },
  completeText: { ...type.caption, color: T.color.secondary, textAlign: 'center', lineHeight: 20 },
});
