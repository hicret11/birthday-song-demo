import { normalizeClientLyrics } from "@/lib/anthropic";
import {
  ApiError,
  ApiErrorCode,
  GenerateMusicRequest,
  GenerateMusicResponse,
  Lyrics,
} from "@/lib/api-types";
import { submitGeneration } from "@/lib/suno";

export const runtime = "nodejs";
export const maxDuration = 30;

function errorResponse(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
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

  try {
    const jobId = await submitGeneration({
      lyrics: lyrics.raw,
      style: lyrics.style,
      title: lyrics.title,
    });
    const response: GenerateMusicResponse = { jobId };
    return Response.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown music submit error";
    if (/429|rate.?limit/i.test(message)) {
      return errorResponse("RATE_LIMITED", "Music service is busy. Please wait a moment.", 429);
    }
    console.error("[generate-music] submit failed:", message);
    return errorResponse("MUSIC_SUBMIT_FAILED", "Couldn't start music generation. Please try again.", 502);
  }
}
