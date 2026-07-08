// Server-only photo-slideshow compositing pipeline.
//
// renderSlideshow downloads the user's photos and song audio, then runs a
// single ffmpeg pass that:
//   • Scales+crops each photo to a vertical 1080x1920 (9:16) canvas.
//   • Applies a slow Ken-Burns zoom/pan (zoompan) over each photo's hold.
//   • Crossfades (xfade) between consecutive photos.
//   • Loops the photo sequence to cover the song length, then trims/-shortest
//     against the audio so the video ends exactly with the song.
//   • Muxes the song audio in unchanged.
//
// Mirrors lib/video.ts: same @ffmpeg-installer import, same fluent-ffmpeg
// spawn style, same tmp-dir + download + probe + error handling.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffmpegInstaller.path.replace(/ffmpeg$/, "ffprobe"));

// The Ken-Burns slideshow needs `zoompan` + `xfade`. A minimal static ffmpeg
// build (as bundled on Vercel) can omit them, in which case every render throws
// "Option not found". Probe `ffmpeg -filters` once per process so the route can
// give a Deluxe buyer an honest "not available on this deploy" answer instead of
// a generic retry loop for something that will never succeed here. Cached.
let slideshowFiltersSupportedCache: boolean | null = null;
export function slideshowFiltersSupported(): Promise<boolean> {
  if (slideshowFiltersSupportedCache !== null) {
    return Promise.resolve(slideshowFiltersSupportedCache);
  }
  return new Promise<boolean>((resolve) => {
    execFile(ffmpegInstaller.path, ["-hide_banner", "-filters"], (err, stdout) => {
      // On probe failure, assume supported and let renderSlideshow's own error
      // handling deal with it — never let the probe itself block a render.
      if (err) {
        slideshowFiltersSupportedCache = true;
        resolve(true);
        return;
      }
      const list = stdout || "";
      const supported = /\bzoompan\b/.test(list) && /\bxfade\b/.test(list);
      slideshowFiltersSupportedCache = supported;
      resolve(supported);
    });
  });
}

// Vertical output — slideshows are made for phones / stories. 1080x1920 keeps
// parity with the rest of the brand's video output; libx264 veryfast handles
// ~6 stills + crossfades well within the route's 120s ceiling.
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const FPS = 30;
// Each photo is fully visible for PHOTO_HOLD_SEC; consecutive photos overlap
// for XFADE_SEC during the crossfade. The Ken-Burns zoom runs across the whole
// hold for a slow, gentle drift.
const PHOTO_HOLD_SEC = 2.5;
const XFADE_SEC = 0.8;
// Inter Bold from public/video-fonts/ (same asset lib/video.ts uses) for the
// brand watermark drawtext. On Vercel cwd is /var/task; the route's
// outputFileTracingIncludes must ship public/video-fonts/**.
const FONT_PATH = path.join(process.cwd(), "public", "video-fonts", "Inter-Bold.ttf");
const MAX_PHOTOS = 6;
// Bound the muxed length so a long Suno overshoot can't produce a huge file.
const MAX_SLIDESHOW_SEC = 75;
const MIN_SLIDESHOW_SEC = 4;

const FETCH_TIMEOUT_MS = 25_000;

export type RenderSlideshowInput = {
  audioUrl: string;
  photoUrls: string[];
  logId?: string;
};

export type RenderSlideshowResult = {
  mp4: Buffer;
  durationSec: number;
};

function logStage(
  logId: string,
  stage: string,
  startedAt: number,
  extra?: Record<string, string | number>,
): void {
  const tookMs = Date.now() - startedAt;
  const extras = extra ? " " + Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(" ") : "";
  console.log(`[slideshow:${stage}] took ${tookMs}ms id=${logId}${extras}`);
}

async function downloadToTemp(url: string, dest: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("download empty");
    await writeFile(dest, buf);
  } finally {
    clearTimeout(timeout);
  }
}

function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err: Error | null, data: ffmpeg.FfprobeData) => {
      if (err) {
        resolve(0);
        return;
      }
      const seconds = Number(data?.format?.duration ?? 0);
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
    });
  });
}

/**
 * Build the complex filtergraph for `count` still images (inputs [0..count-1])
 * plus the audio at input index `count`.
 *
 * Per photo: scale to cover the 9:16 frame, crop to exact size, then zoompan a
 * slow zoom over the hold window. zoompan needs a fixed frame count `d` and an
 * fps; we render each photo for (hold + xfade) seconds so the trailing xfade
 * overlap has frames to blend into. Consecutive photos are then chained with
 * xfade, each transition offset by the cumulative hold time.
 */
