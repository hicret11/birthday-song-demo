import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const price = process.env.STRIPE_FOUNDING_VENUE_PRICE_ID;
  if (!price) {
    return Response.json({ error: { message: "Pricing not configured." } }, { status: 500 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/become-a-venue`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
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
