import React from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { ADS_ENABLED, BANNER_UNIT_ID } from '@/lib/ads';
import { usePro } from '@/lib/pro';

/** Banner ad for free users only. Hidden for TextCraft Pro subscribers. */
export function AdBanner() {
  const { pro } = usePro();
  if (!ADS_ENABLED || pro) return null;
  return (
    <View style={{ alignItems: 'center' }}>
      <BannerAd unitId={BANNER_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
    </View>
  );
}
