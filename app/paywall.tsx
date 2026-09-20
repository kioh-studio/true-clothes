// Paywall screen — full-height modal presenting RevenueCat offerings.
// Luxury-minimal design: thin serif headline, off-white/warm-black palette,
// generous whitespace, hairline strokes. No gradients, no heavy shadows.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton, TextLink, Bounded } from '../src/components/ui';
import { IconX } from '../src/components/icons';
import { usePremium } from '../src/features/monetization/usePremium';
import { useTranslation } from '../src/i18n';
import { TERMS_URL, PRIVACY_URL } from '../src/config/legal';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { isPremium, isLoading, offerings, activeProductId, purchase, restore } = usePremium();

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Auto-dismiss timer after a successful restore. Tracked in a ref so a
  // hardware-back/manual dismiss before it fires can cancel it — otherwise the
  // deferred router.back() fires on whatever screen is on top by then (double-back).
  const backTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (backTimeoutRef.current) clearTimeout(backTimeoutRef.current);
  }, []);

  // Render every package RevenueCat returns for the current offering — never
  // hardcode to a single index. Adding a plan (e.g. yearly) later becomes a
  // dashboard-only change instead of an app update + App Review cycle.
  const packages = useMemo(
    () => offerings?.current?.availablePackages ?? [],
    [offerings],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default selection once packages load: prefer ANNUAL, else the first
  // package. Keeps the current selection if it's still present (e.g. a
  // re-fetch of the same offering), never leaves selection null when
  // packages exist. When the user is already premium and more than one
  // package exists, default to a package that ISN'T their current plan —
  // otherwise the CTA would land disabled immediately (prefer ANNUAL among
  // the non-current options, same as the base preference).
  useEffect(() => {
    if (packages.length === 0) return;
    setSelectedId((prev) => {
      if (prev && packages.some((p) => p.identifier === prev)) return prev;
      if (isPremium && packages.length > 1) {
        const notCurrent = packages.filter((p) => p.product.identifier !== activeProductId);
        if (notCurrent.length > 0) {
          const annual = notCurrent.find((p) => p.packageType === 'ANNUAL');
          return (annual ?? notCurrent[0]).identifier;
        }
      }
      const annual = packages.find((p) => p.packageType === 'ANNUAL');
      return (annual ?? packages[0]).identifier;
    });
  }, [packages, isPremium, activeProductId]);

  const selectedPkg = packages.find((p) => p.identifier === selectedId) ?? null;

  // The package matching the user's live RevenueCat entitlement, if any.
  const currentPkg = activeProductId
    ? packages.find((p) => p.product.identifier === activeProductId) ?? null
    : null;

  // Plan-switch classification for the CTA / badges / downgrade notice.
  // 'none'      — not premium, or no package selected: unchanged buy flow.
  // 'current'   — selected package IS the plan the user is already on.
  // 'upgrade'   — monthly -> annual.
  // 'downgrade' — annual -> monthly.
  // 'switch'    — any other cross-plan combination.
  const planRelation: 'none' | 'current' | 'upgrade' | 'downgrade' | 'switch' = (() => {
    if (!isPremium || !selectedPkg) return 'none';
    if (currentPkg && selectedPkg.identifier === currentPkg.identifier) return 'current';
    if (!currentPkg) return 'switch';
    if (currentPkg.packageType === 'MONTHLY' && selectedPkg.packageType === 'ANNUAL') return 'upgrade';
    if (currentPkg.packageType === 'ANNUAL' && selectedPkg.packageType === 'MONTHLY') return 'downgrade';
    return 'switch';
  })();

  // Human-readable plan label — never render a raw PACKAGE_TYPE enum string.
  const getPlanLabel = (p: PurchasesPackage): string => {
    if (p.packageType === 'MONTHLY') return t('paywall_planMonthly');
    if (p.packageType === 'ANNUAL') return t('paywall_planAnnual');
    return p.product.title;
  };

  const getPlanPeriod = (p: PurchasesPackage): string => {
    if (p.packageType === 'MONTHLY') return t('paywall_periodMonthly');
    if (p.packageType === 'ANNUAL') return t('paywall_periodAnnual');
    return '';
  };

  // Savings badge: only when both a MONTHLY and an ANNUAL package exist, and
  // only with a sane, positive, finite result — guards against RevenueCat
  // returning a zero/negative/missing price.
  const monthlyPkg = packages.find((p) => p.packageType === 'MONTHLY') ?? null;
  const annualPkg = packages.find((p) => p.packageType === 'ANNUAL') ?? null;
  const savingsPercent = (() => {
    if (!monthlyPkg || !annualPkg) return null;
    const monthlyPrice = monthlyPkg.product.price;
    const annualPrice = annualPkg.product.price;
    if (
      !Number.isFinite(monthlyPrice) ||
      !Number.isFinite(annualPrice) ||
      monthlyPrice <= 0
    ) {
      return null;
    }
    const percent = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);
    return percent > 0 ? percent : null;
  })();

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => { /* non-fatal — nothing else to do if the link fails to open */ });
  };

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    setFeedbackMsg(null);
    try {
      const outcome = await purchase(selectedPkg);
      if (outcome === 'success') {
        // Fix 2: Re-hydrate the auth/profile store so the server-sourced
        // account_type refreshes without waiting for the RevenueCat webhook lag.
        // Dynamic require avoids a circular import (paywall → store → service).
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { useAuthStore } = require('../src/stores/authStore') as typeof import('../src/stores/authStore');
          await useAuthStore.getState().hydrate();
        } catch { /* non-fatal — RevenueCat entitlement already set locally */ }
        router.back();
      } else if (outcome === 'cancelled') {
        // User dismissed the system purchase sheet — not an error, stay silent.
      } else {
        setFeedbackMsg(t('paywall_purchaseFailedMessage'));
      }
    } catch {
      setFeedbackMsg(t('paywall_genericErrorMessage'));
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setFeedbackMsg(null);
    try {
      const success = await restore();
      if (success) {
        // Same refresh as after purchase
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { useAuthStore } = require('../src/stores/authStore') as typeof import('../src/stores/authStore');
          await useAuthStore.getState().hydrate();
        } catch { /* non-fatal */ }
        setFeedbackMsg(t('paywall_restoreSuccessMessage'));
        if (backTimeoutRef.current) clearTimeout(backTimeoutRef.current);
        backTimeoutRef.current = setTimeout(() => router.back(), 800);
      } else {
        setFeedbackMsg(t('paywall_restoreEmptyMessage'));
      }
    } catch {
      setFeedbackMsg(t('paywall_restoreFailedMessage'));
    } finally {
      setRestoring(false);
    }
  };

  const busy = purchasing || restoring;

  return (
    <View style={[styles.container, { paddingTop: insets.top + T.s(4) }]}>
      {/* Close button */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.closeBtn}
        disabled={busy}
      >
        <IconX size={20} strokeWidth={1.4} color={T.color.primary} />
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + T.s(8) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Bounded>
        {/* Eyebrow */}
        <Text style={styles.eyebrow}>{t('paywall_eyebrow')}</Text>

        {/* Headline */}
        <Text style={styles.h1}>{t('paywall_title')}</Text>

        {/* Sub-copy — the only value statement on the screen. Deliberately
            quota-free: no per-month counts, no bullet list (see design.md). */}
        <Text style={styles.caption}>
          {t('paywall_subtitle')}
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Offerings area */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={T.color.secondary} />
          </View>
        ) : packages.length === 1 ? (
          // Exactly one package — a single non-interactive card, no selector
          // chrome. Making a one-item list look like a choice is misleading.
          <View style={styles.offeringCard}>
            <Text style={styles.offeringTitle}>
              {packages[0].product.title || t('paywall_defaultProductTitle')}
            </Text>
            <Text style={styles.offeringPrice}>
              {packages[0].product.priceString}
            </Text>
          </View>
        ) : packages.length > 1 ? (
          <View style={styles.planList}>
            {packages.map((p) => {
              const isSelected = p.identifier === selectedId;
              const isCurrentPlan = isPremium && p.product.identifier === activeProductId;
              const showSavings = !isCurrentPlan && p.packageType === 'ANNUAL' && savingsPercent !== null;
              return (
                <Pressable
                  key={p.identifier}
                  onPress={() => setSelectedId(p.identifier)}
                  disabled={busy}
                  style={[
                    styles.planCard,
                    isSelected ? styles.planCardSelected : styles.planCardUnselected,
                  ]}
                >
                  <View style={styles.planCardHeader}>
                    <Text style={styles.planLabel}>{getPlanLabel(p)}</Text>
                    {isCurrentPlan ? (
                      <Text style={styles.savingsBadge}>{t('paywall_currentPlanBadge')}</Text>
                    ) : showSavings ? (
                      <Text style={styles.savingsBadge}>
                        {t('paywall_savePercent', { percent: savingsPercent })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.planPrice}>{p.product.priceString}</Text>
                  {getPlanPeriod(p) ? (
                    <Text style={styles.planPeriod}>{getPlanPeriod(p)}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          // No offerings — RevenueCat not configured in this build (Expo Go /
          // missing EXPO_PUBLIC_REVENUECAT_API_KEY). Show a clear fallback.
          <View style={styles.fallbackBox}>
            <Text style={styles.fallbackTitle}>{t('paywall_unavailableTitle')}</Text>
          </View>
        )}

        {/* Apple 3.1.2 auto-renewable subscription disclosure. The Terms/Privacy
            links always show — Apple requires them reachable from the paywall
            even if offerings fail to load. The plan-specific renewal text only
            renders once a package is selected. */}
        <View style={styles.disclosure}>
          {selectedPkg ? (
            <>
              <Text style={styles.disclosureText}>
                {t('paywall_disclosureTerms', {
                  plan: getPlanLabel(selectedPkg),
                  price: selectedPkg.product.priceString,
                })}
              </Text>
              <Text style={styles.disclosureText}>
                {t('paywall_disclosureRenewal')}
              </Text>
            </>
          ) : null}
          <View style={styles.disclosureLinks}>
            <TextLink onPress={() => openLink(TERMS_URL)} color={T.color.tertiary}>
              {t('paywall_termsLink')}
            </TextLink>
            <TextLink onPress={() => openLink(PRIVACY_URL)} color={T.color.tertiary}>
              {t('paywall_privacyLink')}
            </TextLink>
          </View>
        </View>

        {/* Feedback message */}
        {feedbackMsg ? (
          <Text style={styles.feedbackText}>{feedbackMsg}</Text>
        ) : null}

        {/* Already premium */}
        {isPremium ? (
          <View style={styles.alreadyPremium}>
            <Text style={styles.alreadyPremiumText}>
              {t('paywall_alreadyPremiumMessage')}
            </Text>
            <TextLink
              onPress={() => openLink('itms-apps://apps.apple.com/account/subscriptions')}
              color={T.color.tertiary}
            >
              {t('paywall_manageSubscription')}
            </TextLink>
          </View>
        ) : null}
        </Bounded>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + T.s(4) }]}>
        <Bounded>
        <PrimaryButton
          onPress={handlePurchase}
          disabled={busy || !selectedPkg || planRelation === 'current'}
        >
          {purchasing
            ? t('paywall_upgradingButton')
            : !selectedPkg
            ? t('premium_upgradeButton')
            : planRelation === 'current'
            ? t('paywall_currentPlanButton')
            : planRelation === 'upgrade'
            ? t('paywall_upgradeToAnnual')
            : planRelation === 'downgrade'
            ? t('paywall_switchToMonthly')
            : planRelation === 'switch'
            ? t('paywall_switchPlan', { plan: getPlanLabel(selectedPkg) })
            : t('paywall_upgradeButtonWithPrice', { price: selectedPkg.product.priceString })}
        </PrimaryButton>

        {planRelation === 'downgrade' ? (
          <Text style={styles.downgradeNotice}>{t('paywall_downgradeNotice')}</Text>
        ) : null}

        <View style={styles.footerLinks}>
          <TextLink
            onPress={handleRestore}
            color={T.color.tertiary}
          >
            {restoring ? t('paywall_restoringLink') : t('paywall_restoreLink')}
          </TextLink>
        </View>
        </Bounded>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.canvas,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginRight: T.s(6),
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: T.s(6),
    paddingTop: T.s(4),
  },

  eyebrow: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
    marginBottom: T.s(3),
  },
  h1: {
    ...type.h1,
    color: T.color.primary,
    marginBottom: T.s(4),
  },
  caption: {
    ...type.body,
    color: T.color.secondary,
    marginBottom: T.s(8),
  },

  divider: {
    height: 0.5,
    backgroundColor: T.color.hairline,
    marginBottom: T.s(8),
  },

  loadingBox: {
    paddingVertical: T.s(10),
    alignItems: 'center',
  },

  offeringCard: {
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    padding: T.s(5),
    marginBottom: T.s(6),
  },
  offeringTitle: {
    fontFamily: T.font.serif,
    fontSize: 20,
    fontWeight: '400',
    color: T.color.primary,
    marginBottom: T.s(2),
  },
  offeringPrice: {
    fontFamily: T.font.serifLight,
    fontSize: 36,
    fontWeight: '300',
    color: T.color.primary,
    letterSpacing: -0.4,
    marginBottom: T.s(2),
  },
  offeringDesc: {
    ...type.caption,
    color: T.color.secondary,
  },

  planList: {
    gap: T.s(3),
    marginBottom: T.s(6),
  },
  planCard: {
    padding: T.s(5),
  },
  planCardSelected: {
    borderWidth: 1,
    borderColor: T.color.primary,
  },
  planCardUnselected: {
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.s(2),
  },
  planLabel: {
    fontFamily: T.font.serif,
    fontSize: 18,
    fontWeight: '400',
    color: T.color.primary,
  },
  savingsBadge: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
  },
  planPrice: {
    fontFamily: T.font.serifLight,
    fontSize: 28,
    fontWeight: '300',
    color: T.color.primary,
    letterSpacing: -0.3,
  },
  planPeriod: {
    ...type.caption,
    color: T.color.secondary,
    marginTop: T.s(1),
  },

  disclosure: {
    marginBottom: T.s(4),
    gap: T.s(2),
  },
  disclosureText: {
    ...type.caption,
    color: T.color.tertiary,
    textAlign: 'center',
  },
  disclosureLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: T.s(5),
    marginTop: T.s(1),
  },

  fallbackBox: {
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    borderStyle: 'dashed',
    padding: T.s(6),
    marginBottom: T.s(6),
  },
  fallbackTitle: {
    fontFamily: T.font.serif,
    fontSize: 18,
    color: T.color.primary,
    marginBottom: T.s(2),
  },
  fallbackCaption: {
    ...type.caption,
    color: T.color.secondary,
  },

  feedbackText: {
    ...type.caption,
    color: T.color.secondary,
    textAlign: 'center',
    marginTop: T.s(3),
  },

  alreadyPremium: {
    padding: T.s(4),
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    marginTop: T.s(4),
    alignItems: 'center',
    gap: T.s(2),
  },
  alreadyPremiumText: {
    ...type.caption,
    color: T.color.secondary,
  },

  downgradeNotice: {
    ...type.caption,
    color: T.color.tertiary,
    textAlign: 'center',
  },

  footer: {
    paddingHorizontal: T.s(6),
    paddingTop: T.s(4),
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    backgroundColor: T.color.canvas,
    gap: T.s(4),
  },
  footerLinks: {
    alignItems: 'center',
  },
});
