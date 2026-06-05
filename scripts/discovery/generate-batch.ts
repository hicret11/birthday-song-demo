/**
 * Discovery batch: generate name-songs + per-name SEO assets for upload.
 *
 * Usage:
 *   npx tsx scripts/discovery/generate-batch.ts --limit=3
 *   npx tsx scripts/discovery/generate-batch.ts --confirm        # full 100
 *
 * Calls the project's lib/* functions directly (bypassing HTTP), so the
 * /api/generate-music IP rate limiter does not apply. Suno's own per-account
 * rate limits do — hence the 30s throttle between submissions.
 *
 * Per name (≈ $0.11):
 *   out/discovery/{slug}/{slug}-1080p.mp4       horizontal w/ name burned in
 *   out/discovery/{slug}/{slug}-vertical.mp4    1080×1920, padded
 *   out/discovery/{slug}/{slug}-thumbnail.jpg   1280×720, brand gradient
 *   out/discovery/{slug}/{slug}-metadata.json   title/desc/tags via Claude Haiku
 *
 * Plus out/discovery/generation-log.csv (one row per attempt).
 */

import Anthropic from "@anthropic-ai/sdk";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { mkdir, readFile, rm, writeFile, appendFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

import { generateLyrics } from "../../lib/anthropic";
import { renderShareVideo } from "../../lib/video";
import { checkStatus, submitGeneration } from "../../lib/suno";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const NAMES_PATH = path.join(PROJECT_ROOT, "scripts/discovery/names-us-top-100.json");
const OUT_ROOT = path.join(PROJECT_ROOT, "out/discovery");
const LOG_PATH = path.join(OUT_ROOT, "generation-log.csv");
const LOGO_MARK_PATH = path.join(PROJECT_ROOT, "public/brand/logo-mark.png");
const FONT_PATH = path.join(PROJECT_ROOT, "public/video-fonts/Inter-Bold.ttf");

const POLL_INTERVAL_MS = 4_000;
const SUNO_TIMEOUT_MS = 4 * 60 * 1000;
const THROTTLE_MS = 30_000;
const COST_PER_NAME_USD = 0.11;
const CONFIRM_REQUIRED_ABOVE = 5;

type NameEntry = {
  name: string;
  popularity_rank: number;
  gender_lean: "boy" | "girl" | "neutral";
  region: string;
};

// ---------------- env bootstrap ----------------

async function loadEnvFile(filePath: string): Promise<void> {
  try {
    const raw = await readFile(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+)\s*$/);
      if (!m) continue;
      const key = m[1];
      if (process.env[key]) continue; // do not clobber existing
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // missing file is fine — caller will detect missing required vars
  }
}

const REQUIRED_ENV = ["ANTHROPIC_API_KEY", "SUNO_API_KEY"];

// ---------------- CLI args ----------------

type Args = { limit: number | null; confirm: boolean };

function parseArgs(argv: string[]): Args {
  let limit: number | null = null;
  let confirm = false;
  for (const arg of argv.slice(2)) {
    if (arg === "--confirm") confirm = true;
    else if (arg.startsWith("--limit=")) {
      const v = Number(arg.slice("--limit=".length));
      if (Number.isFinite(v) && v > 0) limit = Math.floor(v);
    }
  }
  return { limit, confirm };
}

// ---------------- helpers ----------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeFFmpegText(text: string): string {
  // ffmpeg drawtext filter escapes
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function appendLogRow(row: (string | number | null | undefined)[]): Promise<void> {
  await appendFile(LOG_PATH, row.map(csvCell).join(",") + "\n", "utf8");
}

async function ensureLogHeader(): Promise<void> {
  try {
    await stat(LOG_PATH);
  } catch {
    await writeFile(
      LOG_PATH,
      "name,slug,started_at,finished_at,status,error,cost_estimate_usd,horizontal_mp4,vertical_mp4,thumbnail_jpg,metadata_json\n",
    );
  }
}

// ---------------- Suno polling ----------------

