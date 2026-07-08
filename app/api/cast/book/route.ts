// Book a cast experience.
//
// POST /api/cast/book
//   AI call (kind "ai_call", default):
//     { characterId, recipientName, recipientPhone, language?, personalNote?,
//       scheduledAt?, consent, giftId? }
//   Live, in-person (kind "live_musician" | "character_visit"):
//     { kind, recipientName, eventDate, city, addressNote?, personalNote?,
//       contactPhone?, contactEmail?, consent, giftId? }
//
// Creates a PENDING booking; payment (Stripe checkout) flips it to scheduled.
// Consent is REQUIRED for every kind. Free text is moderated. The live cast is a
// concierge pilot gated to CAST_LIVE_CITIES — off entirely when that's unset.

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";
import { moderateShareInput } from "@/lib/moderation";
import { createBooking } from "@/lib/cast";
import { getCharacter } from "@/lib/cast/characters";
import { timezoneForPhone } from "@/lib/cast/quiet-hours";
import { isCallAllowedForPhone } from "@/lib/cast/call-countries";
import {
  isLiveKind,
  isLiveCastEnabled,
  isLiveCityAllowed,
  liveDepositUsd,
  getLiveCities,
} from "@/lib/cast/live";

export const runtime = "nodejs";

const BOOKER_COOKIE = "smb_booker";
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
// Loose E.164: leading +, 7–15 digits, first digit non-zero.
const PHONE_RE = /^\+[1-9]\d{6,14}$/;
const ID_RE = /^[a-zA-Z0-9]{1,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function stripControl(s: string): string {
  return s.replace(/\p{Cc}/gu, "");
}

function str(v: unknown, max: number): string {
  return stripControl(typeof v === "string" ? v : "").trim().slice(0, max);
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  try {
    const rate = await rateLimitFixedWindow(
      `rate:cast-book:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      { request, ip },
    );
    if (!rate.allowed) {
      return jsonError("RATE_LIMITED", "Too many bookings — try again a little later.", 429);
    }
  } catch (err) {
    console.error("[cast-book] rate-limit KV failure:", err);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  if (body.consent !== true) {
    return jsonError("CONSENT_REQUIRED", "Please confirm consent before booking.", 400);
  }

  const kind = typeof body.kind === "string" ? body.kind : "ai_call";
  const giftId = typeof body.giftId === "string" && ID_RE.test(body.giftId) ? body.giftId : null;

  // Anonymous, stable booker identity via a first-party cookie.
  const jar = await cookies();
  let token = jar.get(BOOKER_COOKIE)?.value;
  let setCookie = false;
  if (!token || token.length < 8) {
    token = randomUUID();
    setCookie = true;
  }

  function withCookie(res: Response): Response {
    if (setCookie) {
      res.headers.append(
        "Set-Cookie",
        `${BOOKER_COOKIE}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 90}; HttpOnly; SameSite=Lax`,
      );
    }
    return res;
  }

  // ── Live, in-person cast (concierge pilot) ───────────────────────────────
  if (isLiveKind(kind)) {
    if (!isLiveCastEnabled()) {
      return jsonError("NOT_AVAILABLE", "Live performers aren't available yet — check back soon.", 403);
    }

    const recipientName = str(body.recipientName, 80);
    if (!recipientName) return jsonError("INVALID_INPUT", "Who is the celebration for?", 400);

    const city = str(body.city, 80);
    if (!city || !isLiveCityAllowed(city)) {
      return jsonError(
        "CITY_NOT_SERVED",
        `We're only in ${getLiveCities().join(", ") || "a pilot city"} right now.`,
        400,
      );
    }

    const eventDate = str(body.eventDate, 10);
    if (!DATE_RE.test(eventDate) || Number.isNaN(Date.parse(eventDate))) {
      return jsonError("INVALID_INPUT", "Pick a valid event date.", 400);
    }

    const addressNote = str(body.addressNote, 200) || null;
    const personalNote = str(body.personalNote, 400) || null;

    const contactPhone = str(body.contactPhone, 30) || null;
    const contactEmail = str(body.contactEmail, 120) || null;
    const phoneOk = contactPhone ? (contactPhone.match(/\d/g)?.length ?? 0) >= 7 : false;
    const emailOk = contactEmail ? EMAIL_RE.test(contactEmail) : false;
    if (!phoneOk && !emailOk) {
      return jsonError("INVALID_INPUT", "Add a phone or email so we can reach you to confirm.", 400);
    }

    const mod = await moderateShareInput([recipientName, personalNote, addressNote]);
    if (!mod.allowed) {
      return jsonError("MODERATION", "That didn't pass our content check — try rephrasing.", 422);
    }

    const booking = await createBooking({
      giftId,
      kind,
      characterId: kind, // sentinel: no character library selection for live
      recipientName,
      language: "English",
      personalNote,
      consentConfirmed: true,
      bookerToken: token,
      city,
      eventDate,
      addressNote,
      contactPhone: phoneOk ? contactPhone : null,
      contactEmail: emailOk ? contactEmail : null,
    });
    if (!booking) {
      return jsonError("INTERNAL", "Couldn't save the booking — please try again.", 502);
    }

    return withCookie(
      Response.json({
        ok: true,
        booking: {
          id: booking.id,
          kind: booking.kind,
          recipientName: booking.recipientName,
          city: booking.city,
          eventDate: booking.eventDate,
          status: booking.status,
          priceUsd: liveDepositUsd(),
        },
        nextStep: "payment",
      }),
    );
  }

  // ── AI character phone call (default) ────────────────────────────────────
  const character = getCharacter(typeof body.characterId === "string" ? body.characterId : "");
  // Only characters currently offered to bookers can be booked (launch gate); the
  // full library still resolves for already-scheduled bookings elsewhere.
  if (!character || !character.active) return jsonError("INVALID_INPUT", "Pick a character for the call.", 400);

  const recipientName = str(body.recipientName, 80);
  if (!recipientName) return jsonError("INVALID_INPUT", "Who is the call for?", 400);

  const recipientPhone = typeof body.recipientPhone === "string" ? body.recipientPhone.trim() : "";
  if (!PHONE_RE.test(recipientPhone)) {
    return jsonError("INVALID_INPUT", "Enter a valid phone number in international format (e.g. +15551234567).", 400);
  }
  // Country allowlist — the AI call is only placed to recipients in supported
  // countries (the rest of the product stays global).
  if (!isCallAllowedForPhone(recipientPhone)) {
    return jsonError("INVALID_INPUT", "The birthday call isn't available for that country's number yet.", 400);
  }

  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim().slice(0, 40)
      : "English";
  const personalNote = str(body.personalNote, 400) || null;

  let scheduledAt: string | null = null;
  if (typeof body.scheduledAt === "string" && body.scheduledAt) {
    const t = Date.parse(body.scheduledAt);
    if (!Number.isNaN(t)) scheduledAt = new Date(t).toISOString();
  }

  const mod = await moderateShareInput([recipientName, personalNote]);
  if (!mod.allowed) {
    return jsonError("MODERATION", "That didn't pass our content check — try rephrasing.", 422);
  }

  // Consent evidence (giver-attests model) — the exact wording the booker agreed
  // to (client-supplied), their IP, and the time. Persisted as a burden-of-proof
  // trail. recipient_timezone drives the quiet-hours guard in the scheduler.
  const consentText = str(body.consentText, 300) || "Booker attested the recipient consents to the call.";
  const booking = await createBooking({
    giftId,
    kind: "ai_call",
    characterId: character.id,
    recipientName,
    recipientPhone,
    language,
    personalNote,
    scheduledAt,
    consentConfirmed: true,
    bookerToken: token,
    consentIp: ip.slice(0, 64),
    consentAttestation: consentText,
    consentAt: new Date().toISOString(),
    recipientTimezone: timezoneForPhone(recipientPhone),
  });
  if (!booking) {
    return jsonError("INTERNAL", "Couldn't save the booking — please try again.", 502);
  }

  return withCookie(
    Response.json({
      ok: true,
      booking: {
        id: booking.id,
        characterId: booking.characterId,
        characterName: character.name,
        recipientName: booking.recipientName,
        status: booking.status,
        priceUsd: character.priceUsd,
        scheduledAt: booking.scheduledAt,
      },
      nextStep: "payment",
    }),
  );
}
