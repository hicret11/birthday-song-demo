// Server-only shared logic for turning a generated share into an
// admin_content_packages row, ported from content-automation/scripts/package-share.mjs.
// Reads KV (one share by id — NEVER enumerates) + promo_permissions (service role);
// writes ONLY admin_content_packages. Fail-closed permission buckets. Never approves,
// never posts. No filesystem/media writes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSharedSong } from "./share";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://singmybirthday.com").replace(/\/+$/, "");
const HOME = "https://singmybirthday.com";

export type Bucket = "approved-for-promo" | "needs-permission" | "private-share-only";

export type PermissionResolution = {
  bucket: Bucket;
  granted: boolean | null;
  minor: boolean | null;
  permission_text_version: string | null;
  policy_version: string | null;
  verdict: string;
};

/** Fail-closed: throws if promo_permissions can't be read (we never package on uncertainty). */
export async function resolvePermissionBucket(supabase: SupabaseClient, shareId: string): Promise<PermissionResolution> {
  const { data, error } = await supabase
    .from("promo_permissions")
    .select("granted,is_minor_recipient,permission_text_version,policy_version,created_at")
    .eq("share_id", shareId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`promo_permissions read failed: ${error.message}`);
  const row = data?.[0] as
    | { granted: boolean | null; is_minor_recipient: boolean | null; permission_text_version: string | null; policy_version: string | null }
    | undefined;
  if (!row) {
    return { bucket: "needs-permission", verdict: "no_permission_row", granted: null, minor: null, permission_text_version: null, policy_version: null };
  }
  const minor = row.is_minor_recipient === true;
  const granted = row.granted === true;
  const base = { granted, minor, permission_text_version: row.permission_text_version ?? null, policy_version: row.policy_version ?? null };
  if (minor) return { ...base, bucket: "private-share-only", verdict: "minor_recipient" };
  if (granted) return { ...base, bucket: "approved-for-promo", verdict: "granted" };
  return { ...base, bucket: "private-share-only", verdict: "declined" };
}

export function statusFromBucket(bucket: Bucket): string {
  return bucket === "approved-for-promo" ? "pending-review" : bucket;
}

function utm(platform: string, shareId: string): string {
  return `${HOME}/?utm_source=${platform}&utm_medium=organic&utm_campaign=product_share&utm_content=${shareId}`;
}

export type Suggested = {
  captions: { tiktok: string; instagram: string; youtube: string };
  /** Use-case caption angles (platform-agnostic copy, ready to adapt). */
  variants: { reaction: string; gift: string; venue: string; celebrity: string };
  hashtags: string;
  utm: { tiktok: string; instagram: string; youtube: string };
  share_link: string;
};

/** Derive suggested caption/hashtags/UTM from stored package fields (pure; no IO). */
export function suggestedContent(p: {
  recipient_first_name: string | null; genre: string | null; language: string | null;
  share_id: string; share_page_url: string | null;
}): Suggested {
  const name = (p.recipient_first_name || "someone").trim().split(/\s+/)[0] || "someone";
  const genre = p.genre ? `${p.genre} ` : "";
  const lang = p.language && !/english/i.test(p.language) ? ` (in ${p.language})` : "";
  const hashtags = "#birthdaysong #personalizedgift #singmybirthday #customsong #birthdaygift #giftideas";
  const captions = {
    tiktok: `🎂 we turned ${name}'s birthday into a real ${genre}song${lang} 🎶\nthe name-drop hits different. make one for someone you love 👇\n👉 ${HOME}\n\n${utm("tiktok", p.share_id)}\n\n${hashtags}`,
    instagram: `A birthday song made just for ${name} 💗 ${genre ? `a custom ${p.genre} track` : "a custom track"}${lang} with their name in it.\nSome gifts they unwrap — this one they replay forever.\nMake theirs 👉 ${HOME}\n\n${utm("instagram", p.share_id)}\n\n${hashtags}`,
    youtube: `${name}'s personalized birthday song 🎶 ${genre ? `${p.genre} style` : ""}${lang}. Hear their name in a real song.\nMake a custom birthday song in minutes 👉 ${HOME}\n\n${utm("youtube", p.share_id)}\n\n${hashtags}`,
  };
  // Use-case angles. Celebrity variant uses generic "pop-star birthday vibe" wording
  // and an explicit not-affiliated disclaimer — never names an artist or implies endorsement.
  const variants = {
    reaction: `👀 wait for it — we put ${name}'s name in a real ${genre}song${lang} 🎶\nthat reaction when they hear themselves in the lyrics 🥹\nmake one for someone you love 👉 ${HOME}\n\n${hashtags}`,
    gift: `the birthday gift that actually gets replayed 🎁 a custom ${genre}song${lang} made just for ${name}.\nsome gifts you unwrap — this one they keep forever 💗\n👉 ${HOME}\n\n${hashtags}`,
    venue: `birthdays hit different here 🎉 surprise your guest with a personalized birthday song with their name in it.\nperfect for venues, parties & events.\n👉 ${HOME}\n\n${hashtags}`,
    celebrity: `give them a pop-star birthday vibe 🎤 a custom ${genre}song${lang} with ${name}'s name in the lyrics.\n(original song — not affiliated with or endorsed by any artist)\n👉 ${HOME}\n\n${hashtags}`,
  };
  return {
    captions, variants, hashtags,
    utm: { tiktok: utm("tiktok", p.share_id), instagram: utm("instagram", p.share_id), youtube: utm("youtube", p.share_id) },
    share_link: p.share_page_url || `${SITE}/share/${p.share_id}`,
  };
}

