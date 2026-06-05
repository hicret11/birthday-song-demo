// waitlist_leads is a consent log. Each capture event is one row.
// Migration history:
//   - waitlist_leads_email_unique on lower(email)        // dropped in COPPA migration
//   - alter column birthday drop not null                // inline gate captures target DOB
//   - target_birthday, target_is_minor, parental_consent_given, parental_consent_at
//   - check waitlist_parental_consent_required_for_minors
//   - target_age integer                                 // inline gate now captures age, target_birthday kept nullable legacy

import { createClient } from "@supabase/supabase-js";
import { recordVenueStat } from "@/lib/venue-stats";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VENUE_SLUG_RE = /^[a-z0-9-]{1,100}$/;
const MIN_AGE = 1;
const MAX_AGE = 120;

type WaitlistBody = {
  email?: unknown;
  birthday?: unknown;
  target_birthday?: unknown;
  target_age?: unknown;
  is_adult?: unknown;
  parental_consent_given?: unknown;
  venue_slug?: unknown;
};

function bad(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

function ageOnDate(birthday: Date, today: Date): number {
  let age = today.getUTCFullYear() - birthday.getUTCFullYear();
  const m = today.getUTCMonth() - birthday.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < birthday.getUTCDate())) age--;
  return age;
}

function parseDateString(raw: string, fieldLabel: string): { iso: string; date: Date } | Response {
  if (!DATE_RE.test(raw)) return bad(`${fieldLabel} must be YYYY-MM-DD.`, 400);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return bad(`${fieldLabel} is not a real date.`, 400);
  return { iso: raw, date };
}

export async function POST(request: Request): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return bad("Server is missing Supabase credentials.", 500);
  }

  let body: WaitlistBody;
  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return bad("Request body must be valid JSON.", 400);
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  if (!rawEmail) return bad("Email is required.", 400);
  if (rawEmail.length > MAX_EMAIL_LEN) return bad("Email is too long.", 400);
  const email = rawEmail.toLowerCase();
  if (!EMAIL_RE.test(email)) return bad("Email format looks off.", 400);

  const now = new Date();

  // birthday: optional submitter DOB (legacy waitlist path)
  let birthdayIso: string | null = null;
  let birthdayDate: Date | null = null;
  const rawBirthday = typeof body.birthday === "string" ? body.birthday.trim() : "";
  if (rawBirthday) {
    const parsed = parseDateString(rawBirthday, "Birthday");
    if (parsed instanceof Response) return parsed;
    if (parsed.date.getTime() > now.getTime()) return bad("Birthday can't be in the future.", 400);
    birthdayIso = parsed.iso;
    birthdayDate = parsed.date;
  }

  // target_age: recipient age in years (current inline gate path). Accepts a
  // number or numeric string; bounded to MIN_AGE..MAX_AGE. Drives the COPPA
  // minor determination directly.
  let targetAge: number | null = null;
  let targetIsMinor: boolean | null = null;
  if (body.target_age !== undefined && body.target_age !== null && body.target_age !== "") {
    const rawAge = body.target_age;
    const ageNum =
      typeof rawAge === "number"
        ? rawAge
        : typeof rawAge === "string" && /^\d{1,3}$/.test(rawAge.trim())
          ? Number.parseInt(rawAge.trim(), 10)
          : NaN;
    if (!Number.isInteger(ageNum) || ageNum < MIN_AGE || ageNum > MAX_AGE) {
      return bad(
        `Birthday person's age must be a whole number between ${MIN_AGE} and ${MAX_AGE}.`,
        400,
      );
    }
    targetAge = ageNum;
    targetIsMinor = ageNum < 18;
  }

  // target_birthday: legacy recipient DOB path. Kept nullable for back-compat;
  // only consulted for the minor check when target_age was not supplied.
  let targetBirthdayIso: string | null = null;
  const rawTarget = typeof body.target_birthday === "string" ? body.target_birthday.trim() : "";
  if (rawTarget) {
    const parsed = parseDateString(rawTarget, "Birthday person's date of birth");
    if (parsed instanceof Response) return parsed;
    if (parsed.date.getTime() > now.getTime()) {
      return bad("Birthday person's date of birth can't be in the future.", 400);
    }
    targetBirthdayIso = parsed.iso;
    if (targetIsMinor === null) targetIsMinor = ageOnDate(parsed.date, now) < 18;
  }

  // Adult check: prefer explicit is_adult flag, fall back to submitter birthday age
  let isAdult = false;
  if (typeof body.is_adult === "boolean") {
    isAdult = body.is_adult;
  } else if (birthdayDate) {
    isAdult = ageOnDate(birthdayDate, now) >= 18;
  }
  if (!isAdult) {
    return bad("You must be 18 or older to use this service.", 403);
  }

  // COPPA gate
  const consentGiven = body.parental_consent_given === true;
  if (targetIsMinor === true && !consentGiven) {
    return bad(
      "A parent or legal guardian must consent before we can generate a song for a minor.",
      403,
    );
  }

  const parentalConsentAt = targetIsMinor === true && consentGiven ? now.toISOString() : null;

  // Shape-validate venue_slug only; we store whatever well-formed slug the
  // client claims so the consent log preserves referral source even if that
  // venue later goes inactive. Server-of-truth resolution (with active-status
  // gating) happens at /api/share when binding the song to a venue.
  let venueSlug: string | null = null;
  if (typeof body.venue_slug === "string") {
    const candidate = body.venue_slug.trim().toLowerCase();
    if (candidate && VENUE_SLUG_RE.test(candidate)) {
      venueSlug = candidate;
    }
  }

  const row: Record<string, unknown> = {
    email,
    birthday: birthdayIso,
    target_birthday: targetBirthdayIso,
    target_age: targetAge,
    target_is_minor: targetIsMinor,
    parental_consent_given: targetIsMinor === true ? true : null,
    parental_consent_at: parentalConsentAt,
    venue_slug: venueSlug,
  };

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await supabase.from("waitlist_leads").insert([row]);

  if (error) {
    if (error.code === "23505") {
      return bad("This email is already on the waitlist.", 409);
    }
    if (error.code === "23514") {
      // Check constraint violation — should be unreachable due to upstream validation
      console.error("[waitlist] consent check failed", error);
      return bad("Parental consent is required for minor recipients.", 403);
    }
    console.error("[waitlist] insert failed", error);
    return bad("Couldn't save your capture. Please try again.", 500);
  }

  // Bump the venue's "captures in the last 30 days" stat for the manage page.
  if (venueSlug) {
    void recordVenueStat("capture", venueSlug);
  }

  return Response.json({ ok: true });
}
