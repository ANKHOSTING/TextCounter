# TextCraft: Word Counter (TextCounter)

AI-powered word counter and writing companion for Android, built with Expo (React Native, TypeScript, expo-router).
It merges the original **TextCounter** (word counter with spelling/punctuation check, letter counts, keyword density)
and **TextCraft-Pro** (word counts, character analysis, writing insights) ideas into one app.

> Previously a Base44 project. This repo is now the Expo app that ships to Google Play as `com.textcounter.app`.

## Features
Works fully **offline, no account**:
- Live words, characters (with/without spaces), letters, sentences, paragraphs
- Reading time (238 wpm) and speaking time (140 wpm)
- Keyword density: top words (stop words excluded) with counts and percentages
- Flesch Reading Ease readability score
- Paste / copy / clear, and saved drafts stored on the device (AsyncStorage)

Optional online:
- **AI writing check** (spelling, grammar, punctuation, suggestions, corrected text) via the `writing-check` Supabase Edge Function. The OpenAI key lives only on the server. Free users get a daily limit (default 3/day). If the AI isn't configured, the app says so and everything else keeps working.
- **TextCraft Pro** (RevenueCat / Google Play Billing): unlimited AI checks and no ads.
- Banner ads (AdMob) for free users; Google test ads until real IDs are set.

## Quick start
```bash
npm install
cp .env.example .env   # optional; app runs without it
npx expo start
```
Ads and purchases are native modules, so use a development build (`eas build --profile development`) rather than Expo Go to test them.

See [docs/SETUP.md](docs/SETUP.md), [docs/PLAY_STORE_LISTING.md](docs/PLAY_STORE_LISTING.md) and [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## Security
- `.gitignore` prevents API keys, service-account JSON, and `.env` files from being committed.
- Never put the OpenAI key or RevenueCat secret key in the app. Only `EXPO_PUBLIC_*` values (public by design) go in `.env`.
