// Premium Remotion render trigger — Next-app side (server-only).
//
// requestPremiumRender is the ONLY bridge between the Next app and the separate
// Remotion render worker. It deliberately does NOT import `remotion` (Vercel
// can't render MP4 with headless Chromium): it just (a) ensures word-timed
// captions exist, then (b) POSTs a render job to the worker over HTTP and
// persists the returned MP4 URL.
//
// It is entirely gated on `RENDER_WORKER_URL`. When that env var is unset the
// function is a no-op — the existing ffmpeg `renderShareVideo` output remains
// the shown video, so nothing breaks before the worker is deployed.
//
// Everything here is best-effort: it swallows all errors and never throws, so a
// worker outage can never break unlock, the Stripe webhook, or the share page.

import type { SharedSong } from "./api-types";
import { loadSharedSong, updateSharedSong } from "./share";
import { transcribeWordTimings } from "./transcribe";
import { isLambdaConfigured, renderPremiereOnLambda } from "./render-lambda";

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // rendering can take a couple minutes

/**
 * Ensure premium captions + kick off (and await) the worker render for an
 * unlocked song. Fire-and-forget from callers via `after(...)`.
 *
 * - No-op if RENDER_WORKER_URL is unset (ffmpeg fallback stays the video).
 * - Ensures captions: reuses persisted `song.captions`, else transcribes from
 *   the song audio (reconciled against the known lyrics) and persists them.
 * - Marks videoStatus "pending", POSTs { song, captions } to the worker with a
 *   bearer secret, and on `{ url }` persists premiumVideoUrl + videoStatus
 *   "ready". On any failure, best-effort persists videoStatus "failed".
 *
 * Never throws.
 */
export async function requestPremiumRender(song: SharedSong): Promise<void> {
  try {
    if (!song.unlocked) return;

    // Phase D: prefer the Remotion Lambda premiere render when configured. It
    // renders the full premiere (curtain/marquee/scenes/note/credits) and needs
    // no captions. On success we're done; on failure we fall through to the
    // Railway worker, then the ffmpeg video stays as the last-resort fallback.
    if (isLambdaConfigured()) {
      await updateSharedSong(song.id, { videoStatus: "pending" });
      const freshForLambda = (await loadSharedSong(song.id)) ?? song;
      const lambdaUrl = await renderPremiereOnLambda(freshForLambda);
      if (lambdaUrl) {
        await updateSharedSong(song.id, { premiumVideoUrl: lambdaUrl, videoStatus: "ready" });
        console.log(`[render-video] Lambda premiere ready for ${song.id}`);
        return;
      }
      console.error(`[render-video] Lambda render failed for ${song.id}; trying worker`);
    }

    const workerUrl = process.env.RENDER_WORKER_URL;
    if (!workerUrl) {
      // No worker configured. If Lambda was configured but failed, record it;
      // otherwise nothing is configured and the ffmpeg video remains (clean no-op).
      if (isLambdaConfigured()) {
        await updateSharedSong(song.id, { videoStatus: "failed" });
      }
      return;
    }

    // 1) Ensure captions. Reuse persisted captions if we already have them.
    let captions = song.captions ?? null;
    if (!captions || captions.length === 0) {
      const knownLyrics = song.lyrics?.raw ?? "";
      // Transcribe the SAME audio the video renders from — the highlight cut
      // when present — so word timings line up with the audiogram/karaoke.
      const captionAudioUrl = song.highlightAudioUrl ?? song.audioUrl;
      captions = await transcribeWordTimings(captionAudioUrl, knownLyrics);
      if (captions && captions.length > 0) {
        // Persist so a re-trigger (webhook + verify-path both fire) doesn't
        // re-transcribe, and so the worker always has them.
        await updateSharedSong(song.id, { captions });
      }
    }

    // Mark pending before dispatch so the share page can reflect progress.
    await updateSharedSong(song.id, { videoStatus: "pending" });

    // 2) POST the render job to the worker. The worker renders + uploads to R2.
    const secret = process.env.RENDER_WORKER_SECRET ?? "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let url: string | null = null;
    try {
      // Re-load the freshest song so the worker gets any captions we just wrote.
      const fresh = (await loadSharedSong(song.id)) ?? song;
      const res = await fetch(`${workerUrl.replace(/\/$/, "")}/render`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({ song: fresh, captions: captions ?? fresh.captions ?? [] }),
      });
      if (!res.ok) {
        throw new Error(`worker responded ${res.status}`);
      }
      const data = (await res.json().catch(() => ({}))) as { url?: unknown };
      if (typeof data.url === "string" && data.url) url = data.url;
    } finally {
      clearTimeout(timeout);
    }

    if (url) {
      await updateSharedSong(song.id, { premiumVideoUrl: url, videoStatus: "ready" });
      console.log(`[render-video] premium render ready for ${song.id}`);
    } else {
      await updateSharedSong(song.id, { videoStatus: "failed" });
      console.error(`[render-video] worker returned no url for ${song.id}`);
    }
  } catch (err) {
    console.error(
      "[render-video] requestPremiumRender failed:",
      err instanceof Error ? err.message : err,
    );
    // Best-effort failure marker; ignore if this also fails.
    try {
      await updateSharedSong(song.id, { videoStatus: "failed" });
    } catch {
      // give up quietly — ffmpeg fallback remains the shown video.
    }
  }
}
