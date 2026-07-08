// Renders the optional paid photo slideshow for an unlocked song.
//
// POST { shareId }. Requires the song to be UNLOCKED (402 otherwise) and to
// have at least one uploaded photo. Idempotent: if a slideshow already exists
// for the share, its URL is returned without re-rendering. Otherwise it fetches
// the song audio + photos, runs the ffmpeg Ken-Burns pipeline in lib/slideshow,
// uploads the mp4 to R2, persists the URL onto the SharedSong, and returns it.

import { uploadToR2 } from "@/lib/r2";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";
import { loadSharedSong, updateSharedSong } from "@/lib/share";
import { renderSlideshow, slideshowFiltersSupported } from "@/lib/slideshow";

export const runtime = "nodejs";
// 120s buffer: photo fetch + zoompan/xfade encode at 1080x1920 typically lands
// well under a minute, but cold starts + R2 upload add tail variance.
export const maxDuration = 120;

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  // Per-IP rate limiting — render is expensive. Fail open on KV trouble.
  try {
    const rate = await rateLimitFixedWindow(
      `rate:slideshow:${ip}`,
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
          error: { code: "RATE_LIMITED", message: "Too many slideshow renders. Please try again later." },
        }),
        { status: 429, headers },
      );
    }
  } catch (err) {
    console.error("[slideshow-render] rate-limit KV failure:", err);
  }

  let body: { shareId?: unknown };
  try {
    body = (await request.json()) as { shareId?: unknown };
  } catch {
    return jsonError("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  const shareId = typeof body.shareId === "string" ? body.shareId.trim() : "";
  if (!shareId) {
    return jsonError("INVALID_INPUT", "shareId is required.", 400);
  }

  const song = await loadSharedSong(shareId);
  if (!song) {
    return jsonError("NOT_FOUND", "Song not found or expired.", 404);
  }

  // Gate on unlock — the slideshow is a paid artifact.
  if (song.unlocked !== true) {
    return jsonError("LOCKED", "Unlock the song to render its photo slideshow.", 402);
  }

  // The photo slideshow is a Deluxe-only entitlement. A Standard ("full")
  // unlock does not include it.
  if (song.plan !== "deluxe") {
    return jsonError("DELUXE_REQUIRED", "Deluxe required to render the photo slideshow.", 402);
  }

  if (!song.photoUrls || song.photoUrls.length === 0) {
    return jsonError("INVALID_INPUT", "No photos were added for this song.", 400);
  }

  // Idempotent — return the existing slideshow if we've already rendered one.
  if (song.slideshowVideoUrl) {
    return Response.json({ url: song.slideshowVideoUrl });
  }

  // If this deploy's ffmpeg can't run the Ken-Burns filtergraph, say so once and
  // honestly (503 UNSUPPORTED) so the client shows a permanent, reassuring note
  // rather than looping on "try again" for something that can't succeed here.
  // The song + branded video the buyer already has are unaffected.
  if (!(await slideshowFiltersSupported())) {
    console.error(`[slideshow-render:unsupported] id=${shareId} ffmpeg build lacks zoompan/xfade`);
    return jsonError(
      "UNSUPPORTED",
      "The photo slideshow isn't available on this deploy yet — your song and video are ready above.",
      503,
    );
  }

  try {
    const rendered = await renderSlideshow({
      audioUrl: song.audioUrl,
      photoUrls: song.photoUrls,
      logId: shareId,
    });
    console.log(
      `[slideshow-render] rendered mp4 for ${shareId} photos=${song.photoUrls.length} duration=${rendered.durationSec.toFixed(2)}s bytes=${rendered.mp4.length}`,
    );

    const uploadStart = Date.now();
    const url = await uploadToR2(`slideshows/${shareId}.mp4`, rendered.mp4, "video/mp4");
    console.log(`[slideshow-render:r2-upload] took ${Date.now() - uploadStart}ms id=${shareId} bytes=${rendered.mp4.length}`);

    await updateSharedSong(shareId, { slideshowVideoUrl: url });
    return Response.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown slideshow render error";
    console.error(`[slideshow-render:failed] id=${shareId} msg=${message}`);
    return jsonError("INTERNAL", "Couldn't render the slideshow. Please try again.", 502);
  }
}
