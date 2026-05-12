import { normalizeClientLyrics } from "@/lib/anthropic";
import {
  ApiError,
  ApiErrorCode,
  SHARE_TEMPLATES,
  ShareCreateRequest,
  ShareCreateResponse,
  ShareTemplate,
  SharedSong,
} from "@/lib/api-types";
import { generateShareId, saveSharedSong } from "@/lib/share";

export const runtime = "nodejs";
export const maxDuration = 10;

const MAX_NAME_LEN = 80;
const MAX_GENRE_LEN = 60;
const MAX_LANGUAGE_LEN = 40;

function errorResponse(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
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
  const song: SharedSong = {
    id,
    name,
    language,
    genre,
    lyrics,
    audioUrl: body.audioUrl,
    template: body.template,
    createdAt: Date.now(),
  };

  try {
    await saveSharedSong(song);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown share storage error";
    console.error("[share-create] failed:", message);
    return errorResponse("SHARE_STORE_FAILED", "Couldn't save share link. Please try again.", 502);
  }

  const response: ShareCreateResponse = { id, shareUrl: `/share/${id}` };
  return Response.json(response);
}
