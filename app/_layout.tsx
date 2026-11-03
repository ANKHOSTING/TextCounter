import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import { ProProvider } from '@/lib/pro';
import { EditorProvider } from '@/lib/editor';
import { initPurchases } from '@/lib/purchases';
import { ADS_ENABLED, AdsReadyContext } from '@/lib/ads';
import { colors } from '@/components/ui';

initPurchases();

export default function RootLayout() {
  const [adsReady, setAdsReady] = useState(false);
  useEffect(() => {
    if (!ADS_ENABLED) return;
    (async () => {
      // UMP consent first (shows the consent form where required). If the request itself fails we still initialize:
      // banners always request non-personalized ads only (see AdBanner), so that is the safe fallback.
      let canRequestAds = true;
      try {
        canRequestAds = (await AdsConsent.gatherConsent()).canRequestAds;
      } catch (e) {
        console.warn('UMP consent request failed; continuing with non-personalized ads only', e);
      }
      if (!canRequestAds) return; // consent required but not given: no ad requests
      try { await mobileAds().initialize(); } catch (e) { console.warn('mobileAds().initialize() failed', e); }
      setAdsReady(true);
    })();
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