async function pollUntilDone(jobId: string): Promise<string> {
  const started = Date.now();
  // small initial delay to let Suno's task get queued
  await sleep(2_000);
  while (Date.now() - started < SUNO_TIMEOUT_MS) {
    const s = await checkStatus(jobId);
    if (s.status === "complete") return s.audioUrl;
    if (s.status === "failed") throw new Error(`Suno failed: ${s.error}`);
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Suno status polling timed out");
}

// ---------------- assets ----------------

async function burnTextOntoVideo(
  inputMp4Path: string,
  outputMp4Path: string,
  name: string,
): Promise<void> {
  const headline = escapeFFmpegText(`Happy Birthday`);
  const namePart = escapeFFmpegText(`${name}!`);
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputMp4Path)
      .videoFilter([
        // Headline: top-third, large
        `drawtext=fontfile=${FONT_PATH}:text='${headline}':fontsize=72:fontcolor=white:` +
          `borderw=4:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.10`,
        // Name: bigger, below headline
        `drawtext=fontfile=${FONT_PATH}:text='${namePart}':fontsize=128:fontcolor=white:` +
          `borderw=6:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.18`,
      ])
      .outputOptions(["-c:a", "copy", "-movflags", "+faststart"])
      .on("error", reject)
      .on("end", () => resolve())
      .save(outputMp4Path);
  });
}

async function makeVerticalFromHorizontal(
  horizontalPath: string,
  verticalPath: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(horizontalPath)
      // Scale to width 1080 keeping aspect, then pad to 1080×1920 with brand-dark background.
      .videoFilter(
        "scale=1080:-2,pad=1080:1920:0:(1920-ih)/2:color=#0a0014",
      )
      .outputOptions(["-c:a", "copy", "-movflags", "+faststart"])
      .on("error", reject)
      .on("end", () => resolve())
      .save(verticalPath);
  });
}

async function renderThumbnail(name: string, outPath: string): Promise<void> {
  const logoBuf = await readFile(LOGO_MARK_PATH);
  const logoB64 = logoBuf.toString("base64");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ec4899"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="url(#brand)"/>
  <image x="60" y="56" width="128" height="128" href="data:image/png;base64,${logoB64}"/>
  <text x="640" y="340" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="88" font-weight="800" fill="#ffffff" filter="url(#shadow)" letter-spacing="2">HAPPY BIRTHDAY</text>
  <text x="640" y="500" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="180" font-weight="900" fill="#ffffff" filter="url(#shadow)">${name}!</text>
  <text x="640" y="660" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="600" fill="rgba(255,255,255,0.85)" letter-spacing="6">SINGMYBIRTHDAY.COM</text>
</svg>`;
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outPath);
}

// ---------------- metadata via Claude Haiku ----------------

type Metadata = {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  category: string;
};

const META_SYSTEM = `You are a YouTube/TikTok SEO copywriter for a personalized birthday-song platform. You always output a single valid JSON object — no prose, no markdown fences, no commentary.`;

function buildMetaPrompt(name: string): string {
  return `Generate SEO metadata for a personalized birthday-song video celebrating the name "${name}".

Output JSON with this exact schema:
{
  "title": "Happy Birthday ${name}! 🎂 <varied second clause that includes the word 'song' or 'music'> 🎵",
  "description": "150-180 word friendly description. Mention the name '${name}' 2-3 times. Include 'Happy Birthday ${name}!' as a phrase. Include a CTA: 'Make your own custom birthday song at singmybirthday.com'. End with 5-10 hashtags on the last line.",
  "tags": ["happy birthday ${name}", "birthday song ${name}", "${name} birthday", "personalized birthday song", "ai birthday song", "<10-15 more relevant general birthday tags>"],
  "hashtags": ["#happybirthday", "#${name.toLowerCase()}", "<6-8 more>"],
  "category": "Music"
}

Vary the title's second clause across runs (do not always say "Personalized Birthday Song"). Examples of acceptable second clauses: "Birthday Song Just for You", "A Special Birthday Tune", "Made With Love Just for You", "Original Birthday Anthem". Keep titles under 90 characters total.`;
}

async function generateMetadata(name: string, anthropic: Anthropic): Promise<Metadata> {
  const result = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
    max_tokens: 900,
    temperature: 0.8,
    system: META_SYSTEM,
    messages: [{ role: "user", content: buildMetaPrompt(name) }],
  });
  const block = result.content[0];
  if (!block || block.type !== "text") throw new Error("Claude returned no text");
  const text = block.text.trim();
  // Tolerate accidental fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Metadata;
  if (
    typeof parsed.title !== "string" ||
    typeof parsed.description !== "string" ||
    !Array.isArray(parsed.tags) ||
    !Array.isArray(parsed.hashtags)
  ) {
    throw new Error("metadata JSON missing required fields");
  }
  return parsed;
}

// ---------------- per-name pipeline ----------------

type Outcome = {
  status: "success" | "failure";
  error?: string;
  horizontal?: string;
  vertical?: string;
  thumbnail?: string;
  metadata?: string;
};

