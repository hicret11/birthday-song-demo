// Cast-call scheduler cron.
//
// Runs every few minutes (see vercel.json). Picks up cast bookings that are paid
// and due — status "scheduled" with scheduled_at in the past OR null (null means
// "as soon as possible") — and places the AI character call via placeCall.
//
// Idempotency + concurrency safety:
//   - A booking only becomes "scheduled" after the Stripe webhook confirms
//     payment (markBookingPaid), so we never call before it's paid.
//   - Each due booking is atomically claimed "scheduled" → "calling"
//     (claimBookingForCalling). Only the run that wins the claim calls; a second
//     overlapping run sees it already "calling" and skips. placeCall then owns
//     the terminal transition (stays "calling" on success, → "failed" on error).
//
// Clean no-op without telephony creds: if ElevenLabs/Twilio env isn't
// configured we return immediately WITHOUT touching any booking, so they stay
// "scheduled" and are retried once creds are added — nothing is lost or wedged.
//
// Auth: requires `authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends it).

import {
  listDueBookings,
  claimBookingForCalling,
  updateBookingStatus,
} from "@/lib/cast";
import { placeCall, isTelephonyConfigured } from "@/lib/cast/place-call";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_LIMIT = 25;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Clean no-op when telephony isn't configured — don't claim or mutate anything.
  if (!isTelephonyConfigured()) {
    return Response.json({ skipped: "telephony not configured", placed: 0, failed: 0, due: 0 });
  }

  const nowIso = new Date().toISOString();
  const due = await listDueBookings(nowIso, BATCH_LIMIT);

  let placed = 0;
  let failed = 0;
  let skipped = 0;

  for (const booking of due) {
    // Only the AI phone call is placeable here; other kinds are fulfilled
    // elsewhere — leave them scheduled rather than failing them.
    if (booking.kind !== "ai_call") {
      skipped += 1;
      continue;
    }
    try {
      // Atomic claim: only the winner proceeds. Losers (already "calling") skip.
      const won = await claimBookingForCalling(booking.id);
      if (!won) {
        skipped += 1;
        continue;
      }

      const result = await placeCall(booking);
      if (result.placed) {
        placed += 1;
      } else {
        // We already gated on telephony config, so a non-placed result here is a
        // real problem (bad number, unknown character, ElevenLabs error).
        // placeCall marks API errors "failed"; ensure the early-return guards
        // don't leave the booking wedged in "calling".
        failed += 1;
        await updateBookingStatus(booking.id, "failed", result.reason ?? "call not placed");
      }
    } catch (err) {
      // One bad booking must not abort the batch.
      failed += 1;
      console.error(`[cast-calls] failed processing booking=${booking.id}`, err);
      try {
        await updateBookingStatus(
          booking.id,
          "failed",
          err instanceof Error ? err.message.slice(0, 200) : "scheduler error",
        );
      } catch {
        // give up quietly
      }
    }
  }

  return Response.json({ due: due.length, placed, failed, skipped });
}
