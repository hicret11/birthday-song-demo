// Server-only video compositing pipeline.
//
// Pre-rendered template MP4s live on R2 (one per template, each ~60s).
// renderShareVideo downloads the user audio, probes its duration, then runs
// a single ffmpeg pass that:
//   • Plays the template through (no loop) — birthday songs are short by
//     design (Suno is prompted for ~35s, hard ceiling 60s).
//   • Caps the audio at the template length (60s) if Suno overshoots its
//     duration hint, with a 1-second fade-out at the cut so it doesn't
//     end abruptly.
//   • Burns personalized text overlays — headline "Happy Birthday",
//     recipient name, optional sender/venue subtitle, and a discreet
//     singmybirthday.com mark in the last 3s.
//   • Re-encodes video with libx264 (the drawtext filter requires this;
//     stream-copy is no longer an option now that we draw on the frame).
//
// All text is white-filled with a black stroke for legibility on every
// template's background — same approach the discovery batch uses.

import { mkdtemp, readFile, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import type { ShareTemplate } from "./api-types";
import { templateVideoPath } from "./video-style";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffmpegInstaller.path.replace(/ffmpeg$/, "ffprobe"));

export const MAX_VIDEO_SECONDS = 60;
const TEMPLATE_DURATION_SEC = 60;
// Fade the last second of audio so a hard 60s cap (when Suno overshoots its
// ~35s target) doesn't sound abrupt. Songs that come back at or under 60s
// still get the same tail fade applied to their final second.
const AUDIO_TAIL_FADE_SEC = 1;
const ATTRIBUTION_TAIL_SEC = 3;
const BRAND_PINK = "#ec4899";
// Templates are stored at 1080p (1920x1080), but drawtext forces a full
// re-encode and re-encoding 60s of 1080p with libx264 exceeds the Vercel
// function ceiling on a single-vCPU sandbox. We scale to 720p before
// drawtext: ~4× less pixel work for the codec, output drops from ~25 MB to
// ~9 MB, and the visual difference on a phone is negligible.
const OUTPUT_WIDTH = 1280;
// Font sizes were tuned for the 1080p template; downscale by the same ratio
// so the text-to-frame proportion stays the same at the new resolution.
const FONT_SCALE = 720 / 1080;
function px(value: number): number {
  return Math.max(1, Math.round(value * FONT_SCALE));
}

const FETCH_TIMEOUT_MS = 25_000;

// Inter Bold lives in public/video-fonts/. The serverless function needs the
// font on disk at render time, which means it must be traced into the bundle
// (see next.config.ts outputFileTracingIncludes).
const FONT_PATH = path.join(process.cwd(), "public", "video-fonts", "Inter-Bold.ttf");

export type RenderVideoInput = {
  audioUrl: string;
  name: string;
  template: ShareTemplate;
  language: string;
  logId?: string;
  /** Optional — burned as "with love from {senderName}" in the subtitle. */
  senderName?: string;
  /** Optional — burned as the venue half of the subtitle. */
  venueName?: string;
  /** Optional — #RRGGBB; tints the headline + recipient name when present. */
  venueColor?: string;
  /**
   * Optional caption from the "Make it Yours" panel — drawn as a smaller
   * text layer just below the recipient name. Already trimmed and capped
   * server-side; we still drawtext-escape here for filtergraph safety.
   */
  personalNote?: string;
  /** Optional — song genre; picks a genre-themed background when assets exist. */
  genre?: string;
  /** Optional — stable seed (e.g. share id) for deterministic background variety. */
  backgroundSeed?: string;
};

