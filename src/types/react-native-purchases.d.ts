// Stub types for react-native-purchases (not yet installed — dev-client only).
// Remove once the package is added via `npx expo install react-native-purchases`.
declare module 'react-native-purchases' {
  export interface PurchasesPackage {
    identifier: string;
    packageType: string;
    product: { title: string; priceString: string };
  }
  export interface PurchasesOfferings {
    current: { availablePackages: PurchasesPackage[] } | null;
  }
  export interface CustomerInfo {
    entitlements: { active: Record<string, { isActive: boolean }> };
  }
  const Purchases: {
    configure: (opts: { apiKey: string }) => void;
    logIn: (userId: string) => Promise<{ customerInfo: CustomerInfo }>;
    getCustomerInfo: () => Promise<CustomerInfo>;
    getOfferings: () => Promise<PurchasesOfferings>;
    purchasePackage: (pkg: PurchasesPackage) => Promise<{ customerInfo: CustomerInfo }>;
    restorePurchases: () => Promise<CustomerInfo>;
  };
  export default Purchases;
}
