// Emergency: Blob store is platform-blocked, every share's videoUrl 403s.
// Strip videoUrl from each share record so the template falls back to
// <audio src=/api/audio/<hash>> (the proxy, which still works).
// Run:
//   Dry-run:  npx tsx --env-file=.env.production.local scripts/revert-to-audio.ts --dry-run
//   Execute:  npx tsx --env-file=.env.production.local scripts/revert-to-audio.ts

import { kv } from "@vercel/kv";
import type { SharedSong } from "../lib/api-types";
import { loadSharedSong, saveSharedSong } from "../lib/share";

const PUBLIC_BASE_URL = "https://birthday-song-demo.vercel.app";
const DRY_RUN = process.argv.includes("--dry-run");

type Result =
  | { id: string; status: "missing" }
  | { id: string; status: "no-video"; hasAudioUrl: boolean }
  | { id: string; status: "no-audio-cannot-revert"; videoUrl: string }
  | { id: string; status: "would-strip"; hasAudioUrl: boolean; videoUrl: string }
  | { id: string; status: "stripped"; pageHasAudio: boolean | null; pageHasVideo: boolean | null }
  | { id: string; status: "failed"; error: string };

async function listAllShareIds(): Promise<string[]> {
  const ids: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await kv.scan(cursor, { match: "share:*", count: 200 });
    for (const key of batch) {
      ids.push(key.replace(/^share:/, ""));
    }
    cursor = next;
  } while (cursor !== "0");
  return ids.sort();
}

async function probePage(id: string): Promise<{ hasAudio: boolean | null; hasVideo: boolean | null }> {
  try {
    const res = await fetch(`${PUBLIC_BASE_URL}/share/${id}`, { cache: "no-store" });
    if (!res.ok) return { hasAudio: null, hasVideo: null };
    const html = await res.text();
    return {
      hasAudio: /<audio[\s>]/i.test(html),
      hasVideo: /<video[\s>]/i.test(html),
    };
  } catch {
    return { hasAudio: null, hasVideo: null };
  }
}

async function processOne(id: string): Promise<Result> {
  const song = await loadSharedSong(id);
  if (!song) return { id, status: "missing" };

  const hasVideoUrl = Boolean(song.videoUrl);
  const hasAudioUrl = Boolean(song.audioUrl);

  if (!hasVideoUrl) return { id, status: "no-video", hasAudioUrl };
  if (!hasAudioUrl) {
    return { id, status: "no-audio-cannot-revert", videoUrl: song.videoUrl! };
  }

  if (DRY_RUN) {
    return { id, status: "would-strip", hasAudioUrl, videoUrl: song.videoUrl! };
  }

  try {
    const stripped: SharedSong = { ...song };
    delete stripped.videoUrl;
    await saveSharedSong(stripped);
    const { hasAudio, hasVideo } = await probePage(id);
    return { id, status: "stripped", pageHasAudio: hasAudio, pageHasVideo: hasVideo };
  } catch (err) {
    return { id, status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

async function main(): Promise<void> {
  const ids = await listAllShareIds();
  console.log(`[revert-to-audio] mode=${DRY_RUN ? "DRY-RUN" : "EXECUTE"} candidates=${ids.length}`);

  const results: Result[] = [];
  for (const id of ids) {
    const r = await processOne(id);
    results.push(r);
    const extras: string[] = [];
    if ("hasAudioUrl" in r) extras.push(`audio=${r.hasAudioUrl}`);
    if ("videoUrl" in r) extras.push(`video=${r.videoUrl.slice(0, 60)}…`);
    if ("pageHasAudio" in r) extras.push(`pageHasAudio=${r.pageHasAudio}`);
    if ("pageHasVideo" in r) extras.push(`pageHasVideo=${r.pageHasVideo}`);
    if ("error" in r) extras.push(`error=${r.error}`);
    console.log(`  ${id} -> ${r.status} ${extras.join(" ")}`);
  }

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("[revert-to-audio] summary:", summary);

  const stuck = results.filter(
    (r): r is Extract<Result, { status: "no-audio-cannot-revert" }> =>
      r.status === "no-audio-cannot-revert",
  );
  if (stuck.length > 0) {
    console.log("[revert-to-audio] CANNOT REVERT (no audioUrl to fall back to):");
    for (const r of stuck) console.log(`  - ${r.id} ${r.videoUrl}`);
  }

  if (!DRY_RUN) {
    const broken = results.filter(
      (r): r is Extract<Result, { status: "stripped" }> =>
        r.status === "stripped" && (r.pageHasAudio !== true || r.pageHasVideo !== false),
    );
    if (broken.length > 0) {
      console.log("[revert-to-audio] PAGE VERIFY FAILED:");
      for (const r of broken) {
        console.log(`  - ${r.id} pageHasAudio=${r.pageHasAudio} pageHasVideo=${r.pageHasVideo}`);
      }
    }
  }
}

main().catch((err) => {
  console.error("[revert-to-audio] fatal:", err);
  process.exit(1);
});
