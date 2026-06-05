// Migration: re-render share videos and upload to Cloudflare R2.
// After af207af-style revert, share records have audioUrl but no videoUrl.
// This script re-renders each video and sets videoUrl on the KV record.
// Run:
//   Dry-run:  npx tsx --env-file=.env.local scripts/migrate-to-r2.ts --dry-run
//   Execute:  npx tsx --env-file=.env.local scripts/migrate-to-r2.ts

import { kv } from "@vercel/kv";
import type { SharedSong } from "../lib/api-types";
import { uploadToR2 } from "../lib/r2";
import { loadSharedSong, saveSharedSong } from "../lib/share";
import { renderShareVideo } from "../lib/video";

const PUBLIC_BASE_URL = "https://birthday-song-demo.vercel.app";
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const EXPLICIT_IDS: string[] | null = idsArg
  ? idsArg.slice("--ids=".length).split(",").map((s) => s.trim()).filter(Boolean)
  : null;

type Result =
  | { id: string; status: "missing" }
  | { id: string; status: "has-video"; videoUrl: string }
  | { id: string; status: "no-audio-cannot-migrate" }
  | { id: string; status: "audio-dead"; audioUrl: string; httpStatus: number }
  | { id: string; status: "would-migrate"; audioUrl: string; template: string }
  | { id: string; status: "migrated"; videoUrl: string; pageHasVideo: boolean | null }
  | { id: string; status: "failed"; error: string };

async function listAllShareIds(): Promise<string[]> {
  const ids: string[] = [];
  let cursor = "0";
  while (true) {
    const [next, batch] = await kv.scan(cursor, { match: "share:*", count: 200 });
    for (const key of batch) ids.push(key.replace(/^share:/, ""));
    cursor = String(next);
    if (cursor === "0") break;
  }
  return ids.sort();
}

async function audioStatus(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status;
  } catch {
    return 0;
  }
}

async function pageRendersVideo(id: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${PUBLIC_BASE_URL}/share/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();
    return /<video[\s>]/i.test(html);
  } catch {
    return null;
  }
}

async function processOne(id: string): Promise<Result> {
  const song = await loadSharedSong(id);
  if (!song) return { id, status: "missing" };
  if (song.videoUrl && !FORCE) return { id, status: "has-video", videoUrl: song.videoUrl };
  if (!song.audioUrl) return { id, status: "no-audio-cannot-migrate" };

  const audioHttp = await audioStatus(song.audioUrl);
  if (audioHttp !== 200) {
    return { id, status: "audio-dead", audioUrl: song.audioUrl, httpStatus: audioHttp };
  }

  if (DRY_RUN) {
    return { id, status: "would-migrate", audioUrl: song.audioUrl, template: song.template };
  }

  try {
    const rendered = await renderShareVideo({
      audioUrl: song.audioUrl,
      name: song.name,
      template: song.template,
      language: song.language,
    });
    const videoUrl = await uploadToR2(`shares/${id}.mp4`, rendered.mp4, "video/mp4");
    const updated: SharedSong = { ...song, videoUrl };
    await saveSharedSong(updated);
    const pageHasVideo = await pageRendersVideo(id);
    return { id, status: "migrated", videoUrl, pageHasVideo };
  } catch (err) {
    return { id, status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

async function main(): Promise<void> {
  const ids = EXPLICIT_IDS ?? (await listAllShareIds());
  console.log(`[migrate-to-r2] mode=${DRY_RUN ? "DRY-RUN" : "EXECUTE"} candidates=${ids.length}`);

  const results: Result[] = [];
  for (const id of ids) {
    const r = await processOne(id);
    results.push(r);
    const extras: string[] = [];
    if ("videoUrl" in r) extras.push(`videoUrl=${r.videoUrl}`);
    if ("audioUrl" in r) extras.push(`audio=${r.audioUrl.slice(0, 70)}…`);
    if ("template" in r) extras.push(`template=${r.template}`);
    if ("httpStatus" in r) extras.push(`http=${r.httpStatus}`);
    if ("pageHasVideo" in r) extras.push(`pageHasVideo=${r.pageHasVideo}`);
    if ("error" in r) extras.push(`error=${r.error}`);
    console.log(`  ${id} -> ${r.status} ${extras.join(" ")}`);
  }

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("[migrate-to-r2] summary:", summary);

  const dead = results.filter((r): r is Extract<Result, { status: "audio-dead" }> => r.status === "audio-dead");
  if (dead.length > 0) {
    console.log("[migrate-to-r2] PERMANENTLY DEAD (audio not 200):");
    for (const r of dead) console.log(`  - ${r.id} http=${r.httpStatus} ${r.audioUrl}`);
  }

  const stuck = results.filter(
    (r): r is Extract<Result, { status: "no-audio-cannot-migrate" }> => r.status === "no-audio-cannot-migrate",
  );
  if (stuck.length > 0) {
    console.log("[migrate-to-r2] NO AUDIO (cannot migrate, share is dead):");
    for (const r of stuck) console.log(`  - ${r.id}`);
  }
}

main().catch((err) => {
  console.error("[migrate-to-r2] fatal:", err);
  process.exit(1);
});
