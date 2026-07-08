// Premium premiere video via Remotion on AWS Lambda — Next-app side (server-only).
//
// This is the Phase D render path: it triggers the "PremiereVideo" composition
// on Lambda, waits for it, copies the resulting MP4 from Lambda's S3 bucket to
// Vercel Blob (our canonical store), and returns the Blob URL. Unlike a Vercel
// route, Lambda CAN run headless Chromium + ffmpeg, so this replaces the fragile
// on-Vercel ffmpeg path.
//
// Entirely env-gated: with the REMOTION_* Lambda env unset, isLambdaConfigured()
// is false and renderPremiereOnLambda() is a no-op returning null — the caller
// falls back to the Railway worker, then the ffmpeg video. Best-effort; the
// caller owns videoStatus. IMPORTANT: the installed @remotion/lambda version must
// exactly match the deployed Lambda function + site (see docs/AI... VIDEO-GOLIVE).

import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import type { SharedSong } from "./api-types";
import { getDictionary, type Locale } from "./i18n";
import { uploadToR2 } from "./r2";

const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  English: "en",
  Spanish: "es",
  Turkish: "tr",
  Arabic: "ar",
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 120; // ~6 minutes ceiling

type LambdaEnv = {
  region: string;
  functionName: string;
  serveUrl: string;
};

function lambdaEnv(): LambdaEnv | null {
  const region = process.env.REMOTION_AWS_REGION;
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;
  // The AWS key/secret are read by @remotion/lambda from REMOTION_AWS_ACCESS_KEY_ID
  // / REMOTION_AWS_SECRET_ACCESS_KEY automatically; require them here so we only
  // attempt a render when fully configured.
  const hasKeys =
    !!process.env.REMOTION_AWS_ACCESS_KEY_ID && !!process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
  if (!region || !functionName || !serveUrl || !hasKeys) return null;
  return { region, functionName, serveUrl };
}

/** Whether the Remotion Lambda render path is configured. */
export function isLambdaConfigured(): boolean {
  return lambdaEnv() !== null;
}

/** Build the PremiereVideo input props from a song. */
function inputPropsFor(song: SharedSong, aspect: "16:9" | "9:16") {
  const t = getDictionary(LANGUAGE_TO_LOCALE[song.language] ?? "en");
  return {
    name: song.name,
    directorName: song.directorCredit || song.senderName || undefined,
    // Prefer the highlight cut (matches the web premiere) when present.
    audioSrc: song.highlightAudioUrl ?? song.audioUrl,
    noteAudioSrc: song.directorNote?.voiceUrl || undefined,
    directorNoteText: song.directorNote?.text || undefined,
    theme: song.template ?? "classic",
    photoUrls: song.photoUrls ?? [],
    // Contributor names for the credits roll are resolved elsewhere (crowd);
    // empty is fine — the roll simply omits the "with love" block.
    contributors: [],
    watermark: "singmybirthday.com",
    language: song.language,
    aspect,
    starringLabel: t.premiere.starringLabel,
    producedByLabel: t.premiere.producedByLabel,
    withLoveLabel: t.premiere.withLoveLabel,
    noteLabel: t.premiere.noteLabel,
  };
}

/**
 * Render the premiere video on Lambda and return a Vercel Blob URL, or null when
 * Lambda isn't configured or the render fails. Never throws.
 */
export async function renderPremiereOnLambda(
  song: SharedSong,
  aspect: "16:9" | "9:16" = "16:9",
): Promise<string | null> {
  const env = lambdaEnv();
  if (!env) return null;
  try {
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: env.region as Parameters<typeof renderMediaOnLambda>[0]["region"],
      functionName: env.functionName,
      serveUrl: env.serveUrl,
      composition: "PremiereVideo",
      inputProps: inputPropsFor(song, aspect),
      codec: "h264",
      audioCodec: "mp3",
      privacy: "public",
      downloadBehavior: { type: "download", fileName: `premiere-${song.id}.mp4` },
    });

    for (let i = 0; i < MAX_POLLS; i++) {
      const progress = await getRenderProgress({
        renderId,
        bucketName,
        functionName: env.functionName,
        region: env.region as Parameters<typeof getRenderProgress>[0]["region"],
      });
      if (progress.fatalErrorEncountered) {
        console.error(
          `[render-lambda] fatal render error for ${song.id}:`,
          progress.errors?.[0]?.message ?? "unknown",
        );
        return null;
      }
      if (progress.done && progress.outputFile) {
        // Copy the MP4 off Lambda's S3 into Vercel Blob so it lives with the
        // rest of our media and is served from our domain.
        const res = await fetch(progress.outputFile);
        if (!res.ok) {
          console.error(`[render-lambda] could not fetch output for ${song.id}: ${res.status}`);
          return null;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const key = `video/${song.id}-premiere${aspect === "9:16" ? "-vertical" : ""}.mp4`;
        return await uploadToR2(key, buf, "video/mp4");
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    console.error(`[render-lambda] render timed out for ${song.id}`);
    return null;
  } catch (err) {
    console.error(
      "[render-lambda] renderPremiereOnLambda failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
