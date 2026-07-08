// Close a crowd-magic gift and weave the circle's contributions into ONE song.
//
// POST /api/crowd/[id]/close
// - Only the director (the giver who minted the gift) may close it — gated on
//   the smb_director cookie set at create time (app/api/crowd/create).
// - Flips crowd.status "collecting" → "closed" (a durable checkpoint), then runs
//   the SAME lyric + music pipeline the solo flow uses, feeding the approved
//   contributions in as extra lyric context, and finally persists the finished
//   song with crowd.status = "merged".
//
// Resilience: the pipeline is decomposed into discrete, retry-wrapped steps.
// The "closed" checkpoint is written before any model call, so a mid-pipeline
// failure leaves the gift closed-but-unmerged and the director can re-POST to
// retry the merge (contributions are already frozen). This shape maps 1:1 onto
// Inngest durable steps later: each stepX() becomes a step.run(...), and the
// audio poll becomes step.waitForEvent on the Suno webhook instead of a loop.
// (No new dependency is added for this first cut — it runs inline.)

import { cookies } from "next/headers";
import {
  loadSharedSong,
  saveSharedSong,
  loadCrowdDirectorToken,
} from "@/lib/share";
import { generateLyrics, type LyricsInput } from "@/lib/anthropic";
import {
  listApprovedContributions,
  composeLyricContext,
  collectPhotoUrls,
  collectVoiceUrls,
  setContributionContent,
} from "@/lib/crowd";
import { transcribeFromUrl } from "@/lib/transcribe-audio";
import { moderateShareInput } from "@/lib/moderation";
import { getMusicProvider } from "@/lib/music-provider";
import type { Lyrics, SharedSong } from "@/lib/api-types";

export const runtime = "nodejs";
// Generous ceiling so the inline poll can await Suno on Vercel Pro. Production
// durability should move this to Inngest (step.waitForEvent on the webhook);
// see the file header. `next dev` does not enforce this, so local verify runs
// the full ~60-120s pipeline end-to-end.
export const maxDuration = 300;

const DIRECTOR_COOKIE = "smb_director";
const ID_RE = /^[a-zA-Z0-9]{1,32}$/;
// Fallback genre when a crowd gift was minted without one — the lyric + music
// prompts both need a genre to anchor tone.
const DEFAULT_GENRE = "🎤 Pop";

// Audio poll bounds (inline first cut). Suno typically finishes in ~60-120s.
const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 80; // ~4 min ceiling, under maxDuration
const MAX_POLL_ERRORS = 5; // tolerate transient status blips before giving up

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry a transient step with linear backoff. Throws the last error. */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[crowd-close] ${label} attempt ${i}/${attempts} failed: ${msg}`);
      if (i < attempts) await sleep(1_000 * i);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}

// ── Steps (each maps to a future Inngest step.run) ──────────────────────────

/** Mark collection closed BEFORE any model call, so a failure is retryable. */
async function stepCloseCollection(song: SharedSong): Promise<void> {
  if (song.crowd) song.crowd.status = "closed";
  await saveSharedSong(song);
}

/**
 * Gather approved contributions into a lyric-prompt context block, plus the
 * photo URLs (Deluxe slideshow) and voice URLs (future montage).
 *
 * Voice notes carry no text at contribute time, so here we Whisper-transcribe
 * each one (in the gift's language), moderate the words, and persist the clean
 * transcript onto the contribution's `content` — which makes composeLyricContext
 * fold the spoken words into the lyrics. Persisting is idempotent: a re-close
 * skips clips that already have a transcript. Best-effort per clip — a failed or
 * flagged transcription just leaves that voice out of the words (its audio is
 * still kept in voiceUrls).
 */
async function stepBuildContext(
  id: string,
  language: string,
): Promise<{ context: string; count: number; photoUrls: string[]; voiceUrls: string[] }> {
  const contributions = await listApprovedContributions(id);

  await Promise.all(
    contributions.map(async (c) => {
      if (c.kind !== "voice" || !c.contentUrl || c.content?.trim()) return;
      const transcript = await transcribeFromUrl(c.contentUrl, language);
      if (!transcript) return;
      const mod = await moderateShareInput([transcript]).catch(() => ({ allowed: true }));
      if (!mod.allowed) return; // flagged words never reach the lyrics
      c.content = transcript; // update in-memory so composeLyricContext sees it
      await setContributionContent(c.id, transcript); // persist for idempotent re-close
    }),
  );

  return {
    context: composeLyricContext(contributions),
    count: contributions.length,
    photoUrls: collectPhotoUrls(contributions),
    voiceUrls: collectVoiceUrls(contributions),
  };
}

/** Reuse the solo lyric pipeline, appending the crowd context as extra input. */
async function stepGenerateLyrics(
  song: SharedSong,
  genre: string,
  context: string,
): Promise<Lyrics> {
  const extras = context
    ? `The birthday person's friends and family each added lines, memories, wishes, and voice notes below — weave in as many as you naturally can:\n${context}`
    : undefined;
  const input: LyricsInput = {
    name: song.name,
    language: song.language,
    genre,
    extras,
  };
  return withRetry("generate-lyrics", () => generateLyrics(input));
}

