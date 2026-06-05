const PROD = "https://singmybirthday.com";
const TOKEN = process.env.ADMIN_BYPASS_TOKEN || "0mL7SnAfGFKZ6YMsGwZqCWSRDPvtOzKP";
const HEADERS = { "Content-Type": "application/json", "X-Admin-Bypass": TOKEN };

async function jpost(path, body) {
  const r = await fetch(`${PROD}${path}`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
  const t = await r.text();
  let parsed;
  try { parsed = JSON.parse(t); } catch { parsed = t; }
  return { status: r.status, body: parsed };
}
async function jget(path) {
  const r = await fetch(`${PROD}${path}`, { headers: HEADERS });
  const t = await r.text();
  let parsed;
  try { parsed = JSON.parse(t); } catch { parsed = t; }
  return { status: r.status, body: parsed };
}

const name = process.argv[2] || "Kamila";
const venueSlug = process.argv[3];
const waitCaptureMode = process.argv[4]; // "full" or "empty"

console.log(`name=${name} venue=${venueSlug || "(none)"} waitCapture=${waitCaptureMode || "empty"}`);

console.log("--- generate-lyrics ---");
const lyrics = await jpost("/api/generate-lyrics", { name, language: "English", genre: "🎤 Pop" });
console.log("status", lyrics.status, "title", lyrics.body.lyrics?.title);
if (lyrics.status !== 200) { console.error("lyrics failed", lyrics.body); process.exit(1); }

console.log("--- generate-music ---");
const music = await jpost("/api/generate-music", {
  name, language: "English", genre: "🎤 Pop", lyrics: lyrics.body.lyrics,
});
console.log("status", music.status, "jobId", music.body.jobId);
if (music.status !== 200) { console.error("music failed", music.body); process.exit(1); }

console.log("--- poll song-status ---");
let audioUrl;
const startedAt = Date.now();
for (let i = 1; i <= 40; i += 1) {
  const s = await jget(`/api/song-status?jobId=${music.body.jobId}`);
  console.log(`[${i}] +${((Date.now() - startedAt) / 1000).toFixed(1)}s status=${s.body.status}`);
  if (s.body.status === "complete") { audioUrl = s.body.audioUrl; break; }
  if (s.body.status === "failed") { console.error("song failed", s.body.error); process.exit(1); }
  await new Promise((r) => setTimeout(r, 3000));
}
if (!audioUrl) { console.error("song never completed"); process.exit(1); }
console.log("audioUrl=", audioUrl);

console.log("--- /api/share ---");
const makeItYoursMode = process.argv[5]; // "full" or "empty"
const sharePayload = {
  name,
  language: "English",
  genre: "🎤 Pop",
  lyrics: lyrics.body.lyrics,
  audioUrl,
  template: "classic",
  senderName: "Test Sender",
  ...(venueSlug ? { venueSlug } : {}),
  ...(waitCaptureMode === "full"
    ? { wait_capture: { relationship: "friend", celebration_location: "home", year_reminder: true } }
    : {}),
  ...(makeItYoursMode === "full"
    ? {
        cake_style: "rainbow",
        candle_color: "purple",
        personal_note: "May this year be your brightest one yet!",
      }
    : {}),
  ...(makeItYoursMode === "long-note"
    ? {
        personal_note:
          "This is going to be your most incredible year and you deserve every bit of it!",
      }
    : {}),
  ...(makeItYoursMode === "cake-only"
    ? {
        cake_style: "chocolate",
        personal_note: "Many happy returns!",
      }
    : {}),
};
const shareStart = Date.now();
const share = await jpost("/api/share", sharePayload);
const shareDur = ((Date.now() - shareStart) / 1000).toFixed(1);
console.log(`status=${share.status} took=${shareDur}s`);
console.log(JSON.stringify(share.body, null, 2));
if (share.status !== 200) process.exit(1);
console.log("--- HEAD on videoUrl ---");
if (share.body.videoUrl) {
  const head = await fetch(share.body.videoUrl, { method: "HEAD" });
  console.log("videoUrl status:", head.status, "size:", head.headers.get("content-length"));
}