export type RenderVideoResult = {
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
  console.log(`[share-create:${stage}] took ${tookMs}ms id=${logId}${extras}`);
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

// ffmpeg drawtext escapes (same shape the discovery batch uses).
// We wrap the result in single quotes at the call site.
function escapeDrawtext(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function safeColor(value: string | undefined, fallback: string): string {
  if (value && HEX_RE.test(value)) return value;
  return fallback;
}

/**
 * Greedy word-wrap for the personal note. Targets ~`targetCharsPerLine`
 * chars per line and never breaks inside a word. The final allowed line
 * absorbs everything that remains rather than dropping characters — the
 * 80-char input cap means this is at most a few extra chars over target.
 *
 * Returns the input as a single-line array when there are no spaces (one
 * very long token), so the caller can still render it (drawtext doesn't
 * auto-wrap, so a wide single word will run wide — that's accepted).
 */
function wrapPersonalNote(
  text: string,
  targetCharsPerLine: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const wouldBe = current.length === 0 ? word : `${current} ${word}`;
    // On the last allowed line, pack everything that remains rather than
    // truncating — long final words are rare with an 80-char input cap.
    if (lines.length === maxLines - 1) {
      current = wouldBe;
      continue;
    }
    if (wouldBe.length <= targetCharsPerLine || current.length === 0) {
      current = wouldBe;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildSubtitle(senderName?: string, venueName?: string): string | null {
  const s = senderName?.trim();
  const v = venueName?.trim();
  if (s && v) return `with love from ${s} · at ${v}`;
  if (s) return `with love from ${s}`;
  if (v) return `from ${v}`;
  return null;
}

type DrawtextLayer = {
  text: string;
  fontsize: number;
  color: string;
  x: string;
  y: string;
  borderw?: number;
  enable?: string;
};

function drawtextFilter(layer: DrawtextLayer): string {
  const parts = [
    `fontfile=${FONT_PATH}`,
    `text='${escapeDrawtext(layer.text)}'`,
    `fontsize=${layer.fontsize}`,
    `fontcolor=${layer.color}`,
    `borderw=${layer.borderw ?? 2}`,
    `bordercolor=black@0.85`,
    `x=${layer.x}`,
    `y=${layer.y}`,
  ];
  if (layer.enable) parts.push(`enable='${layer.enable}'`);
  return `drawtext=${parts.join(":")}`;
}

function buildFilterGraph(args: {
  recipientName: string;
  senderName?: string;
  venueName?: string;
  venueColor?: string;
  personalNote?: string;
  effectiveDurationSec: number;
}): string {
  const heroColor = safeColor(args.venueColor, BRAND_PINK);

  const layers: DrawtextLayer[] = [
    // "Happy Birthday" — top of frame, smaller weight than the name.
    {
      text: "Happy Birthday",
      fontsize: px(56),
      color: "white",
      borderw: 2,
      x: "(w-text_w)/2",
      y: "h*0.08",
    },
    // Recipient name — dominant element, tinted brand-pink or venueColor.
    {
      text: `${args.recipientName}!`,
      fontsize: px(120),
      color: heroColor,
      borderw: 3,
      x: "(w-text_w)/2",
      y: "h*0.17",
    },
  ];

  // Optional personal note from the "Make it Yours" panel. Long notes get
  // greedy-wrapped at word boundaries (~35 chars/line, max 3 lines) and
  // start higher in the frame so they don't reach down into the template's
  // cake/candle imagery. Short notes (≤40 chars) stay single-line at the
  // original height — a 15-char note shouldn't float weirdly high above
  // the subtitle.
  const noteTrimmed = args.personalNote?.replace(/\s*\n+\s*/g, " ").trim();
  if (noteTrimmed) {
    const noteFontsize = px(40);
    const noteLines =
      noteTrimmed.length > 40 ? wrapPersonalNote(noteTrimmed, 35, 3) : [noteTrimmed];
    const baseY = noteLines.length > 1 ? "h*0.27" : "h*0.31";
    // Line height ~1.2× font size — same proportion typography conventions
    // use for body text. Round to an integer pixel so drawtext's expression
    // parser doesn't have to evaluate fractional offsets.
    const lineSpacing = Math.round(noteFontsize * 1.2);
    for (let i = 0; i < noteLines.length; i += 1) {
      const yExpr = i === 0 ? baseY : `${baseY}+${i * lineSpacing}`;
      layers.push({
        text: noteLines[i],
        fontsize: noteFontsize,
        color: "white",
        // Thicker stroke survives against busy template imagery (candles,
        // cake) where the 1px border was being washed out at small sizes.
        borderw: 2,
        x: "(w-text_w)/2",
        y: yExpr,
      });
    }
  }

  const subtitle = buildSubtitle(args.senderName, args.venueName);
  if (subtitle) {
    layers.push({
      text: subtitle,
      fontsize: px(30),
      color: "white",
      borderw: 1,
      x: "(w-text_w)/2",
      y: "h*0.86",
    });
  }

  // Discreet "singmybirthday.com" in the bottom-right for the last 3 seconds.
  // Anyone who forwards a stripped MP4 still sees where it came from.
  const tailEnable =
    args.effectiveDurationSec > ATTRIBUTION_TAIL_SEC
      ? `gte(t,${(args.effectiveDurationSec - ATTRIBUTION_TAIL_SEC).toFixed(2)})`
      : undefined;
  layers.push({
    text: "singmybirthday.com",
    fontsize: px(22),
    color: "white@0.85",
    borderw: 1,
    x: "w-text_w-16",
    y: "h-text_h-16",
    enable: tailEnable,
  });

  // Scale down BEFORE drawtext so the encoder has 4× less pixel work to do
  // per frame. The drawtext positioning uses h/w expressions, so it adapts
  // to the post-scale frame size automatically.
  const scaleFilter = `scale=${OUTPUT_WIDTH}:-2`;
  const videoChain = [scaleFilter, ...layers.map(drawtextFilter)].join(",");
  // Trim audio to the effective duration (≤ 60s) then fade the final second.
  // atrim+asetpts gives us a hard cap regardless of how long Suno's clip is.
  const fadeStart = Math.max(0, args.effectiveDurationSec - AUDIO_TAIL_FADE_SEC).toFixed(2);
  const audioChain = `atrim=0:${args.effectiveDurationSec.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=out:st=${fadeStart}:d=${AUDIO_TAIL_FADE_SEC}`;
  return `[0:v]${videoChain}[v];[1:a]${audioChain}[a]`;
}

function runFfmpeg(args: {
  templateUrl: string;
  audioPath: string;
  outputPath: string;
  recipientName: string;
  senderName?: string;
  venueName?: string;
  venueColor?: string;
  personalNote?: string;
  effectiveDurationSec: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const filter = buildFilterGraph({
      recipientName: args.recipientName,
      senderName: args.senderName,
      venueName: args.venueName,
      venueColor: args.venueColor,
      personalNote: args.personalNote,
      effectiveDurationSec: args.effectiveDurationSec,
    });

    ffmpeg()
      .input(args.templateUrl)
      .input(args.audioPath)
      .complexFilter(filter)
      .outputOptions([
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        // -shortest stops at whichever stream ends first. With audio capped
        // at ≤60s and the template's own ~60s length, this lands the output
        // at ~effectiveDurationSec without needing a separate -t flag.
        "-shortest",
        "-movflags", "+faststart",
      ])
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve())
      .save(args.outputPath);
  });
}

export async function renderShareVideo(input: RenderVideoInput): Promise<RenderVideoResult> {
  const logId = input.logId ?? randomUUID().slice(0, 8);
  const totalStart = Date.now();

  const workDir = await mkdtemp(path.join(tmpdir(), `bday-video-${randomUUID()}-`));
  const audioPath = path.join(workDir, "audio.mp3");
  const outputPath = path.join(workDir, "out.mp4");
  const templateUrl = templateVideoPath(input.template, {
    genre: input.genre,
    seed: input.backgroundSeed ?? input.logId,
  });

  try {
    // Verify the font is reachable before kicking off ffmpeg — fails fast with
    // a clear error if outputFileTracingIncludes missed it on this route.
    try {
      await stat(FONT_PATH);
    } catch {
      throw new Error(
        `font missing at ${FONT_PATH} — outputFileTracingIncludes for this route needs to include public/video-fonts/**/*`,
      );
    }

    const audioStart = Date.now();
    await downloadToTemp(input.audioUrl, audioPath);
    logStage(logId, "audio-fetch", audioStart);

    const probeStart = Date.now();
    const probedAudioSec = await probeDuration(audioPath);
    // Effective duration is bounded by the template length. If the probe
    // fails we still cap at the template ceiling — Suno occasionally returns
    // 90s+ clips even when we ask for ~35s, and we want a predictable MP4.
    const rawAudioSec = probedAudioSec > 0 ? probedAudioSec : TEMPLATE_DURATION_SEC;
    const effectiveDurationSec = Math.min(rawAudioSec, TEMPLATE_DURATION_SEC);
    logStage(logId, "audio-probe", probeStart, {
      audio: rawAudioSec.toFixed(2),
      effective: effectiveDurationSec.toFixed(2),
    });

    const ffmpegStart = Date.now();
    await runFfmpeg({
      templateUrl,
      audioPath,
      outputPath,
      recipientName: input.name,
      senderName: input.senderName,
      venueName: input.venueName,
      venueColor: input.venueColor,
      personalNote: input.personalNote,
      effectiveDurationSec,
    });
    logStage(logId, "ffmpeg-mux", ffmpegStart);

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
