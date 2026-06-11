// Raffle / voucher entry endpoint.
//
// Only functional when an active promotion is configured (lib/promotions.ts).
// With no active promotion it rejects every entry — there is no raffle to join.
// Raffle opt-in is kept strictly separate from marketing consent: entering here
// never subscribes the user to marketing.

import { getGeoContext } from "@/lib/geo";
import { resolveActivePromotion } from "@/lib/promotions";
import { recordRaffleEntry } from "@/lib/raffle";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_TEXT_LEN = 120;

type Body = {
  email?: unknown;
  raffle_opt_in?: unknown;
  promotion_id?: unknown;
  marketing_consent?: unknown;
  anonymous_id?: unknown;
  source?: unknown;
};

function bad(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

function clean(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed || null;
}

export async function POST(request: Request): Promise<Response> {
  // Reject when no promotion is active — even a well-formed entry has nowhere
  // to go. resolveActivePromotion also rejects a claimed id that doesn't match.
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Request body must be valid JSON.", 400);
  }

  const promotion = resolveActivePromotion(body.promotion_id);
  if (!promotion) {
    return bad("No active promotion.", 403);
  }

  if (body.raffle_opt_in !== true) {
    return bad("Raffle opt-in is required to enter.", 400);
  }

  const rawEmail = clean(body.email, MAX_EMAIL_LEN);
  const email = rawEmail ? rawEmail.toLowerCase() : null;
  if (!email || !EMAIL_RE.test(email)) {
    return bad("A valid email is required.", 400);
  }

  // Marketing consent is independent and defaults false. Entering the raffle
  // does not imply marketing opt-in.
  const marketingConsent = body.marketing_consent === true;

  const geo = getGeoContext(request);

  const result = await recordRaffleEntry({
    promotionId: promotion.id,
    email,
    eligibilityCountry: geo.country,
    eligibilityRegion: geo.region,
    prizeTermsVersion: promotion.prizeTermsVersion,
    marketingConsent,
    source: clean(body.source, MAX_TEXT_LEN) ?? "raffle-entry",
    anonymousId: clean(body.anonymous_id, MAX_TEXT_LEN),
  });

  if (!result.ok) {
    // Honest: the insert failed (e.g. table not migrated). Non-fatal to surface.
    return Response.json({ ok: false }, { status: 200 });
  }
  return Response.json({ ok: true, duplicate: result.duplicate, promotion_id: promotion.id });
}
