// Promotional-use permission capture.
//
// Optional and best-effort: the client submits this after a song is shareable.
// It must never block generation, sharing, download, or playback. One row per
// submission (append-only evidence).

import { getGeoContext } from "@/lib/geo";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { LEGAL_VERSION, PROMO_PERMISSION_TEXT_VERSION } from "@/lib/legal";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_TEXT_LEN = 120;

type Body = {
  granted?: unknown;
  email?: unknown;
  anonymous_id?: unknown;
  share_id?: unknown;
  recipient_name?: unknown;
  is_minor_recipient?: unknown;
};

function bad(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

function clean(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  out = out.trim().slice(0, maxLen);
  return out || null;
}

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Request body must be valid JSON.", 400);
  }

  if (typeof body.granted !== "boolean") {
    return bad("`granted` must be a boolean.", 400);
  }

  let email = clean(body.email, MAX_EMAIL_LEN);
  if (email) {
    email = email.toLowerCase();
    if (!EMAIL_RE.test(email)) email = null; // malformed email is dropped, not fatal
  }

  const anonymousId = clean(body.anonymous_id, MAX_TEXT_LEN);
  const shareId = clean(body.share_id, MAX_TEXT_LEN);
  const recipientName = clean(body.recipient_name, MAX_TEXT_LEN);
  const isMinorRecipient =
    typeof body.is_minor_recipient === "boolean" ? body.is_minor_recipient : null;

  // Minor-recipient flows: NEVER store a positive promo grant. We force
  // granted=false (rather than rejecting with 400) for two reasons:
  //   1. Defense-in-depth — even a buggy/crafted client that sends granted=true
  //      for a minor can never produce a positive grant in the evidence log.
  //   2. Auditability — we keep a row showing permission was not granted,
  //      instead of silently dropping the request.
  const forcedFalseForMinor = isMinorRecipient === true && body.granted === true;
  const granted = isMinorRecipient === true ? false : body.granted;

  // Geo enriched server-side from edge headers; null in local dev.
  const geo = getGeoContext(request);

  const row: Record<string, unknown> = {
    granted,
    email,
    anonymous_id: anonymousId,
    share_id: shareId,
    recipient_name: recipientName,
    is_minor_recipient: isMinorRecipient,
    permission_text_version: PROMO_PERMISSION_TEXT_VERSION,
    policy_version: LEGAL_VERSION,
    country: geo.country,
    region: geo.region,
    metadata: forcedFalseForMinor ? { forced_false_minor: true } : {},
  };

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return bad("Server is missing Supabase credentials.", 500);
  }

  const { error } = await supabase.from("promo_permissions").insert([row]);
  if (error) {
    console.error("[promo-permission] insert failed:", error.message);
    // Honest, non-blocking: the client fires this fire-and-forget.
    return Response.json({ ok: false }, { status: 200 });
  }

  return Response.json({ ok: true, granted });
}
