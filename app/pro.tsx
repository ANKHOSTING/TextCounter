import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { buyPackage, getProPackages, purchasesAvailable, restorePurchases } from '@/lib/purchases';
import { usePro } from '@/lib/pro';
import { Button, Card, s } from '@/components/ui';

export default function Pro() {
  const router = useRouter();
  const { pro, refresh } = usePro();
  const [pkgs, setPkgs] = useState<PurchasesPackage[] | null>(null);
  useEffect(() => { getProPackages().then(setPkgs).catch(() => setPkgs([])); }, []);
  const buy = async (p: PurchasesPackage) => {
    try { if (await buyPackage(p)) { await refresh(); Alert.alert('Welcome to TextCraft Pro! ⭐'); router.back(); } }
    catch (e: any) { if (!e?.userCancelled) Alert.alert('Purchase failed', e?.message ?? String(e)); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
      <Text style={{ fontSize: 24, fontWeight: '800' }}>⭐ TextCraft Pro</Text>
      <Card>
        <Text>✅ Unlimited AI writing checks</Text>
        <Text>✅ No ads</Text>
        <Text>✅ Support an indie app</Text>
      </Card>
      {pro && <Text style={s.h2}>You're already a Pro member. Thank you!</Text>}
      {!purchasesAvailable() && <Text style={s.muted}>Subscriptions are not configured in this build (set EXPO_PUBLIC_REVENUECAT_ANDROID_KEY).</Text>}
      {pkgs === null && purchasesAvailable() && <ActivityIndicator />}
      {pkgs?.map((p) => (
        <Button key={p.identifier} title={`${p.product.title || 'TextCraft Pro'} · ${p.product.priceString}`} onPress={() => buy(p)} />
      ))}
      <Button title="Restore purchases" variant="ghost" onPress={async () => { await restorePurchases(); await refresh(); }} />
      <Text style={s.muted}>Subscriptions renew automatically until cancelled in Google Play. Pro status is verified with RevenueCat for AI limits.</Text>
    </ScrollView>
  );
}
