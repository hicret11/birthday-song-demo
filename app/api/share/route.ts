import { after } from "next/server";
import { normalizeClientLyrics } from "@/lib/anthropic";
import {
  ApiError,
  ApiErrorCode,
  CAKE_STYLES,
  CANDLE_COLORS,
  CakeStyle,
  CandleColor,
  PERSONAL_NOTE_MAX_LEN,
  SHARE_TEMPLATES,
  ShareCreateRequest,
  ShareCreateResponse,
  ShareTemplate,
  SharedSong,
  WAIT_CAPTURE_LOCATIONS,
  WAIT_CAPTURE_RELATIONSHIPS,
  WaitCapture,
  WaitCaptureLocation,
  WaitCaptureRelationship,
} from "@/lib/api-types";
import { resolveTier } from "@/lib/pricing-tiers";
import { uploadToR2 } from "@/lib/r2";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";
import { sendSongReadyEmail } from "@/lib/resend";
import { logGenerationEvent } from "@/lib/events";
import { generateShareId, saveSharedSong } from "@/lib/share";
import { renderShareVideo } from "@/lib/video";
import { loadActiveVenue } from "@/lib/venues";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;

function sanitizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  if (!lower || lower.length > MAX_EMAIL_LEN) return null;
  if (!EMAIL_RE.test(lower)) return null;
  return lower;
}

export const runtime = "nodejs";
// 120s buffer: ffmpeg drawtext re-encode at 720p typically completes in
// 20–35s on the Vercel sandbox, but cold starts + audio fetch + R2 upload
// add tail variance. We'd rather wait than 504 the user mid-share.
export const maxDuration = 120;

const MAX_NAME_LEN = 80;
const MAX_GENRE_LEN = 60;
const MAX_LANGUAGE_LEN = 40;
const MAX_SENDER_NAME_LEN = 50;

function sanitizeSenderName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  let cleaned = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    cleaned += ch;
  }
  cleaned = cleaned.trim().slice(0, MAX_SENDER_NAME_LEN);
  return cleaned || undefined;
}

