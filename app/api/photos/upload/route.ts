// Photo upload endpoint for the optional paid photo slideshow.
//
// Accepts up to 6 images via multipart/form-data (field name "photos", repeated
// or as a list). Each file is validated (image/* content type, ≤6MB) and pushed
// to R2 under photos/<randomId>.<ext>. Returns the public URLs so the client can
// forward them to /api/share, which persists them onto the SharedSong. The
// slideshow itself is rendered later (after unlock) by /api/slideshow/render.

import { randomUUID } from "node:crypto";
import { uploadToR2 } from "@/lib/r2";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_FILES = 6;
const MAX_BYTES = 6 * 1024 * 1024; // ~6MB per image
const RATE_LIMIT_MAX = 30; // uploads per IP per window (6 files × a few tries)
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour

// Map a small set of allowed image content types to file extensions. Anything
// outside this list is rejected — we only render these into the slideshow.
const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: { code: "INVALID_INPUT", message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  // Basic per-IP rate limiting. Fail open if KV is unreachable — blocking real
  // users on an infra blip is worse than the marginal abuse risk here.
  try {
    const rate = await rateLimitFixedWindow(
      `rate:photos:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      { request, ip },
    );
    if (!rate.allowed) {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (rate.resetInSeconds !== null) {
        headers.set("Retry-After", String(rate.resetInSeconds));
      }
      return new Response(
        JSON.stringify({
          error: {
            code: "RATE_LIMITED",
            message: "Too many photo uploads. Please try again a little later.",
          },
        }),
        { status: 429, headers },
      );
    }
  } catch (err) {
    console.error("[photos-upload] rate-limit KV failure:", err);
    // Fall open.
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Request must be multipart/form-data.", 400);
  }

  // Accept the files under "photos" (repeated) or "photos[]"; also tolerate any
  // File entries the browser appended under a different key.
  const candidates = [
    ...form.getAll("photos"),
    ...form.getAll("photos[]"),
    ...form.getAll("files"),
    ...form.getAll("file"),
  ];
  const files = candidates.filter((c): c is File => c instanceof File && c.size > 0);

  if (files.length === 0) {
    return errorResponse("No photos provided.", 400);
  }
  if (files.length > MAX_FILES) {
    return errorResponse(`You can upload at most ${MAX_FILES} photos.`, 400);
  }

  const urls: string[] = [];
  try {
    for (const file of files) {
      const contentType = (file.type || "").toLowerCase();
      const ext = CONTENT_TYPE_EXT[contentType];
      if (!ext) {
        return errorResponse("Each upload must be an image (JPEG, PNG, WebP, GIF, or HEIC).", 400);
      }
      if (file.size > MAX_BYTES) {
        return errorResponse(`Each photo must be ${Math.round(MAX_BYTES / (1024 * 1024))}MB or smaller.`, 400);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length === 0) {
        return errorResponse("One of the uploads was empty.", 400);
      }
      const key = `photos/${randomUUID()}.${ext}`;
      const url = await uploadToR2(key, buf, contentType);
      urls.push(url);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown upload error";
    console.error(`[photos-upload] upload failed ip=${ip} msg=${message}`);
    return Response.json(
      { error: { code: "INTERNAL", message: "Couldn't upload photos. Please try again." } },
      { status: 502 },
    );
  }

  return Response.json({ urls });
}
