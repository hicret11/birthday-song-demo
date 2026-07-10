// Re-render a share with a fresh Suno audio cut. Capped at 2 retries per
// share to bound spend. Synchronous: blocks until the new MP4 lands or we
// hit the 60s function ceiling. Updates the existing share row in place so
// any URL already in the wild silently upgrades on next /share/[id] hit.
//
// Note: the rendered MP4 is uploaded to a NEW R2 key per retry version
// (shares/{id}-v{n}.mp4). Avoids R2/CDN caching surprises that would
// otherwise let recipients still see the previous take.

import { applyPronunciationHint, refineStyleForSuno } from "@/lib/anthropic";
import { renderShareVideo } from "@/lib/video";
import { uploadToR2 } from "@/lib/r2";
import { loadSharedSong, saveSharedSong } from "@/lib/share";
import { submitGeneration, checkStatus, sunoStyleLimit } from "@/lib/suno";
import { recordSpendCents } from "@/lib/spend-cap";
import type { SharedSong } from "@/lib/api-types";

export const runtime = "nodejs";
// 120s: regenerate also waits on Suno (~30–45s) and then runs the same
// ffmpeg drawtext re-encode that the initial share does. Matching the
// share-create ceiling prevents mid-retry 504s.
export const maxDuration = 120;

const MAX_REGEN_RETRIES = 2;
const POLL_INTERVAL_MS = 4_000;
const SUNO_TIMEOUT_MS = 50_000;
const MAX_STYLE_NOTES_LEN = 2000;
// Birthday-song boilerplate that must always survive on the end of the Suno
// style regardless of how much descriptor we trim to fit the model's field.
const SUNO_STYLE_SUFFIX =
  "full, cheerful birthday song with a clear verse and chorus, about 60 seconds, natural ending";

const ID_RE = /^[a-zA-Z0-9]{1,32}$/;

function stripEmojiPrefix(value: string): string {
  return value.replace(/^[^\p{L}]+/u, "").trim() || value;
}

function stripControlChars(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  return out;
}

// Mirrors generate-music's fitSunoStyle — compose the descriptive head with the
// required birthday-song suffix, keeping the whole string within the active Suno
// model's style ceiling. The suffix is always kept; only the head is trimmed
// (at a word boundary) to fit, so any-length style notes never bounce back as
// Suno's "shorten it to 200 characters" error. Kept inline rather than shared
// so each route owns its own Suno-prompt assembly.
function fitSunoStyle(head: string): string {
  const limit = sunoStyleLimit();
  const cleanHead = head.trim().replace(/[\s,]+$/, "");
  if (!cleanHead) return SUNO_STYLE_SUFFIX.slice(0, limit);

  const room = limit - SUNO_STYLE_SUFFIX.length - 2;
  if (room <= 0) return cleanHead.slice(0, limit);
  if (cleanHead.length <= room) return `${cleanHead}, ${SUNO_STYLE_SUFFIX}`;

  let trimmed = cleanHead.slice(0, room);
  const lastBreak = Math.max(trimmed.lastIndexOf(" "), trimmed.lastIndexOf(","));
  if (lastBreak > room * 0.6) trimmed = trimmed.slice(0, lastBreak);
  trimmed = trimmed.replace(/[\s,]+$/, "");
  return `${trimmed}, ${SUNO_STYLE_SUFFIX}`;
}

function buildSunoStyle(genre: string, styleNotes?: string | null): string {
  const cleanGenre = stripEmojiPrefix(genre);
  const notes = stripControlChars(styleNotes ?? "").trim().slice(0, MAX_STYLE_NOTES_LEN);
  return fitSunoStyle(notes ? `${cleanGenre}, ${notes}` : cleanGenre);
}

function buildRefinedSunoStyle(refined: string): string {
  return fitSunoStyle(refined);
}

