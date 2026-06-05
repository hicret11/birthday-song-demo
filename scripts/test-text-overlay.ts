// One-off test harness for the drawtext overlay.
// Run: npx tsx --env-file=.env.local scripts/test-text-overlay.ts

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import type { ShareTemplate } from "../lib/api-types";
import { renderShareVideo } from "../lib/video";

const AUDIO_URL = "https://tempfile.aiquickdraw.com/r/00a1c4c641864b2d895e9077b193f073.mp3";
const OUT_DIR = "/tmp/text-overlay-test";
const FFPROBE = ffmpegInstaller.path.replace(/ffmpeg$/, "ffprobe");

type Case = { name: string; template: ShareTemplate; language: string; label: string };

const CASES: Case[] = [
  { name: "Alex",   template: "classic", language: "English", label: "classic-english" },
  { name: "Alex",   template: "neon",    language: "English", label: "neon-english" },
  { name: "Alex",   template: "elegant", language: "English", label: "elegant-english" },
  { name: "Alex",   template: "playful", language: "English", label: "playful-english" },
  { name: "Sofía",  template: "classic", language: "Spanish", label: "classic-spanish" },
  { name: "Marie",  template: "classic", language: "French",  label: "classic-french" },
  { name: "Doğan",  template: "classic", language: "Turkish", label: "classic-turkish" },
];

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  for (const c of CASES) {
    const started = Date.now();
    try {
      const r = await renderShareVideo({
        audioUrl: AUDIO_URL,
        name: c.name,
        template: c.template,
        language: c.language,
      });
      const mp4Path = path.join(OUT_DIR, `${c.label}.mp4`);
      const jpgPath = path.join(OUT_DIR, `${c.label}.jpg`);
      await writeFile(mp4Path, r.mp4);
      const ff = spawnSync(ffmpegInstaller.path, [
        "-y", "-ss", "10", "-i", mp4Path, "-frames:v", "1", "-q:v", "2", jpgPath,
      ]);
      const renderMs = Date.now() - started;
      const ok = ff.status === 0;
      console.log(`[test] ${c.label} (name=${c.name}): ${(renderMs / 1000).toFixed(1)}s, mp4=${r.mp4.length}B, frame=${ok ? "OK" : "FAIL"} -> ${jpgPath}`);
    } catch (err) {
      console.error(`[test] ${c.label}: FAILED -- ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((e) => {
  console.error("[test] fatal:", e);
  process.exit(1);
});
