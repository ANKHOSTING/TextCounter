import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getAppUserId } from './purchases';

/** Optional AI writing check. Calls the `writing-check` Supabase Edge Function; the OpenAI key lives only on the server. */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const MAX_AI_CHARS = 6000;

export function aiConfigured() {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY && !SUPABASE_URL.includes('REPLACE') && !SUPABASE_ANON_KEY.includes('REPLACE');
}

export type Issue = { type: 'spelling' | 'grammar' | 'punctuation' | 'style'; original: string; suggestion: string; explanation: string };
export type CheckResult =
  | { ok: true; issues: Issue[]; suggestions: string[]; correctedText: string; used: number | null; limit: number | null }
  | { ok: false; reason: 'unconfigured' | 'limit' | 'error' | 'empty'; message: string };

async function deviceId(): Promise<string> {
  const k = 'textcraft.deviceId';
  let id = await AsyncStorage.getItem(k);
  if (!id) { id = Crypto.randomUUID(); await AsyncStorage.setItem(k, id); }
  return id;
}

export async function runWritingCheck(text: string): Promise<CheckResult> {
  if (!aiConfigured()) return { ok: false, reason: 'unconfigured', message: 'AI writing check isn’t set up in this build yet. All counting and analysis tools still work offline.' };
  if (!text.trim()) return { ok: false, reason: 'empty', message: 'Type or paste some text first.' };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/writing-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ text: text.slice(0, MAX_AI_CHARS), deviceId: await deviceId(), rcUserId: await getAppUserId() }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (res.status === 429 || body?.error === 'limit_reached') {
      return { ok: false, reason: 'limit', message: `You've used your ${body?.limit ?? 'free'} free AI checks today. Upgrade to TextCraft Pro for unlimited checks.` };
    }
    if (res.status === 503 || body?.error === 'not_configured') {
      return { ok: false, reason: 'unconfigured', message: 'The AI service isn’t configured on the server yet.' };
    }
    if (!res.ok) return { ok: false, reason: 'error', message: body?.error ?? `Request failed (${res.status})` };
    return { ok: true, issues: body.issues ?? [], suggestions: body.suggestions ?? [], correctedText: body.correctedText ?? text, used: body.used ?? null, limit: body.limit ?? null };
  } catch (e) {
    return { ok: false, reason: 'error', message: 'Couldn’t reach the AI service. Check your connection and try again.' };
  }
}
