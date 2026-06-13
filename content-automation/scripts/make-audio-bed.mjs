// Generate a brand-safe, ORIGINAL 10s instrumental audio bed with FFmpeg only.
// No samples, no lyrics, no copyrighted/trending melody — just synthesized sine
// "mallet" plucks over a soft pad, in a generic major progression (C–F–G–C).
//
// Output: content-automation/assets/audio/brand-bed.m4a (AAC), ~10s, soft.
// Run: node content-automation/scripts/make-audio-bed.mjs [--force]

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ASSETS_DIR } from "./lib.mjs";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const AUDIO_DIR = path.join(ASSETS_DIR, "audio");
const OUT = path.join(AUDIO_DIR, "brand-bed.m4a");
const DURATION = 10;
const FORCE = process.argv.includes("--force");

// 4 bars × 2.5s. Each chord arpeggiated as 5 plucks (root,3rd,5th,octave,5th).
// Plain triads in C major — generic harmony, not a recognizable tune.
const CHORDS = [
  [261.63, 329.63, 392.0, 523.25], // C  (C4 E4 G4 C5)
  [349.23, 440.0, 523.25, 698.46], // F  (F4 A4 C5 F5)
  [392.0, 493.88, 587.33, 783.99], // G  (G4 B4 D5 G5)
  [261.63, 329.63, 392.0, 523.25], // C
];
const STEP_PATTERN = [0, 1, 2, 3, 2];
const BAR = 2.5;
const STEP = 0.5;

function buildNotes() {
  const notes = [];
  CHORDS.forEach((chord, bar) => {
    STEP_PATTERN.forEach((idx, s) => {
      notes.push({ freq: chord[idx], start: bar * BAR + s * STEP });
    });
  });
  return notes; // 20 plucks
}

function buildArgs() {
  const notes = buildNotes();
  const inputs = [];
  const chains = [];
  const mixLabels = [];

  // Pluck voices.
  notes.forEach((n, i) => {
    inputs.push("-f", "lavfi", "-i", `sine=frequency=${n.freq}:duration=0.7:sample_rate=44100`);
    const ms = Math.round(n.start * 1000);
    // attack 8ms, exponential-ish decay via afade out → soft mallet.
    chains.push(`[${i}:a]afade=t=in:st=0:d=0.008,afade=t=out:st=0.1:d=0.55,volume=0.30,adelay=${ms}|${ms}[n${i}]`);
    mixLabels.push(`[n${i}]`);
  });

  // Two soft drone pads (C3 + G3) for warmth, low + tremolo.
  const padBase = notes.length;
  inputs.push("-f", "lavfi", "-i", `sine=frequency=130.81:duration=${DURATION}:sample_rate=44100`);
  inputs.push("-f", "lavfi", "-i", `sine=frequency=196.0:duration=${DURATION}:sample_rate=44100`);
  chains.push(`[${padBase}:a]volume=0.10,tremolo=f=4:d=0.4[p0]`);
  chains.push(`[${padBase + 1}:a]volume=0.08,tremolo=f=4:d=0.4[p1]`);
  mixLabels.push("[p0]", "[p1]");

  const n = mixLabels.length;
  const filter =
    chains.join(";") + ";" +
    `${mixLabels.join("")}amix=inputs=${n}:normalize=0:dropout_transition=0,` +
    `lowpass=f=6500,aecho=0.8:0.7:55:0.18,` +
    `afade=t=in:st=0:d=0.25,afade=t=out:st=${(DURATION - 1.0).toFixed(2)}:d=1.0,` +
    // Normalize to a consistent, healthy bed level; the renderer then mixes this
    // in at a low volume so it sits subtly under the video.
    `loudnorm=I=-18:TP=-2:LRA=11[a]`;

  return [
    "-y", ...inputs,
    "-filter_complex", filter,
    "-map", "[a]", "-t", String(DURATION),
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
    OUT,
  ];
}

function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  if (fs.existsSync(OUT) && !FORCE) {
    console.log(`brand-bed.m4a already exists (use --force to regenerate): ${OUT}`);
    return;
  }
  const args = buildArgs();
  const res = spawnSync(FFMPEG, args, { encoding: "utf8" });
  if (res.status !== 0) {
    console.error("ffmpeg failed:\n", (res.stderr || "").split("\n").slice(-8).join("\n"));
    process.exit(1);
  }
  console.log(`Generated brand-safe audio bed → ${OUT}`);
}

main();
