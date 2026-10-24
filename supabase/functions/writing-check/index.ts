// Supabase Edge Function: AI writing check (spelling, grammar, punctuation, suggestions).
// Deploy with: supabase functions deploy writing-check --no-verify-jwt   (the app has no user accounts)
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
  if (!key || !rcUserId) return false;
  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rcUserId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return false;
    const ent = (await r.json())?.subscriber?.entitlements?.[Deno.env.get("REVENUECAT_ENTITLEMENT") ?? "pro"];
    return !!ent && (!ent.expires_date || new Date(ent.expires_date) > new Date());
  } catch { return false; }
}

const SYSTEM = `You are TextCraft, a careful proofreader. Find spelling, grammar, and punctuation mistakes and give brief style suggestions.
Respond ONLY with JSON: {"issues":[{"type":"spelling"|"grammar"|"punctuation"|"style","original":"exact text","suggestion":"replacement","explanation":"short reason"}],
"suggestions":["up to 3 short overall writing tips"],"correctedText":"the full text with spelling, grammar and punctuation fixed, keeping the author's voice and meaning"}.
Keep the same language as the input. If there are no issues, return an empty issues array and the original text.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = Deno.env.get("AI_API_KEY");
  // Default: Fireworks serverless. Model alias from https://docs.fireworks.ai/nexus/open-models (Sep 2026 snapshot).
  const baseUrl = (Deno.env.get("AI_BASE_URL") ?? "https://api.fireworks.ai/inference/v1").replace(/\/+$/, "");
  const model = Deno.env.get("AI_MODEL") ?? "glm-flash-latest";
  if (!apiKey) return json({ error: "not_configured" }, 503);
  try {
    const { text, deviceId, rcUserId } = await req.json() as { text?: string; deviceId?: string; rcUserId?: string | null };
    if (!text || !text.trim()) return json({ error: "No text" }, 400);
    if (!deviceId || !/^[\w-]{8,64}$/.test(deviceId)) return json({ error: "Missing device id" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const pro = await isProUser(rcUserId);
    const limit = Number(Deno.env.get("FREE_DAILY_LIMIT") ?? "3");
    let used = 0;
    if (!pro) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: u } = await admin.from("ai_usage").select("count").eq("device_id", deviceId).eq("day", today).maybeSingle();
      used = u?.count ?? 0;
      if (used >= limit) return json({ error: "limit_reached", limit, used }, 429);
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
    if (!resp.ok) { console.error("AI provider", resp.status, await resp.text()); return json({ error: "AI provider error" }, 502); }
    const data = await resp.json();
    let parsed: any = {};
    const raw: string = data.choices?.[0]?.message?.content ?? "{}";
    // Some models wrap JSON in prose/code fences or a <think> block; take the outermost {...}.
    const m = raw.replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/);
    try { parsed = JSON.parse(m ? m[0] : raw); } catch { return json({ error: "AI returned an unreadable response, please try again" }, 502); }

    if (!pro) used = (await admin.rpc("increment_ai_usage", { p_device: deviceId })).data ?? used + 1;
    return json({
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 50) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
      correctedText: typeof parsed.correctedText === "string" ? parsed.correctedText : text,
      pro, used: pro ? null : used, limit: pro ? null : limit,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
