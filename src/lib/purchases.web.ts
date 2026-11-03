/** Web builds have no Play Billing / RevenueCat native SDK. */

export const PRO_ENTITLEMENT = 'pro';

export type PurchasesPackage = {
  identifier: string;
  product: { title: string; priceString: string };
};

export function purchasesAvailable() {
  return false;
}

export function initPurchases() {}

export async function getAppUserId(): Promise<string | null> {
  return null;
}

export async function isPro(): Promise<boolean> {
  return false;
}

export async function getProPackages(): Promise<PurchasesPackage[]> {
  return [];
}

export async function buyPackage(_pkg: PurchasesPackage): Promise<boolean> {
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  return false;
}
