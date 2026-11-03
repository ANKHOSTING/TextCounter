import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import { ProProvider } from '@/lib/pro';
import { EditorProvider } from '@/lib/editor';
import { initPurchases, isPro } from '@/lib/purchases';
import { ADS_ENABLED, AdsReadyContext } from '@/lib/ads';
import { colors } from '@/components/ui';

initPurchases();

export default function RootLayout() {
  const [adsReady, setAdsReady] = useState(false);
  useEffect(() => {
    if (!ADS_ENABLED) return;
    let cancelled = false;
    (async () => {
      if (await isPro()) return; // Pro users never see ads: no consent form, no SDK init
      // UMP consent first (shows the consent form where required). Default is "no ad requests"; if the request fails we
      // only proceed when the last known consent info already allows ads. Banners are always non-personalized (AdBanner).
      let canRequestAds = false;
      try {
        canRequestAds = (await AdsConsent.gatherConsent()).canRequestAds;
      } catch (e) {
        console.warn('UMP consent request failed; falling back to last known consent info', e);
        try { canRequestAds = (await AdsConsent.getConsentInfo()).canRequestAds; } catch { canRequestAds = false; }
      }
      if (cancelled || !canRequestAds) return;
      try { await mobileAds().initialize(); } catch (e) { console.warn('mobileAds().initialize() failed', e); }
      if (!cancelled) setAdsReady(true);
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <AdsReadyContext.Provider value={adsReady}>
    <ProProvider>
      <EditorProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerTintColor: colors.primary }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="check" options={{ title: 'AI writing check' }} />
          <Stack.Screen name="pro" options={{ title: 'TextCraft Pro', presentation: 'modal' }} />
        </Stack>
      </EditorProvider>
    </ProProvider>
    </AdsReadyContext.Provider>
  );
}
