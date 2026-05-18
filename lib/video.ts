// Server-only video compositing pipeline.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import type { ShareTemplate } from "./api-types";
import { greetingFor } from "./greetings";
import { templateVideoPath, TEMPLATE_TYPOGRAPHY, type TemplateTypography } from "./video-style";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const MAX_VIDEO_SECONDS = 60;

const FETCH_TIMEOUT_MS = 25_000;
// Template is 300s on R2; cap the random seek at 240 so the 60s output
// window stays inside the clip end. Bump if the template gets longer.
const RANDOM_START_MAX_SECONDS = 240;

export type RenderVideoInput = {
  audioUrl: string;
  name: string;
  template: ShareTemplate;
  language: string;
};

export type RenderVideoResult = {
  mp4: Buffer;
  durationSec: number;
};

async function downloadToTemp(url: string, dest: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });

    if (!res.ok) {
      throw new Error(`download failed: ${res.status}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());

    if (buf.length === 0) {
      throw new Error("download empty");
    }

    await writeFile(dest, buf);
  } finally {
    clearTimeout(timeout);
  }
}

function buildDrawtextFilter(typography: TemplateTypography, textPath: string): string {
  const parts: string[] = [
    `textfile='${textPath}'`,
    `fontfile='${typography.fontPath}'`,
    `fontsize=${typography.fontSize}`,
    `fontcolor=${typography.fontColor}`,
  ];
  if (typography.borderColor && typography.borderWidth) {
    parts.push(`bordercolor=${typography.borderColor}`);
    parts.push(`borderw=${typography.borderWidth}`);
  }
  if (typography.shadowColor) {
    parts.push(`shadowcolor=${typography.shadowColor}`);
    parts.push(`shadowx=${typography.shadowX ?? 0}`);
    parts.push(`shadowy=${typography.shadowY ?? 0}`);
  }
  parts.push("x=(w-text_w)/2");
  parts.push("y=h-150");
  return `[0:v]drawtext=${parts.join(":")}[v]`;
}

function runFfmpeg(args: {
  templatePath: string;
  audioPath: string;
  outputPath: string;
  textPath: string;
  typography: TemplateTypography;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const randomStart = Math.floor(Math.random() * RANDOM_START_MAX_SECONDS);

    ffmpeg()
      .input(args.templatePath)
      .inputOptions([
        "-ss",
        String(randomStart),
      ])
      .input(args.audioPath)
      .complexFilter([
        buildDrawtextFilter(args.typography, args.textPath),
        "[1:a]afade=t=out:st=59.5:d=0.5[a]",
      ])
      .outputOptions([
        "-map", "[v]",
        "-map", "[a]",
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
  return new Promise((resolve) => {
    ffmpeg.setFfprobePath(ffmpegInstaller.path.replace(/ffmpeg$/, "ffprobe"));

    ffmpeg.ffprobe(filePath, (err: Error | null, data: ffmpeg.FfprobeData) => {
      if (err) {
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
  const videoPath = path.join(workDir, "template.mp4");
  const outputPath = path.join(workDir, "out.mp4");
  const textPath = path.join(workDir, "greeting.txt");

  const templatePath = templateVideoPath(input.template);
  const typography = TEMPLATE_TYPOGRAPHY[input.template];
  const greeting = greetingFor(input.language, input.name);

  try {
    await writeFile(textPath, greeting, "utf8");
    await downloadToTemp(input.audioUrl, audioPath);
    await downloadToTemp(templatePath, videoPath);

    await runFfmpeg({
      templatePath: videoPath,
      audioPath,
      outputPath,
      textPath,
      typography,
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