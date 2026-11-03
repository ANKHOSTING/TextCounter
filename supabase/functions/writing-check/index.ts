// Supabase Edge Function: AI writing check (spelling, grammar, punctuation, suggestions).
// Deploy with: supabase functions deploy writing-check   (JWT verification ON; the app has no user accounts, so it sends the Supabase anon JWT)
// Abuse protection: JWT required + per-IP daily cap (IP_DAILY_LIMIT, default 30) + global daily cap (GLOBAL_DAILY_LIMIT, default 2000) + per-device free limit.
// Provider-agnostic: any OpenAI-compatible /chat/completions API (Fireworks by default, OpenAI via AI_BASE_URL).
// Secrets (supabase secrets set ...): AI_API_KEY (required), optional AI_BASE_URL, AI_MODEL, FREE_DAILY_LIMIT,
//   REVENUECAT_SECRET_KEY (v1 secret key, to verify TextCraft Pro server-side), REVENUECAT_ENTITLEMENT (default "pro").
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically. User text is never stored.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function isProUser(rcUserId: string | null | undefined): Promise<boolean> {
  const key = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!key || !rcUserId || rcUserId.length > 128) return false; // rcUserId is client-supplied: only trusted via the RevenueCat lookup below
  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rcUserId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return false;
    const ent = (await r.json())?.subscriber?.entitlements?.[Deno.env.get("REVENUECAT_ENTITLEMENT") ?? "pro"];
    return !!ent && (!ent.expires_date || new Date(ent.expires_date) > new Date());
  } catch { return false; }
}

function hasSupabaseJwt(req: Request): boolean {
  // Signature is verified by the Supabase gateway (verify_jwt ON). This is defence in depth in case the function
  // is ever deployed with --no-verify-jwt: require a bearer token shaped like a Supabase anon/authenticated JWT.
  const m = (req.headers.get("Authorization") ?? "").match(/^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/);
  if (!m) return false;
  try {
    const b64 = m[2].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")));
    if (claims.exp && claims.exp * 1000 < Date.now()) return false;
    return claims.role === "anon" || claims.role === "authenticated";
  } catch { return false; }
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return req.headers.get("cf-connecting-ip") || xff || req.headers.get("x-real-ip") || "unknown";
}

async function sha256Hex(v: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

const SYSTEM = `You are TextCraft, a careful proofreader. Find spelling, grammar, and punctuation mistakes and give brief style suggestions.
Respond ONLY with JSON: {"issues":[{"type":"spelling"|"grammar"|"punctuation"|"style","original":"exact text","suggestion":"replacement","explanation":"short reason"}],
"suggestions":["up to 3 short overall writing tips"],"correctedText":"the full text with spelling, grammar and punctuation fixed, keeping the author's voice and meaning"}.
Keep the same language as the input. If there are no issues, return an empty issues array and the original text.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = Deno.env.get("AI_API_KEY");
  // Default: Fireworks serverless. Default model tested working Oct 2026 (reasons first, needs max_tokens >= ~1500).
  const baseUrl = (Deno.env.get("AI_BASE_URL") ?? "https://api.fireworks.ai/inference/v1").replace(/\/+$/, "");
  const model = Deno.env.get("AI_MODEL") ?? "accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b";
  if (!apiKey) return json({ error: "not_configured" }, 503);
  if (!hasSupabaseJwt(req)) return json({ error: "unauthorized" }, 401);
  try {
    let body: { text?: unknown; deviceId?: unknown; rcUserId?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const text = typeof body.text === "string" ? body.text : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const rcUserId = typeof body.rcUserId === "string" ? body.rcUserId : null;
    if (!text.trim()) return json({ error: "No text" }, 400);
    if (!/^[\w-]{8,64}$/.test(deviceId)) return json({ error: "Missing device id" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Per-IP + global daily caps (apply to everyone, including Pro). Fails closed if the quota check errors.
    const ipLimit = Number(Deno.env.get("IP_DAILY_LIMIT") ?? "30");
    const globalLimit = Number(Deno.env.get("GLOBAL_DAILY_LIMIT") ?? "2000");
    const ipKey = (await sha256Hex(clientIp(req))).slice(0, 32);
    const { data: quota, error: quotaErr } = await admin.rpc("consume_ai_quota", {
      p_ip_key: ipKey, p_ip_limit: ipLimit, p_global_limit: globalLimit,
    });
    if (quotaErr) { console.error("quota check failed", quotaErr.message); return json({ error: "service_unavailable" }, 500); }
    if (quota === "ip_limit") return json({ error: "rate_limited" }, 429);
    if (quota === "global_limit") return json({ error: "service_busy" }, 429);

    const pro = await isProUser(rcUserId);
    const limit = Number(Deno.env.get("FREE_DAILY_LIMIT") ?? "3");
    let used = 0;
    // Atomic reserve BEFORE the AI call (no read-then-write race). Refunded if the AI call fails.
    const refund = async () => { if (!pro) await admin.rpc("refund_ai_usage", { p_device: deviceId }).then(() => {}, () => {}); };
    if (!pro) {
      const { data: n, error: incErr } = await admin.rpc("increment_ai_usage", { p_device: deviceId });
      if (incErr || typeof n !== "number") { console.error("usage increment failed", incErr?.message); return json({ error: "Something went wrong. Please try again." }, 500); }
      used = n;
      if (used > limit) { await refund(); return json({ error: "limit_reached", limit, used: limit }, 429); }
    }

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        max_tokens: 2500,
        temperature: 0.2,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: text.slice(0, 6000) }],
      }),
    });
    if (!resp.ok) { console.error("AI provider", resp.status, await resp.text()); await refund(); return json({ error: "AI provider error" }, 502); }
    const data = await resp.json();
    let parsed: any = {};
    const raw: string = data.choices?.[0]?.message?.content ?? "{}";
    // Some models wrap JSON in prose/code fences or a <think> block; take the outermost {...}.
    const m = raw.replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/);
    try { parsed = JSON.parse(m ? m[0] : raw); } catch { await refund(); return json({ error: "AI returned an unreadable response, please try again" }, 502); }

    return json({
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 50) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
      correctedText: typeof parsed.correctedText === "string" ? parsed.correctedText : text,
      pro, used: pro ? null : used, limit: pro ? null : limit,
    });
  } catch (e) {
    console.error("writing-check failed", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
