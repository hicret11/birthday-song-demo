import { getStripe } from "@/lib/stripe";
import { getGeoContext } from "@/lib/geo";
import {
  LEGAL_VERSION,
  LEGAL_ACCEPTANCE_SURFACE,
  LEGAL_ACCEPTANCE_VERSION,
} from "@/lib/legal";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const price = process.env.STRIPE_FOUNDING_VENUE_PRICE_ID;
  if (!price) {
    return Response.json({ error: { message: "Pricing not configured." } }, { status: 500 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const stripe = getStripe();

  // Legal acceptance is captured at this moment — the user clicked through the
  // checkout button under the "By continuing, you agree…" notice. Geo must be
  // read here (the later webhook request comes from Stripe, not the user), then
  // carried on the subscription's metadata so the webhook can persist evidence.
  const geo = getGeoContext(request);
  const acceptanceMetadata: Record<string, string> = {
    terms_version: LEGAL_VERSION,
    privacy_version: LEGAL_VERSION,
    acceptance_surface: LEGAL_ACCEPTANCE_SURFACE,
    acceptance_version: LEGAL_ACCEPTANCE_VERSION,
    accepted_at: new Date().toISOString(),
  };
  if (geo.country) acceptanceMetadata.accept_country = geo.country;
  if (geo.region) acceptanceMetadata.accept_region = geo.region;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/become-a-venue`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      // Stamp acceptance onto the subscription so it surfaces as sub.metadata in
      // the customer.subscription.created/updated webhook. Also kept on the
      // session for completeness.
      metadata: acceptanceMetadata,
      subscription_data: { metadata: acceptanceMetadata },
    });

    if (!session.url) {
      return Response.json({ error: { message: "Stripe did not return a checkout URL." } }, { status: 502 });
    }

    return Response.json({ url: session.url, id: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "checkout failed";
    console.error("[stripe-checkout] failed:", message);
    return Response.json({ error: { message: "Couldn't start checkout. Please try again." } }, { status: 502 });
  }
}