async function processOne(entry: NameEntry, anthropic: Anthropic): Promise<Outcome> {
  const slug = slugify(entry.name);
  const dir = path.join(OUT_ROOT, slug);
  await mkdir(dir, { recursive: true });
  const horizontalRaw = path.join(dir, `${slug}-raw.mp4`);
  const horizontal = path.join(dir, `${slug}-1080p.mp4`);
  const vertical = path.join(dir, `${slug}-vertical.mp4`);
  const thumbnail = path.join(dir, `${slug}-thumbnail.jpg`);
  const metadataPath = path.join(dir, `${slug}-metadata.json`);

  console.log(`  → lyrics`);
  const lyrics = await generateLyrics({
    name: entry.name,
    language: "English",
    genre: "Pop",
  });

  console.log(`  → suno submit`);
  const jobId = await submitGeneration({
    lyrics: lyrics.raw,
    style:
      "short cheerful birthday pop song, 30 to 45 seconds, simple vocals, natural ending",
    title: lyrics.title,
  });

  console.log(`  → suno poll (≈60s)`);
  const audioUrl = await pollUntilDone(jobId);

  console.log(`  → mux video`);
  const rendered = await renderShareVideo({
    audioUrl,
    name: entry.name,
    template: "classic",
    language: "English",
    logId: slug,
  });
  await writeFile(horizontalRaw, rendered.mp4);

  console.log(`  → burn name onto video`);
  await burnTextOntoVideo(horizontalRaw, horizontal, entry.name);
  await rm(horizontalRaw, { force: true });

  console.log(`  → vertical render`);
  await makeVerticalFromHorizontal(horizontal, vertical);

  console.log(`  → thumbnail`);
  await renderThumbnail(entry.name, thumbnail);

  console.log(`  → metadata (Haiku)`);
  const meta = await generateMetadata(entry.name, anthropic);
  await writeFile(metadataPath, JSON.stringify(meta, null, 2) + "\n");

  return {
    status: "success",
    horizontal: path.relative(PROJECT_ROOT, horizontal),
    vertical: path.relative(PROJECT_ROOT, vertical),
    thumbnail: path.relative(PROJECT_ROOT, thumbnail),
    metadata: path.relative(PROJECT_ROOT, metadataPath),
  };
}

// ---------------- main ----------------

async function main(): Promise<void> {
  await loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
  await loadEnvFile(path.join(PROJECT_ROOT, ".env.production.local"));

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      `Missing required env vars: ${missing.join(", ")}.\n` +
        `Add them to .env.local (or .env.production.local) before running.`,
    );
    process.exit(2);
  }

  const args = parseArgs(process.argv);
  const allNames: NameEntry[] = JSON.parse(await readFile(NAMES_PATH, "utf8"));
  const queue = args.limit ? allNames.slice(0, args.limit) : allNames;
  const estimate = (queue.length * COST_PER_NAME_USD).toFixed(2);

  console.log("─".repeat(60));
  console.log(`Discovery batch — ${queue.length} name${queue.length === 1 ? "" : "s"}`);
  console.log(`Est. API spend: $${estimate}  (≈ $${COST_PER_NAME_USD.toFixed(2)}/name)`);
  console.log(`Throttle: 1 generation per ${THROTTLE_MS / 1000}s`);
  console.log(`Output:   ${path.relative(process.cwd(), OUT_ROOT)}/`);
  console.log("─".repeat(60));

  if (queue.length > CONFIRM_REQUIRED_ABOVE && !args.confirm) {
    console.log(
      `Above ${CONFIRM_REQUIRED_ABOVE} names — re-run with --confirm to execute.`,
    );
    return;
  }

  await mkdir(OUT_ROOT, { recursive: true });
  await ensureLogHeader();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const entry = queue[i];
    const slug = slugify(entry.name);
    const startedAt = new Date().toISOString();
    console.log(`\n[${i + 1}/${queue.length}] ${entry.name}  (${slug})`);

    let outcome: Outcome;
    try {
      outcome = await processOne(entry, anthropic);
      successCount += 1;
      console.log(`  ✓ done`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outcome = { status: "failure", error: msg };
      failureCount += 1;
      console.log(`  ✗ ${msg}`);
    }
    const finishedAt = new Date().toISOString();

    await appendLogRow([
      entry.name,
      slug,
      startedAt,
      finishedAt,
      outcome.status,
      outcome.error,
      COST_PER_NAME_USD,
      outcome.horizontal,
      outcome.vertical,
      outcome.thumbnail,
      outcome.metadata,
    ]);

    if (i < queue.length - 1) {
      console.log(`  … throttle ${THROTTLE_MS / 1000}s`);
      await sleep(THROTTLE_MS);
    }
  }

  console.log(
    `\nDone. ${successCount} succeeded, ${failureCount} failed. Log: ${path.relative(process.cwd(), LOG_PATH)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