/** Reuse the existing music provider (Suno) to submit the merged song. Mirrors
 * the solo flow's buildSunoStyle: the SHORT genre (emoji stripped) + birthday
 * boilerplate. Kept under Suno's ~200-char style limit — the model's verbose
 * lyrics.style descriptor would blow past it. */
async function stepSubmitMusic(lyrics: Lyrics, genre: string): Promise<string> {
  const provider = getMusicProvider();
  const cleanGenre = genre.replace(/^[^\p{L}]+/u, "").trim() || genre;
  const style = [
    cleanGenre,
    "full, cheerful birthday song with a clear verse and chorus",
    "about 60 seconds",
    "natural ending",
  ]
    .join(", ")
    .slice(0, 200);
  return withRetry("submit-music", () =>
    provider.submit({ lyrics: lyrics.raw, style, title: lyrics.title }),
  );
}

/**
 * Await the finished audio. Inline poll for the first cut; the Inngest version
 * replaces this with step.waitForEvent on the Suno completion webhook.
 */
async function stepAwaitAudio(jobId: string): Promise<{ audioUrl: string; durationSec?: number }> {
  const provider = getMusicProvider();
  let errors = 0;
  for (let i = 0; i < MAX_POLLS; i += 1) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const status = await provider.checkStatus(jobId);
      if (status.status === "complete") {
        return { audioUrl: status.audioUrl, durationSec: status.durationSec };
      }
      if (status.status === "failed") {
        throw new Error(`music generation failed: ${status.error}`);
      }
      errors = 0; // a clean "pending" resets the transient-error streak
    } catch (err) {
      if (err instanceof Error && /music generation failed/.test(err.message)) throw err;
      errors += 1;
      if (errors >= MAX_POLL_ERRORS) throw err;
    }
  }
  throw new Error("music generation timed out");
}

/** Persist the finished merged song. Crowd photo contributions are folded into
 *  song.photoUrls (deduped, capped 6) for the Deluxe slideshow; crowd voice
 *  notes are kept on song.voiceUrls (deduped, capped 10) for a future montage. */
async function stepPersistMerged(
  song: SharedSong,
  lyrics: Lyrics,
  audioUrl: string,
  photoUrls: string[],
  voiceUrls: string[],
): Promise<void> {
  song.lyrics = lyrics;
  song.audioUrl = audioUrl;
  if (photoUrls.length > 0) {
    const merged = [...(song.photoUrls ?? []), ...photoUrls];
    song.photoUrls = Array.from(new Set(merged)).slice(0, 6);
  }
  if (voiceUrls.length > 0) {
    const merged = [...(song.voiceUrls ?? []), ...voiceUrls];
    song.voiceUrls = Array.from(new Set(merged)).slice(0, 10);
  }
  if (song.crowd) song.crowd.status = "merged";
  await saveSharedSong(song);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!id || !ID_RE.test(id)) {
    return jsonError("INVALID_INPUT", "Invalid gift id.", 400);
  }

  const song = await loadSharedSong(id);
  if (!song) {
    return jsonError("NOT_FOUND", "This gift link isn't valid or has expired.", 404);
  }
  if (!song.crowd) {
    return jsonError("NOT_CROWD", "This gift isn't a group song.", 403);
  }
  if (song.crowd.status === "merged" && song.audioUrl) {
    // Already done — return the finished state idempotently.
    return Response.json({ id, status: "merged", audioUrl: song.audioUrl });
  }

  // Director gate: only the browser that minted the gift may close it. The
  // stored token lives out of band (never in the served SharedSong).
  const jar = await cookies();
  const cookieToken = jar.get(DIRECTOR_COOKIE)?.value ?? "";
  const directorToken = await loadCrowdDirectorToken(id);
  if (!directorToken || !cookieToken || cookieToken !== directorToken) {
    return jsonError("FORBIDDEN", "Only the person who created this group song can close it.", 403);
  }

  const genre = song.genre?.trim() || DEFAULT_GENRE;

  try {
    // 1. Freeze collection (durable checkpoint before any model call).
    if (song.crowd.status === "collecting") {
      await stepCloseCollection(song);
    }
    // 2. Assemble the circle's contributions: text + transcribed voice notes
    //    for the lyrics, plus photo + voice URLs for the merged song.
    const { context, count, photoUrls, voiceUrls } = await stepBuildContext(id, song.language);
    // 3. Lyrics (solo pipeline + crowd context).
    const lyrics = await stepGenerateLyrics(song, genre, context);
    // 4. Music submit.
    const jobId = await stepSubmitMusic(lyrics, genre);
    // 5. Await audio.
    const { audioUrl } = await stepAwaitAudio(jobId);
    // 6. Persist the merged song (crowd photos → slideshow, voices → montage).
    await stepPersistMerged(song, lyrics, audioUrl, photoUrls, voiceUrls);

    return Response.json({
      id,
      status: "merged",
      audioUrl,
      contributionCount: count,
      title: lyrics.title,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown crowd-merge error";
    console.error("[crowd-close] merge failed:", message);
    // The gift stays "closed" (frozen contributions) — the director can re-POST
    // to retry the merge without losing anything.
    return jsonError(
      "MERGE_FAILED",
      "Contributions are saved and collection is closed, but the song couldn't be generated. Please try again.",
      502,
    );
  }
}
