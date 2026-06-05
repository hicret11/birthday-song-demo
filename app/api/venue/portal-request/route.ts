// Magic-link request endpoint.
//
// Venue owner submits their slug + email on /v/[slug]/manage. We check the
// email matches the venue's stored email; if yes, mint a short-lived token,
// email a one-time link. Either way we return 200 — never leak which slug/
// email pairs are real.

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { mintPortalToken } from "@/lib/portal-tokens";
import { sendPortalLinkEmail } from "@/lib/resend";
import { SLUG_RE } from "@/lib/venues";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_SECONDS = 30 * 60;

function ok(): Response {
  // Constant-shape response so callers can't distinguish hit/miss.
  return Response.json({ ok: true });
}

export async function POST(request: Request): Promise<Response> {
  let body: { slug?: unknown; email?: unknown };
  try {
    body = (await request.json()) as { slug?: unknown; email?: unknown };
  } catch {
    return Response.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!slug || !SLUG_RE.test(slug) || !email || !EMAIL_RE.test(email)) {
    // Even malformed input gets the same response shape — don't enumerate.
    return ok();
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("venues")
    .select("email, stripe_customer_id, venue_name, share_slug, subscription_status")
    .eq("share_slug", slug)
    .maybeSingle();

  if (error || !data) return ok();
  if (!data.stripe_customer_id || !data.email) return ok();
  if (String(data.email).toLowerCase() !== email) return ok();

  const token = await mintPortalToken(
    { stripe_customer_id: data.stripe_customer_id, slug: data.share_slug ?? slug },
    TOKEN_TTL_SECONDS,
  );

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const portalUrl = `${origin}/api/venue/portal-session?token=${token}`;

  await sendPortalLinkEmail({
    to: email,
    venueName: data.venue_name ?? "your venue",
    portalUrl,
  });

  return ok();
}
