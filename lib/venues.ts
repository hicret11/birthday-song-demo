import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "./supabase-admin";

const SLUG_SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export const SLUG_RE = /^[a-z0-9-]{1,100}$/;
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function randomSlugSuffix(length = 4): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SLUG_SUFFIX_ALPHABET[bytes[i] % SLUG_SUFFIX_ALPHABET.length];
  }
  return out;
}

export type ActiveVenue = {
  venue_name: string;
  logo_color: string;
  share_slug: string;
  subscription_status: string;
  past_due_since: string | null;
};

const PAST_DUE_GRACE_DAYS = 7;

// Convention: any reporting / count / aggregate query on `venues` for "real
// paying venues" must filter `is_demo = false`. Demo rows are seeded for
// outreach (presentable URLs) and would otherwise inflate revenue/active-venue
// metrics. Public-facing per-slug lookups (loadActiveVenue, /v/[slug]) are
// intentionally NOT filtered on is_demo — the demo URLs are meant to render.

/**
 * Resolve a slug to an active venue or return null. Single source of truth
 * for venue lookups. Normalizes case, validates shape, and gates on
 * subscription_status === 'active' + non-null venue_name + non-null share_slug.
 */
export async function loadActiveVenue(rawSlug: string | null | undefined): Promise<ActiveVenue | null> {
  if (!rawSlug || typeof rawSlug !== "string") return null;
  const slug = rawSlug.toLowerCase();
  if (!SLUG_RE.test(slug)) return null;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return null;
  }

  const { data, error } = await supabase
    .from("venues")
    .select("venue_name, logo_color, share_slug, subscription_status, past_due_since")
    .eq("share_slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.venue_name || !data.share_slug) return null;

  const status = data.subscription_status;

  if (status === "active") {
    return data as ActiveVenue;
  }

  if (status === "past_due") {
    // Within the grace window → render the page with a banner.
    // Past the window → treat as suspended (404), same as canceled.
    const since = data.past_due_since ? new Date(data.past_due_since).getTime() : Date.now();
    const ageDays = (Date.now() - since) / (24 * 60 * 60 * 1000);
    if (ageDays <= PAST_DUE_GRACE_DAYS) {
      return data as ActiveVenue;
    }
    return null;
  }

  // canceled, unpaid, incomplete, etc. — 404.
  return null;
}
