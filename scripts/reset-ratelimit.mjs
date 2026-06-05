import { readFileSync } from "node:fs";
const envText = readFileSync(".env.production.local", "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { kv } = await import("@vercel/kv");
const ip = process.argv[2];
if (!ip) { console.error("usage: node scripts/reset-ratelimit.mjs <ip>"); process.exit(1); }
const keys = [`rate:share:${ip}`, `rate:music:${ip}`];
for (const k of keys) {
  const before = await kv.get(k);
  const deleted = await kv.del(k);
  console.log(`${k}: before=${JSON.stringify(before)} del=${deleted}`);
}