export type PackageOutcome = { action: "packaged" | "skipped" | "failed"; reason?: string; bucket?: Bucket; status?: string };

/**
 * Package one share into admin_content_packages. INSERT-only for new share_ids
 * (skips ones already packaged → idempotent + preserves human-edited status/notes).
 * dry=true computes the outcome without writing. Never approves, never posts.
 */
export async function packageShareToAdmin(supabase: SupabaseClient, shareId: string, opts: { dry?: boolean } = {}): Promise<PackageOutcome> {
  const { data: existing, error: exErr } = await supabase.from("admin_content_packages").select("id").eq("share_id", shareId).limit(1);
  if (exErr) {
    const missing = exErr.code === "PGRST205" || exErr.code === "42P01" || /does not exist|schema cache|could not find the table/i.test(exErr.message || "");
    return { action: "failed", reason: missing ? "admin_content_packages not applied" : exErr.message };
  }
  if (existing?.[0]) return { action: "skipped", reason: "already_packaged" };

  const song = await loadSharedSong(shareId);
  if (!song) return { action: "skipped", reason: "share_not_found" }; // expired (90d TTL) or never existed

  const perm = await resolvePermissionBucket(supabase, shareId); // throws → caller marks failed (fail-closed)
  const hasVideo = typeof song.videoUrl === "string" && song.videoUrl.length > 0;
  const payload = {
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
    permission_text_version: perm.permission_text_version,
    policy_version: perm.policy_version,
    packaged_at: new Date().toISOString(),
  };

  if (opts.dry) return { action: "packaged", bucket: perm.bucket, status: payload.status, reason: "dry" };

  const { error: insErr } = await supabase.from("admin_content_packages").insert(payload);
  if (insErr) return { action: "failed", reason: insErr.message };
  return { action: "packaged", bucket: perm.bucket, status: payload.status };
}

/** Auto-discover share_created events not yet packaged. Uses generation_events as the index (no KV enumeration). */
export async function findShareCreatedCandidates(
  supabase: SupabaseClient,
  opts: { sinceDays?: number; limit?: number } = {},
): Promise<{ candidates: string[]; scanned: number; already_packaged: number }> {
  const sinceDays = opts.sinceDays ?? 60;
  const limit = opts.limit ?? 1000;
  const cutoff = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const { data: events, error } = await supabase
    .from("generation_events")
    .select("share_id")
    .eq("event_type", "share_created")
    .not("share_id", "is", null)
    .gte("occurred_at", cutoff)
    .limit(limit);
  if (error) throw new Error(`generation_events read failed: ${error.message}`);
  const shareIds = [...new Set((events ?? []).map((e) => (e as { share_id: string | null }).share_id).filter((x): x is string => !!x))];

  const { data: existing, error: exErr } = await supabase.from("admin_content_packages").select("share_id");
  if (exErr) throw new Error(`admin_content_packages read failed: ${exErr.message}`);
  const have = new Set((existing ?? []).map((r) => (r as { share_id: string }).share_id));
  const candidates = shareIds.filter((id) => !have.has(id));
  return { candidates, scanned: shareIds.length, already_packaged: shareIds.length - candidates.length };
}
