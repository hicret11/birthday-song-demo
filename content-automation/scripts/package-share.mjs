// content:package-share — turn generated songs/shares into post-ready packages
// for Hicrete. READ-ONLY on KV + Supabase. No posting, no AI generation, no API
// endpoints, no user-facing changes, never writes to production data.
//
// Single:  npm run content:package-share -- --share-id=<id> [--dry]
// Batch:   npm run content:package-share -- --share-ids-file=content-automation/share-ids.txt [--dry]
//
// Batch reads an explicit list of share IDs (one per line, # comments + blanks
// allowed). It does NOT scan KV globally — you only package IDs you already know.
//
// Buckets (fail-closed): approved-for-promo ONLY when a promo_permissions row has
// granted=true AND is_minor_recipient!=true. Unknown/missing/minor/declined => never public.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { kv } from "@vercel/kv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { ROOT, REPO_ROOT, LOGO, ensureDir, escapeXml, nowIso } from "./lib.mjs";

for (const f of [".env.local", ".env"]) {
  try { process.loadEnvFile(path.join(REPO_ROOT, f)); } catch { /* file absent — ok */ }
}

const OUT_ROOT = path.join(ROOT, "product-outputs");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://singmybirthday.com").replace(/\/+$/, "");
const HOME = "https://singmybirthday.com";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const ID_RE = /^[a-zA-Z0-9]{1,32}$/;
const PLATFORMS = ["tiktok", "instagram", "youtube"];
const BUCKETS = ["approved-for-promo", "private-share-only", "needs-permission"];

const argv = process.argv.slice(2);
const idArg = argv.find((a) => a.startsWith("--share-id="));
const fileArg = argv.find((a) => a.startsWith("--share-ids-file="));
const SHARE_ID = idArg ? idArg.split("=")[1] : null;
const IDS_FILE = fileArg ? fileArg.split("=").slice(1).join("=") : null;
const DRY = argv.includes("--dry");
const RECORD_ADMIN = argv.includes("--record-admin"); // optional write to admin_content_packages

function die(msg) { console.error(`\n✖ ${msg}\n`); process.exit(1); }

function requireEnv() {
  const required = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
  if (missing.length) {
    die(`Missing required env (set them in birthday-song-demo/.env.local — do not paste secrets anywhere):\n  - ${missing.join("\n  - ")}`);
  }
}

function parseIdsFile(rel) {
  const file = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
  if (!fs.existsSync(file)) die(`Share-IDs file not found: ${rel}`);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const ids = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue; // blanks + comments
    ids.push(line);
  }
  return { file, ids };
}

function utm(platform, shareId) {
  return `${HOME}/?utm_source=${platform}&utm_medium=organic&utm_campaign=product_share&utm_content=${shareId}`;
}

async function resolvePermission(supabase, shareId) {
  const { data, error } = await supabase
    .from("promo_permissions")
    .select("granted,is_minor_recipient,permission_text_version,policy_version,metadata,created_at")
    .eq("share_id", shareId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`promo_permissions read failed: ${error.message}`); // fail-closed
  const row = data && data[0];
  if (!row) {
    return { bucket: "needs-permission", verdict: "no_permission_row", granted: null, minor: null,
      permission_text_version: null, policy_version: null,
      label: "Permission NOT granted (no record). DO NOT post publicly." };
  }
  const minor = row.is_minor_recipient === true;
  const granted = row.granted === true;
  if (minor) return { bucket: "private-share-only", verdict: "minor_recipient", granted, minor,
    permission_text_version: row.permission_text_version ?? null, policy_version: row.policy_version ?? null,
    label: "NOT for public promotion — minor recipient. Share-only." };
  if (granted) return { bucket: "approved-for-promo", verdict: "granted", granted, minor,
    permission_text_version: row.permission_text_version ?? null, policy_version: row.policy_version ?? null,
    label: "APPROVED for public promotion." };
  return { bucket: "private-share-only", verdict: "declined", granted, minor,
    permission_text_version: row.permission_text_version ?? null, policy_version: row.policy_version ?? null,
    label: "NOT for public promotion — permission declined. Share-only." };
}

