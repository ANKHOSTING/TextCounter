import React, { useContext } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { ADS_ENABLED, AdsReadyContext, BANNER_UNIT_ID } from '@/lib/ads';
import { usePro } from '@/lib/pro';

/** Banner ad for free users only. Hidden for TextCraft Pro subscribers. */
export function AdBanner() {
  const { pro } = usePro();
  const adsReady = useContext(AdsReadyContext);
  if (!ADS_ENABLED || !BANNER_UNIT_ID || pro || !adsReady) return null;
  return (
    <View style={{ alignItems: 'center' }}>
      <BannerAd unitId={BANNER_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
    </View>
  );
}
