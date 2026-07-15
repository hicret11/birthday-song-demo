import { after } from "next/server";
import {
  applyPronunciationHint,
  normalizeClientLyrics,
  refineStyleForSuno,
} from "@/lib/anthropic";
import { logGenerationEvent } from "@/lib/events";
import {
  ApiError,
  ApiErrorCode,
  GenerateMusicRequest,
  GenerateMusicResponse,
  Lyrics,
} from "@/lib/api-types";
import {
  getMusicProvider,
  isProviderOpen,
  isTransientUpstreamError,
  noteProviderFailure,
  noteProviderSuccess,
} from "@/lib/music-provider";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";
import { getUserEmail } from "@/lib/user-session";
import { isCompEmail } from "@/lib/comp-emails";
import { recordSpendCents } from "@/lib/spend-cap";
import { sunoStyleLimit } from "@/lib/suno";

// Generous cap on the user's free-text style notes — effectively "any length"
// for real use. It's not a hard product limit; the notes are refined by Claude
// into a compact Suno descriptor anyway, so a long note never reaches Suno raw.
const MAX_STYLE_NOTES_LEN = 2000;
// The birthday-song boilerplate that must always survive on the end of the
// Suno style so we still get a short cut with a proper ending, regardless of
// how much of the descriptor we had to trim to fit the model's field.
const SUNO_STYLE_SUFFIX =
  "full, cheerful birthday song with a clear verse and chorus, about 60 seconds, natural ending";
// Haiku-refined descriptor costs roughly $0.0001/call; track 1 cent
// (rounded up) against the same daily anthropic budget that gates lyrics.
const ANTHROPIC_STYLE_REFINE_COST_CENTS = 1;

function stripEmojiPrefix(value: string): string {
  return value.replace(/^[^\p{L}]+/u, "").trim() || value;
}

function stripControlChars(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  return out;
}

// Compose the descriptive "head" (genre + notes, or a refined descriptor) with
// the required birthday-song suffix so the whole string fits the active Suno
// model's style ceiling. The suffix is always kept; only the head is trimmed
// (at a word boundary) to make room. This is why the giver can enter style
// notes of any length without ever hitting Suno's "shorten to 200 chars" error.
function fitSunoStyle(head: string): string {
  const limit = sunoStyleLimit();
  const cleanHead = head.trim().replace(/[\s,]+$/, "");
  if (!cleanHead) return SUNO_STYLE_SUFFIX.slice(0, limit);

  // Reserve room for ", " + the suffix. If the suffix alone already fills the
  // field (tiny/misconfigured limit), the head wins and boilerplate is dropped.
  const room = limit - SUNO_STYLE_SUFFIX.length - 2;
  if (room <= 0) return cleanHead.slice(0, limit);
  if (cleanHead.length <= room) return `${cleanHead}, ${SUNO_STYLE_SUFFIX}`;

  let trimmed = cleanHead.slice(0, room);
  const lastBreak = Math.max(trimmed.lastIndexOf(" "), trimmed.lastIndexOf(","));
  if (lastBreak > room * 0.6) trimmed = trimmed.slice(0, lastBreak);
  trimmed = trimmed.replace(/[\s,]+$/, "");
  return `${trimmed}, ${SUNO_STYLE_SUFFIX}`;
}

function buildSunoStyle(genre: string, styleNotes?: string | null): string {
  const cleanGenre = stripEmojiPrefix(genre);
  const notes = stripControlChars(styleNotes ?? "")
    .trim()
    .slice(0, MAX_STYLE_NOTES_LEN);
  return fitSunoStyle(notes ? `${cleanGenre}, ${notes}` : cleanGenre);
}

// When the user-supplied style notes have been passed through Claude, the
// refined descriptor already encodes subgenre/BPM/instrumentation. We just
// append the birthday-song boilerplate so Suno still produces a short cut.
function buildRefinedSunoStyle(refined: string): string {
  return fitSunoStyle(refined);
}

export const runtime = "nodejs";
export const maxDuration = 30;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;

