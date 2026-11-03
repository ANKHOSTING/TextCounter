import { createContext } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { TestIds } from 'react-native-google-mobile-ads';

const UNIT_ID_RE = /^ca-app-pub-\d{16}\/\d{10}$/;
const GOOGLE_TEST_PUBLISHER = 'ca-app-pub-3940256099942544';

/** Real banner unit id from env (EXPO_PUBLIC_ADMOB_BANNER_ANDROID) or app config extra.admobBannerAndroid. */
function configuredUnitId(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as { admobBannerAndroid?: string };
  const v = (process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || extra.admobBannerAndroid || '').trim();
  // Must look like a real unit id and must not be one of Google's test ids.
  return UNIT_ID_RE.test(v) && !v.startsWith(GOOGLE_TEST_PUBLISHER) ? v : null;
}

/**
 * Banner unit id, or null => render no ad.
 * Test ids are used ONLY under __DEV__; release builds never fall back to them.
 */
export const BANNER_UNIT_ID: string | null = __DEV__ ? TestIds.ADAPTIVE_BANNER : configuredUnitId();

export const ADS_ENABLED =
  process.env.EXPO_PUBLIC_ADS_ENABLED !== 'false' && Platform.OS !== 'web' && !!BANNER_UNIT_ID;

/** True once UMP consent allows ad requests (or the consent request failed: banners are always non-personalized). */
export const AdsReadyContext = createContext(false);
