import { after } from "next/server";
import { generateLyrics } from "@/lib/anthropic";
import { logGenerationEvent } from "@/lib/events";
import {
  ApiError,
  ApiErrorCode,
  GENRES,
  GenerateLyricsResponse,
  GenerateSongRequest,
  Genre,
  LANGUAGES,
  Language,
  SURPRISE_GENRE,
} from "@/lib/api-types";
import { alertSpendCapExceeded } from "@/lib/ops-alerts";
import { checkCapStatus, recordSpendCents } from "@/lib/spend-cap";

// Cost per lyrics generation, in cents. Claude Haiku at ~500 input + 500 output
// tokens ≈ $0.0024/call. Tracking with the next-higher integer cent keeps the
// daily counter conservative (we'd rather hit the cap a few requests early than
// run over).
const ANTHROPIC_COST_PER_LYRICS_CENTS = 1;

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_NAME_LEN = 80;
// Advanced free-text fields (style notes, memory, etc.) — generous so long
// descriptions pass through to the lyric generator instead of being truncated.
const MAX_ADVANCED_LEN = 2000;

function errorResponse(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

function pickRandomGenre(): Genre {
  return GENRES[Math.floor(Math.random() * GENRES.length)];
}

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

function isValidGenre(value: unknown): value is Genre | typeof SURPRISE_GENRE {
  return typeof value === "string" && ((GENRES as readonly string[]).includes(value) || value === SURPRISE_GENRE);
}

function sanitizeAdvanced(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_ADVANCED_LEN);
}

export async function POST(request: Request): Promise<Response> {
  const cap = await checkCapStatus("openai");
  if (cap.overCap) {
    if (cap.shouldAlert) {
      void alertSpendCapExceeded("anthropic", cap.spentCents, cap.capCents);
    }
    return errorResponse(
      "RATE_LIMITED",
      "We're at capacity for today. Please try again tomorrow.",
      503,
    );
  }

  let body: Partial<GenerateSongRequest>;
  try {
    body = (await request.json()) as Partial<GenerateSongRequest>;
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return errorResponse("INVALID_INPUT", "Name is required.", 400);
  }
  if (name.length > MAX_NAME_LEN) {
    return errorResponse("INVALID_INPUT", `Name must be ${MAX_NAME_LEN} characters or fewer.`, 400);
  }

  if (!isLanguage(body.language)) {
    return errorResponse("INVALID_INPUT", "Language must be one of the supported options.", 400);
  }

  if (!isValidGenre(body.genre)) {
    return errorResponse("INVALID_INPUT", "Genre must be one of the supported options.", 400);
  }

  const resolvedGenre: Genre = body.genre === SURPRISE_GENRE ? pickRandomGenre() : (body.genre as Genre);

  const lyricsInput = {
    name,
    language: body.language,
    genre: resolvedGenre,
    relationship: sanitizeAdvanced(body.relationship),
    age: sanitizeAdvanced(body.age),
    profession: sanitizeAdvanced(body.profession),
    memory: sanitizeAdvanced(body.memory),
    extras: sanitizeAdvanced(body.extras),
    styleNotes: sanitizeAdvanced(body.style_notes),
    feeling: sanitizeAdvanced(body.feeling),
    directorCredit: sanitizeAdvanced(body.director_credit),
  };
  // pronunciation_hint is intentionally NOT passed to the lyric generator.
  // The displayed lyrics must keep the original name spelling. The hint is
  // applied as a post-process substitution on the Suno-bound copy in
  // /api/generate-music (see applyPronunciationHint).

  try {
    const lyrics = await generateLyrics(lyricsInput);
    void recordSpendCents("openai", ANTHROPIC_COST_PER_LYRICS_CENTS);
    // Best-effort durable event — never blocks the response.
    after(
      logGenerationEvent("generation_started", request, {
        recipientName: name,
        language: body.language,
        genre: resolvedGenre,
      }),
    );
    const response: GenerateLyricsResponse = { lyrics, resolvedGenre };
    return Response.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown lyric generation error";
    if (/timeout|aborted/i.test(message)) {
      return errorResponse("LYRICS_TIMEOUT", "Lyric service was too slow. Please try again.", 504);
    }
    if (/429|rate.?limit/i.test(message)) {
      return errorResponse("RATE_LIMITED", "Lyric service is busy. Please wait a moment.", 429);
    }
    console.error("[generate-lyrics] failed:", message);
    return errorResponse("LYRICS_FAILED", "Couldn't write lyrics. Please try again.", 502);
  }
}
