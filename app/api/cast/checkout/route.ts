// One-time Stripe Checkout for a cast booking (the AI character birthday call).
//
// POST /api/cast/checkout  { bookingId }
//
// Mirrors app/api/stripe/checkout-song: we load the booking server-side, derive
// the price from the character (never trust the client for price), and open a
// one-time Checkout Session whose metadata carries { kind: "cast_booking",
// booking_id }. On success Stripe fires `checkout.session.completed`; the shared
// webhook flips the booking to "scheduled" and stores the payment id, and the
// scheduler then places the call.
//
// Price uses inline `price_data` rather than a pre-created Stripe price id, so
// there's no SKU to provision — the amount is fixed in code (an AI call uses the
// character's priceUsd; a live booking uses the concierge deposit) and can't be
// tampered with here. On success the shared webhook flips the booking to
// "scheduled" (which, for a live booking, means "paid — awaiting our concierge").

import { getStripe } from "@/lib/stripe";
import { getBooking } from "@/lib/cast";
import { getCharacter } from "@/lib/cast/characters";
import { isLiveKind, liveDepositUsd, liveKindLabel } from "@/lib/cast/live";
import { isTelephonyConfigured } from "@/lib/cast/place-call";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: { bookingId?: unknown };
  try {
    body = (await request.json()) as { bookingId?: unknown };
  } catch {
    return jsonError("Invalid request.", 400);
  }

  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!UUID_RE.test(bookingId)) {
    return jsonError("Missing or invalid bookingId.", 400);
  }

  const booking = await getBooking(bookingId);
  if (!booking) return jsonError("Booking not found or expired.", 404);

  // Derive the line item + price from the booking kind (never trust the client).
  const live = isLiveKind(booking.kind);
  let lineName: string;
  let lineDescription: string;
  let unitAmountCents: number;
  const metadata: Record<string, string> = {
    kind: "cast_booking",
    booking_id: bookingId,
    accepted_at: new Date().toISOString(),
  };

  if (live) {
    lineName = `${liveKindLabel(booking.kind)} — deposit`;
    lineDescription = `Deposit to request a live performer for ${booking.recipientName}${
      booking.city ? ` in ${booking.city}` : ""
    }. We'll contact you to confirm the details.`;
    unitAmountCents = liveDepositUsd() * 100;
    metadata.cast_kind = booking.kind;
  } else {
    // Hard gate (defense in depth): never open checkout for an AI call when
    // outbound telephony is de-armed — the call can't be placed, so we must not
    // take payment. Mirrors the /api/cast/book guard and the hidden client
    // add-on. Auto-clears once ELEVENLABS_* is configured on Production.
    if (!isTelephonyConfigured()) {
      return jsonError("Birthday calls aren't available yet — check back soon.", 403);
    }
    const character = getCharacter(booking.characterId);
    if (!character) return jsonError("Unknown character on this booking.", 400);
    lineName = `${character.name} — AI birthday call`;
    lineDescription = `A personalized AI birthday phone call for ${booking.recipientName}.`;
    unitAmountCents = character.priceUsd * 100;
    metadata.character_id = character.id;
  }

  // Already paid — short-circuit so a double-submit doesn't open a second
  // Checkout. Anything past "pending" means payment already advanced it.
  if (booking.status !== "pending") {
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    return Response.json({ url: `${origin}/cast/booked?booking=${bookingId}`, alreadyPaid: true });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: unitAmountCents,
            product_data: {
              name: lineName,
              description: lineDescription,
            },
          },
        },
      ],
      client_reference_id: bookingId,
      success_url: `${origin}/cast/booked?booking=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: booking.giftId ? `${origin}/share/${booking.giftId}` : `${origin}/`,
      allow_promotion_codes: true,
      metadata,
      payment_intent_data: { metadata },
    });

    if (!session.url) {
      return jsonError("Stripe did not return a checkout URL.", 502);
    }
    return Response.json({ url: session.url, id: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "checkout failed";
    console.error("[cast-checkout] failed:", message);
    return jsonError("Couldn't start checkout. Please try again.", 502);
  }
}
