// Crowd-magic — server-side helpers for collaborative contributions.
//
// Contributions live in Postgres (see the crowd_contributions migration);
// the gift/song itself lives in Vercel KV (lib/share.ts). All access here is
// via the Supabase service role. Kept deliberately small: add a contribution,
// list a gift's approved contributions, count them, and compose them into a
// lyric-prompt context block for the eventual merge step (Inngest, Phase 2b).

import { getSupabaseAdmin } from "./supabase-admin";

export type ContributionKind = "line" | "memory" | "wish" | "photo" | "voice";
export type ContributionStatus = "pending" | "approved" | "rejected";

export type CrowdContribution = {
  id: string;
  giftId: string;
  authorName: string | null;
  kind: ContributionKind;
  content: string | null;
  contentUrl: string | null;
  status: ContributionStatus;
  createdAt: string;
};

const TABLE = "crowd_contributions";

/** Max text length for a single contribution (mirrors app-side clamp). */
export const MAX_CONTRIBUTION_LEN = 280;
/** How many contributions one anonymous token may add to one gift. */
export const MAX_PER_AUTHOR = 5;

type Row = {
  id: string;
  gift_id: string;
  author_name: string | null;
  kind: ContributionKind;
  content: string | null;
  content_url: string | null;
  status: ContributionStatus;
  created_at: string;
};

function toContribution(r: Row): CrowdContribution {
  return {
    id: r.id,
    giftId: r.gift_id,
    authorName: r.author_name,
    kind: r.kind,
    content: r.content,
    contentUrl: r.content_url,
    status: r.status,
    createdAt: r.created_at,
  };
}

/** Insert a contribution. Returns the created row, or null on failure. */
export async function addContribution(input: {
  giftId: string;
  authorToken: string;
  authorName?: string | null;
  kind: ContributionKind;
  content?: string | null;
  contentUrl?: string | null;
  status?: ContributionStatus;
}): Promise<CrowdContribution | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      gift_id: input.giftId,
      author_token: input.authorToken,
      author_name: input.authorName ?? null,
      kind: input.kind,
      content: input.content ?? null,
      content_url: input.contentUrl ?? null,
      status: input.status ?? "approved",
    })
    .select(
      "id, gift_id, author_name, kind, content, content_url, status, created_at",
    )
    .single();
  if (error || !data) {
    console.error("[crowd] addContribution failed:", error?.message);
    return null;
  }
  return toContribution(data as Row);
}

/** How many contributions this anonymous token has already made to this gift. */
export async function countByAuthor(
  giftId: string,
  authorToken: string,
): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("gift_id", giftId)
    .eq("author_token", authorToken);
  if (error) {
    console.error("[crowd] countByAuthor failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Approved contributions for a gift, oldest first. */
export async function listApprovedContributions(
  giftId: string,
): Promise<CrowdContribution[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, gift_id, author_name, kind, content, content_url, status, created_at",
    )
    .eq("gift_id", giftId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  if (error || !data) {
    console.error("[crowd] listApprovedContributions failed:", error?.message);
    return [];
  }
  return (data as Row[]).map(toContribution);
}

/**
 * Compose approved contributions into a context block for the lyric prompt.
 * This is what turns "many people's bits" into ONE song at merge time. Text
 * kinds (line/memory/wish) use their content directly; a voice note contributes
 * its TRANSCRIPT (persisted into `content` by the close route after Whisper).
 * Photos have no words, so they're excluded here (they feed the slideshow).
 */
export function composeLyricContext(contributions: CrowdContribution[]): string {
  const lines = contributions
    .filter(
      (c) =>
        (c.kind === "line" || c.kind === "memory" || c.kind === "wish" || c.kind === "voice") &&
        c.content?.trim(),
    )
    .map((c) => {
      const who = c.authorName?.trim() ? ` (from ${c.authorName.trim()})` : "";
      const label =
        c.kind === "line"
          ? "Lyric idea"
          : c.kind === "memory"
            ? "Memory"
            : c.kind === "wish"
              ? "Wish"
              : "Voice note";
      return `- ${label}${who}: ${c.content!.trim()}`;
    });
  return lines.join("\n");
}

/** Collect one media kind's contribution URLs, deduped and in order. */
function collectMediaUrls(contributions: CrowdContribution[], kind: ContributionKind): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const c of contributions) {
    if (c.kind !== kind) continue;
    const url = c.contentUrl?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/**
 * Collect approved photo contributions' URLs, deduped and in order. These feed
 * the merged song's Deluxe slideshow (song.photoUrls) at close/merge time.
 */
export function collectPhotoUrls(contributions: CrowdContribution[]): string[] {
  return collectMediaUrls(contributions, "photo");
}

/**
 * Collect approved voice-note contributions' audio URLs, deduped and in order.
 * Persisted on the merged song (song.voiceUrls) for a future voice montage —
 * the words themselves are separately transcribed into the lyrics.
 */
export function collectVoiceUrls(contributions: CrowdContribution[]): string[] {
  return collectMediaUrls(contributions, "voice");
}

/**
 * Persist text onto a contribution's `content` (e.g. a voice note's Whisper
 * transcript, computed at merge time). Best-effort; logs and swallows errors.
 */
export async function setContributionContent(id: string, content: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).update({ content }).eq("id", id);
  if (error) console.error("[crowd] setContributionContent failed:", error.message);
}