function buildFilterGraph(count: number): { filter: string; videoLabel: string } {
  const holdFrames = Math.round((PHOTO_HOLD_SEC + XFADE_SEC) * FPS);
  // Pre-scale larger than the frame so the zoompan crop never reveals edges,
  // then zoompan zooms from 1.0 → ZOOM_MAX across the clip for a gentle drift.
  const ZOOM_MAX = 1.12;
  const zoomExpr = `min(zoom+${((ZOOM_MAX - 1) / holdFrames).toFixed(6)},${ZOOM_MAX})`;

  const parts: string[] = [];

  // Each photo: cover-fit to 9:16, pad to exact, then Ken-Burns zoompan.
  for (let i = 0; i < count; i += 1) {
    // increase_then_crop: scale to cover, then crop to the exact canvas so no
    // letterboxing. The intermediate scale to 2x keeps the zoompan crisp.
    parts.push(
      `[${i}:v]` +
        `scale=${OUTPUT_WIDTH * 2}:${OUTPUT_HEIGHT * 2}:force_original_aspect_ratio=increase,` +
        `crop=${OUTPUT_WIDTH * 2}:${OUTPUT_HEIGHT * 2},` +
        `zoompan=z='${zoomExpr}':` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
        `d=${holdFrames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${FPS},` +
        `setsar=1,format=yuv420p[v${i}]`,
    );
  }

  let baseLabel: string;
  if (count === 1) {
    baseLabel = "[v0]";
  } else {
    // Chain xfade transitions. Each clip is (hold + xfade) long; transition N
    // starts at the cumulative hold of all prior clips.
    let prevLabel = "[v0]";
    for (let i = 1; i < count; i += 1) {
      const outLabel = i === count - 1 ? "[vout]" : `[x${i}]`;
      const offset = (PHOTO_HOLD_SEC * i).toFixed(3);
      parts.push(
        `${prevLabel}[v${i}]xfade=transition=fade:duration=${XFADE_SEC}:offset=${offset}${outLabel}`,
      );
      prevLabel = outLabel;
    }
    baseLabel = "[vout]";
  }

  // Brand watermark — discreet, persistent, bottom-right. Every reshared
  // slideshow then carries singmybirthday.com, turning shares into free reach.
  parts.push(
    `${baseLabel}drawtext=fontfile=${FONT_PATH}:text='singmybirthday.com':` +
      `fontcolor=white@0.85:fontsize=34:x=w-tw-36:y=h-th-44:` +
      `box=1:boxcolor=black@0.35:boxborderw=12[wm]`,
  );

  return { filter: parts.join(";"), videoLabel: "[wm]" };
}

function runFfmpeg(args: {
  photoPaths: string[];
  audioPath: string;
  outputPath: string;
  targetDurationSec: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const { filter, videoLabel } = buildFilterGraph(args.photoPaths.length);

    const command = ffmpeg();
    // Each still is looped as a 1-frame video; xfade/zoompan generate the
    // motion frames. -loop 1 + a generous -t per input lets ffmpeg produce
    // enough frames for the hold + crossfade.
    for (const p of args.photoPaths) {
      command.input(p).inputOptions(["-loop", "1", "-t", String(PHOTO_HOLD_SEC + XFADE_SEC + 0.5)]);
    }
    // Audio last. -stream_loop -1 loops the song so a short sequence still has
    // audio to the very end; -shortest then trims to the video length.
    command.input(args.audioPath).inputOptions(["-stream_loop", "-1"]);

    command
      .complexFilter(filter)
      .outputOptions([
        "-map", videoLabel,
        "-map", `${args.photoPaths.length}:a`,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-r", String(FPS),
        "-c:a", "aac",
        "-b:a", "192k",
        // Cap to the song length (or our ceiling, whichever is shorter) and end
        // with the audio. -shortest closes out cleanly when the video runs dry.
        "-t", args.targetDurationSec.toFixed(2),
        "-shortest",
        "-movflags", "+faststart",
      ])
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve())
      .save(args.outputPath);
  });
}

export async function renderSlideshow(input: RenderSlideshowInput): Promise<RenderSlideshowResult> {
  const logId = input.logId ?? randomUUID().slice(0, 8);
  const totalStart = Date.now();

  const photoUrls = input.photoUrls.slice(0, MAX_PHOTOS);
  if (photoUrls.length === 0) {
    throw new Error("renderSlideshow: no photos provided");
  }

  const workDir = await mkdtemp(path.join(tmpdir(), `bday-slideshow-${randomUUID()}-`));
  const audioPath = path.join(workDir, "audio.mp3");
  const outputPath = path.join(workDir, "out.mp4");
  const photoPaths = photoUrls.map((_, i) => path.join(workDir, `photo-${i}.img`));

  try {
    const fetchStart = Date.now();
    await Promise.all([
      downloadToTemp(input.audioUrl, audioPath),
      ...photoUrls.map((url, i) => downloadToTemp(url, photoPaths[i])),
    ]);
    logStage(logId, "assets-fetch", fetchStart, { photos: photoPaths.length });

    const probeStart = Date.now();
    const probedAudioSec = await probeDuration(audioPath);
    logStage(logId, "audio-probe", probeStart, { audio: probedAudioSec.toFixed(2) });

    // Target length: the song length, clamped to sane bounds. If the probe
    // failed, fall back to a length that shows every photo once.
    const photosSpan = PHOTO_HOLD_SEC * photoPaths.length + XFADE_SEC;
    const rawTarget = probedAudioSec > 0 ? probedAudioSec : photosSpan;
    const targetDurationSec = Math.max(
      MIN_SLIDESHOW_SEC,
      Math.min(rawTarget, MAX_SLIDESHOW_SEC),
    );

    const ffmpegStart = Date.now();
    await runFfmpeg({ photoPaths, audioPath, outputPath, targetDurationSec });
    logStage(logId, "ffmpeg-mux", ffmpegStart, { target: targetDurationSec.toFixed(2) });

    const readStart = Date.now();
    const [mp4, durationSec] = await Promise.all([
      readFile(outputPath),
      probeDuration(outputPath),
    ]);
    logStage(logId, "read+probe", readStart, { bytes: mp4.length });
    logStage(logId, "render-total", totalStart);

    return { mp4, durationSec };
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
