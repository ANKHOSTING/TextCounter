// Dynamic Expo config: layers AdMob IDs from the environment on top of app.json.
// No AdMob IDs (real or Google test) are committed. Supply them via env / EAS environment variables:
//   ADMOB_ANDROID_APP_ID              ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY  (native app id)       REQUIRED
//   EXPO_PUBLIC_ADMOB_BANNER_ANDROID  ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ  (banner unit id)      REQUIRED unless EXPO_PUBLIC_ADS_ENABLED=false
//   ADMOB_IOS_APP_ID                  optional (iOS is not shipped; omitted from the plugin when unset)
// There is NO test-id fallback for any build (EAS or local, release or preview): a missing/invalid id fails config
// resolution. Local development only: set ADMOB_ALLOW_TEST_IDS=true (e.g. in .env.local) to use Google's test app id so
// the native SDK can initialise. That opt-in is rejected anywhere except the EAS "development" profile / local non-EAS runs, and the JS side
// still shows test ads only under __DEV__ (see src/lib/ads.ts).
// The opt-in is honoured only for EAS_BUILD_PROFILE=development or a local non-EAS run (EAS_BUILD unset) and is rejected
// elsewhere. A Gradle check (plugins/with-no-test-admob.js) additionally fails release builds whose merged manifest has the
// Google test app id. Preview builds (release APKs) and EAS Update publishes resolve this
// same config, so they need the REAL ids set as EAS environment variables for that environment; they must not use the opt-in.
const GOOGLE_TEST_PUBLISHER = 'ca-app-pub-3940256099942544';
const GOOGLE_TEST_ANDROID_APP_ID = `${GOOGLE_TEST_PUBLISHER}~3347511713`;
const APP_ID_RE = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID_RE = /^ca-app-pub-\d{16}\/\d{10}$/;

module.exports = ({ config }) => {
  const env = (n) => (process.env[n] || '').trim();
  // Test ids are honoured ONLY for EAS "development" builds or a local run outside EAS (EAS_BUILD unset).
  // Any other context (EAS preview/production/custom profile) that sets the opt-in is rejected, not ignored.
  // (NODE_ENV is deliberately not used: Expo overrides it per command, so it is not a reliable signal.)
  const wantsTest = env('ADMOB_ALLOW_TEST_IDS') === 'true';
  const testContextOk = process.env.EAS_BUILD_PROFILE === 'development' || !process.env.EAS_BUILD;
  if (wantsTest && !testContextOk) {
    throw new Error('ADMOB_ALLOW_TEST_IDS is only allowed for the EAS "development" profile or local non-EAS runs.');
  }
  const allowTest = wantsTest && testContextOk;
  const adsEnabled = env('EXPO_PUBLIC_ADS_ENABLED') !== 'false';

  const appId = (name) => {
    const v = env(name);
    if (!v) return undefined;
    if (!APP_ID_RE.test(v) || (v.startsWith(GOOGLE_TEST_PUBLISHER) && !allowTest)) {
      throw new Error(`${name} is not a valid real AdMob app id (ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY).`);
    }
    return v;
  };

  let androidAppId = appId('ADMOB_ANDROID_APP_ID');
  if (!androidAppId) {
    if (!allowTest) {
      throw new Error('ADMOB_ANDROID_APP_ID is required (no test-id fallback). For local development only, set ADMOB_ALLOW_TEST_IDS=true.');
    }
    console.warn('[app.config] ADMOB_ALLOW_TEST_IDS=true: using Google TEST app id (local development only).');
    androidAppId = GOOGLE_TEST_ANDROID_APP_ID;
  }
  const iosAppId = appId('ADMOB_IOS_APP_ID'); // optional; undefined => omitted (plugin only warns)

  const unit = env('EXPO_PUBLIC_ADMOB_BANNER_ANDROID');
  if (adsEnabled && !allowTest && (!UNIT_ID_RE.test(unit) || unit.startsWith(GOOGLE_TEST_PUBLISHER))) {
    throw new Error('EXPO_PUBLIC_ADMOB_BANNER_ANDROID must be a real AdMob banner unit id (or set EXPO_PUBLIC_ADS_ENABLED=false). No test-ad fallback.');
  }

  const plugins = (config.plugins || []).map((p) =>
    Array.isArray(p) && p[0] === 'react-native-google-mobile-ads'
      ? [p[0], { ...p[1], androidAppId, ...(iosAppId ? { iosAppId } : {}) }]
      : p,
  );
  return { ...config, plugins, extra: { ...config.extra, admobBannerAndroid: unit } };
};
