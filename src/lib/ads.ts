import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

export const ADS_ENABLED = process.env.EXPO_PUBLIC_ADS_ENABLED !== 'false' && Platform.OS !== 'web';
/** Uses Google's test banner until a real AdMob unit id is configured. */
export const BANNER_UNIT_ID =
  __DEV__ || !process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ? TestIds.ADAPTIVE_BANNER : process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
