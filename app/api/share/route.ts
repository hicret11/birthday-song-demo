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
import { getUserEmail } from "@/lib/user-session";
import { isCompEmail } from "@/lib/comp-emails";
import { sendSongReadyEmail } from "@/lib/resend";
import { logGenerationEvent } from "@/lib/events";
import { generateShareId, saveSharedSong } from "@/lib/share";
import { computeDeliverAt, isValidTimezone, type Delivery } from "@/lib/delivery";
import { randomBytes } from "node:crypto";
import { addPendingUnlock } from "@/lib/pending-unlocks";
import { enrollBirthdayReminder } from "@/lib/birthday-reminders";
import { addSongToUser } from "@/lib/user-songs";
import { renderShareVideo } from "@/lib/video";
import { renderHighlightCut } from "@/lib/audio-cut";
import { transcribeWordTimings, findNameOnsetMs, type Caption } from "@/lib/transcribe";
import { moderateShareInput } from "@/lib/moderation";
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

// Birthday capture is purely additive — used only for the annual reminder.
// Accepts "YYYY-MM-DD" or "MM-DD" and returns a normalized month-day "MM-DD",
// or undefined if missing/invalid. Validates the day against the month
// (Feb 29 is allowed — leap-year handling is the cron's concern, and a Feb 29
// recipient still has a real birthday). Never throws; share creation never
// fails over a malformed birthday.
function sanitizeBirthdayMonthDay(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let month: number;
  let day: number;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const md = /^(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) {
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else if (md) {
    month = Number(md[1]);
    day = Number(md[2]);
  } else {
    return undefined;
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) return undefined;
  // Max days per month; February capped at 29 to allow leap-day birthdays.
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1];
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return undefined;

  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

const MAX_PHOTO_URLS = 6;

// Photo URLs come from /api/photos/upload (R2 https URLs). Additive — invalid
// or empty input is silently dropped, never failing share creation. Returns
// undefined when nothing valid is supplied so the field can be omitted entirely.
function sanitizePhotoUrls(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    try {
      const url = new URL(entry);
      if (url.protocol !== "https:") continue;
    } catch {
      continue;
    }
    out.push(entry);
    if (out.length >= MAX_PHOTO_URLS) break;
  }
  return out.length > 0 ? out : undefined;
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  // Verified comp admins (logged in) create shares without the daily cap.
  const admin = isCompEmail(await getUserEmail());
  let rate;
  try {
    rate = await rateLimitFixedWindow(
      `rate:share:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      { request, ip, admin },
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
    cleaned = cleaned.trim().slice(0, 2000);
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

  // Optional recipient birthday (month-day) for the annual reminder. Stored on
  // the share row when valid; only drives enrollment when the buyer also opted
  // into the year reminder (see the enrollment gate below). Additive.
  const birthdayDate = sanitizeBirthdayMonthDay(body.birthday_date);

  // Countdown delivery (giver-sends): when the giver chose "scheduled" AND we
  // have a birthday month-day + a valid giver timezone, hold the premiere behind
  // a countdown until 9am local on the recipient's next birthday. Anything else
  // (no birthday, no/invalid tz, or an unresolvable date) falls back to "now"
  // (instant reveal) so delivery can never block a share. A previewToken lets
  // the GIVER bypass the countdown to see their own premiere early.
  let delivery: Delivery | undefined;
  let previewToken: string | undefined;
  {
    const reqDelivery = body.delivery;
    const wantScheduled =
      typeof reqDelivery === "object" && reqDelivery !== null && reqDelivery.mode === "scheduled";
    const tz =
      typeof reqDelivery === "object" && reqDelivery !== null && isValidTimezone(reqDelivery.timezone)
        ? reqDelivery.timezone
        : undefined;
    if (wantScheduled && birthdayDate && tz) {
      const deliverAt = computeDeliverAt(birthdayDate, tz, Date.now());
      if (deliverAt) {
        delivery = { mode: "scheduled", deliverAt, timezone: tz };
        previewToken = randomBytes(16).toString("hex");
      }
    }
  }

  // Optional photo URLs for the paid slideshow. Best-effort — invalid entries
  // are dropped, the field is omitted when nothing valid was supplied.
  const photoUrls = sanitizePhotoUrls(body.photoUrls);

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

  // v4 "Production Studio" capture — all additive/best-effort, never blocks
  // share creation. directorCredit + feeling steer copy/tone; directorNote is
  // the closing message revealed on the premiere (text and/or a recorded voice
  // clip already uploaded to Blob and passed here as an https URL).
  const cleanCapped = (value: unknown, max: number): string | undefined => {
    if (typeof value !== "string") return undefined;
    let cleaned = "";
    for (const ch of value) {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 0x20 || code === 0x7f) continue;
      cleaned += ch;
    }
    cleaned = cleaned.trim().slice(0, max);
    return cleaned || undefined;
  };
  const directorCredit = cleanCapped(body.director_credit, 60);
  const feeling = cleanCapped(body.feeling, 40);
  const directorNoteText = cleanCapped(body.director_note_text, 280);
  const directorNoteVoiceUrl = isValidAudioUrl(body.director_note_voice_url)
    ? body.director_note_voice_url
    : undefined;
  let directorNoteVoiceDurationSec: number | undefined;
  if (
    typeof body.director_note_voice_duration_sec === "number" &&
    Number.isFinite(body.director_note_voice_duration_sec) &&
    body.director_note_voice_duration_sec > 0
  ) {
    directorNoteVoiceDurationSec = Math.min(120, Math.round(body.director_note_voice_duration_sec));
  }
  const directorNote =
    directorNoteText || directorNoteVoiceUrl
      ? {
          ...(directorNoteText ? { text: directorNoteText } : {}),
          ...(directorNoteVoiceUrl
            ? {
                voiceUrl: directorNoteVoiceUrl,
                ...(directorNoteVoiceDurationSec
                  ? { voiceDurationSec: directorNoteVoiceDurationSec }
                  : {}),
              }
            : {}),
        }
      : undefined;

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

  // Content moderation gate. The recipient name + notes become a PUBLIC artifact
  // (share page, OG card) and steer the lyrics, so screen them before we spend
  // money rendering/persisting. Fail-open by design (never blocks over an API
  // blip); a serious-category flag rejects with a friendly message.
  const moderation = await moderateShareInput([
    name,
    senderName,
    personalNote,
    styleNotes,
    lyrics.raw,
    directorCredit,
    directorNoteText,
  ]);
  if (!moderation.allowed) {
    console.warn(`[share-create:moderation-blocked] cats=${moderation.categories?.join(",")}`);
    return errorResponse(
      "INVALID_INPUT",
      "We can't create a song from this content. Please adjust the details and try again.",
      400,
    );
  }

  // Highlight-cut: carve a tight ~55s highlight from Suno's full 2–3 min track
  // and persist a stable copy of the full-length track. Best-effort — on any
  // failure we keep the raw Suno audioUrl as the only source. Runs before the
  // video render so the audiogram/karaoke can be built from the tight cut.
  let highlightAudioUrl: string | undefined;
  let fullAudioUrl: string | undefined;
  let previewAudioUrl: string | undefined;
  let highlightDurationSec: number | undefined;

  // Word-timed transcription of the generated track, reconciled against the
  // lyrics we wrote. Two payoffs: (1) locate where the recipient's name is first
  // sung so the free preview can open on that hook, and (2) persist the captions
  // so the premium video render reuses them instead of transcribing again on
  // unlock. Best-effort — a null result just means a heuristic preview + a
  // transcribe-on-render later, so it never blocks generation.
  let captions: Caption[] | undefined;
  let previewStartSec: number | undefined;
  try {
    const timed = await transcribeWordTimings(body.audioUrl, lyrics.raw ?? "");
    if (timed && timed.length > 0) {
      captions = timed;
      const nameOnsetMs = findNameOnsetMs(timed, name);
      if (nameOnsetMs != null) {
        // Start ~2s before the name so the listener hears the run-up into it.
        previewStartSec = Math.max(0, nameOnsetMs / 1000 - 2);
        console.log(
          `[share-create:name-onset] id=${id} nameAt=${(nameOnsetMs / 1000).toFixed(1)}s previewStart=${previewStartSec.toFixed(1)}s`,
        );
      }
    }
  } catch (err) {
    console.error(`[share-create:transcribe-failed] id=${id}`, err);
  }

  try {
    const cut = await renderHighlightCut(body.audioUrl, { previewStartSec });
    if (cut) {
      const [hUrl, fUrl, pUrl] = await Promise.all([
        uploadToR2(`audio/${id}-highlight.mp3`, cut.cutMp3, "audio/mpeg"),
        uploadToR2(`audio/${id}-full.mp3`, cut.fullMp3, "audio/mpeg"),
        uploadToR2(`audio/${id}-preview.mp3`, cut.previewMp3, "audio/mpeg"),
      ]);
      highlightAudioUrl = hUrl;
      fullAudioUrl = fUrl;
      previewAudioUrl = pUrl;
      highlightDurationSec = Math.round(cut.cutDurationSec);
      console.log(
        `[share-create:highlight-cut] id=${id} cut=${highlightDurationSec}s full=${Math.round(cut.fullDurationSec)}s`,
      );
    }
  } catch (err) {
    console.error(`[share-create:highlight-cut-failed] id=${id}`, err);
  }

  // The video/audiogram/captions track the tight highlight when we have one —
  // that's the polished, repeat-free song. Falls back to the raw Suno track.
  const videoAudioUrl = highlightAudioUrl ?? body.audioUrl;

  let videoUrl: string | undefined;
  try {
    // cakeStyle + candleColor are still validated + persisted (see below)
    // but no longer fed to the renderer — overlay path was rolled back
    // because the templates already include cake/candle imagery and the
    // overlays conflicted visually. Picker UI is gated off, but the
    // server keeps accepting + storing the picks for a future visual pass.
    const rendered = await renderShareVideo({
      audioUrl: videoAudioUrl,
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
      // Drives the premium 9:16 lyric-audiogram's timed line reveal. The
      // renderer falls back to the simple renderer if these are unusable.
      lyrics,
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
    ...(highlightAudioUrl ? { highlightAudioUrl } : {}),
    ...(fullAudioUrl ? { fullAudioUrl } : {}),
    ...(previewAudioUrl ? { previewAudioUrl } : {}),
    ...(highlightDurationSec ? { highlightDurationSec } : {}),
    ...(captions && captions.length > 0 ? { captions } : {}),
    ...(senderName ? { senderName } : {}),
    ...(styleNotes ? { styleNotes } : {}),
    ...(refinedStyle ? { refinedStyle } : {}),
    ...(pronunciationHint ? { pronunciationHint } : {}),
    ...(waitCapture ? { waitCapture } : {}),
    ...(birthdayDate ? { birthdayDate } : {}),
    ...(delivery ? { delivery } : {}),
    ...(previewToken ? { previewToken } : {}),
    ...(cakeStyle ? { cakeStyle } : {}),
    ...(candleColor ? { candleColor } : {}),
    ...(personalNote ? { personalNote } : {}),
    ...(photoUrls ? { photoUrls } : {}),
    ...(directorCredit ? { directorCredit } : {}),
    ...(feeling ? { feeling } : {}),
    ...(directorNote ? { directorNote } : {}),
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
    // Index this song under the buyer's email so "My Songs" can list it after
    // an optional magic-link login. Best-effort, never blocks the response.
    after(addSongToUser(toEmail, id));
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    // Register the still-locked share for the abandoned-preview recovery
    // sequence. A freshly created song is locked (song.unlocked is falsy), so
    // we only skip enrollment in the defensive case where it's somehow already
    // unlocked. Best-effort — addPendingUnlock never throws.
    if (!song.unlocked) {
      after(
        addPendingUnlock({
          id,
          email: toEmail,
          recipientName: name,
          shareUrl: `${origin}/share/${id}`,
        }),
      );
    }
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

    // Annual birthday reminder (LTV). Consent gate: enroll ONLY when the buyer
    // gave us an email (above), supplied a valid birthday month-day, AND
    // explicitly opted into the year reminder via the wait-capture checkbox.
    // Never enroll silently. Best-effort — enrollBirthdayReminder never throws.
    if (birthdayDate && waitCapture?.year_reminder === true) {
      after(
        enrollBirthdayReminder({
          email: toEmail,
          recipientName: name,
          monthDay: birthdayDate,
        }),
      );
    }
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
    ...(delivery?.deliverAt ? { deliverAt: delivery.deliverAt } : {}),
    ...(previewToken ? { previewUrl: `/share/${id}?preview=${previewToken}` } : {}),
  };
  return Response.json(response);
}
