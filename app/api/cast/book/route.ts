// Book a cast experience (currently the AI character birthday call).
//
// POST /api/cast/book
//   { characterId, recipientName, recipientPhone, language?, personalNote?,
//     scheduledAt?, consent, giftId? }
//
// Creates a pending booking. Consent is REQUIRED — the booker attests the
// recipient agrees to receive an AI call (we won't cold-call strangers). The
// personal note is moderated. Payment is a separate step (Stripe checkout) that
// flips the booking to scheduled on success — wired in a follow-up; this route
// creates the record and returns it.

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";
import { moderateShareInput } from "@/lib/moderation";
import { createBooking } from "@/lib/cast";
import { getCharacter } from "@/lib/cast/characters";

export const runtime = "nodejs";

const BOOKER_COOKIE = "smb_booker";
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
// Loose E.164: leading +, 7–15 digits, first digit non-zero.
const PHONE_RE = /^\+[1-9]\d{6,14}$/;
const ID_RE = /^[a-zA-Z0-9]{1,32}$/;

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function stripControl(s: string): string {
  return s.replace(/[\u0000-\u001F\u007F]/g, "");
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

  let body: {
    characterId?: unknown;
    recipientName?: unknown;
    recipientPhone?: unknown;
    language?: unknown;
    personalNote?: unknown;
    scheduledAt?: unknown;
    consent?: unknown;
    giftId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  const characterId = typeof body.characterId === "string" ? body.characterId : "";
  const character = getCharacter(characterId);
  if (!character) return jsonError("INVALID_INPUT", "Pick a character for the call.", 400);

  const recipientName = stripControl(typeof body.recipientName === "string" ? body.recipientName : "")
    .trim()
    .slice(0, 80);
  if (!recipientName) return jsonError("INVALID_INPUT", "Who is the call for?", 400);

  const recipientPhone = typeof body.recipientPhone === "string" ? body.recipientPhone.trim() : "";
  if (!PHONE_RE.test(recipientPhone)) {
    return jsonError("INVALID_INPUT", "Enter a valid phone number in international format (e.g. +15551234567).", 400);
  }

  // Consent is mandatory — we never cold-call. The booker attests the recipient
  // agrees to receive a fun AI birthday call.
  if (body.consent !== true) {
    return jsonError("CONSENT_REQUIRED", "Please confirm the birthday person is happy to receive the call.", 400);
  }

  const language = typeof body.language === "string" && body.language.trim() ? body.language.trim().slice(0, 40) : "English";
  const personalNote = stripControl(typeof body.personalNote === "string" ? body.personalNote : "")
    .trim()
    .slice(0, 400) || null;

  const giftId = typeof body.giftId === "string" && ID_RE.test(body.giftId) ? body.giftId : null;

  let scheduledAt: string | null = null;
  if (typeof body.scheduledAt === "string" && body.scheduledAt) {
    const t = Date.parse(body.scheduledAt);
    if (!Number.isNaN(t)) scheduledAt = new Date(t).toISOString();
  }

  // Moderate the free-text (recipient name + personal note).
  const mod = await moderateShareInput([recipientName, personalNote]);
  if (!mod.allowed) {
    return jsonError("MODERATION", "That didn't pass our content check — try rephrasing.", 422);
  }

  // Anonymous booker identity.
  const jar = await cookies();
  let token = jar.get(BOOKER_COOKIE)?.value;
  let setCookie = false;
  if (!token || token.length < 8) {
    token = randomUUID();
    setCookie = true;
  }

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
  });
  if (!booking) {
    return jsonError("INTERNAL", "Couldn't save the booking — please try again.", 502);
  }

  const res = Response.json({
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
    // Payment is the next step: create a Stripe checkout for character.priceUsd,
    // and on success flip the booking to "scheduled".
    nextStep: "payment",
  });
  if (setCookie) {
    res.headers.append(
      "Set-Cookie",
      `${BOOKER_COOKIE}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 90}; HttpOnly; SameSite=Lax`,
    );
  }
  return res;
}
