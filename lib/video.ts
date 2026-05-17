// Server-only video compositing pipeline.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import type { ShareTemplate } from "./api-types";
import { templateVideoPath } from "./video-style";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const MAX_VIDEO_SECONDS = 60;

const FETCH_TIMEOUT_MS = 25_000;

// 1 saatlik video için son 10 dakikaya çok yaklaşmasın diye
// ilk 50 dakika içinden random başlangıç seçiyoruz.
const RANDOM_START_MAX_SECONDS = 50 * 60;

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

function runFfmpeg(args: {
  templatePath: string;
  audioPath: string;
  outputPath: string;
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
      .outputOptions([
        "-map", "0:v",
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

  const templatePath = templateVideoPath(input.template);

  try {
    await downloadToTemp(input.audioUrl, audioPath);
    await downloadToTemp(templatePath, videoPath);

    await runFfmpeg({
      templatePath: videoPath,
      audioPath,
      outputPath,
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