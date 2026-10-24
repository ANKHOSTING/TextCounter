# TextCraft setup guide

The app runs with **zero configuration**: all counting, analysis and drafts work offline. Each section below turns on one optional piece.

## 1. Expo / EAS (required to build for Play)
1. Create a free account at https://expo.dev and run `npx eas-cli login`.
2. `npx eas-cli init` — replaces `REPLACE_WITH_EAS_PROJECT_ID` in `app.json`.
3. Add env values for builds: `npx eas-cli env:create` (or the expo.dev dashboard) for each `EXPO_PUBLIC_*` in `.env.example`.
4. Production AAB: `npx eas-cli build -p android --profile production`.
5. Upload the `.aab` to Play Console → TextCounter → Internal testing (or `eas submit -p android` with a Play service-account JSON at `./play-service-account.json`, which is git-ignored).

### Package and versionCode
- `android.package` is **`com.textcounter.app`** to match the existing Play Console app. Do not change it.
- `android.versionCode` is set to **10** so it exceeds earlier uploads. If Play says "version code already used", raise it in `app.json` (e.g. 11, 20) and rebuild. Bump it on every upload.
- If Play rejects the AAB for a **signing key mismatch**, the earlier upload was signed with a different key. In Play Console → App integrity, either let EAS use the existing upload key (`eas credentials` → upload your keystore) or request an upload-key reset.

## 2. AI writing check (Supabase + OpenAI)
1. Use the existing Supabase project (or create one) at https://supabase.com.
2. Apply the migration: `npx supabase link --project-ref <ref>` then `npx supabase db push` (or paste `supabase/migrations/*.sql` into the SQL editor).
3. Set secrets:
   ```bash
   npx supabase secrets set OPENAI_API_KEY=sk-...  FREE_DAILY_LIMIT=3
   # optional: AI_MODEL=gpt-4o-mini  REVENUECAT_SECRET_KEY=sk_...  REVENUECAT_ENTITLEMENT=pro
   ```
4. Deploy: `npx supabase functions deploy writing-check --no-verify-jwt` (no user accounts, so no JWT).
5. Put `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API) in `.env` / EAS env.

If these are missing, the app shows "AI writing check isn't set up" and everything else works. If the OpenAI key is missing on the server, the function returns 503 and the app shows the same message.

The free limit is enforced server-side per random device ID. A determined user could reset it by reinstalling; that's an accepted trade-off for an account-free app.

## 3. TextCraft Pro (RevenueCat + Google Play Billing)
1. Play Console → Monetize → Subscriptions: create e.g. `textcraft_pro_monthly` and `textcraft_pro_yearly`. (Requires an uploaded build with the BILLING permission, which this app has.)
2. RevenueCat (https://app.revenuecat.com): new project → Android app `com.textcounter.app` → connect a Play service-account.
3. Create entitlement **`pro`**, attach both products, and add them to the **current** offering.
4. Copy the public Android SDK key (`goog_...`) to `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
5. Optional but recommended: put a RevenueCat **secret** API key in the Supabase secret `REVENUECAT_SECRET_KEY` so the server grants Pro users unlimited AI checks. Without it, Pro still removes ads but the server applies the free limit.

## 4. Ads (AdMob)
1. Create an AdMob app for `com.textcounter.app` and a banner ad unit.
2. Replace the **test** `androidAppId` (`ca-app-pub-3940256099942544~3347511713`) in `app.json` → `react-native-google-mobile-ads` plugin with your real AdMob App ID.
3. Set `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` to your banner unit ID. Dev builds always use Google test ads.
4. Add `app-ads.txt` on your developer website if you list one in Play.
5. Set `EXPO_PUBLIC_ADS_ENABLED=false` to ship without ads.

## 5. Play Console checklist
- Privacy policy URL: host `PRIVACY_POLICY.md` (GitHub link works) and set `EXPO_PUBLIC_PRIVACY_POLICY_URL`.
- Data safety: see `docs/PLAY_STORE_LISTING.md`.
- **Account deletion:** not required — the app has no user accounts. Answer "No" to "Does your app allow users to create an account?"
- Ads declaration: Yes. Content rating questionnaire: Utility/Productivity, no objectionable content.
- Closed test with 12+ testers for 14 days (personal accounts created after Nov 13, 2023) before production.
