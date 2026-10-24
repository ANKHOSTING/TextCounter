import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

/** RevenueCat entitlement identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT = 'pro';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
let configured = false;

export function purchasesAvailable() {
  return Platform.OS === 'android' && !!ANDROID_KEY && !ANDROID_KEY.includes('REPLACE');
}

export function initPurchases() {
  if (configured || !purchasesAvailable()) return;
  Purchases.configure({ apiKey: ANDROID_KEY });
  configured = true;
}

/** RevenueCat anonymous app user id (no accounts). Sent to the AI function so it can verify Pro server-side. */
export async function getAppUserId(): Promise<string | null> {
  if (!configured) return null;
  try { return await Purchases.getAppUserID(); } catch { return null; }
}

export async function isPro(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[PRO_ENTITLEMENT];
  } catch { return false; }
}

export async function getProPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function buyPackage(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo.entitlements.active[PRO_ENTITLEMENT];
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}
