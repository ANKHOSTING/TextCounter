// Supabase Edge Function: AI writing check (spelling, grammar, punctuation, suggestions).
// Deploy with: supabase functions deploy writing-check   (verify_jwt stays ON: the Supabase gateway rejects requests without a valid
// anon/user JWT; the app has no user accounts so it sends the anon key).
// Required secret: IP_HASH_SECRET (random, >= 32 chars) keys the IP hashes; unset/short => 503. IPv6 is keyed on its /64. Optional: TRUSTED_PROXY_HOPS (default 1), see docs/SETUP.md.
// Abuse protection: per-IP daily cap (IP_DAILY_LIMIT, default 30) + global daily cap (GLOBAL_DAILY_LIMIT, default 2000) + per-device free limit.
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
      signal: AbortSignal.timeout(5000), // fail safe: timeout/error => not Pro
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return false;
    const ent = (await r.json())?.subscriber?.entitlements?.[Deno.env.get("REVENUECAT_ENTITLEMENT") ?? "pro"];
    return !!ent && (!ent.expires_date || new Date(ent.expires_date) > new Date());
  } catch { return false; }
}

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
function isIpv6(v: string): boolean {
  if (v.length > 45 || !/^[0-9a-fA-F:.]+$/.test(v) || v.includes(":::")) return false;
  const parts = v.split("::");
  if (parts.length > 2) return false;
  const groups = (x: string) => (x === "" ? [] : x.split(":"));
  const all = [...groups(parts[0]), ...(parts.length === 2 ? groups(parts[1]) : [])];
  let count = 0;
  for (let i = 0; i < all.length; i++) {
    const g = all[i];
    if (i === all.length - 1 && g.includes(".")) { if (!IPV4_RE.test(g)) return false; count += 2; continue; } // embedded IPv4 tail
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return false;
    count++;
  }
  return parts.length === 2 ? count < 8 : count === 8;
}
/** Returns a normalised IP string if `v` is a syntactically valid IPv4/IPv6 address, else null. */
function validIp(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  if (IPV4_RE.test(t)) return t;
  return isIpv6(t) ? t.toLowerCase() : null;
}

/** Expands a VALID IPv6 string to its 8 numeric 16-bit groups. */
function ipv6Groups(v: string): number[] {
  let t = v.toLowerCase();
  const m = t.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/); // embedded IPv4 tail -> two hex groups
  if (m) {
    const o = m[2].split(".").map(Number);
    t = m[1] + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  }
  const [head, tail] = t.split("::");
  const h = head ? head.split(":") : [];
  const l = tail === undefined ? [] : tail ? tail.split(":") : [];
  const mid = tail === undefined ? [] : Array(8 - h.length - l.length).fill("0");
  return [...h, ...mid, ...l].map((g) => parseInt(g, 16));
}

/**
 * Rate-limit identity for a validated IP: IPv4 as-is (IPv4-mapped IPv6 is mapped back to IPv4); IPv6 is expanded to
 * its full form and reduced to the /64 prefix, because one subscriber commonly controls a whole /64 and could
 * otherwise rotate addresses to dodge the per-IP cap.
 */
function rateLimitIdentity(ip: string): string {
  if (IPV4_RE.test(ip)) return ip;
  const g = ipv6Groups(ip);
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  }
  return "v6/64:" + g.slice(0, 4).map((x) => x.toString(16).padStart(4, "0")).join(":");
}

/**
 * Caller IP from headers set by Supabase's proxy. Prefers cf-connecting-ip (set by the CDN, not client-controllable);
 * otherwise the last *trusted* x-forwarded-for hop: entries before it can be spoofed by the client, so we take
 * the entry TRUSTED_PROXY_HOPS from the right (default 1 = the address the edge proxy itself appended).
 * Every candidate must be a syntactically valid IPv4/IPv6 address, otherwise it is ignored.
 * Returns null when no valid IP can be determined (the request is then refused with 503; there is no shared bucket).
 * Post-deploy check: see docs/SETUP.md ("Verify the IP headers").
 */