function errorResponse(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

// Wait-state capture is purely additive — values are persisted when they
// match the closed enum lists, silently dropped when they don't. We never
// fail a share-create on invalid capture, because the user already paid
// for the Suno run and the capture itself is best-effort. Returns undefined
// when nothing valid was supplied so the consumer can omit the field
// entirely from the SharedSong row.
function sanitizeWaitCapture(value: unknown): WaitCapture | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as {
    relationship?: unknown;
    celebration_location?: unknown;
    year_reminder?: unknown;
  };
  const out: WaitCapture = {};
  if (
    typeof raw.relationship === "string" &&
    (WAIT_CAPTURE_RELATIONSHIPS as readonly string[]).includes(raw.relationship)
  ) {
    out.relationship = raw.relationship as WaitCaptureRelationship;
  }
  if (
    typeof raw.celebration_location === "string" &&
    (WAIT_CAPTURE_LOCATIONS as readonly string[]).includes(raw.celebration_location)
  ) {
    out.celebration_location = raw.celebration_location as WaitCaptureLocation;
  }
  if (raw.year_reminder === true) {
    out.year_reminder = true;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function isValidTemplate(value: unknown): value is ShareTemplate {
  return typeof value === "string" && (SHARE_TEMPLATES as readonly string[]).includes(value);
}

function isValidAudioUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  let rate;
  try {
    rate = await rateLimitFixedWindow(
      `rate:share:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      { request, ip },
    );
  } catch (err) {
    // KV unreachable — fail open. Share creation is expensive but the alternative
    // is denying real users; we'd rather take the cost.
    console.error("[share-create] rate-limit KV failure:", err);
    rate = { allowed: true, count: 0, remaining: RATE_LIMIT_MAX, resetInSeconds: null };
  }
  if (!rate.allowed) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (rate.resetInSeconds !== null) {
      headers.set("Retry-After", String(rate.resetInSeconds));
    }
    return new Response(
      JSON.stringify({
        error: {
          code: "RATE_LIMITED",
          message: `You've hit the daily limit of ${RATE_LIMIT_MAX} shares. Please try again tomorrow.`,
        },
      }),
      { status: 429, headers },
    );
  }

  let body: Partial<ShareCreateRequest>;
  try {
    body = (await request.json()) as Partial<ShareCreateRequest>;
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return errorResponse("INVALID_INPUT", "Name is required.", 400);
  if (name.length > MAX_NAME_LEN) {
    return errorResponse("INVALID_INPUT", `Name must be ${MAX_NAME_LEN} characters or fewer.`, 400);
  }

  const language = typeof body.language === "string" ? body.language.trim() : "";
  if (!language || language.length > MAX_LANGUAGE_LEN) {
    return errorResponse("INVALID_INPUT", "Language is required.", 400);
  }

  const genre = typeof body.genre === "string" ? body.genre.trim() : "";
  if (!genre || genre.length > MAX_GENRE_LEN) {
    return errorResponse("INVALID_INPUT", "Genre is required.", 400);
  }

  if (!isValidAudioUrl(body.audioUrl)) {
    return errorResponse("INVALID_INPUT", "audioUrl must be a valid http(s) URL.", 400);
  }

  if (!isValidTemplate(body.template)) {
    return errorResponse("INVALID_INPUT", "Unknown share template.", 400);
  }

  let lyrics;
  try {
    lyrics = normalizeClientLyrics(body.lyrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid lyrics payload";
    return errorResponse("INVALID_INPUT", message, 400);
  }

  const id = generateShareId();

  // Resolve sender + venue context BEFORE the render so renderShareVideo can
  // burn them into the video frame. Venue is server-verified — client claims
  // a slug, we look it up; if it's not an active venue, no venue context is
  // attached (prevents brand impersonation in the burned-in subtitle).
  const senderName = sanitizeSenderName(body.senderName);

  let styleNotes: string | undefined;
  if (typeof body.style_notes === "string") {
    let cleaned = "";
    for (const ch of body.style_notes) {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 0x20 || code === 0x7f) continue;
      cleaned += ch;
    }
    cleaned = cleaned.trim().slice(0, 200);
    if (cleaned) styleNotes = cleaned;
  }

  // Claude-refined Suno descriptor forwarded from /api/generate-music. Same
  // sanitization shape as styleNotes — control chars stripped, length capped.
  // Stored so the regenerate route can reuse it without re-paying Haiku.
  let refinedStyle: string | undefined;
  if (typeof body.refined_style === "string") {
    let cleaned = "";
    for (const ch of body.refined_style) {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 0x20 || code === 0x7f) continue;
      cleaned += ch;
    }
    cleaned = cleaned.trim().slice(0, 200);
    if (cleaned) refinedStyle = cleaned;
  }

  // Pronunciation hint persists on the share row so the regenerate route can
  // re-apply the substitution on retries without the user re-entering it.
  // Never baked into the displayed lyrics — see lib/anthropic.ts.
  let pronunciationHint: string | undefined;
  if (typeof body.pronunciation_hint === "string") {
    let cleaned = "";
    for (const ch of body.pronunciation_hint) {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 0x20 || code === 0x7f) continue;
      cleaned += ch;
    }
    cleaned = cleaned.trim().slice(0, 80);
    if (cleaned) pronunciationHint = cleaned;
  }

  const waitCapture = sanitizeWaitCapture(body.wait_capture);

  // "Make it Yours" personalization. Cake and candle map to closed enums —
  // unknown values are silently dropped (never fail share creation over
  // a presentation field). Personal note is free text: strip control
  // characters, trim, and cap at the same length the form enforces.
  let cakeStyle: CakeStyle | undefined;
  if (
    typeof body.cake_style === "string" &&
    (CAKE_STYLES as readonly string[]).includes(body.cake_style)
  ) {
    cakeStyle = body.cake_style as CakeStyle;
  }
  let candleColor: CandleColor | undefined;
  if (
    typeof body.candle_color === "string" &&
    (CANDLE_COLORS as readonly string[]).includes(body.candle_color)
  ) {
    candleColor = body.candle_color as CandleColor;
  }
  let personalNote: string | undefined;
  if (typeof body.personal_note === "string") {
    let cleaned = "";
    for (const ch of body.personal_note) {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 0x20 || code === 0x7f) continue;
      cleaned += ch;
    }
    cleaned = cleaned.trim().slice(0, PERSONAL_NOTE_MAX_LEN);
    if (cleaned) personalNote = cleaned;
  }

  let venueFields: { venueSlug: string; venueName: string; venueColor: string } | null = null;
  if (typeof body.venueSlug === "string" && body.venueSlug.trim()) {
    const venue = await loadActiveVenue(body.venueSlug);
    if (venue) {
      venueFields = {
        venueSlug: venue.share_slug,
        venueName: venue.venue_name,
        venueColor: venue.logo_color,
      };
    }
  }

  let videoUrl: string | undefined;
  try {
    // cakeStyle + candleColor are still validated + persisted (see below)
    // but no longer fed to the renderer — overlay path was rolled back
    // because the templates already include cake/candle imagery and the
    // overlays conflicted visually. Picker UI is gated off, but the
    // server keeps accepting + storing the picks for a future visual pass.
    const rendered = await renderShareVideo({
      audioUrl: body.audioUrl,
      name,
      template: body.template,
      language,
      logId: id,
      senderName: senderName ?? undefined,
      venueName: venueFields?.venueName,
      venueColor: venueFields?.venueColor,
      personalNote,
      genre,
      backgroundSeed: id,
    });
    console.log(
      `[share-create] rendered mp4 for ${id} template=${body.template} duration=${rendered.durationSec.toFixed(2)}s bytes=${rendered.mp4.length}`,
    );
    const uploadStart = Date.now();
    videoUrl = await uploadToR2(`shares/${id}.mp4`, rendered.mp4, "video/mp4");
    console.log(`[share-create:r2-upload] took ${Date.now() - uploadStart}ms id=${id} bytes=${rendered.mp4.length}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown video render error";
    console.error(`[share-create:render-failed] id=${id} msg=${message}`);
    // Fall through: persist share with raw audio fallback only.
  }

  const song: SharedSong = {
    id,
    name,
    language,
    genre,
    lyrics,
    audioUrl: body.audioUrl,
    videoUrl,
    template: body.template,
    createdAt: Date.now(),
    // Lock the pricing tier at creation so the unlock price can't drift between
    // preview and checkout. A freshly created song is implicitly locked
    // (unlocked is undefined → falsy) until the Stripe webhook flips it.
    tier: resolveTier(request),
    ...(senderName ? { senderName } : {}),
    ...(styleNotes ? { styleNotes } : {}),
    ...(refinedStyle ? { refinedStyle } : {}),
    ...(pronunciationHint ? { pronunciationHint } : {}),
    ...(waitCapture ? { waitCapture } : {}),
    ...(cakeStyle ? { cakeStyle } : {}),
    ...(candleColor ? { candleColor } : {}),
    ...(personalNote ? { personalNote } : {}),
    ...(venueFields ?? {}),
  };

  const kvStart = Date.now();
  try {
    await saveSharedSong(song);
    console.log(`[share-create:kv-write] took ${Date.now() - kvStart}ms id=${id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown share storage error";
    console.error(`[share-create:kv-write-failed] id=${id} tookMs=${Date.now() - kvStart} msg=${message}`);
    return errorResponse("SHARE_STORE_FAILED", "Couldn't save share link. Please try again.", 502);
  }

  // Fire-and-forget: notify the sender once the share artifact has persisted.
  // Wrapped in next/server `after()` so the serverless function stays alive
  // until the send completes; otherwise the handler returns and the runtime
  // terminates the promise mid-flight. Failures inside sendSongReadyEmail are
  // already caught and logged — they cannot bubble up here either.
  const toEmail = sanitizeEmail(body.email);
  if (toEmail) {
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    after(
      sendSongReadyEmail({
        to: toEmail,
        shareUrl: `${origin}/share/${id}`,
        recipientName: name,
        senderName: senderName ?? undefined,
        venueName: venueFields?.venueName,
        venueColor: venueFields?.venueColor,
        origin,
      }),
    );
  }

  // Best-effort durable event — the richly-joinable row (email ↔ share_id).
  after(
    logGenerationEvent("share_created", request, {
      email: toEmail ?? undefined,
      shareId: id,
      venueSlug: venueFields?.venueSlug,
      recipientName: name,
      language,
      genre,
    }),
  );

  const response: ShareCreateResponse = {
    id,
    shareUrl: `/share/${id}`,
    videoUrl,
    tier: resolveTier(request),
  };
  return Response.json(response);
}
