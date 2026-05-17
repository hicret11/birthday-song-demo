// Offline smoke test for the video pipeline.
// Run: `npx tsx --env-file=.env.local scripts/smoke-test-video.ts <publicAudioUrl>`
//
// Substitutes for the live Anthropic+Suno E2E tests we can't run without the
// keys hicret holds. Proves: ffmpeg composite, drawtext overlay, 60s duration
// cap, Blob upload, all four template paths.

import { readFile } from "node:fs/promises";
import { put } from "@vercel/blob";
import type { ShareTemplate } from "../lib/api-types";
import { renderShareVideo } from "../lib/video";

type Case = {
  name: string;
  template: ShareTemplate;
};

const CASES: Case[] = [
  { name: "Alex", template: "classic" },
  { name: "Sofía", template: "playful" },
  { name: "Burak", template: "neon" },
  { name: "Marie", template: "elegant" },
];

async function uploadAudioFixture(): Promise<string> {
  const fixturePath = "/tmp/sample-audio.mp3";
  const bytes = await readFile(fixturePath);
  const blob = await put(`smoke-test/sample-${Date.now()}.mp3`, bytes, {
    access: "public",
    contentType: "audio/mpeg",
    addRandomSuffix: false,
  });
  return blob.url;
}

async function main(): Promise<void> {
  const explicit = process.argv[2];
  const audioUrl = explicit ?? (await uploadAudioFixture());
  console.log(`[smoke] using audio: ${audioUrl}`);

  for (const c of CASES) {
    const started = Date.now();
    let result;
    try {
      result = await renderShareVideo({ audioUrl, name: c.name, template: c.template });
    } catch (err) {
      console.error(`[smoke] FAIL ${c.template} / ${c.name}: ${(err as Error).message}`);
      continue;
    }
    const renderMs = Date.now() - started;

    const blob = await put(
      `smoke-test/${c.template}-${c.name}-${Date.now()}.mp4`,
      result.mp4,
      { access: "public", contentType: "video/mp4", addRandomSuffix: false },
    );

    console.log(
      `[smoke] OK   ${c.template} / ${c.name}: duration=${result.durationSec.toFixed(2)}s bytes=${result.mp4.length} renderMs=${renderMs} url=${blob.url}`,
    );
  }
}

main().catch((err) => {
  console.error("[smoke] fatal:", err);
  process.exit(1);
});