function errorResponse(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  // Verified comp admins (logged in) generate without the daily cap.
  const admin = isCompEmail(await getUserEmail());
  let rate;
  try {
    rate = await rateLimitFixedWindow(
      `rate:music:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      { request, ip, admin },
    );
  } catch (err) {
    // KV unreachable — fail open rather than block legitimate users.
    console.error("[generate-music] rate-limit KV failure:", err);
    rate = { allowed: true, count: 0, remaining: RATE_LIMIT_MAX, resetInSeconds: null };
  }
  if (!rate.allowed) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (rate.resetInSeconds !== null) {
      headers.set("Retry-After", String(rate.resetInSeconds));
    }
    const body: ApiError = {
      error: {
        code: "RATE_LIMITED",
        message: `You've hit the daily limit of ${RATE_LIMIT_MAX} songs. Please try again tomorrow.`,
      },
    };
    return new Response(JSON.stringify(body), { status: 429, headers });
  }

  let body: Partial<GenerateMusicRequest>;
  try {
    body = (await request.json()) as Partial<GenerateMusicRequest>;
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return errorResponse("INVALID_INPUT", "Name is required.", 400);
  }
  if (typeof body.genre !== "string" || !body.genre.trim()) {
    return errorResponse("INVALID_INPUT", "Genre is required.", 400);
  }
  if (typeof body.language !== "string" || !body.language.trim()) {
    return errorResponse("INVALID_INPUT", "Language is required.", 400);
  }

  let lyrics: Lyrics;
  try {
    lyrics = normalizeClientLyrics(body.lyrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid lyrics payload";
    return errorResponse("INVALID_INPUT", message, 400);
  }

  const provider = getMusicProvider();

  // Circuit breaker: if the upstream tripped recently, don't dial it again.
  // The breaker auto-resets after the cooldown TTL elapses, so this self-heals.
  const breaker = await isProviderOpen(provider.name);
  if (breaker.open) {
    console.warn(
      `[generate-music] breaker open for ${provider.name} (${breaker.consecutiveFailures} consecutive failures); short-circuiting`,
    );
    return errorResponse(
      "MUSIC_SUBMIT_FAILED",
      "We're having a moment with our music service. Please try again in a few minutes.",
      503,
    );
  }

  try {
    const styleNotesRaw =
      typeof body.style_notes === "string" ? body.style_notes : undefined;
    const trimmedNotes = stripControlChars(styleNotesRaw ?? "")
      .trim()
      .slice(0, MAX_STYLE_NOTES_LEN);

    // If the user gave us style notes, route them through Claude so Suno
    // gets a precise descriptor instead of a raw "Afro house like Palm
    // Monkey's AWGAZI" — which Suno tends to interpret generically. Empty
    // input skips the call (no latency/tokens wasted). Any failure falls
    // back to the plain genre + raw notes concatenation, so refinement
    // never blocks generation.
    let refinedStyle: string | undefined;
    if (trimmedNotes) {
      try {
        refinedStyle = await refineStyleForSuno({
          genre: body.genre,
          styleNotes: trimmedNotes,
          recipientName: body.name,
        });
        void recordSpendCents("openai", ANTHROPIC_STYLE_REFINE_COST_CENTS);
      } catch (refineErr) {
        const msg = refineErr instanceof Error ? refineErr.message : String(refineErr);
        console.warn(`[generate-music] style-refine failed, falling back: ${msg}`);
        refinedStyle = undefined;
      }
    }

    const style = refinedStyle
      ? buildRefinedSunoStyle(refinedStyle)
      : buildSunoStyle(body.genre, trimmedNotes || undefined);

    // Build a Suno-bound copy of the lyric text with the pronunciation form
    // substituted for the original name (e.g., "Kamila" → "Ka-MEE-la"). The
    // displayed lyrics persisted on the share page keep the original
    // spelling — only what we send to Suno's tokenizer changes. When no
    // hint is supplied, this is a no-op and the original raw passes through.
    const pronunciationHintRaw =
      typeof body.pronunciation_hint === "string" ? body.pronunciation_hint : undefined;
    const trimmedHint = stripControlChars(pronunciationHintRaw ?? "")
      .trim()
      .slice(0, MAX_STYLE_NOTES_LEN);
    const sunoLyricsRaw = trimmedHint
      ? applyPronunciationHint({
          text: lyrics.raw,
          name: body.name,
          hint: trimmedHint,
        })
      : lyrics.raw;
    const sunoTitle = trimmedHint
      ? applyPronunciationHint({
          text: lyrics.title,
          name: body.name,
          hint: trimmedHint,
        })
      : lyrics.title;

    const jobId = await provider.submit({
      lyrics: sunoLyricsRaw,
      style,
      title: sunoTitle,
    });
    void noteProviderSuccess(provider.name);
    // Best-effort durable event — never blocks the response.
    after(
      logGenerationEvent("music_submitted", request, {
        recipientName: body.name,
        language: body.language,
        genre: body.genre,
        metadata: { job_id: jobId },
      }),
    );
    const response: GenerateMusicResponse = refinedStyle ? { jobId, refinedStyle } : { jobId };
    return Response.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown music submit error";

    // Rate-limit responses from upstream are surfaced to user as 429 — not
    // a breaker condition (it'll reset itself within minutes).
    if (/429|rate.?limit/i.test(message)) {
      return errorResponse("RATE_LIMITED", "Music service is busy. Please wait a moment.", 429);
    }

    if (isTransientUpstreamError(message)) {
      const total = await noteProviderFailure(provider.name);
      console.error(
        `[generate-music] transient ${provider.name} failure (${total} consecutive): ${message}`,
      );
      // Surface the friendly message immediately if we've crossed the threshold,
      // otherwise the conventional 502 — next request will trip the breaker.
      return errorResponse(
        "MUSIC_SUBMIT_FAILED",
        total >= 2
          ? "We're having a moment with our music service. Please try again in a few minutes."
          : "Couldn't start music generation. Please try again.",
        503,
      );
    }

    console.error("[generate-music] submit failed:", message);
    return errorResponse(
      "MUSIC_SUBMIT_FAILED",
      "Couldn't start music generation. Please try again.",
      502,
    );
  }
}
