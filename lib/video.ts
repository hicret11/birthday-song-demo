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
import type { Lyrics, ShareTemplate } from "./api-types";
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
  /**
   * Optional normalized lyrics. When present, the premium 9:16 lyric-audiogram
   * renderer reveals the lyric lines timed across the song. Absent (or on any
   * premium-render failure) the pipeline falls back to the simple renderer.
   */
  lyrics?: Lyrics;
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

/**
 * Legacy 16:9 renderer. Kept as the guaranteed fallback so shares never break
 * if the premium 9:16 lyric-audiogram pipeline throws (bad lyrics, an ffmpeg
 * filter quirk, etc.). This is the exact pipeline that shipped before the
 * audiogram upgrade — flat static drawtext over the scaled template loop.
 */
async function renderShareVideoSimple(input: RenderVideoInput): Promise<RenderVideoResult> {
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

// ============================================================================
// PREMIUM 9:16 LYRIC-AUDIOGRAM PIPELINE
// ----------------------------------------------------------------------------
// The shareable soul of the product. Renders a vertical (portrait) video that
// reads as a living audio product: the template plays as a darkened/blurred
// background so the foreground pops, an animated waveform (showwaves, brand
// pink) pulses to the audio, a headline scales in over the first ~1.2s, and
// the lyric lines are revealed one at a time timed across the song — the
// "lyric video" feel that drives 5–8× more social engagement than static
// text over a 16:9 loop.
//
// CANVAS: 720x1280 (9:16). We deliberately stay 720-wide, NOT the 1080-wide
// source asset, for the same reason the legacy renderer downscaled to 720p:
// re-encoding a full-res vertical clip with libx264 + several drawtext layers
// + a live waveform overlay exceeds the Vercel single-vCPU function budget.
// 720x1280 is ~44% of the pixel work of 1080x1920, indistinguishable on a
// phone, and keeps us comfortably under the 120s route ceiling.
//
// TEMPLATE ASSETS: the R2 template MP4s are ALREADY 1080x1920 (9:16 portrait),
// per the video-style.ts asset comment — so NO re-render of the source assets
// is required. We only downscale/crop them to the 720x1280 working canvas.
// ============================================================================

const PREMIUM_WIDTH = 720;
const PREMIUM_HEIGHT = 1280;
const PREMIUM_FPS = 30;
// Cap premium output length. Songs are ~35s (60s hard ceiling), but we also
// clamp to ~45s so a long Suno overshoot can't blow the render budget on the
// heavier premium filtergraph. -shortest lands us at min(song, template, cap).
const PREMIUM_MAX_SEC = 45;
// Brand accent used for the waveform + headline. Bright pink reads well on the
// darkened background and matches the marketing palette (#ec4899).
const BRAND_PINK_HEX = "ec4899";

// Localized "Happy Birthday" headline prefix. Falls back to English for any
// language we don't have a mapping for. Keys match the app's Language enum
// values (see lib/api-types.ts LANGUAGES) plus common lowercase variants.
const HAPPY_BIRTHDAY_BY_LANG: Record<string, string> = {
  english: "Happy Birthday",
  spanish: "Feliz Cumpleaños",
  turkish: "İyi ki Doğdun",
  french: "Joyeux Anniversaire",
  arabic: "عيد ميلاد سعيد",
  hindi: "जन्मदिन मुबारक",
  russian: "С Днём Рождения",
};

function localizedHappyBirthday(language: string): string {
  const key = language.trim().toLowerCase();
  return HAPPY_BIRTHDAY_BY_LANG[key] ?? "Happy Birthday";
}

/**
 * Flatten the normalized lyrics into an ordered list of display lines,
 * skipping blank/whitespace lines and section tags. Each line is greedy
 * word-wrapped to ~`maxChars` chars so it fits the 720-wide frame at the
 * lyric font size, capped at 2 physical rows per lyric line (longer lines
 * are truncated with an ellipsis rather than overflowing the frame).
 *
 * Returns an array of arrays: each entry is the 1–2 wrapped rows for one
 * lyric line, revealed together as a single beat.
 */
function buildLyricBeats(lyrics: Lyrics | undefined, maxChars: number): string[][] {
  if (!lyrics || !Array.isArray(lyrics.sections)) return [];
  const beats: string[][] = [];
  for (const section of lyrics.sections) {
    if (!section || !Array.isArray(section.lines)) continue;
    for (const rawLine of section.lines) {
      if (typeof rawLine !== "string") continue;
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (!line) continue;
      // Reuse the greedy word-wrap; cap at 2 rows. If a line still overflows
      // its second row we let wrapPersonalNote pack it (accepted per the
      // helper's contract) — real lyric lines are short.
      const rows = wrapPersonalNote(line, maxChars, 2);
      beats.push(rows);
    }
  }
  return beats;
}

/**
 * Build the premium 9:16 filtergraph.
 *
 * High level (single ffmpeg pass, two inputs: [0:v]=template, [1:a]=audio):
 *   1. BACKGROUND: scale template to COVER 720x1280 + crop to exact, then a
 *      subtle boxblur + brightness cut so the foreground text/waveform pop.
 *      Motion is preserved.
 *   2. WAVEFORM: showwaves on the (trimmed) audio → a brand-pink band, scaled
 *      to full width, overlaid in the lower third. This is the "audiogram".
 *   3. HEADLINE: "Happy Birthday, {name}" top third, fades+implied-scales in
 *      over the first 1.2s via drawtext alpha, strong stroke for legibility.
 *   4. LYRICS: one beat (1–2 rows) visible at a time, evenly spaced across the
 *      song via enable='between(t, i*D/N, (i+1)*D/N)', centered mid-frame.
 *   5. SENDER NOTE: optional, brief, near the end — kept calm.
 *   6. WATERMARK: discreet singmybirthday.com bottom-center (persistent).
 *
 * Labels are threaded explicitly ([bg]→[bgw]→[base]→...) so the graph stays
 * valid; every drawtext consumes one labelled stream and emits the next.
 */
function buildPremiumFilterGraph(args: {
  recipientName: string;
  language: string;
  senderName?: string;
  personalNote?: string;
  lyricBeats: string[][];
  effectiveDurationSec: number;
}): { filter: string; videoLabel: string; audioLabel: string } {
  const D = args.effectiveDurationSec;
  const dur = D.toFixed(2);

  // ---- Font sizing (px on the 720-wide canvas) ----
  const HEADLINE_SIZE = 58;
  const NAME_SIZE = 86;
  const LYRIC_SIZE = 46;
  const NOTE_SIZE = 34;
  const WM_SIZE = 26;

  const chains: string[] = [];

  // ---- 1. Background: cover-crop → blur + darken ----
  // increase-fit then crop to exact so there's no letterboxing; boxblur=6:1
  // softens it and eq brightness=-0.14 darkens so overlays read. Kept to a
  // single blur pass (cheap) — heavier gblur was avoided for the vCPU budget.
  chains.push(
    `[0:v]scale=${PREMIUM_WIDTH}:${PREMIUM_HEIGHT}:force_original_aspect_ratio=increase,` +
      `crop=${PREMIUM_WIDTH}:${PREMIUM_HEIGHT},` +
      `boxblur=6:1,eq=brightness=-0.14:saturation=1.05,` +
      `setsar=1,fps=${PREMIUM_FPS},format=yuv420p[bg]`,
  );

  // ---- 2. Waveform (audiogram core) ----
  // showwaves renders the audio as a moving line. We give it its own scratch
  // audio split so the muxed audio stays untouched. Band is ~28% of height,
  // full width, brand pink, drawn as a filled "cline" mode for a fuller look.
  const waveH = Math.round(PREMIUM_HEIGHT * 0.22);
  chains.push(
    `[1:a]asplit=2[awave][aout]`,
  );
  chains.push(
    `[awave]atrim=0:${dur},asetpts=PTS-STARTPTS,` +
      `showwaves=s=${PREMIUM_WIDTH}x${waveH}:mode=cline:rate=${PREMIUM_FPS}:` +
      `colors=0x${BRAND_PINK_HEX}:scale=sqrt,format=rgba,` +
      // Slight transparency so it blends into the background rather than
      // looking like a pasted-on strip.
      `colorchannelmixer=aa=0.9[wave]`,
  );
  // Overlay the waveform in the lower third (centered horizontally). y places
  // its top at ~62% of the frame, leaving room for lyrics above and the
  // watermark below.
  const waveY = Math.round(PREMIUM_HEIGHT * 0.62);
  chains.push(
    `[bg][wave]overlay=x=0:y=${waveY}:format=auto[base]`,
  );

  // ---- 3. Headline: "Happy Birthday" + "{name}!" ----
  // The prefix fades in over the first 1.2s (t/1.2 alpha ramp) which reads as
  // a gentle scale/reveal. Name sits just under it, brand pink, dominant.
  const hb = localizedHappyBirthday(args.language);
  let label = "base";
  chains.push(
    `[${label}]drawtext=fontfile=${FONT_PATH}:text='${escapeDrawtext(hb)}':` +
      `fontsize=${HEADLINE_SIZE}:fontcolor=white:borderw=3:bordercolor=black@0.85:` +
      `shadowcolor=black@0.6:shadowx=2:shadowy=2:` +
      `x=(w-text_w)/2:y=h*0.09:` +
      `alpha='if(lt(t,1.2),t/1.2,1)'[hb]`,
  );
  label = "hb";
  chains.push(
    `[${label}]drawtext=fontfile=${FONT_PATH}:text='${escapeDrawtext(`${args.recipientName}!`)}':` +
      `fontsize=${NAME_SIZE}:fontcolor=0x${BRAND_PINK_HEX}:borderw=4:bordercolor=black@0.9:` +
      `shadowcolor=black@0.6:shadowx=2:shadowy=2:` +
      `x=(w-text_w)/2:y=h*0.09+${HEADLINE_SIZE + 18}:` +
      `alpha='if(lt(t,1.2),t/1.2,1)'[name]`,
  );
  label = "name";

  // ---- 4. Lyric reveal ----
  // No per-word timestamps exist, so we split the song evenly: N beats over
  // duration D, beat i visible during [i*D/N, (i+1)*D/N). Each beat is 1–2
  // rows, centered vertically around ~46% of the frame. This is the biggest
  // premium upgrade — it turns a static card into a lyric video.
  const beats = args.lyricBeats;
  const N = beats.length;
  if (N > 0) {
    const slot = D / N;
    const lineSpacing = Math.round(LYRIC_SIZE * 1.25);
    for (let i = 0; i < N; i += 1) {
      const start = (i * slot).toFixed(2);
      const end = ((i + 1) * slot).toFixed(2);
      const rows = beats[i];
      // Vertically center this beat's rows around 0.46*h. For a 2-row beat the
      // first row starts half a line-height above center.
      const blockTop = `h*0.46-${Math.round(((rows.length - 1) * lineSpacing) / 2)}`;
      for (let r = 0; r < rows.length; r += 1) {
        const yExpr = r === 0 ? blockTop : `${blockTop}+${r * lineSpacing}`;
        const out = `ly${i}_${r}`;
        chains.push(
          `[${label}]drawtext=fontfile=${FONT_PATH}:text='${escapeDrawtext(rows[r])}':` +
            `fontsize=${LYRIC_SIZE}:fontcolor=white:borderw=3:bordercolor=black@0.9:` +
            `shadowcolor=black@0.55:shadowx=2:shadowy=2:` +
            `x=(w-text_w)/2:y=${yExpr}:` +
            `enable='between(t,${start},${end})'[${out}]`,
        );
        label = out;
      }
    }
  }

  // ---- 5. Sender note (optional, calm, near the end) ----
  // Shown only in the last ~5s so the mid-song frame stays clean. Combines the
  // personal note (if any) and/or "with love from {sender}".
  const noteTrimmed = args.personalNote?.replace(/\s*\n+\s*/g, " ").trim();
  const senderTrimmed = args.senderName?.trim();
  let closing: string | null = null;
  if (noteTrimmed) closing = noteTrimmed;
  else if (senderTrimmed) closing = `with love from ${senderTrimmed}`;
  if (closing && D > 6) {
    const rows = wrapPersonalNote(closing, 32, 2);
    const showFrom = Math.max(0, D - 5).toFixed(2);
    const spacing = Math.round(NOTE_SIZE * 1.2);
    const blockTop = `h*0.80`;
    for (let r = 0; r < rows.length; r += 1) {
      const yExpr = r === 0 ? blockTop : `${blockTop}+${r * spacing}`;
      const out = `note${r}`;
      chains.push(
        `[${label}]drawtext=fontfile=${FONT_PATH}:text='${escapeDrawtext(rows[r])}':` +
          `fontsize=${NOTE_SIZE}:fontcolor=white@0.95:borderw=2:bordercolor=black@0.85:` +
          `x=(w-text_w)/2:y=${yExpr}:` +
          `enable='gte(t,${showFrom})'[${out}]`,
      );
      label = out;
    }
  }

  // ---- 6. Watermark: discreet, persistent, bottom-center ----
  chains.push(
    `[${label}]drawtext=fontfile=${FONT_PATH}:text='singmybirthday.com':` +
      `fontsize=${WM_SIZE}:fontcolor=white@0.85:borderw=1:bordercolor=black@0.6:` +
      `box=1:boxcolor=black@0.3:boxborderw=10:` +
      `x=(w-text_w)/2:y=h-text_h-28[v]`,
  );

  // ---- Audio chain: hard-cap to D then 1s tail fade (same policy as legacy) ----
  const fadeStart = Math.max(0, D - AUDIO_TAIL_FADE_SEC).toFixed(2);
  chains.push(
    `[aout]atrim=0:${dur},asetpts=PTS-STARTPTS,` +
      `afade=t=out:st=${fadeStart}:d=${AUDIO_TAIL_FADE_SEC}[a]`,
  );

  return { filter: chains.join(";"), videoLabel: "[v]", audioLabel: "[a]" };
}

function runPremiumFfmpeg(args: {
  templateUrl: string;
  audioPath: string;
  outputPath: string;
  recipientName: string;
  language: string;
  senderName?: string;
  personalNote?: string;
  lyricBeats: string[][];
  effectiveDurationSec: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const { filter, videoLabel, audioLabel } = buildPremiumFilterGraph({
      recipientName: args.recipientName,
      language: args.language,
      senderName: args.senderName,
      personalNote: args.personalNote,
      lyricBeats: args.lyricBeats,
      effectiveDurationSec: args.effectiveDurationSec,
    });

    ffmpeg()
      .input(args.templateUrl)
      .input(args.audioPath)
      .complexFilter(filter)
      .outputOptions([
        "-map", videoLabel,
        "-map", audioLabel,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-r", String(PREMIUM_FPS),
        "-c:a", "aac",
        "-b:a", "192k",
        // Belt-and-suspenders: -t caps at the effective duration and -shortest
        // closes out cleanly if the template stream runs dry first.
        "-t", args.effectiveDurationSec.toFixed(2),
        "-shortest",
        "-movflags", "+faststart",
      ])
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve())
      .save(args.outputPath);
  });
}

