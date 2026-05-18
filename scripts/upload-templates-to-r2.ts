// One-off: upload the 4 pre-rendered 60s template MP4s to R2.
// Run: npx tsx --env-file=.env.local scripts/upload-templates-to-r2.ts

import { readFile } from "node:fs/promises";
import { uploadToR2 } from "../lib/r2";

const FILES = [
  { local: "/tmp/template-encodes/classic-60s.mp4",  key: "templates/classic-60s.mp4" },
  { local: "/tmp/template-encodes/elegant-60s.mp4",  key: "templates/elegant-60s.mp4" },
  { local: "/tmp/template-encodes/neon-60s.mp4",     key: "templates/neon-60s.mp4" },
  { local: "/tmp/template-encodes/playful-60s.mp4",  key: "templates/playful-60s.mp4" },
];

async function main(): Promise<void> {
  for (const { local, key } of FILES) {
    const bytes = await readFile(local);
    const started = Date.now();
    const url = await uploadToR2(key, bytes, "video/mp4");
    console.log(`[upload] ${key} bytes=${bytes.length} took=${Date.now() - started}ms url=${url}`);
  }
}

main().catch((err) => { console.error("[upload] fatal:", err); process.exit(1); });
