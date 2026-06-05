// Magic-link redemption endpoint.
//
// Reads ?token=..., consumes it from KV (one-time use), creates a Stripe
// billing portal session, and 302s the user there. Failures redirect back
// to the manage page with an error query param so the UI can explain.

import { consumePortalToken } from "@/lib/portal-tokens";
import { getStripe } from "@/lib/stripe";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fallbackUrl(origin: string, slug: string | null, reason: string): string {
  const path = slug ? `/v/${encodeURIComponent(slug)}/manage` : "/";
  return `${origin}${path}?portal_error=${encodeURIComponent(reason)}`;
}

export async function GET(request: NextRequest): Promise<Response> {
  const url = request.nextUrl;
  const origin = url.origin;
  const token = url.searchParams.get("token") ?? "";

  const payload = await consumePortalToken(token);
  if (!payload) {
    return Response.redirect(fallbackUrl(origin, null, "expired"), 302);
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: payload.stripe_customer_id,
      return_url: `${origin}/v/${encodeURIComponent(payload.slug)}/manage`,
    });
    return Response.redirect(session.url, 302);
  } catch (err) {
    console.error("[portal-session] Stripe error:", err);
    return Response.redirect(fallbackUrl(origin, payload.slug, "stripe_error"), 302);
  }
}