function captions(song, shareId) {
  const name = (song.name || "someone").trim().split(/\s+/)[0];
  const genre = song.genre ? `${song.genre} ` : "";
  const lang = song.language && !/english/i.test(song.language) ? ` (in ${song.language})` : "";
  const tags = "#birthdaysong #personalizedgift #singmybirthday #customsong #birthdaygift #giftideas";
  return {
    tiktok: `🎂 we turned ${name}'s birthday into a real ${genre}song${lang} 🎶\nthe name-drop hits different. make one for someone you love 👇\n👉 ${HOME}\n\n${utm("tiktok", shareId)}\n\n${tags}`,
    instagram: `A birthday song made just for ${name} 💗 ${genre ? `a custom ${song.genre} track` : "a custom track"}${lang} with their name in it.\nSome gifts they unwrap — this one they replay forever.\nMake theirs 👉 ${HOME}\n\n${utm("instagram", shareId)}\n\n${tags}`,
    youtube: `${name}'s personalized birthday song 🎶 ${genre ? `${song.genre} style` : ""}${lang}. Hear their name in a real song.\nMake a custom birthday song in minutes 👉 ${HOME}\n\n${utm("youtube", shareId)}\n\n${tags}`,
  };
}

function shareUrlsText(shareId) {
  return [
    `This song's share page: ${SITE}/share/${shareId}`, ``,
    `"Make your own" links (UTM-tagged, all → singmybirthday.com):`,
    ...PLATFORMS.map((p) => `  ${p}: ${utm(p, shareId)}`), ``,
  ].join("\n");
}

function permissionStatusText(perm, shareId) {
  return [
    `SHARE ID: ${shareId}`, `BUCKET: ${perm.bucket}`,
    `PROMO USE: ${perm.bucket === "approved-for-promo" ? "APPROVED ✅" : "DO NOT POST PUBLICLY ⛔"}`,
    `verdict: ${perm.verdict}`, `granted: ${perm.granted}`, `is_minor_recipient: ${perm.minor}`,
    `permission_text_version: ${perm.permission_text_version ?? "(none)"}`,
    `policy_version: ${perm.policy_version ?? "(none)"}`, ``, perm.label, ``,
    `Only "approved-for-promo" packages may be posted publicly. Everything else is`,
    `share-only / pending permission and must not be used in public promotion.`, ``,
  ].join("\n");
}

async function downloadTo(url, dest) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`download failed (${res.status}) for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function makeVideoThumbnail(videoPath, outJpg) {
  const r = spawnSync(FFMPEG, ["-y", "-ss", "1", "-i", videoPath, "-frames:v", "1", "-vf", "scale='min(1080,iw)':-2", outJpg], { encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(outJpg)) throw new Error(`ffmpeg thumbnail failed: ${(r.stderr || "").split("\n").slice(-3).join(" ")}`);
}

async function makeBrandPoster(song, outJpg) {
  const name = escapeXml((song.name || "Happy Birthday").trim().split(/\s+/)[0]);
  const W = 1080, H = 1920;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C3AED"/><stop offset="1" stop-color="#EC4899"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><text x="${W/2}" y="${H/2-40}" font-family="Avenir Next, Arial, sans-serif" font-weight="800" font-size="92" fill="#fff" text-anchor="middle">Happy Birthday</text><text x="${W/2}" y="${H/2+80}" font-family="Avenir Next, Arial, sans-serif" font-weight="900" font-size="120" fill="#FDE68A" text-anchor="middle">${name} 🎂</text><text x="${W/2}" y="${H-160}" font-family="Avenir Next, Arial, sans-serif" font-weight="700" font-size="40" fill="#fff" text-anchor="middle" opacity="0.95">singmybirthday.com</text></svg>`;
  let img = sharp(Buffer.from(svg));
  if (fs.existsSync(LOGO)) {
    const logo = await sharp(LOGO).resize(150, 150, { fit: "inside" }).png().toBuffer();
    img = img.composite([{ input: logo, top: 200, left: Math.round((W - 150) / 2) }]);
  }
  await img.jpeg({ quality: 90 }).toFile(outJpg);
}

// --- Admin (Phase B) optional recording -------------------------------------
// Bucket → initial admin status. approved-for-promo enters Hicrete's review
// queue as pending-review; the others mirror their (non-public) bucket.
function statusFromBucket(bucket) {
  return bucket === "approved-for-promo" ? "pending-review" : bucket;
}

// Payload for admin_content_packages. NO emails, NO local filesystem paths.
// thumbnail_url stays null until an R2/Blob upload step exists (Phase B+).
function buildAdminPayload(shareId, song, perm, hasVideo) {
  return {
    share_id: shareId,
    permission_bucket: perm.bucket,
    status: statusFromBucket(perm.bucket),
    recipient_first_name: (song.name || "").split(/\s+/)[0] || null,
    genre: song.genre || null,
    language: song.language || null,
    template: song.template || null,
    video_url: hasVideo ? song.videoUrl : null,
    audio_url: song.audioUrl || null,
    thumbnail_url: null,
    share_page_url: `${SITE}/share/${shareId}`,
    promo_granted: perm.granted === true,
    is_minor_recipient: perm.minor === true,
    permission_text_version: perm.permission_text_version ?? null,
    policy_version: perm.policy_version ?? null,
    packaged_at: nowIso(),
  };
}

