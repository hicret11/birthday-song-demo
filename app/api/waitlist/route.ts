// waitlist_leads is a consent log. Each capture event is one row.
// Migration history:
//   - waitlist_leads_email_unique on lower(email)        // dropped in COPPA migration
//   - alter column birthday drop not null                // inline gate captures target DOB
//   - target_birthday, target_is_minor, parental_consent_given, parental_consent_at
//   - check waitlist_parental_consent_required_for_minors
//   - target_age integer                                 // inline gate now captures age, target_birthday kept nullable legacy

import { createClient } from "@supabase/supabase-js";
import { recordVenueStat } from "@/lib/venue-stats";
import { LEGAL_VERSION } from "@/lib/legal";
import { getGeoContext } from "@/lib/geo";
import { getActivePromotion } from "@/lib/promotions";
import { recordRaffleEntry } from "@/lib/raffle";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VENUE_SLUG_RE = /^[a-z0-9-]{1,100}$/;
const MIN_AGE = 1;
const MAX_AGE = 120;
// Caps for the optional free-text capture fields. Generous but bounded so a
// malformed/oversized payload can't bloat the consent log. Sanitization never
// rejects the request — it trims to fit.
const MAX_NAME_LEN = 100;
const MAX_SHORT_TEXT_LEN = 80;
const MAX_PROMO_ID_LEN = 64;

type WaitlistBody = {
  email?: unknown;
  birthday?: unknown;
  target_birthday?: unknown;
  target_age?: unknown;
  is_adult?: unknown;
  parental_consent_given?: unknown;
  venue_slug?: unknown;
  // Phase 3: optional structured capture. All additive — absence is fine.
  recipient_name?: unknown;
  language?: unknown;
  genre?: unknown;
  relationship?: unknown;
  marketing_reminder_consent?: unknown;
  raffle_opt_in?: unknown;
  promotion_id?: unknown;
};

function bad(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

// Trim, strip control characters, collapse to a bounded length. Returns null for
// non-strings or empty results — optional capture fields never fail the request.
function sanitizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  let cleaned = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    cleaned += ch;
  }
  cleaned = cleaned.trim().slice(0, maxLen);
  return cleaned || null;
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
  // Explicit under-13 status, derived from the same age signal. This does NOT
  // change the gate (all under-18 minors still require parental consent); it
  // only records the under-13 flag separately for compliance queries.
  let targetUnder13: boolean | null = null;
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
    targetUnder13 = ageNum < 13;
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
    const targetAgeFromDob = ageOnDate(parsed.date, now);
    if (targetIsMinor === null) targetIsMinor = targetAgeFromDob < 18;
    if (targetUnder13 === null) targetUnder13 = targetAgeFromDob < 13;
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
  // Record which policy/consent version was in force when child consent was
  // captured. Only meaningful for a consented minor.
  const childConsentVersion = targetIsMinor === true && consentGiven ? LEGAL_VERSION : null;

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

  // ── Phase 3: optional structured capture ──────────────────────────────────
  // All fields are optional and never gate the request. They describe data the
  // generation form already collects, so the consent log is complete.
  const recipientName = sanitizeText(body.recipient_name, MAX_NAME_LEN);
  const captureLanguage = sanitizeText(body.language, MAX_SHORT_TEXT_LEN);
  const captureGenre = sanitizeText(body.genre, MAX_SHORT_TEXT_LEN);
  const relationship = sanitizeText(body.relationship, MAX_SHORT_TEXT_LEN);

  // Country/region are enriched server-side from edge headers — never trusted
  // from the client. Absent in local dev (stored as null).
  const geo = getGeoContext(request);

  // Marketing/reminder consent is opt-in (default false). It is NEVER recorded
  // as granted on a child-recipient flow, regardless of what the client sends —
  // we do not solicit marketing in a child-directed session.
  const marketingReminderConsent =
    targetIsMinor === true ? false : body.marketing_reminder_consent === true;

  // Raffle opt-in is kept separate from marketing consent and nullable: null
  // means "not offered / not answered". Only recorded when explicitly boolean.
  const raffleOptIn =
    typeof body.raffle_opt_in === "boolean" ? body.raffle_opt_in : null;
  const promotionId = sanitizeText(body.promotion_id, MAX_PROMO_ID_LEN);

  const row: Record<string, unknown> = {
    email,
    birthday: birthdayIso,
    target_birthday: targetBirthdayIso,
    target_age: targetAge,
    target_is_minor: targetIsMinor,
    target_under_13: targetUnder13,
    parental_consent_given: targetIsMinor === true ? true : null,
    parental_consent_at: parentalConsentAt,
    child_consent_version: childConsentVersion,
    venue_slug: venueSlug,
    recipient_name: recipientName,
    language: captureLanguage,
    genre: captureGenre,
    relationship,
    country: geo.country,
    region: geo.region,
    marketing_reminder_consent: marketingReminderConsent,
    raffle_opt_in: raffleOptIn,
    promotion_id: promotionId,
    capture_version: LEGAL_VERSION,
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

  // Raffle/voucher readiness: only when a promotion is actively configured AND
  // the user opted in. With no active promotion this is a no-op — no raffle row
  // is ever created. Best-effort: failure never affects the capture response.
  // Marketing consent is carried independently (raffle opt-in ≠ marketing).
  const activePromotion = getActivePromotion();
  if (activePromotion && raffleOptIn === true) {
    void recordRaffleEntry({
      promotionId: activePromotion.id,
      email,
      eligibilityCountry: geo.country,
      eligibilityRegion: geo.region,
      prizeTermsVersion: activePromotion.prizeTermsVersion,
      marketingConsent: marketingReminderConsent,
      source: "waitlist",
    });
  }

  return Response.json({ ok: true });
}
