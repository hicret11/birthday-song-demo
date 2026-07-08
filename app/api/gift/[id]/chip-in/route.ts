// Chip in toward a group gift (split payment).
//
// POST /api/gift/[id]/chip-in  { amountCents }
// - id = KV share id of the gift (must exist and still be locked).
// - Opens a one-time Stripe Checkout for the contributor's chosen amount, using
//   inline price_data (like /api/cast/checkout) so there's no SKU to provision.
// - metadata carries { kind: "gift_chip_in", gift_id, contributor_token,
//   amount_cents }; on success the shared webhook records the paid contribution
//   and, once the running total reaches the gift's price, unlocks the song via
//   the SAME markSharedSongUnlocked path a solo purchase uses.
//
// Gated by GROUP_PAY_ENABLED (off by default): disabled ⇒ 404, so the feature
// has zero effect on the existing solo checkout / paywall until switched on.

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { loadSharedSong } from "@/lib/share";
import {
  isGroupPayEnabled,
  giftPoolTargetCents,
  getChipInProgress,
  MIN_CHIP_IN_CENTS,
} from "@/lib/group-pay";

export const runtime = "nodejs";

const ID_RE = /^[a-zA-Z0-9]{1,32}$/;
const CONTRIBUTOR_COOKIE = "smb_contributor";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Feature gate — off by default. A disabled feature must be indistinguishable
  // from "route doesn't exist" so it can't be probed.
  if (!isGroupPayEnabled()) return jsonError("Not found.", 404);

  const { id } = await params;
  if (!ID_RE.test(id)) return jsonError("Missing or invalid gift id.", 400);

  let body: { amountCents?: unknown };
  try {
    body = (await request.json()) as { amountCents?: unknown };
  } catch {
    return jsonError("Invalid request.", 400);
  }

  const song = await loadSharedSong(id);
  if (!song) return jsonError("Gift not found or expired.", 404);

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  // Already funded — nothing left to chip in. Send them to the gift.
  if (song.unlocked) {
    return Response.json({ url: `${origin}/share/${id}`, alreadyUnlocked: true });
  }

  // Validate the amount: a whole number of cents, at least the minimum, and
  // never more than the gift's full price (a single chip-in can cover the whole
  // thing, but not exceed it — pool-level overshoot from a final chip is fine).
  const target = giftPoolTargetCents(song);
  const raw = typeof body.amountCents === "number" ? Math.floor(body.amountCents) : NaN;
  if (!Number.isFinite(raw) || raw < MIN_CHIP_IN_CENTS) {
    return jsonError(`Enter at least $${(MIN_CHIP_IN_CENTS / 100).toFixed(2)}.`, 400);
  }
  const amountCents = Math.min(raw, target);

  // Already fully funded (webhook may not have flipped KV yet) — don't take more.
  const progress = await getChipInProgress(id);
  if (progress.paidCents >= target) {
    return Response.json({ url: `${origin}/share/${id}`, alreadyUnlocked: true });
  }

  // Anonymous, stable contributor identity via a first-party cookie (same one
  // the crowd contributor page uses).
  const jar = await cookies();
  let token = jar.get(CONTRIBUTOR_COOKIE)?.value;
  let setCookie = false;
  if (!token || token.length < 8) {
    token = randomUUID();
    setCookie = true;
  }

  const metadata: Record<string, string> = {
    kind: "gift_chip_in",
    gift_id: id,
    contributor_token: token,
    amount_cents: String(amountCents),
  };

  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Chip in for ${song.name}'s birthday song`,
              description: `A contribution toward unlocking ${song.name}'s group birthday song.`,
            },
          },
        },
      ],
      client_reference_id: id,
      success_url: `${origin}/join/${id}?chipped=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/join/${id}`,
      allow_promotion_codes: true,
      metadata,
      payment_intent_data: { metadata },
    });

    if (!session.url) return jsonError("Stripe did not return a checkout URL.", 502);

    const res = Response.json({ url: session.url, id: session.id });
    if (setCookie) {
      res.headers.append(
        "Set-Cookie",
        `${CONTRIBUTOR_COOKIE}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 90}; HttpOnly; SameSite=Lax`,
      );
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "checkout failed";
    console.error("[gift-chip-in] failed:", message);
    return jsonError("Couldn't start checkout. Please try again.", 502);
  }
}
