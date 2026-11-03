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

## 2. AI writing check (Supabase + Fireworks AI, or any OpenAI-compatible provider)
The `writing-check` function calls an OpenAI-compatible `/chat/completions` endpoint. Defaults to **Fireworks AI**.

1. Use the existing Supabase project (or create one) at https://supabase.com.
2. Apply the migration: `npx supabase link --project-ref <ref>` then `npx supabase db push` (or paste `supabase/migrations/*.sql` into the SQL editor).
3. Set secrets (server-side only, never in the app or `.env`):
   ```bash
   # Fireworks (default). Key from https://fireworks.ai/account/api-keys
   npx supabase secrets set AI_API_KEY=fw_...  FREE_DAILY_LIMIT=3
   # optional overrides:
   #   AI_BASE_URL=https://api.fireworks.ai/inference/v1   (default)
   #   AI_MODEL=accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b   (default)
   #   REVENUECAT_SECRET_KEY=sk_...  REVENUECAT_ENTITLEMENT=pro
   ```
   **Model:** the default `accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b` (Nemotron Lightning) was tested working on Fireworks in Oct 2026; it reasons before answering, so keep max_tokens >= ~1500 (the function uses 2500). Models can be retired, so if checks start failing, list current models with
   `curl https://api.fireworks.ai/v1/serverless/models -H "Authorization: Bearer $AI_API_KEY"` and set `AI_MODEL` (e.g. `deepseek-flash-latest`, or a full id like `accounts/fireworks/models/<name>`).
   **To use OpenAI instead:** `AI_API_KEY=sk-... AI_BASE_URL=https://api.openai.com/v1 AI_MODEL=gpt-4o-mini`.
4. Deploy: `npx supabase functions deploy writing-check` (JWT verification stays ON: the app sends the Supabase anon JWT). Optional secrets: `IP_DAILY_LIMIT` (default 30 requests/IP/day), `GLOBAL_DAILY_LIMIT` (default 2000 requests/day across all users). Apply the `consume_ai_quota` migration first. The migration schedules a daily cleanup of `ai_rate_limit` with `pg_cron` if available; otherwise run `delete from public.ai_rate_limit where day < current_date - 1;` daily from any scheduler (the table is tiny, so skipping it is harmless short-term). 
   - **Required secret:** `IP_HASH_SECRET` (random, at least 32 chars, e.g. `openssl rand -hex 32`). IPs are stored only as HMAC-SHA256 keyed with it (IPv6 on its /64 prefix). If unset or shorter than 32 chars, the function fails closed with 503.
   - **`TRUSTED_PROXY_HOPS`** (default `1`): how many entries from the RIGHT of `x-forwarded-for` are appended by proxies you trust. The function first uses `cf-connecting-ip` if it is a valid IP; otherwise it takes the entry `TRUSTED_PROXY_HOPS` from the right of `x-forwarded-for` (entries further left can be spoofed by the client). Header values must be valid IPv4/IPv6 or they are ignored; with no valid IP the function logs an error and returns 503 (no shared bucket). Raise it only if the header check shows one constant row (see below).
   - **Post-deploy header check (do this once):** from a network whose public IP you know, call the function twice with a spoofed header, then check the logs and table:
     ```bash
     curl -s -X POST "$SUPABASE_URL/functions/v1/writing-check" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -H "X-Forwarded-For: 203.0.113.9" -d '{"text":"Their going too the store.","deviceId":"hdrcheck-0001"}'
     ```
     In SQL: `select key, count from public.ai_rate_limit where day = current_date;` and read the result like this:
     - **Exactly one `ip:` row that grows with every call, regardless of the spoofed value** → correct; the key comes from the real client address. Keep `TRUSTED_PROXY_HOPS` as is.
     - **One new `ip:` row per spoofed value** → the function is trusting a client-controlled `x-forwarded-for` entry, i.e. the header is untrusted. Do **not** raise `TRUSTED_PROXY_HOPS`; keep it at 1 (or lower the hop you read) and re-test, because raising it moves further into the client-controlled part of the header.
     - **One constant `ip:` row shared by everyone** (including requests from different networks) → the function is reading your proxy/CDN's own address, so there is a trusted proxy in front of Supabase that you are not accounting for. **Raise** `TRUSTED_PROXY_HOPS` by one per extra trusted proxy and re-test.
     - Calls return 503 and the logs say "no valid client IP" → the proxy isn't sending usable headers.
     IPv6 clients are keyed on their /64 prefix (one `v6/64:` identity per subscriber network), so several rows from one IPv6 network indicates different /64s, not spoofing.
     `IP_HASH_SECRET` must be at least 32 characters, otherwise the function returns 503.
