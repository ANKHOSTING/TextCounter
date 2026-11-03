// Dynamic Expo config: layers AdMob IDs from the environment on top of app.json.
// No real AdMob IDs are committed. Angel supplies them via env / EAS environment variables:
//   ADMOB_ANDROID_APP_ID        e.g. ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY   (native app id)
//   ADMOB_IOS_APP_ID            optional (iOS is not shipped yet)
//   EXPO_PUBLIC_ADMOB_BANNER_ANDROID  e.g. ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ (banner unit id)
// Behaviour when the app id is missing:
//   - EAS "production" profile: the build FAILS (we never ship Google's test ids).
//   - any other build (dev/preview/local): Google's test *app* id is used only so the native SDK can
//     initialise; the JS side still renders no ad outside __DEV__ without a real unit id (see src/lib/ads.ts).
const GOOGLE_TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const APP_ID_RE = /^ca-app-pub-\d{16}~\d{10}$/;

module.exports = ({ config }) => {
  const isProdProfile = process.env.EAS_BUILD_PROFILE === 'production';
  const pick = (name, fallback) => {
    const v = (process.env[name] || '').trim();
    if (v && APP_ID_RE.test(v)) return v;
    if (v) throw new Error(`${name} is set but is not a valid AdMob app id (ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY).`);
    if (isProdProfile) throw new Error(`${name} is required for production builds. Refusing to ship Google test ad ids.`);
    console.warn(`[app.config] ${name} not set; using Google TEST app id (non-production build only).`);
    return fallback;
  };
  const androidAppId = pick('ADMOB_ANDROID_APP_ID', GOOGLE_TEST_ANDROID_APP_ID);
  // iOS is not shipped; only enforce when explicitly provided or in production builds of iOS.
  const iosAppId = process.env.ADMOB_IOS_APP_ID ? pick('ADMOB_IOS_APP_ID', GOOGLE_TEST_IOS_APP_ID) : GOOGLE_TEST_IOS_APP_ID;

  const plugins = (config.plugins || []).map((p) =>
    Array.isArray(p) && p[0] === 'react-native-google-mobile-ads' ? [p[0], { ...p[1], androidAppId, iosAppId }] : p,
  );
  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      admobBannerAndroid: (process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || '').trim(),
    },
  };
};