// Upsert one row by share_id. Never throws — returns a result so packaging
// always succeeds even if the table is missing (migration not applied yet).
async function upsertAdminRow(supabase, payload) {
  try {
    const { error } = await supabase
      .from("admin_content_packages")
      .upsert(payload, { onConflict: "share_id" });
    if (!error) return { recorded: true, reason: null };
    const missing =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /does not exist|schema cache|could not find the table/i.test(error.message || "");
    return {
      recorded: false,
      reason: missing
        ? "admin_content_packages not found — apply the Phase B migration first"
        : error.message,
    };
  } catch (e) {
    return { recorded: false, reason: e instanceof Error ? e.message : "upsert failed" };
  }
}

// Package one share. Returns { bucket, audioOnly, dir, admin?, adminPayload? }.
// Throws on any failure (invalid id, not found, no media, permission read error)
// so batch can record it and continue.
async function packageOne(shareId, supabase, opts = {}) {
  const { dry = false, recordAdmin = false } = opts;
  if (!ID_RE.test(shareId)) throw new Error(`invalid share-id "${shareId}" (expected 1-32 alphanumeric)`);

  let song;
  try { song = await kv.get(`share:${shareId}`); }
  catch (e) { throw new Error(`KV read failed: ${e.message}`); }
  if (!song) throw new Error(`share not found in KV (may have expired — 90-day TTL)`);

  const perm = await resolvePermission(supabase, shareId);
  const hasVideo = typeof song.videoUrl === "string" && song.videoUrl.length > 0;
  const audioOnly = !hasVideo;
  const outDir = path.join(OUT_ROOT, perm.bucket, shareId);
  const promoTag = perm.bucket === "approved-for-promo" ? "APPROVED ✅" : "DO NOT POST PUBLICLY ⛔";
  console.log(`  ${shareId}: ${(song.name||"").split(/\s+/)[0]||"?"} | ${song.genre||"-"} | video:${hasVideo?"y":"NO"} | ${perm.bucket} (${promoTag})`);

  const adminPayload = recordAdmin ? buildAdminPayload(shareId, song, perm, hasVideo) : null;

  if (dry) return { bucket: perm.bucket, audioOnly, dir: outDir, dry: true, adminPayload };

  ensureDir(outDir);
  const files = [];
  const thumb = path.join(outDir, "thumbnail.jpg");
  if (hasVideo) {
    const v = path.join(outDir, "video.mp4");
    await downloadTo(song.videoUrl, v); files.push("video.mp4");
    await makeVideoThumbnail(v, thumb); files.push("thumbnail.jpg");
  } else {
    if (!song.audioUrl) throw new Error(`no videoUrl and no audioUrl — nothing to package`);
    const a = path.join(outDir, "audio.mp3");
    await downloadTo(song.audioUrl, a); files.push("audio.mp3");
    await makeBrandPoster(song, thumb); files.push("thumbnail.jpg");
  }

  const caps = captions(song, shareId);
  for (const p of PLATFORMS) {
    fs.writeFileSync(path.join(outDir, `caption-${p}.txt`), caps[p] + "\n", "utf8");
    files.push(`caption-${p}.txt`);
  }
  fs.writeFileSync(path.join(outDir, "share-url.txt"), shareUrlsText(shareId), "utf8"); files.push("share-url.txt");
  fs.writeFileSync(path.join(outDir, "permission-status.txt"), permissionStatusText(perm, shareId), "utf8"); files.push("permission-status.txt");

  const metadata = {
    share_id: shareId,
    recipient_name: (song.name || "").split(/\s+/)[0] || null,
    language: song.language || null, genre: song.genre || null, template: song.template || null,
    created_at: song.createdAt ? new Date(song.createdAt).toISOString() : null,
    video_url_present: hasVideo, audio_only: audioOnly,
    bucket: perm.bucket, promo_use: perm.bucket === "approved-for-promo" ? "approved" : "not_approved",
    permission_verdict: perm.verdict, granted: perm.granted, is_minor_recipient: perm.minor,
    permission_text_version: perm.permission_text_version, policy_version: perm.policy_version,
    share_page_url: `${SITE}/share/${shareId}`, cta_url: HOME,
    utm_links: Object.fromEntries(PLATFORMS.map((p) => [p, utm(p, shareId)])),
    auto_post: false, generated_at: nowIso(), output_files: files,
  };
  fs.writeFileSync(path.join(outDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
  files.push("metadata.json");

  let admin = null;
  if (recordAdmin) admin = await upsertAdminRow(supabase, adminPayload);

  return { bucket: perm.bucket, audioOnly, dir: outDir, admin, adminPayload };
}

async function runBatch(supabase, rel) {
  const { file, ids } = parseIdsFile(rel);
  if (!ids.length) die(`No share IDs found in ${rel} (only blanks/comments?).`);
  ensureDir(OUT_ROOT);
  console.log(`\n=== package-share BATCH (${ids.length} ids from ${rel})${DRY ? " [dry]" : ""} ===`);

  const results = [];
  const buckets = Object.fromEntries(BUCKETS.map((b) => [b, 0]));
  let packaged = 0, failed = 0, adminRecorded = 0, adminFailed = 0;

  for (const id of ids) {
    try {
      const r = await packageOne(id, supabase, { dry: DRY, recordAdmin: RECORD_ADMIN });
      packaged++; buckets[r.bucket] = (buckets[r.bucket] || 0) + 1;
      const row = { share_id: id, ok: true, bucket: r.bucket, audio_only: r.audioOnly };
      if (RECORD_ADMIN) {
        if (DRY) {
          console.log(`    [dry] admin upsert payload: ${JSON.stringify(r.adminPayload)}`);
          row.admin_recorded = null; // dry — not written
        } else {
          row.admin_recorded = r.admin?.recorded ?? false;
          row.admin_reason = r.admin?.reason ?? null;
          if (row.admin_recorded) adminRecorded++; else adminFailed++;
          console.log(`    admin: ${row.admin_recorded ? "recorded ✅" : `NOT recorded — ${row.admin_reason}`}`);
        }
      }
      results.push(row);
    } catch (e) {
      failed++; console.log(`  ✖ ${id}: ${e.message}`);
      results.push({ share_id: id, ok: false, error: e.message });
    }
  }

  const report = {
    generated_at: nowIso(), source_file: rel, dry: DRY, record_admin: RECORD_ADMIN,
    total_ids: ids.length, packaged, failed, buckets,
    admin: RECORD_ADMIN ? { attempted: packaged, recorded: adminRecorded, failed: adminFailed } : null,
    results,
  };
  if (!DRY) fs.writeFileSync(path.join(OUT_ROOT, "_batch-report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(`\n--- batch summary ---`);
  console.log(`packaged: ${packaged} | failed: ${failed}`);
  console.log(`approved-for-promo: ${buckets["approved-for-promo"]} | private-share-only: ${buckets["private-share-only"]} | needs-permission: ${buckets["needs-permission"]}`);
  if (RECORD_ADMIN && !DRY) console.log(`admin recorded: ${adminRecorded} | admin failed: ${adminFailed}`);
  console.log(DRY ? `(dry — no files or report written)` : `report: ${path.relative(REPO_ROOT, path.join(OUT_ROOT, "_batch-report.json"))}`);
  console.log(`(nothing was posted or scheduled.)\n`);
}

async function main() {
  if (IDS_FILE && SHARE_ID) die(`Use either --share-id or --share-ids-file, not both.`);
  if (!IDS_FILE && !SHARE_ID) die(`Missing input. Usage:\n  --share-id=<id>\n  --share-ids-file=<path>   [add --dry to preview]`);
  requireEnv();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (IDS_FILE) { await runBatch(supabase, IDS_FILE); return; }

  console.log(`\n=== package-share: ${SHARE_ID}${DRY ? " [dry]" : ""} ===`);
  try {
    const r = await packageOne(SHARE_ID, supabase, { dry: DRY, recordAdmin: RECORD_ADMIN });
    if (DRY) {
      console.log(`[dry] would write to: ${path.relative(REPO_ROOT, r.dir)} (no files written)`);
      if (RECORD_ADMIN) {
        console.log(`[dry] admin upsert payload (admin_content_packages):`);
        console.log(JSON.stringify(r.adminPayload, null, 2));
      }
    } else {
      console.log(`✅ packaged → ${path.relative(REPO_ROOT, r.dir)}`);
      if (r.bucket !== "approved-for-promo") console.log(`   ⛔ NOT public-postable — bucket "${r.bucket}". Post only from approved-for-promo/.`);
      if (RECORD_ADMIN) console.log(`   admin: ${r.admin?.recorded ? "recorded ✅" : `NOT recorded — ${r.admin?.reason}`}`);
    }
    console.log(`(nothing was posted or scheduled.)\n`);
  } catch (e) { die(`package-share failed for ${SHARE_ID}: ${e.message}`); }
}

main().catch((e) => die(`package-share failed: ${e.message}`));
