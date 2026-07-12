// Paywall screen — full-height modal presenting RevenueCat offerings.
// Luxury-minimal design: thin serif headline, off-white/warm-black palette,
// generous whitespace, hairline strokes. No gradients, no heavy shadows.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton, TextLink } from '../src/components/ui';
import { IconX } from '../src/components/icons';
import { usePremium } from '../src/features/monetization/usePremium';
import { useTranslation } from '../src/i18n';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { isPremium, isLoading, offerings, purchase, restore } = usePremium();

  // Benefit lines shown below the price
  const BENEFITS = [
    t('paywall_benefit1'),
    t('paywall_benefit2'),
    t('paywall_benefit3'),
  ];

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

  // Grab the default (first available) package from the current offering.
  const pkg = offerings?.current?.availablePackages?.[0] ?? null;

  const handlePurchase = async () => {
    if (!pkg) return;
    setPurchasing(true);
    setFeedbackMsg(null);
    try {
      const outcome = await purchase(pkg);
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
        {/* Eyebrow */}
        <Text style={styles.eyebrow}>{t('paywall_eyebrow')}</Text>

        {/* Headline */}
        <Text style={styles.h1}>{t('paywall_title')}</Text>

        {/* Sub-copy */}
        <Text style={styles.caption}>
          {t('paywall_subtitle')}
        </Text>

        {/* Benefit list */}
        <View style={styles.benefitList}>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <View style={styles.benefitDot} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Offerings area */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={T.color.secondary} />
          </View>
        ) : pkg ? (
          <View style={styles.offeringCard}>
            <Text style={styles.offeringTitle}>
              {pkg.product.title || t('paywall_defaultProductTitle')}
            </Text>
            <Text style={styles.offeringPrice}>
              {pkg.product.priceString}
            </Text>
          </View>
        ) : (
          // No offerings — RevenueCat not configured in this build (Expo Go /
          // missing EXPO_PUBLIC_REVENUECAT_API_KEY). Show a clear fallback.
          <View style={styles.fallbackBox}>
            <Text style={styles.fallbackTitle}>{t('paywall_unavailableTitle')}</Text>
            <Text style={styles.fallbackCaption}>
              {t('paywall_unavailableCaption')}
            </Text>
          </View>
        )}

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
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + T.s(4) }]}>
        <PrimaryButton
          onPress={handlePurchase}
          disabled={busy || !pkg || isPremium}
        >
          {purchasing
            ? t('paywall_upgradingButton')
            : pkg
            ? t('paywall_upgradeButtonWithPrice', { price: pkg.product.priceString })
            : t('premium_upgradeButton')}
        </PrimaryButton>

        <View style={styles.footerLinks}>
          <TextLink
            onPress={handleRestore}
            color={T.color.tertiary}
          >
            {restoring ? t('paywall_restoringLink') : t('paywall_restoreLink')}
          </TextLink>
        </View>
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

  benefitList: {
    gap: T.s(4),
    marginBottom: T.s(8),
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s(3),
  },
  benefitDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.color.primary,
    flexShrink: 0,
  },
  benefitText: {
    ...type.body,
    color: T.color.primary,
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
  },
  alreadyPremiumText: {
    ...type.caption,
    color: T.color.secondary,
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