function clientIp(req: Request): string | null {
  const cf = validIp(req.headers.get("cf-connecting-ip"));
  if (cf) return cf;
  const hops = (req.headers.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const n = Math.max(1, Math.floor(Number(Deno.env.get("TRUSTED_PROXY_HOPS") ?? "1")) || 1);
  return hops.length >= n ? validIp(hops[hops.length - n]) : null;
}

/** HMAC-SHA256(ip, secret) as hex: keyed so stored keys can't be reversed by brute-forcing the IPv4 space. */
async function hmacIpKey(ip: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const d = await crypto.subtle.sign("HMAC", key, enc.encode(ip));
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
  // Reservations to give back if anything after them fails (also invoked from the outer catch).
  let deviceReserved = false, quotaConsumed = false;
  let giveBack: () => Promise<void> = async () => {};
  try {
    let body: { text?: unknown; deviceId?: unknown; rcUserId?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const text = typeof body.text === "string" ? body.text : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const rcUserId = typeof body.rcUserId === "string" ? body.rcUserId : null;
    if (!text.trim()) return json({ error: "No text" }, 400);
    if (!/^[\w-]{8,64}$/.test(deviceId)) return json({ error: "Missing device id" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ipSecret = (Deno.env.get("IP_HASH_SECRET") ?? "").trim(); // trimmed so stray whitespace/newline from `secrets set` neither counts toward length nor changes the HMAC key
    if (ipSecret.length < 32) { console.error("IP_HASH_SECRET is unset or shorter than 32 chars; refusing requests (fail closed)"); return json({ error: "service_unavailable" }, 503); }
    const ip = clientIp(req);
    if (!ip) {
      console.error("no valid client IP in cf-connecting-ip / x-forwarded-for; check TRUSTED_PROXY_HOPS", {
        cf: req.headers.get("cf-connecting-ip") ? "present" : "absent", xffHops: (req.headers.get("x-forwarded-for") ?? "").split(",").length,
      });
      return json({ error: "service_unavailable" }, 503);
    }
    const ipKey = (await hmacIpKey(rateLimitIdentity(ip), ipSecret)).slice(0, 32);
    giveBack = async () => {
      const dev = deviceReserved, quota = quotaConsumed;
      deviceReserved = quotaConsumed = false; // idempotent
      if (dev) await admin.rpc("refund_ai_usage", { p_device: deviceId }).then(({ error }) => { if (error) console.error("refund_ai_usage failed", error.message); }, (e) => console.error("refund_ai_usage threw", (e as Error)?.message));
      if (quota) await admin.rpc("refund_ai_quota", { p_ip_key: ipKey }).then(({ error }) => { if (error) console.error("refund_ai_quota failed", error.message); }, (e) => console.error("refund_ai_quota threw", (e as Error)?.message));
    };

    // 1) Pro status + per-device free limit first (atomic reserve), so requests already over the free limit
    //    never consume IP/global quota.
    const pro = await isProUser(rcUserId);
    const limit = Number(Deno.env.get("FREE_DAILY_LIMIT") ?? "3");
    let used = 0;
    if (!pro) {
      const { data: n, error: incErr } = await admin.rpc("increment_ai_usage", { p_device: deviceId });
      if (incErr || typeof n !== "number") { console.error("usage increment failed", incErr?.message); return json({ error: "Something went wrong. Please try again." }, 500); }
      deviceReserved = true;
      used = n;
      if (used > limit) { await giveBack(); return json({ error: "limit_reached", limit, used: limit }, 429); }
    }

    // 2) Per-IP + global daily caps (apply to everyone, including Pro). Fails closed if the quota check errors.
    const ipLimit = Number(Deno.env.get("IP_DAILY_LIMIT") ?? "30");
    const globalLimit = Number(Deno.env.get("GLOBAL_DAILY_LIMIT") ?? "2000");
    const { data: quota, error: quotaErr } = await admin.rpc("consume_ai_quota", {
      p_ip_key: ipKey, p_ip_limit: ipLimit, p_global_limit: globalLimit,
    });
    if (quotaErr) { console.error("quota check failed", quotaErr.message); await giveBack(); return json({ error: "service_unavailable" }, 500); }
    if (quota !== "ok") {
      await giveBack(); // device unit is returned; the over-limit IP/global count is intentionally kept (throttle)
      return json({ error: quota === "ip_limit" ? "rate_limited" : "service_busy" }, 429);
    }
    quotaConsumed = true;

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(Number(Deno.env.get("AI_TIMEOUT_MS") ?? "25000")),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        max_tokens: 2500,
        temperature: 0.2,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: text.slice(0, 6000) }],
      }),
    });
    if (!resp.ok) { console.error("AI provider", resp.status, await resp.text()); await giveBack(); return json({ error: "AI provider error" }, 502); }
    const data = await resp.json();
    let parsed: any = {};
    const raw: string = data.choices?.[0]?.message?.content ?? "{}";
    // Some models wrap JSON in prose/code fences or a <think> block; take the outermost {...}.
    const m = raw.replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/);
    try { parsed = JSON.parse(m ? m[0] : raw); } catch { await giveBack(); return json({ error: "AI returned an unreadable response, please try again" }, 502); }

    deviceReserved = quotaConsumed = false; // success: keep the reservations
    return json({
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 50) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
      correctedText: typeof parsed.correctedText === "string" ? parsed.correctedText : text,
      pro, used: pro ? null : used, limit: pro ? null : limit,
    });
  } catch (e) {
    console.error("writing-check failed", e);
    await giveBack();
    if ((e as Error)?.name === "TimeoutError") return json({ error: "The AI took too long. Please try again." }, 504);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
