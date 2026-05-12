import { generateLyrics } from "@/lib/anthropic";
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

export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_NAME_LEN = 80;
const MAX_ADVANCED_LEN = 500;

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
  };

  try {
    const lyrics = await generateLyrics(lyricsInput);
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
