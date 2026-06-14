// Server-only data layer for the manual social posting tracker (social_posts).
// NO auto-posting, NO social API, NO scraping — a manual log only.

import { getSupabaseAdmin } from "./supabase-admin";

export const SOCIAL_PLATFORMS = ["tiktok", "instagram", "youtube_shorts", "facebook"] as const;
export const SOCIAL_STATUSES = ["planned", "posted", "skipped"] as const;
export type SocialStatus = (typeof SOCIAL_STATUSES)[number];

export type SocialPost = {
  id: string;
  platform: string;
  share_id: string | null;
  package_id: string | null;
  post_url: string | null;
  caption: string | null;
  status: string;
  posted_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
};

const COLS = "id,platform,share_id,package_id,post_url,caption,status,posted_at,notes,created_by,created_at";

export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01" ||
    /could not find the table|schema cache|does not exist/i.test(error.message || "");
}

export type ListFilters = { platform?: string; status?: string };
export type ListResult =
  | { ok: true; rows: SocialPost[] }
  | { ok: false; missing: true; message: string }
  | { ok: false; missing: false; error: string };

const MISSING = "Social tracker table not applied yet (Phase C migration). Empty/unavailable is expected until merge.";

export async function listPosts(f: ListFilters): Promise<ListResult> {
  try {
    const supabase = getSupabaseAdmin();
    let q = supabase.from("social_posts").select(COLS);
    if (f.platform) q = q.eq("platform", f.platform);
    if (f.status) q = q.eq("status", f.status);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
    if (error) return isMissingTableError(error) ? { ok: false, missing: true, message: MISSING } : { ok: false, missing: false, error: error.message };
    return { ok: true, rows: (data ?? []) as SocialPost[] };
  } catch (e) {
    return { ok: false, missing: false, error: e instanceof Error ? e.message : "query failed" };
  }
}

export async function createPost(input: {
  platform: string; share_id?: string | null; package_id?: string | null; post_url?: string | null; caption?: string | null;
  status?: string; posted_at?: string | null; notes?: string | null; created_by?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(SOCIAL_PLATFORMS as readonly string[]).includes(input.platform)) return { ok: false, error: "invalid platform" };
  const status = input.status ?? "planned";
  if (!(SOCIAL_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "invalid status" };
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("social_posts").insert({
      platform: input.platform,
      share_id: input.share_id || null,
      package_id: input.package_id || null,
      post_url: input.post_url || null,
      caption: input.caption || null,
      status,
      posted_at: input.posted_at || null,
      notes: input.notes || null,
      created_by: input.created_by || "admin",
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "insert failed" };
  }
}

export async function updatePostStatus(
  id: string, status: string, postedAt?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(SOCIAL_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "invalid status" };
  try {
    const supabase = getSupabaseAdmin();
    const upd: Record<string, unknown> = { status };
    if (status === "posted" && postedAt !== undefined) upd.posted_at = postedAt || new Date().toISOString();
    const { error } = await supabase.from("social_posts").update(upd).eq("id", id);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "update failed" };
  }
}
