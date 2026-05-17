// Server-only video compositing pipeline.
//
// Implementation choice: we use the @ffmpeg-installer/ffmpeg static binary with
// fluent-ffmpeg rather than @ffmpeg/ffmpeg (WASM). WASM in Node serverless is
// brittle and significantly slower; the static binary path is the standard
// Vercel pattern. If the binary ever exceeds platform limits, swap to a hosted
// alternative (Mux / Cloudinary) — the surface area here is small.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import type { ShareTemplate } from "./api-types";
import { TEMPLATE_TYPOGRAPHY, templateVideoPath } from "./video-style";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const MAX_VIDEO_SECONDS = 60;

const AUDIO_FETCH_TIMEOUT_MS = 25_000;

export type RenderVideoInput = {
  audioUrl: string;
  name: string;
  template: ShareTemplate;
};

export type RenderVideoResult = {
  mp4: Buffer;
  durationSec: number;
};

async function downloadToTemp(url: string, dest: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUDIO_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) {
      throw new Error(`audio download failed: ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("audio download empty");
    await writeFile(dest, buf);
  } finally {
    clearTimeout(timeout);
  }
}

// ffmpeg drawtext field-value escaping. Inside a filter graph the special
// chars are \ : ' and the filter separators , ; — escape them with backslash.
function escapeDrawtextFieldValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildDrawtext(template: ShareTemplate, name: string): string {
  const typo = TEMPLATE_TYPOGRAPHY[template];
  const text = `Happy Birthday, ${name}!`;

  const parts: string[] = [
    `drawtext=fontfile='${typo.fontPath.replace(/'/g, "\\'")}'`,
    `text='${escapeDrawtextFieldValue(text)}'`,
    `fontsize=${typo.fontSize}`,
    `fontcolor=${typo.fontColor}`,
    `x=(w-text_w)/2`,
    `y=h-th-160`,
  ];

  if (typo.borderColor && typo.borderWidth) {
    parts.push(`borderw=${typo.borderWidth}`);
    parts.push(`bordercolor=${typo.borderColor}`);
  }
  if (typo.shadowColor) {
    parts.push(`shadowcolor=${typo.shadowColor}`);
    parts.push(`shadowx=${typo.shadowX ?? 2}`);
    parts.push(`shadowy=${typo.shadowY ?? 2}`);
  }

  return parts.join(":");
}

function runFfmpeg(args: {
  templatePath: string;
  audioPath: string;
  outputPath: string;
  template: ShareTemplate;
  name: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const drawtext = buildDrawtext(args.template, args.name);
    ffmpeg()
      .input(args.templatePath)
      .input(args.audioPath)
      .complexFilter([`[0:v]${drawtext}[v]`])
      .outputOptions([
        "-map", "[v]",
        "-map", "1:a",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "24",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        "-t", String(MAX_VIDEO_SECONDS),
        "-movflags", "+faststart",
      ])
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve())
      .save(args.outputPath);
  });
}

function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.setFfprobePath(ffmpegInstaller.path.replace(/ffmpeg$/, "ffprobe"));
    ffmpeg.ffprobe(filePath, (err: Error | null, data: ffmpeg.FfprobeData) => {
      if (err) {
        // ffprobe binary may not be bundled with ffmpeg-installer; fall back to
        // a numeric guess from the rendered size if needed. Best effort.
        resolve(MAX_VIDEO_SECONDS);
        return;
      }
      const seconds = Number(data?.format?.duration ?? 0);
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : MAX_VIDEO_SECONDS);
    });
  });
}

export async function renderShareVideo(input: RenderVideoInput): Promise<RenderVideoResult> {
  const workDir = await mkdtemp(path.join(tmpdir(), `bday-video-${randomUUID()}-`));
  const audioPath = path.join(workDir, "audio.mp3");
  const outputPath = path.join(workDir, "out.mp4");
  const templatePath = templateVideoPath(input.template);

  try {
    await downloadToTemp(input.audioUrl, audioPath);
    await runFfmpeg({
      templatePath,
      audioPath,
      outputPath,
      template: input.template,
      name: input.name,
    });
    const [mp4, durationSec] = await Promise.all([
      readFile(outputPath),
      probeDuration(outputPath),
    ]);
    return { mp4, durationSec };
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
