import { after } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { mintPortalToken } from "@/lib/portal-tokens";
import { requestPremiumRender } from "@/lib/render-video";
import { sendDunningEmail } from "@/lib/resend";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadSharedSong, markSharedSongUnlocked } from "@/lib/share";
import { markBookingPaid } from "@/lib/cast";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singmybirthday.com";
const DUNNING_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export const runtime = "nodejs";

const RELEVANT: Set<string> = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set");
    return new Response("webhook secret not configured", { status: 500 });
  }

  const sig = (await headers()).get("stripe-signature");
  if (!sig) return new Response("missing stripe-signature", { status: 400 });

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    console.error("[stripe-webhook] signature verification failed:", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  if (!RELEVANT.has(event.type)) {
    return Response.json({ received: true, ignored: event.type });
  }

  try {
    await handleEvent(event, stripe);
    return Response.json({ received: true, type: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler failed";
    console.error(`[stripe-webhook] handler failed for ${event.type}:`, message);
    return new Response(`handler error: ${message}`, { status: 500 });
  }
}

function readPeriodEnd(sub: Stripe.Subscription): string | null {
  const subWithLegacy = sub as Stripe.Subscription & { current_period_end?: number | null };
  const item = sub.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number | null }) | undefined;
  const unix = subWithLegacy.current_period_end ?? item?.current_period_end ?? null;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

// Record purchase-time legal acceptance evidence. The acceptance was captured at
// checkout (the "By continuing, you agree…" notice on /become-a-venue) and
// stamped onto the subscription's metadata there. Append-only and deduped by
// (stripe_subscription_id, acceptance_version) so repeat subscription.updated
// events are harmless. Best-effort: any failure is logged, never thrown, so it
// cannot affect the venue subscription upsert or the webhook acknowledgement.
async function persistLegalAcceptance(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  args: {
    sub: Stripe.Subscription;
    customerId: string;
    email: string | null;
    priceId: string | null;
  },
): Promise<void> {
  const md = args.sub.metadata ?? {};
  const termsVersion = md.terms_version;
  // Only record when the instrumented checkout stamped acceptance. Legacy or
  // un-instrumented subscriptions never showed the acceptance notice.
  if (!termsVersion) return;

  const acceptanceVersion = md.acceptance_version || termsVersion;
  const acceptedAtRaw = md.accepted_at;
  const acceptedAt =
    acceptedAtRaw && !Number.isNaN(Date.parse(acceptedAtRaw))
      ? new Date(acceptedAtRaw).toISOString()
      : null;

  const row = {
    accepted_at: acceptedAt,
    email: args.email,
    terms_version: termsVersion,
    privacy_version: md.privacy_version || termsVersion,
    acceptance_surface: md.acceptance_surface || "checkout",
    acceptance_version: acceptanceVersion,
    stripe_customer_id: args.customerId,
    stripe_subscription_id: args.sub.id,
    stripe_price_id: args.priceId,
    country: md.accept_country ?? null,
    region: md.accept_region ?? null,
  };

  const { error } = await supabase
    .from("legal_acceptance")
    .upsert(row, {
      onConflict: "stripe_subscription_id,acceptance_version",
      ignoreDuplicates: true,
    });
  if (error) {
    console.error("[stripe-webhook] legal_acceptance persist failed:", error.message);
  }
}

async function handleEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  // Consumer song unlock (one-time payment) — handled first because it needs
  // neither Supabase nor Stripe customer lookups. Venue subscriptions also emit
  // checkout.session.completed (mode "subscription"); those are persisted via
  // the customer.subscription.* events, so we only act on song_unlock payments.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "payment" && session.metadata?.kind === "song_unlock") {
      const shareId = session.metadata.share_id || session.client_reference_id || "";
      const plan: "full" | "deluxe" = session.metadata.plan === "deluxe" ? "deluxe" : "full";
      if (shareId) {
        const ok = await markSharedSongUnlocked(shareId, plan);
        if (!ok) console.error(`[stripe-webhook] song_unlock: share ${shareId} not found (KV expired?)`);
        else {
          console.log(`[stripe-webhook] song_unlock: ${shareId} unlocked`);
          // Fire-and-forget the premium Remotion render (no-op unless
          // RENDER_WORKER_URL is set). Kept non-blocking via after() so the
          // webhook acknowledges Stripe immediately. Best-effort — never throws.
          after(
            (async () => {
              const song = await loadSharedSong(shareId);
              if (song) await requestPremiumRender(song);
            })().catch(() => undefined),
          );
        }
      } else {
        console.error("[stripe-webhook] song_unlock: missing share_id in metadata");
      }
      return;
    }

    // Cast booking (AI character call) — a separate one-time payment. Advance
    // the booking to "scheduled" and store the payment id; the scheduler then
    // places the call. Idempotent: markBookingPaid only advances a still-pending
    // booking, so a re-delivered event is a harmless no-op. The song_unlock path
    // above is untouched.
    if (session.mode === "payment" && session.metadata?.kind === "cast_booking") {
      const bookingId = session.metadata.booking_id || session.client_reference_id || "";
      if (bookingId) {
        const paymentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || session.id;
        const updated = await markBookingPaid(bookingId, paymentId);
        if (updated) console.log(`[stripe-webhook] cast_booking: ${bookingId} scheduled`);
        else console.log(`[stripe-webhook] cast_booking: ${bookingId} not pending (already handled?)`);
      } else {
        console.error("[stripe-webhook] cast_booking: missing booking_id in metadata");
      }
      return;
    }
    return;
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;
    const email = customer.email ?? null;

    const priceId = sub.items.data[0]?.price.id ?? null;

    // Best-effort, before the venue upsert so acceptance evidence is attempted
    // even if the venue write later fails. Never throws.
    try {
      await persistLegalAcceptance(supabase, { sub, customerId, email, priceId });
    } catch (err) {
      console.error("[stripe-webhook] legal_acceptance persist threw:", err);
    }

    const payload: Record<string, unknown> = {
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      subscription_status: sub.status,
      current_period_end: readPeriodEnd(sub),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: nowIso,
    };
    if (email) payload.email = email;
    // Clear past-due markers if the subscription has recovered.
    if (sub.status === "active" || sub.status === "trialing") {
      payload.past_due_since = null;
    }

    const { error } = await supabase
      .from("venues")
      .upsert(payload, { onConflict: "stripe_customer_id" });
    if (error) throw new Error(error.message);
    return;
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const { error } = await supabase
      .from("venues")
      .update({
        subscription_status: "canceled",
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        updated_at: nowIso,
      })
      .eq("stripe_customer_id", customerId);
    if (error) throw new Error(error.message);
    return;
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
    if (!customerId) return;

    // Read the existing row first so we (a) preserve the first past_due_since
    // when the customer is already in dunning, and (b) have venue.email / slug
    // for the recovery message.
    const { data: existing, error: readErr } = await supabase
      .from("venues")
      .select("email, venue_name, share_slug, past_due_since")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) return; // unknown customer — nothing to do

    const pastDueSince = existing.past_due_since ?? nowIso;
    const { error } = await supabase
      .from("venues")
      .update({
        subscription_status: "past_due",
        past_due_since: pastDueSince,
        updated_at: nowIso,
      })
      .eq("stripe_customer_id", customerId);
    if (error) throw new Error(error.message);

    // Recovery hook: mint a 24-hour magic-link token and email it to the
    // venue's stored address. Best-effort, never throws.
    if (existing.email && existing.share_slug) {
      try {
        const token = await mintPortalToken(
          { stripe_customer_id: customerId, slug: existing.share_slug },
          DUNNING_TOKEN_TTL_SECONDS,
        );
        const portalUrl = `${SITE_URL}/api/venue/portal-session?token=${token}`;
        await sendDunningEmail({
          to: existing.email,
          venueName: existing.venue_name ?? "your venue",
          shareSlug: existing.share_slug,
          portalUrl,
        });
      } catch (err) {
        console.error("[stripe-webhook] dunning dispatch failed", err);
      }
    }
    return;
  }
}
