import mobileAds from 'react-native-google-mobile-ads';
import { ADS_ENABLED } from './ads';

/** Initialize AdMob on native builds. No-op when ads are disabled. */
export function initMobileAds() {
  if (ADS_ENABLED) mobileAds().initialize().catch(() => {});
}
