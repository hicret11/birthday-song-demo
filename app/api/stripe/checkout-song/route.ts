import { after } from "next/server";
import { getStripe } from "@/lib/stripe";
import { resolveTier, priceIdForPlanTier, type Plan } from "@/lib/pricing-tiers";
import { loadSharedSong, markSharedSongUnlocked } from "@/lib/share";
import { isActiveCastCharacterId } from "@/lib/cast/characters";
import { isCallAllowedForPhone } from "@/lib/cast/call-countries";
import { timezoneForPhone } from "@/lib/cast/quiet-hours";
import { getClientIp } from "@/lib/rate-limit";
import { getUserEmail } from "@/lib/user-session";
import { isCompEmail } from "@/lib/comp-emails";
import { launchDiscountPercent, launchCouponId } from "@/lib/launch-pricing";
import { requestPremiumRender } from "@/lib/render-video";
import { createBooking, getAiCallBookingForGift, markBookingPaid } from "@/lib/cast";
import {
  LEGAL_VERSION,
  LEGAL_ACCEPTANCE_SURFACE,
  LEGAL_ACCEPTANCE_VERSION,
} from "@/lib/legal";
import { getGeoContext } from "@/lib/geo";

export const runtime = "nodejs";

/**
 * Consumer one-time checkout to UNLOCK a generated song.
 *
 * Flow: the generate page creates a share (shareId) the moment the song is
 * ready, plays a short free preview, then POSTs { shareId } here. We resolve the
 * buyer's geo tier, pick the matching Stripe price, and open a one-time
 * Checkout Session whose metadata carries the shareId. On success Stripe fires
 * `checkout.session.completed`; the webhook flips the song to unlocked.
 *
 * success_url lands on the share page with ?unlocked=1 so the buyer immediately
 * gets the full song, download, video, and slideshow.
 */
// Loose E.164: leading +, 7–15 digits, first digit non-zero (matches /api/cast/book).
const PHONE_RE = /^\+[1-9]\d{6,14}$/;

/**
 * Retrieve-or-create the deterministic launch coupon for `percent` (id
 * "launch-<pct>pct"). Idempotent: the fixed id means concurrent checkouts reuse
 * the same coupon instead of piling up duplicates. Returns null on any Stripe
 * error so a coupon hiccup degrades to full-price checkout rather than blocking
 * the sale.
 */
