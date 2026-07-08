// Server-only audio highlight-cut pipeline.
//
// Suno always returns a full ~2–3 minute track that repeats the same hook —
// there is no prompt/param to shorten it. A 3-minute loop is a weak preview
// AND a weak Standard deliverable. This module carves a tight, energetic
// HIGHLIGHT (~55s: post-intro hook → verse → chorus) with clean fades, which
// becomes:
//   • the 15s preview (now sampled from the strong part, not a slow intro),
//   • the Standard "complete song" audio, and the audiogram/karaoke video
//     source (so the video is dense and repeat-free),
// while the untouched full-length track is preserved separately as the
// Deluxe "full version" download.
//
// Best-effort: renderHighlightCut returns null on any failure, so callers
// fall back to the raw Suno audioUrl and nothing breaks. Reuses the same
// @ffmpeg-installer binary already traced into the /api/share bundle.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffmpegInstaller.path.replace(/ffmpeg$/, "ffprobe"));

const FETCH_TIMEOUT_MS = 25_000;

// Target highlight length: long enough to carry intro→verse→chorus, short
// enough to stay tight and repeat-free.
const TARGET_CUT_SEC = 55;
// Below this the source is already short enough that a cut adds nothing —
// return null and let the raw audio stand.
const MIN_SOURCE_FOR_CUT_SEC = 70;
const FADE_IN_SEC = 0.5;
const FADE_OUT_SEC = 2;

// Free preview length. The locked share plays ONLY this clip (served through a
// gated route), so it is the sole thing an un-paid visitor can ever fetch.
const PREVIEW_SEC = 15;
const PREVIEW_FADE_OUT_SEC = 1.5;

export type HighlightCut = {
  /** The trimmed ~55s highlight (mp3), with clean in/out fades. */
  cutMp3: Buffer;
  cutDurationSec: number;
  /** The full-length source re-encoded to a stable mp3 (for Deluxe download). */
  fullMp3: Buffer;
  fullDurationSec: number;
  /** A ~15s preview (mp3) sampled from the hook — the only clip locked. */
  previewMp3: Buffer;
  previewDurationSec: number;
};

/**
 * Trim just the free preview from a source mp3 (already on disk) — the first
 * ~15s of the highlight window, with a soft tail fade. Exported so the gated
 * preview route can lazily generate it for legacy songs that predate the cut.
 */
export async function renderPreviewFromFile(
  inputPath: string,
  startSec: number,
  maxLenSec: number,
): Promise<Buffer | null> {
  let outDir: string | null = null;
  try {
    outDir = await mkdtemp(path.join(tmpdir(), "smb-prev-"));
    const outPath = path.join(outDir, `prev-${randomUUID()}.mp3`);
    const len = Math.min(PREVIEW_SEC, Math.max(0, maxLenSec));
    if (len < 3) return null;
    const fadeOutStart = Math.max(0, len - PREVIEW_FADE_OUT_SEC);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startSec)
        .duration(len)
        .audioFilters([
          `afade=t=in:st=0:d=0.4`,
          `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${PREVIEW_FADE_OUT_SEC}`,
        ])
        .audioCodec("libmp3lame")
        .audioBitrate("160k")
        .noVideo()
        .format("mp3")
        .on("error", (err: Error) => reject(err))
        .on("end", () => resolve())
        .save(outPath);
    });
    const buf = await readFile(outPath);
    return buf.length > 0 ? buf : null;
  } catch (err) {
    console.error(
      "[audio-cut] renderPreviewFromFile failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    if (outDir) await rm(outDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function downloadToTemp(url: string, dest: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`audio download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("audio download empty");
    await writeFile(dest, buf);
  } finally {
    clearTimeout(timeout);
  }
}

// Read duration straight from ffmpeg's stderr. CRITICAL: @ffmpeg-installer ships
// the ffmpeg binary but NOT ffprobe, so ffmpeg.ffprobe() fails at runtime on
// Vercel — we must not depend on it. Running `ffmpeg -i <file>` with no output
// exits non-zero but prints "Duration: HH:MM:SS.ss" to stderr, which we parse.
function durationViaFfmpeg(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      ffmpegInstaller.path,
      ["-hide_banner", "-i", filePath],
      (_err, _stdout, stderr) => {
        const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr || "");
        if (!m) {
          resolve(0);
          return;
        }
        const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]);
        resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
      },
    );
  });
}

