import { useState, useEffect, useCallback } from 'react';

// RevenueCat types — only available in dev-client builds.
// We lazy-import to avoid crashing in Expo Go.
let Purchases: typeof import('react-native-purchases').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Purchases = require('react-native-purchases').default;
} catch { /* not available in Expo Go */ }

export interface PremiumState {
  isPremium: boolean;
  isLoading: boolean;
  offerings: import('react-native-purchases').PurchasesOfferings | null;
  purchase: (pkg: import('react-native-purchases').PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

export function usePremium(): PremiumState {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<import('react-native-purchases').PurchasesOfferings | null>(null);

  useEffect(() => {
    if (!Purchases) { setIsLoading(false); return; }
    (async () => {
      try {
        const info = await Purchases.getCustomerInfo();
        setIsPremium(!!info.entitlements.active['premium']);
        const o = await Purchases.getOfferings();
        setOfferings(o);
      } catch { /* ignore in Expo Go */ }
      finally { setIsLoading(false); }
    })();
  }, []);

  const purchase = useCallback(async (pkg: import('react-native-purchases').PurchasesPackage): Promise<boolean> => {
    if (!Purchases) return false;
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = !!customerInfo.entitlements.active['premium'];
      setIsPremium(active);
      return active;
    } catch { return false; }
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    if (!Purchases) return false;
    try {
      const info = await Purchases.restorePurchases();
      const active = !!info.entitlements.active['premium'];
      setIsPremium(active);
      return active;
    } catch { return false; }
  }, []);

  return { isPremium, isLoading, offerings, purchase, restore };
}
