// Annual birthday-reminder cron (repeat-purchase / LTV).
//
// Runs daily (see vercel.json). Computes the calendar month-day exactly 7 days
// out from "today" (UTC), pulls everyone enrolled for that birthday, and sends
// each a warm "make this year's song" nudge — once per season, guarded by a
// per-(month-day, year, email+name) sent key so repeated daily runs (and the
// overlapping ~7-day window) never double-send.
//
// Consent was already enforced at enrollment time (the share route only enrolls
// buyers who gave an email, a valid birthday, AND opted into the year reminder),
// so this cron just delivers to people who already said yes.
//
// Auth: requires `authorization: Bearer ${CRON_SECRET}`. Vercel Cron sends this
// header automatically when CRON_SECRET is configured. 401 otherwise. (Mirrors
// app/api/cron/recover-previews/route.ts.)

import {
  getBirthdayRemindersForDay,
  markBirthdayReminderSent,
  wasBirthdayReminderSent,
} from "@/lib/birthday-reminders";
import { sendBirthdayReminderEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar month-day "MM-DD" for `date` in UTC.
function monthDayUTC(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Target = today + 7 days (UTC). We use UTC consistently for the day key and
  // the season-guard year so the cron's wall-clock timezone can't shift which
  // bucket we scan.
  const target = new Date(Date.now() + 7 * DAY_MS);
  const day = monthDayUTC(target);
  const year = target.getUTCFullYear();

  let sent = 0;

  const enrollments = await getBirthdayRemindersForDay(day);

  for (const enrollment of enrollments) {
    try {
      const already = await wasBirthdayReminderSent(
        day,
        year,
        enrollment.email,
        enrollment.name,
      );
      if (already) continue;

      await sendBirthdayReminderEmail({
        to: enrollment.email,
        recipientName: enrollment.name,
      });
      await markBirthdayReminderSent(day, year, enrollment.email, enrollment.name);
      sent += 1;
    } catch (err) {
      // One bad enrollment must not abort the whole batch.
      console.error(`[birthday-reminders] failed processing ${enrollment.email} day=${day}`, err);
    }
  }

  return Response.json({ day, sent });
}
