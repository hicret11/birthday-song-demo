// Server-only video compositing pipeline.
// Pre-rendered 60s template MP4s live on R2 (one per template). Render
// just muxes user audio in with a 0.5s tail fade — stream-copy video,
// no re-encode, no drawtext. Per-share greeting is rendered as CSS on
// the share page, not burned into the file.

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

export type RenderVideoInput = {
  audioUrl: string;
  name: string;
  template: ShareTemplate;
  language: string;
  logId?: string;
};

export type RenderVideoResult = {
  mp4: Buffer;
  durationSec: number;
};

function logStage(logId: string, stage: string, startedAt: number, extra?: Record<string, string | number>): void {
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

function runFfmpeg(args: {
  templateUrl: string;
  audioPath: string;
  outputPath: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(args.templateUrl)
      .input(args.audioPath)
      .complexFilter(["[1:a]afade=t=out:st=59.5:d=0.5[a]"])
      .outputOptions([
        "-map", "0:v",
        "-map", "[a]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
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
  const logId = input.logId ?? randomUUID().slice(0, 8);
  const totalStart = Date.now();

  const workDir = await mkdtemp(path.join(tmpdir(), `bday-video-${randomUUID()}-`));
  const audioPath = path.join(workDir, "audio.mp3");
  const outputPath = path.join(workDir, "out.mp4");
  const templateUrl = templateVideoPath(input.template);

  try {
    const audioStart = Date.now();
    await downloadToTemp(input.audioUrl, audioPath);
    logStage(logId, "audio-fetch", audioStart);

    const ffmpegStart = Date.now();
    await runFfmpeg({ templateUrl, audioPath, outputPath });
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
