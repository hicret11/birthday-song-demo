// Shared helpers for the Sing My Birthday content-automation pipeline (Phase 1).
//
// Plain Node ESM on purpose:
//  - not matched by the app tsconfig `include` globs (**/*.ts), so it can never
//    break `next build`'s typecheck;
//  - runs with plain `node` (no tsx/compile step) and needs no new dependencies
//    beyond `sharp` (already used by scripts/build_cake_assets.mjs) + system ffmpeg.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, ".."); // content-automation/
export const REPO_ROOT = path.resolve(ROOT, ".."); // birthday-song-demo/
export const CALENDAR = path.join(ROOT, "calendar", "posts.json");
export const ASSETS_DIR = path.join(ROOT, "assets");
export const OUTPUT_DIR = path.join(ROOT, "output");
export const LOGO = path.join(REPO_ROOT, "public", "brand", "logo-mark-white.png");

export const SITE = "https://singmybirthday.com";
export const SITE_HOST = "singmybirthday.com";

// Brand-palette gradients used for brand_made backgrounds (FFmpeg 0xRRGGBB).
export const GRADIENTS = {
  gradient_brand_purple_pink: { c0: "0x7C3AED", c1: "0xEC4899" },
  gradient_brand_sunset: { c0: "0xF59E0B", c1: "0xEC4899" },
  gradient_brand_night: { c0: "0x4C1D95", c1: "0xDB2777" },
};
export const DEFAULT_GRADIENT = "gradient_brand_purple_pink";

// Required fields on every calendar row (data-model contract).
export const REQUIRED_FIELDS = [
  "post_id", "campaign", "date", "platforms", "pillar", "hook",
  "on_screen_text", "caption", "cta", "hashtags", "utm_content", "utm_urls",
  "asset_id", "asset_type", "asset_permission_status", "permission_record_url",
  "adult_targeting_confirmed", "approval_status", "render_status",
];

// Soft signal only — adult_targeting_confirmed is the hard gate. These words get
// a WARNING for human review (avoids false-positives like "kids who are grown").
const CHILD_DIRECTED_HINTS = ["toddler", "infant", "for your child", "for kids", "kids' party", "childrens", "children's"];

export function loadCalendar() {
  const raw = fs.readFileSync(CALENDAR, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.posts)) throw new Error("posts.json: `posts` must be an array");
  return data;
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Schema check — returns array of structural problems (not guardrails). */
export function schemaErrors(post) {
  const errs = [];
  for (const f of REQUIRED_FIELDS) {
    if (!(f in post)) errs.push(`missing field: ${f}`);
  }
  if (post.platforms && !Array.isArray(post.platforms)) errs.push("platforms must be an array");
  if (post.hashtags && !Array.isArray(post.hashtags)) errs.push("hashtags must be an array");
  if (post.utm_urls && typeof post.utm_urls !== "object") errs.push("utm_urls must be an object");
  return errs;
}

/**
 * Compliance guardrails. Returns { eligible, reasons[], warnings[] }.
 * A post is BLOCKED from rendering if any reason is present.
 */
export function evaluateGuardrails(post) {
  const reasons = [];
  const warnings = [];

  // G6/approval: never render a rejected post.
  if (post.approval_status === "rejected") {
    reasons.push("approval_status is `rejected`");
  }

  // G1/G4: permission. `brand_made` and `ai_generated` are synthetic (no real
  // person/customer/song), so they need no permission record. Everything else
  // (lemoni, customer, tbd, …) must be explicitly `cleared`.
  const NO_PERMISSION_NEEDED = new Set(["brand_made", "ai_generated"]);
  if (!NO_PERMISSION_NEEDED.has(post.asset_type) && post.asset_permission_status !== "cleared") {
    reasons.push(
      `asset not cleared (asset_type=${post.asset_type}, permission=${post.asset_permission_status}) — needs permission_status=cleared`,
    );
  }
  // G4: a cleared customer/lemoni asset must also carry a stored permission record.
  if (
    (post.asset_type === "lemoni" || post.asset_type === "customer") &&
    post.asset_permission_status === "cleared" &&
    !post.permission_record_url
  ) {
    reasons.push("permission marked cleared but permission_record_url is empty (G4: must store proof)");
  }

  // G2: adult targeting must be explicitly confirmed.
  if (post.adult_targeting_confirmed !== true) {
    reasons.push("adult_targeting_confirmed is not true");
  }

  // G5: every platform must drive to singmybirthday.com via UTM.
  const platforms = Array.isArray(post.platforms) ? post.platforms : [];
  if (platforms.length === 0) reasons.push("no platforms listed");
  for (const p of platforms) {
    const url = post.utm_urls?.[p];
    if (!url) {
      reasons.push(`missing utm_url for platform: ${p}`);
      continue;
    }
    let ok = false;
    try {
      const u = new URL(url);
      ok = u.protocol === "https:" && u.host === SITE_HOST && u.searchParams.has("utm_source");
    } catch {
      ok = false;
    }
    if (!ok) reasons.push(`utm_url for ${p} does not point to ${SITE} with UTM params`);
  }

  // Soft child-directed scan (warning, not a block).
  const haystack = `${post.hook} ${post.on_screen_text} ${post.caption}`.toLowerCase();
  for (const hint of CHILD_DIRECTED_HINTS) {
    if (haystack.includes(hint)) warnings.push(`possible child-directed phrase: "${hint}" — confirm adult gift-giver framing`);
  }

  return { eligible: reasons.length === 0, reasons, warnings };
}

// ── Text helpers (overlay is rasterized, so we sanitize for SVG/librsvg) ──

const EMOJI_RE =
  /[←-⇿⌀-➿⬀-⯿☀-⛿︀-️‍\u{1F000}-\u{1FAFF}]/gu;

/** Strip emoji/pictographs for on-video text (librsvg has no color-emoji). Captions keep them. */
export function stripEmoji(s) {
  return String(s).replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word-wrap to a max chars-per-line; returns array of lines (capped). */
export function wrapText(text, maxChars, maxLines = 4) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\W*$/, "") + "…";
    return kept;
  }
  return lines;
}

/** Clean a CTA for the on-video end card: drop emoji + "link in bio" phrasing. */
export function cleanCtaForVideo(cta) {
  let s = stripEmoji(cta);
  s = s.replace(/[→·|]+\s*link in bio/gi, "").replace(/link in bio/gi, "");
  s = s.replace(/[→·|]+\s*$/g, "").replace(/\s{2,}/g, " ").trim();
  if (!s || /singmybirthday\.com/i.test(s)) s = "Make their song";
  return s;
}

/** Platform-specific caption file body (captions KEEP emoji). */
export function buildPlatformCaption(post, platform) {
  const url = post.utm_urls?.[platform] || SITE;
  const tags = (post.hashtags || []).join(" ");
  return [post.caption, "", post.cta, "", `🔗 ${url}`, "", tags, ""].join("\n");
}

export function nowIso() {
  return new Date().toISOString();
}
