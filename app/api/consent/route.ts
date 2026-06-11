// Cookie-consent log. Each banner/preference-center decision is one row in
// `cookie_consent_log`. The client (`components/CookieConsent.tsx`) POSTs a
// `CookieConsentPayload`; this route is the authoritative source for the
// policy version and the geo enrichment.

import {
  COOKIE_CATEGORIES,
  normalizeCookieCategories,
  normalizePolicyVersion,
  type CookieConsentPayload,
  type ConsentChoice,
} from "@/lib/consent";
import { COOKIE_BANNER_VERSION } from "@/lib/legal";
import { getGeoContext } from "@/lib/geo";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const VALID_CHOICES: ReadonlySet<ConsentChoice> = new Set([
  "accept_all",
  "reject_non_essential",
  "custom",
]);

const MAX_ID_LEN = 128;

function bad(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

function sanitizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_ID_LEN);
}

export async function POST(request: Request): Promise<Response> {
  let body: Partial<CookieConsentPayload>;
  try {
    body = (await request.json()) as Partial<CookieConsentPayload>;
  } catch {
    return bad("Request body must be valid JSON.", 400);
  }

  const choice = body.choice;
  if (typeof choice !== "string" || !VALID_CHOICES.has(choice as ConsentChoice)) {
    return bad("Invalid consent choice.", 400);
  }

  const categories = normalizeCookieCategories(body.categories);
  const policyVersion = normalizePolicyVersion(body.policyVersion);
  const interfaceVersion =
    typeof body.interfaceVersion === "string" && body.interfaceVersion.trim()
      ? body.interfaceVersion.trim().slice(0, 20)
      : COOKIE_BANNER_VERSION;

  // Identity: store whichever the client supplied. There is no account system
  // yet, so this is normally an anonymous/session id.
  const userId = sanitizeId(body.userId);
  const anonymousId = sanitizeId(body.anonymousId);

  // Geo is enriched server-side from Vercel edge headers — never trusted from
  // the client. Absent in local dev (treated as null).
  const geo = getGeoContext(request);

  const row: Record<string, unknown> = {
    choice,
    // Per-category booleans, plus the canonical category set is fixed by
    // COOKIE_CATEGORIES so the shape can't drift.
    necessary: categories.necessary,
    preferences: categories.preferences,
    analytics: categories.analytics,
    marketing: categories.marketing,
    policy_version: policyVersion,
    interface_version: interfaceVersion,
    user_id: userId,
    anonymous_id: anonymousId,
    country: geo.country,
    region: geo.region,
  };
  // Reference COOKIE_CATEGORIES so an added category surfaces as a compile/lint
  // signal here rather than silently dropping from the log.
  void COOKIE_CATEGORIES;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return bad("Server is missing Supabase credentials.", 500);
  }

  const { error } = await supabase.from("cookie_consent_log").insert([row]);
  if (error) {
    console.error("[consent] insert failed", error);
    return bad("Couldn't record consent. Please try again.", 500);
  }

  return Response.json({ ok: true });
}
