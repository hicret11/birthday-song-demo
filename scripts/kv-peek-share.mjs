import { readFileSync } from "node:fs";
const envText = readFileSync(".env.production.local", "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { kv } = await import("@vercel/kv");
const id = process.argv[2];
const song = await kv.get(`share:${id}`);
console.log(JSON.stringify({
  id,
  cakeStyle: song?.cakeStyle,
  candleColor: song?.candleColor,
  personalNote: song?.personalNote,
  waitCapture: song?.waitCapture,
}, null, 2));