async function renderShareVideoPremium(input: RenderVideoInput): Promise<RenderVideoResult> {
  const logId = input.logId ?? randomUUID().slice(0, 8);
  const totalStart = Date.now();

  const workDir = await mkdtemp(path.join(tmpdir(), `bday-audiogram-${randomUUID()}-`));
  const audioPath = path.join(workDir, "audio.mp3");
  const outputPath = path.join(workDir, "out.mp4");
  const templateUrl = templateVideoPath(input.template, {
    genre: input.genre,
    seed: input.backgroundSeed ?? input.logId,
  });

  try {
    try {
      await stat(FONT_PATH);
    } catch {
      throw new Error(
        `font missing at ${FONT_PATH} — outputFileTracingIncludes for this route needs to include public/video-fonts/**/*`,
      );
    }

    const audioStart = Date.now();
    await downloadToTemp(input.audioUrl, audioPath);
    logStage(logId, "audiogram-audio-fetch", audioStart);

    const probeStart = Date.now();
    const probedAudioSec = await probeDuration(audioPath);
    const rawAudioSec = probedAudioSec > 0 ? probedAudioSec : PREMIUM_MAX_SEC;
    // min(song length, template length, ~45s cap).
    const effectiveDurationSec = Math.min(rawAudioSec, TEMPLATE_DURATION_SEC, PREMIUM_MAX_SEC);
    logStage(logId, "audiogram-probe", probeStart, {
      audio: rawAudioSec.toFixed(2),
      effective: effectiveDurationSec.toFixed(2),
    });

    // ~24 chars/line fits the 720-wide frame at the lyric font size with the
    // stroke; wider would clip against the edges on long words.
    const lyricBeats = buildLyricBeats(input.lyrics, 24);

    const ffmpegStart = Date.now();
    await runPremiumFfmpeg({
      templateUrl,
      audioPath,
      outputPath,
      recipientName: input.name,
      language: input.language,
      senderName: input.senderName,
      personalNote: input.personalNote,
      lyricBeats,
      effectiveDurationSec,
    });
    logStage(logId, "audiogram-mux", ffmpegStart, { beats: lyricBeats.length });

    const readStart = Date.now();
    const [mp4, durationSec] = await Promise.all([
      readFile(outputPath),
      probeDuration(outputPath),
    ]);
    logStage(logId, "audiogram-read+probe", readStart, { bytes: mp4.length });
    logStage(logId, "audiogram-total", totalStart);

    return { mp4, durationSec };
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Public entry point. Renders the premium 9:16 lyric-audiogram; on ANY failure
 * falls back to the legacy 16:9 simple renderer so shares never break. If the
 * simple fallback ALSO throws, the error propagates to the share route, which
 * already degrades to a raw-audio-only share.
 */
export async function renderShareVideo(input: RenderVideoInput): Promise<RenderVideoResult> {
  const logId = input.logId ?? randomUUID().slice(0, 8);
  try {
    return await renderShareVideoPremium(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[share-create:audiogram-failed] id=${logId} falling back to simple renderer msg=${message}`);
    return renderShareVideoSimple(input);
  }
}