// Try ffprobe first (present in some environments), fall back to parsing
// ffmpeg's own output so we always get a real duration.
async function probeDuration(filePath: string): Promise<number> {
  const viaProbe = await new Promise<number>((resolve) => {
    ffmpeg.ffprobe(filePath, (err: Error | null, data: ffmpeg.FfprobeData) => {
      if (err) {
        resolve(0);
        return;
      }
      const seconds = Number(data?.format?.duration ?? 0);
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
    });
  });
  if (viaProbe > 0) return viaProbe;
  return durationViaFfmpeg(filePath);
}

// Where the highlight starts. Skip a slow intro on longer tracks so the cut
// opens on energy rather than a fade-in. Conservative + deterministic (no
// audio analysis) so the result is stable and never lands past the song.
function pickStartSec(sourceDurationSec: number): number {
  if (sourceDurationSec > 150) return 12;
  if (sourceDurationSec > 100) return 8;
  if (sourceDurationSec > 75) return 4;
  return 0;
}

function renderCut(
  inputPath: string,
  outputPath: string,
  startSec: number,
  durationSec: number,
): Promise<void> {
  // Output-side seek (-ss after input) resets output timestamps to 0 at the
  // cut, so the afade offsets below are relative to the trimmed clip.
  const fadeOutStart = Math.max(0, durationSec - FADE_OUT_SEC);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSec)
      .duration(durationSec)
      .audioFilters([
        `afade=t=in:st=0:d=${FADE_IN_SEC}`,
        `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${FADE_OUT_SEC}`,
      ])
      .audioCodec("libmp3lame")
      .audioBitrate("192k")
      .noVideo()
      .format("mp3")
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve())
      .save(outputPath);
  });
}

/**
 * Download the Suno track and produce a tight highlight cut + a persisted copy
 * of the full track. Returns null when the source is already short, unusable,
 * or ffmpeg fails — callers then keep the raw Suno audioUrl.
 */
export async function renderHighlightCut(audioUrl: string): Promise<HighlightCut | null> {
  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(path.join(tmpdir(), "smb-cut-"));
    const inputPath = path.join(workDir, `src-${randomUUID()}.mp3`);
    await downloadToTemp(audioUrl, inputPath);

    const probed = await probeDuration(inputPath);
    // Only SKIP when we positively know the source is short. If duration is
    // unreadable (probed === 0), assume a full Suno track (always 2–3 min) and
    // proceed — never let a probe miss silently disable the cut in production.
    if (probed > 0 && probed < MIN_SOURCE_FOR_CUT_SEC) {
      return null;
    }
    const ASSUMED_WHEN_UNKNOWN = 150;
    const fullDurationSec = probed > 0 ? probed : ASSUMED_WHEN_UNKNOWN;

    const startSec = pickStartSec(fullDurationSec);
    const cutDurationSec = Math.min(
      TARGET_CUT_SEC,
      Math.max(0, fullDurationSec - startSec),
    );
    if (cutDurationSec < 20) return null;

    const cutPath = path.join(workDir, `cut-${randomUUID()}.mp3`);
    await renderCut(inputPath, cutPath, startSec, cutDurationSec);

    // Free preview — the only clip a locked visitor can fetch. Sampled from the
    // same hook window as the highlight so the teaser is the strong part.
    const previewMp3 = await renderPreviewFromFile(inputPath, startSec, cutDurationSec);

    // The full track is already an mp3 (Suno serves .mp3). Suno tempfiles
    // expire within hours, so we persist the downloaded bytes as-is — no need
    // to burn a second ffmpeg pass re-encoding what's already in the format.
    const [cutMp3, fullMp3] = await Promise.all([readFile(cutPath), readFile(inputPath)]);
    if (cutMp3.length === 0 || fullMp3.length === 0 || !previewMp3) return null;

    return {
      cutMp3,
      cutDurationSec,
      fullMp3,
      fullDurationSec,
      previewMp3,
      previewDurationSec: Math.min(PREVIEW_SEC, cutDurationSec),
    };
  } catch (err) {
    console.error(
      "[audio-cut] renderHighlightCut failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
