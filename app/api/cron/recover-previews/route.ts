// Abandoned-preview recovery cron.
//
// Runs hourly (see vercel.json). Scans shares that were created + previewed
// but never unlocked (paid), and sends a short escalating reminder sequence
// of up to 3 emails. Once someone pays, the Stripe webhook → markSharedSongUnlocked
// removes them from the pending set, so they drop out of this scan naturally;
// we also defensively re-check the live SharedSong here in case of a race.
//
// Reminder schedule (age measured from createdAt):
//   stage 0 → send reminder #1 after  1h   (gentle)
//   stage 1 → send reminder #2 after 24h   (value/benefit)
//   stage 2 → send reminder #3 after 72h   (final nudge)
//   stage 3 reached, OR age > ~7d (168h)   → removePendingUnlock (stop)
//
// Throttle to max 3: the per-share `stage` counter is the gate — we only send
// when the NEXT stage's age threshold is reached, then bump stage. Once stage
// hits 3 the record is removed, so a fourth email can never go out.
//
// Auth: requires `authorization: Bearer ${CRON_SECRET}`. Vercel Cron sends this
// header automatically when CRON_SECRET is configured. 401 otherwise.

import {
  getPendingUnlock,
  listDuePendingUnlockIds,
  removePendingUnlock,
  setPendingStage,
} from "@/lib/pending-unlocks";
import { sendUnlockReminderEmail } from "@/lib/resend";
import { loadSharedSong } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOUR_MS = 60 * 60 * 1000;

// Minimum age (in hours since createdAt) before each reminder may be sent.
// Indexed by the stage we're ABOUT to send (1, 2, 3).
const STAGE_THRESHOLD_HOURS: Record<number, number> = {
  1: 1,
  2: 24,
  3: 72,
};

const MAX_AGE_HOURS = 168; // ~7 days — give up after this regardless of stage.
const MAX_STAGE = 3;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let scanned = 0;
  let sent = 0;
  let removed = 0;

  const ids = await listDuePendingUnlockIds(Date.now());

  for (const id of ids) {
    scanned += 1;
    try {
      const record = await getPendingUnlock(id);
      if (!record) {
        // Record expired/missing but a set member lingered — clean it up.
        await removePendingUnlock(id);
        removed += 1;
        continue;
      }

      // If they've paid (or the song vanished), stop reminding immediately.
      const song = await loadSharedSong(id);
      if (!song || song.unlocked) {
        await removePendingUnlock(id);
        removed += 1;
        continue;
      }

      const ageHours = (Date.now() - record.createdAt) / HOUR_MS;
      const stage = record.stage;

      // Aged out, or sequence already complete → stop.
      if (stage >= MAX_STAGE || ageHours > MAX_AGE_HOURS) {
        await removePendingUnlock(id);
        removed += 1;
        continue;
      }

      const nextStage = stage + 1;
      const threshold = STAGE_THRESHOLD_HOURS[nextStage];

      // Not yet old enough for the next reminder — leave it for a later run.
      if (threshold === undefined || ageHours < threshold) {
        continue;
      }

      await sendUnlockReminderEmail({
        to: record.email,
        recipientName: record.recipientName,
        shareUrl: record.shareUrl,
        stage: nextStage,
      });
      await setPendingStage(id, nextStage);
      sent += 1;

      // That was the final reminder — retire the record so no 4th can fire.
      if (nextStage >= MAX_STAGE) {
        await removePendingUnlock(id);
        removed += 1;
      }
    } catch (err) {
      // One bad id must not abort the whole batch.
      console.error(`[recover-previews] failed processing id=${id}`, err);
    }
  }

  return Response.json({ scanned, sent, removed });
}