async function ensureLaunchCoupon(
  stripe: ReturnType<typeof getStripe>,
  percent: number,
): Promise<string | null> {
  const id = launchCouponId(percent);
  try {
    const existing = await stripe.coupons.retrieve(id);
    return existing.id;
  } catch {
    // Not found (or transient) — try to create it below.
  }
  try {
    const created = await stripe.coupons.create({
      id,
      percent_off: percent,
      duration: "once",
      name: `Launch ${percent}% off`,
    });
    return created.id;
  } catch (err) {
    // A concurrent request may have created it between our retrieve and create
    // (id collision) — one more retrieve resolves the race so we don't drop this
    // buyer to full price.
    try {
      const raced = await stripe.coupons.retrieve(id);
      return raced.id;
    } catch {
      console.error(
        "[checkout-song] launch coupon ensure failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: {
    shareId?: unknown;
    plan?: unknown;
    call?: { characterId?: unknown; phone?: unknown; scheduledAt?: unknown };
    consent?: unknown;
    consentText?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: { message: "Invalid request." } }, { status: 400 });
  }

  const shareId = typeof body.shareId === "string" ? body.shareId.trim() : "";
  if (!/^[a-zA-Z0-9]{1,32}$/.test(shareId)) {
    return Response.json({ error: { message: "Missing or invalid shareId." } }, { status: 400 });
  }

  // Plan selection (good-better-best). Defaults to Standard ("full"); "deluxe"
  // adds the slideshow video, "production" adds the AI character call. Anything
  // else is treated as "full".
  const plan: Plan =
    body.plan === "production" ? "production" : body.plan === "deluxe" ? "deluxe" : "full";

  // Production bundles an AI character call, so it MUST carry valid call details
  // (character + recipient phone + the giver's consent attestation). We validate
  // here and stash them in the checkout metadata; the webhook creates the booking
  // on payment. Reject an under-specified Production checkout rather than sell a
  // call with no number to dial.
  let callCharacterId = "";
  let callPhone = "";
  let callWhen = "";
  if (plan === "production") {
    const rawChar = typeof body.call?.characterId === "string" ? body.call.characterId : "";
    const rawPhone = typeof body.call?.phone === "string" ? body.call.phone.trim() : "";
    if (!isActiveCastCharacterId(rawChar)) {
      return Response.json({ error: { message: "Pick a character for the birthday call." } }, { status: 400 });
    }
    if (!PHONE_RE.test(rawPhone)) {
      return Response.json(
        { error: { message: "Enter the recipient's phone in international format (e.g. +15551234567)." } },
        { status: 400 },
      );
    }
    // The AI call is only offered to recipients in the allowlisted countries
    // (the rest of the product stays global). Gate the call, not the purchase.
    if (!isCallAllowedForPhone(rawPhone)) {
      return Response.json(
        { error: { message: "The birthday call isn't available for that country's number yet." } },
        { status: 400 },
      );
    }
    if (body.consent !== true) {
      return Response.json(
        { error: { message: "Please confirm you have their permission to receive the call." } },
        { status: 400 },
      );
    }
    callCharacterId = rawChar;
    callPhone = rawPhone;
    // Optional ISO timestamp for when to place the call; empty = as soon as due.
    if (typeof body.call?.scheduledAt === "string" && body.call.scheduledAt) {
      const t = Date.parse(body.call.scheduledAt);
      if (!Number.isNaN(t)) callWhen = new Date(t).toISOString();
    }
  }

  const song = await loadSharedSong(shareId);
  if (!song) {
    return Response.json({ error: { message: "Song not found or expired." } }, { status: 404 });
  }
  if (song.unlocked) {
    // Already paid — short-circuit straight to the unlocked page.
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    return Response.json({ url: `${origin}/share/${shareId}?unlocked=1`, alreadyUnlocked: true });
  }

  // ── Admin comp (free unlock) ────────────────────────────────────────────────
  // Trusted team addresses unlock without paying so we can dogfood the full
  // buyer flow. The email comes ONLY from the verified magic-link session
  // (ownership-proven), never from the request body — a client can't forge it.
  // We mirror the Stripe webhook's post-unlock side effects (flip to unlocked +
  // kick the premium render, and book the AI call on Production) so a comped
  // song is byte-for-byte the same deliverable a paying buyer gets.
  const sessionEmail = await getUserEmail();
  if (isCompEmail(sessionEmail)) {
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const ok = await markSharedSongUnlocked(shareId, plan);
    if (!ok) {
      return Response.json({ error: { message: "Song not found or expired." } }, { status: 404 });
    }
    console.log(`[checkout-song] comped unlock for ${sessionEmail} → ${shareId} (${plan})`);
    after(
      (async () => {
        const unlocked = await loadSharedSong(shareId);
        if (unlocked) await requestPremiumRender(unlocked);
        // Production bundles the AI character call — create + mark the booking
        // paid so it behaves identically to a purchased Production. Idempotent
        // (one ai_call booking per share). Best-effort; never blocks the unlock.
        if (plan === "production" && unlocked) {
          try {
            const existing = await getAiCallBookingForGift(shareId);
            if (!existing) {
              const booking = await createBooking({
                giftId: shareId,
                kind: "ai_call",
                characterId: callCharacterId || "zoltar",
                recipientName: unlocked.name,
                recipientPhone: callPhone || null,
                language: unlocked.language,
                personalNote: unlocked.directorNote?.text ?? null,
                scheduledAt: callWhen || null,
                consentConfirmed: body.consent === true,
                consentIp: getClientIp(request).slice(0, 64),
                consentAttestation:
                  typeof body.consentText === "string" ? body.consentText.trim().slice(0, 300) : null,
                consentAt: new Date().toISOString(),
                recipientTimezone: timezoneForPhone(callPhone) || null,
              });
              if (booking) await markBookingPaid(booking.id, `comp:${shareId}`);
            }
          } catch (err) {
            console.error("[checkout-song] comp production booking failed:", err);
          }
        }
      })().catch(() => undefined),
    );
    return Response.json({ url: `${origin}/share/${shareId}?unlocked=1&comped=1`, comped: true });
  }

  // Tier the song was created at wins if present (so the price can't change
  // between preview and checkout); otherwise resolve from this request's geo.
  const tier = song.tier ?? resolveTier(request);
  // priceIdForPlanTier falls back to the Standard "full" price when a Deluxe
  // price isn't configured for this tier — so Deluxe checkout keeps working
  // pre-config (the buyer just pays the Standard price until Deluxe SKUs exist).
  const price = priceIdForPlanTier(plan, tier);
  if (!price) {
    console.error(`[checkout-song] no Stripe price_id configured for tier ${tier}`);
    return Response.json({ error: { message: "Pricing not configured." } }, { status: 500 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const stripe = getStripe();

  const geo = getGeoContext(request);
  const metadata: Record<string, string> = {
    kind: "song_unlock",
    share_id: shareId,
    tier,
    plan,
    terms_version: LEGAL_VERSION,
    acceptance_surface: LEGAL_ACCEPTANCE_SURFACE,
    acceptance_version: LEGAL_ACCEPTANCE_VERSION,
    accepted_at: new Date().toISOString(),
  };
  if (geo.country) metadata.accept_country = geo.country;
  if (geo.region) metadata.accept_region = geo.region;
  // Production call details — the webhook books the AI call from these on payment.
  // We also persist consent evidence (giver-attests model): the client IP, the
  // exact attestation wording the giver agreed to, and a representative recipient
  // timezone (for the quiet-hours guard). accepted_at above is the consent time.
  if (plan === "production") {
    metadata.call_character = callCharacterId;
    metadata.call_phone = callPhone;
    if (callWhen) metadata.call_when = callWhen;
    metadata.call_consent = "1";
    metadata.consent_ip = getClientIp(request).slice(0, 64);
    const consentText =
      typeof body.consentText === "string" ? body.consentText.trim().slice(0, 300) : "";
    if (consentText) metadata.consent_text = consentText;
    const tz = timezoneForPhone(callPhone);
    if (tz) metadata.call_tz = tz;
  }

  try {
    // For a scheduled premiere, carry the giver's preview token back on the
    // success redirect so the buyer lands on their unlocked song, not the
    // recipient countdown gate.
    const previewSuffix = song.previewToken ? `&preview=${song.previewToken}` : "";

    // Launch discount: when NEXT_PUBLIC_LAUNCH_DISCOUNT_PERCENT is set we
    // auto-apply a matching coupon so the buyer sees the lower price with zero
    // friction. Checkout forbids `discounts` and `allow_promotion_codes`
    // together, so we pick one: during a launch, the auto-discount; otherwise
    // the promo-code field (which the admin ADMINCOMP fallback uses).
    const launchPct = launchDiscountPercent();
    const launchCoupon = launchPct > 0 ? await ensureLaunchCoupon(stripe, launchPct) : null;
    if (launchCoupon) metadata.launch_percent = String(launchPct);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: shareId,
      success_url: `${origin}/share/${shareId}?unlocked=1&session_id={CHECKOUT_SESSION_ID}${previewSuffix}`,
      cancel_url: `${origin}/share/${shareId}`,
      ...(launchCoupon
        ? { discounts: [{ coupon: launchCoupon }] }
        : { allow_promotion_codes: true }),
      metadata,
      payment_intent_data: { metadata },
    });

    if (!session.url) {
      return Response.json({ error: { message: "Stripe did not return a checkout URL." } }, { status: 502 });
    }
    return Response.json({ url: session.url, id: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "checkout failed";
    console.error("[checkout-song] failed:", message);
    return Response.json({ error: { message: "Couldn't start checkout. Please try again." } }, { status: 502 });
  }
}