5. Put `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API) in `.env` / EAS env.
6. Test: `curl -X POST "$SUPABASE_URL/functions/v1/writing-check" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{"text":"Their going too the store.","deviceId":"test-device-123"}'`

If these are missing, the app shows "AI writing check isn't set up" and everything else works. If `AI_API_KEY` is missing on the server, the function returns 503 and the app shows the same message.

The free limit is enforced server-side per random device ID. A determined user could reset it by reinstalling; that's an accepted trade-off for an account-free app.

## 3. TextCraft Pro (RevenueCat + Google Play Billing)
1. Play Console → Monetize → Subscriptions: create e.g. `textcraft_pro_monthly` and `textcraft_pro_yearly`. (Requires an uploaded build with the BILLING permission, which this app has.)
2. RevenueCat (https://app.revenuecat.com): new project → Android app `com.textcounter.app` → connect a Play service-account.
3. Create entitlement **`pro`**, attach both products, and add them to the **current** offering.
4. Copy the public Android SDK key (`goog_...`) to `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
5. Optional but recommended: put a RevenueCat **secret** API key in the Supabase secret `REVENUECAT_SECRET_KEY` so the server grants Pro users unlimited AI checks. Without it, Pro still removes ads but the server applies the free limit.

## 4. Ads (AdMob)
1. Create an AdMob app for `com.textcounter.app` and a banner ad unit.
2. Set `ADMOB_ANDROID_APP_ID` (`ca-app-pub-XXXX~YYYY`) as an env / EAS environment variable; `app.config.js` injects it into the AdMob plugin. Config resolution (any EAS profile or local build) fails if it is missing; there is no test-id fallback. For local dev only, set `ADMOB_ALLOW_TEST_IDS=true` (already set in the EAS `development` profile,). The opt-in is honoured only for the EAS `development` profile or local non-EAS runs, and is rejected anywhere else. `plugins/with-no-test-admob.js` also fails any release Gradle build whose merged manifest contains Google's test app id. **Preview builds and `eas update` also need the real IDs**: add `ADMOB_ANDROID_APP_ID` and `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` as EAS environment variables for the `preview` (and `production`) environments, and run `eas update` with `--environment` set so the same values are available; they must not use the test opt-in.
3. Set `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` (`ca-app-pub-XXXX/ZZZZ`) to your banner unit ID. If empty, release builds show **no** ad; Google test ads are used only in `__DEV__`.
4. Add `app-ads.txt` on your developer website if you list one in Play.
5. Set `EXPO_PUBLIC_ADS_ENABLED=false` to ship without ads.

## 5. Play Console checklist
- Privacy policy URL: host `PRIVACY_POLICY.md` (GitHub link works) and set `EXPO_PUBLIC_PRIVACY_POLICY_URL`.
- Data safety: see `docs/PLAY_STORE_LISTING.md`.
- **Account deletion:** not required — the app has no user accounts. Answer "No" to "Does your app allow users to create an account?"
- Ads declaration: Yes. Content rating questionnaire: Utility/Productivity, no objectionable content.
- Closed test with 12+ testers for 14 days (personal accounts created after Nov 13, 2023) before production.
