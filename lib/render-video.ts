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
import {
  isLambdaConfigured,
  renderPremiereOnLambda,
  premiereInputProps,
} from "./render-lambda";

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // rendering can take a couple minutes

/**
 * Render the premiere on the Railway worker (a container with no per-render
 * concurrency cap — see remotion/server.ts). Returns the MP4 URL or null.
 *
 * This is the PRIMARY render path on the current AWS-quota-capped account: the
 * Lambda invoke-burst ceiling (~3 concurrent lambdas) can't fan a 1080p
 * premiere out fast enough (~120s+), whereas one beefy Railway container renders
 * it straight through. The worker renders the SAME "PremiereVideo" composition
 * with the SAME props the Lambda path builds, so the output is identical.
 *
 * Never throws.
 */
async function renderPremiereOnWorker(song: SharedSong): Promise<string | null> {
  const workerUrl = process.env.RENDER_WORKER_URL;
  if (!workerUrl) return null;
  const secret = process.env.RENDER_WORKER_SECRET ?? "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, "")}/render`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      // Send resolved premiere props so the worker renders the exact same video
      // as Lambda. `song`/`captions` are kept for the worker's legacy
      // BirthdaySong path (backward-compatible).
      body: JSON.stringify({
        composition: "PremiereVideo",
        inputProps: premiereInputProps(song, "16:9"),
        song,
        captions: song.captions ?? [],
      }),
    });
    if (!res.ok) throw new Error(`worker responded ${res.status}`);
    const data = (await res.json().catch(() => ({}))) as { url?: unknown };
    return typeof data.url === "string" && data.url ? data.url : null;
  } catch (err) {
    console.error(
      "[render-video] worker premiere render failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

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

    const workerConfigured = !!process.env.RENDER_WORKER_URL;
    const lambdaConfigured = isLambdaConfigured();
    if (!workerConfigured && !lambdaConfigured) {
      // Nothing configured — the ffmpeg video remains the shown video. Clean
      // no-op, don't even mark pending.
      return;
    }

    await updateSharedSong(song.id, { videoStatus: "pending" });

    // 1) PRIMARY: the Railway worker (no per-render concurrency cap). On the
    // quota-capped AWS account this beats Lambda, whose invoke-burst ceiling
    // (~3 lambdas) can't fan a 1080p premiere out under a minute. Renders the
    // same "PremiereVideo" composition/props, so output is identical.
    if (workerConfigured) {
      const freshForWorker = (await loadSharedSong(song.id)) ?? song;
      const workerUrl = await renderPremiereOnWorker(freshForWorker);
      if (workerUrl) {
        await updateSharedSong(song.id, { premiumVideoUrl: workerUrl, videoStatus: "ready" });
        console.log(`[render-video] worker premiere ready for ${song.id}`);
        return;
      }
      console.error(`[render-video] worker render failed for ${song.id}; trying Lambda`);
    }

    // 2) FALLBACK: Remotion Lambda. Renders the full premiere and needs no
    // captions. Slow on the capped account but a valid last automated path
    // before ffmpeg. Tune fan-out via REMOTION_FRAMES_PER_LAMBDA (render-lambda).
    if (lambdaConfigured) {
      const freshForLambda = (await loadSharedSong(song.id)) ?? song;
      const lambdaUrl = await renderPremiereOnLambda(freshForLambda);
      if (lambdaUrl) {
        await updateSharedSong(song.id, { premiumVideoUrl: lambdaUrl, videoStatus: "ready" });
        console.log(`[render-video] Lambda premiere ready for ${song.id}`);
        return;
      }
      console.error(`[render-video] Lambda render failed for ${song.id}`);
    }

    // 3) Both automated premiere paths failed → mark failed; the ffmpeg video
    // (rendered earlier) stays as the last-resort shown video. Transcribe +
    // persist captions best-effort so a manual/legacy worker retry has them.
    if (!song.captions || song.captions.length === 0) {
      const captionAudioUrl = song.highlightAudioUrl ?? song.audioUrl;
      const captions = await transcribeWordTimings(captionAudioUrl, song.lyrics?.raw ?? "");
      if (captions && captions.length > 0) {
        await updateSharedSong(song.id, { captions });
      }
    }
    await updateSharedSong(song.id, { videoStatus: "failed" });
    console.error(`[render-video] all premiere render paths failed for ${song.id}`);
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
