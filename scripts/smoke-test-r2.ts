// Smoke test for R2 upload + public read.
// Run: npx tsx --env-file=.env.local scripts/smoke-test-r2.ts

import { uploadToR2 } from "../lib/r2";

async function main(): Promise<void> {
  const key = `smoke-test/hello-${Date.now()}.txt`;
  const body = `hello from r2 smoke test at ${new Date().toISOString()}\n`;

  console.log(`[smoke-r2] uploading key=${key} bytes=${body.length}`);
  const url = await uploadToR2(key, body, "text/plain");
  console.log(`[smoke-r2] upload OK -> ${url}`);

  console.log(`[smoke-r2] curling public URL...`);
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  console.log(`[smoke-r2] GET status=${res.status} content-type=${res.headers.get("content-type")}`);
  console.log(`[smoke-r2] body matches: ${text === body}`);
  if (text !== body) {
    console.log(`[smoke-r2] expected: ${JSON.stringify(body)}`);
    console.log(`[smoke-r2] got:      ${JSON.stringify(text)}`);
  }
}

main().catch((err) => {
  console.error("[smoke-r2] FAILED:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