function errResponse(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

async function pollUntilDone(jobId: string): Promise<string> {
  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  while (Date.now() - started < SUNO_TIMEOUT_MS) {
    const s = await checkStatus(jobId);
    if (s.status === "complete") return s.audioUrl;
    if (s.status === "failed") throw new Error(`Suno failed: ${s.error}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error("Suno status polling timed out");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!id || !ID_RE.test(id)) return errResponse("Invalid share id.", 400);

  const song = await loadSharedSong(id);
  if (!song) return errResponse("Share not found.", 404);

  const currentRetries = song.retryCount ?? 0;
  if (currentRetries >= MAX_REGEN_RETRIES) {
    return errResponse(
      `You can only try ${MAX_REGEN_RETRIES} different versions per song.`,
      429,
    );
  }
  const nextRetry = currentRetries + 1;

  // Optional style-notes override from the retry UI. JSON body is optional —
  // an empty POST is the original "remake with same style" behavior.
  let styleNotesOverride: string | undefined;
  let styleNotesProvided = false;
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text) as { style_notes?: unknown };
      if (typeof body.style_notes === "string") {
        styleNotesProvided = true;
        const trimmed = stripControlChars(body.style_notes).trim().slice(0, MAX_STYLE_NOTES_LEN);
        styleNotesOverride = trimmed || undefined;
      }
    }
  } catch {
    // Malformed JSON body — treat as no override.
  }

  const styleNotesToUse = styleNotesProvided ? styleNotesOverride : song.styleNotes;

  // Style assembly mirrors generate-music: if we have style notes, prefer the
  // Claude-refined descriptor so Suno gets the same precise prompt as the
  // initial take. Cache hit when the user kept the same notes; cache miss
  // (Haiku re-call) when they edited them in the retry UI. Refinement
  // failures fall through to the plain genre+notes concatenation — the user
  // already paid for one Suno run, we don't block their second attempt.
  let refinedStyleForRetry: string | undefined;
  if (styleNotesToUse) {
    if (styleNotesProvided) {
      try {
        refinedStyleForRetry = await refineStyleForSuno({
          genre: song.genre,
          styleNotes: styleNotesToUse,
          recipientName: song.name,
        });
        void recordSpendCents("openai", 1);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[regenerate ${id}] style-refine failed, falling back: ${msg}`);
      }
    } else if (song.refinedStyle) {
      refinedStyleForRetry = song.refinedStyle;
    }
  }

  const style = refinedStyleForRetry
    ? buildRefinedSunoStyle(refinedStyleForRetry)
    : buildSunoStyle(song.genre, styleNotesToUse);

  // Submit fresh Suno generation with the same lyrics + (possibly updated) style.
  let jobId: string;
  try {
    // Re-apply the pronunciation substitution on the Suno-bound copy. The
    // persisted song.lyrics is the display version with the original name;
    // we only swap names for what Suno's tokenizer sees.
    const hint = song.pronunciationHint;
    const sunoLyricsRaw = hint
      ? applyPronunciationHint({ text: song.lyrics.raw, name: song.name, hint })
      : song.lyrics.raw;
    const sunoTitle = hint
      ? applyPronunciationHint({ text: song.lyrics.title, name: song.name, hint })
      : song.lyrics.title;

    jobId = await submitGeneration({
      lyrics: sunoLyricsRaw,
      style,
      title: sunoTitle,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "submit failed";
    console.error(`[regenerate ${id}] suno submit:`, msg);
    if (/429|rate.?limit/i.test(msg)) {
      return errResponse("Music service is busy. Try again in a minute.", 429);
    }
    return errResponse("Couldn't start a fresh take. Please try again.", 502);
  }

  let freshAudioUrl: string;
  try {
    freshAudioUrl = await pollUntilDone(jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "poll failed";
    console.error(`[regenerate ${id}] suno poll:`, msg);
    return errResponse("Couldn't finish the new take in time. Please try again.", 504);
  }

  // Re-render video with the new audio. Upload under a versioned R2 key so
  // CDN-cached old MP4 doesn't get served to fresh viewers.
  let freshVideoUrl: string | undefined;
  try {
    // cakeStyle + candleColor still live on `song` (persisted at share-create
    // time) but are intentionally NOT passed to the renderer — overlay path
    // was rolled back. The persistence stays so a future visual pass picks
    // them up without re-prompting users on retries.
    const rendered = await renderShareVideo({
      audioUrl: freshAudioUrl,
      name: song.name,
      template: song.template,
      language: song.language,
      logId: `${id}-v${nextRetry}`,
      senderName: song.senderName,
      venueName: song.venueName,
      venueColor: song.venueColor,
      personalNote: song.personalNote,
      genre: song.genre,
      backgroundSeed: id,
    });
    freshVideoUrl = await uploadToR2(
      `shares/${id}-v${nextRetry}.mp4`,
      rendered.mp4,
      "video/mp4",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "render failed";
    console.error(`[regenerate ${id}] video render/upload:`, msg);
    // Fall through — persist with audio only, same as initial /api/share path.
  }

  const updated: SharedSong = {
    ...song,
    audioUrl: freshAudioUrl,
    videoUrl: freshVideoUrl ?? song.videoUrl,
    retryCount: nextRetry,
    // Persist whichever style was actually used. If override was supplied,
    // record that — even an empty override clears the previously-stored
    // styleNotes (intentional: user wanted "plain genre" this time). When the
    // user overrides, we also refresh refinedStyle so subsequent retries hit
    // the Haiku cache instead of re-paying; an empty override clears it.
    ...(styleNotesProvided
      ? {
          styleNotes: styleNotesOverride,
          refinedStyle: styleNotesOverride ? refinedStyleForRetry : undefined,
        }
      : {}),
  };
  try {
    await saveSharedSong(updated);
  } catch (err) {
    console.error(`[regenerate ${id}] kv-write:`, err);
    return errResponse("Couldn't save the new take. Please try again.", 502);
  }

  return Response.json({
    audioUrl: freshAudioUrl,
    videoUrl: freshVideoUrl,
    retriesUsed: nextRetry,
    retriesRemaining: MAX_REGEN_RETRIES - nextRetry,
  });
}
