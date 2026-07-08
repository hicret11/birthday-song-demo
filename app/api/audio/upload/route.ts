// Audio upload endpoint for short crowd voice notes.
//
// Accepts ONE short audio clip via multipart/form-data (field "audio"). The clip
// is validated (audio/* content type, ≤5MB — a ~30s recording is well under
// this) and pushed to Vercel Blob under audio/<randomId>.<ext>. Returns the
// public URL so the /join client can POST it to /api/crowd/[id]/contribute as a
// kind="voice" contribution. Mirrors /api/photos/upload's shape and guardrails.

import { randomUUID } from "node:crypto";
import { uploadToR2 } from "@/lib/r2";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // ~5MB — a 30s clip is far smaller
const RATE_LIMIT_MAX = 30; // clips per IP per window
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour

// Allowed audio content types → file extension. MediaRecorder emits webm
// (Chrome/Firefox) or mp4 (Safari); we also tolerate the common upload formats.
const CONTENT_TYPE_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm;codecs=opus": "webm",
};

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: { code: "INVALID_INPUT", message } }, { status });
}

// MediaRecorder often reports a type with codec params (e.g.
// "audio/webm;codecs=opus"); normalize to the base type for the lookup.
function baseType(mime: string): string {
  return (mime || "").toLowerCase().split(";")[0].trim();
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  try {
    const rate = await rateLimitFixedWindow(
      `rate:audio:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      { request, ip },
    );
    if (!rate.allowed) {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (rate.resetInSeconds !== null) headers.set("Retry-After", String(rate.resetInSeconds));
      return new Response(
        JSON.stringify({
          error: { code: "RATE_LIMITED", message: "Too many uploads. Please try again a little later." },
        }),
        { status: 429, headers },
      );
    }
  } catch (err) {
    console.error("[audio-upload] rate-limit KV failure:", err);
    // Fail open — an infra blip shouldn't block a real contributor.
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Request must be multipart/form-data.", 400);
  }

  const candidate = form.get("audio") ?? form.get("file");
  if (!(candidate instanceof File) || candidate.size === 0) {
    return errorResponse("No audio provided.", 400);
  }

  const ext = CONTENT_TYPE_EXT[baseType(candidate.type)];
  if (!ext) {
    return errorResponse("The upload must be an audio recording (WebM, MP4/M4A, OGG, MP3, or WAV).", 400);
  }
  if (candidate.size > MAX_BYTES) {
    return errorResponse(`The voice note must be ${Math.round(MAX_BYTES / (1024 * 1024))}MB or smaller.`, 400);
  }

  try {
    const buf = Buffer.from(await candidate.arrayBuffer());
    if (buf.length === 0) return errorResponse("The upload was empty.", 400);
    const key = `audio/${randomUUID()}.${ext}`;
    const url = await uploadToR2(key, buf, baseType(candidate.type));
    return Response.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown upload error";
    console.error(`[audio-upload] upload failed ip=${ip} msg=${message}`);
    return Response.json(
      { error: { code: "INTERNAL", message: "Couldn't upload the voice note. Please try again." } },
      { status: 502 },
    );
  }
}
