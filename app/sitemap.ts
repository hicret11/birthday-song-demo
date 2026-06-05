import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Re-generate on each request so newly onboarded venues appear within minutes,
// not on the next build.
export const revalidate = 0;

const BASE = "https://singmybirthday.com";

async function loadIndexableVenues(): Promise<
  { slug: string; updatedAt: Date | null }[]
> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("venues")
      .select("share_slug, updated_at")
      .eq("subscription_status", "active")
      .eq("is_demo", false)
      .not("share_slug", "is", null);
    if (error || !data) return [];
    return data
      .filter(
        (r) =>
          typeof r.share_slug === "string" && r.share_slug.length > 0,
      )
      .map((r) => ({
        slug: r.share_slug as string,
        updatedAt:
          typeof r.updated_at === "string" ? new Date(r.updated_at) : null,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE}/generate`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE}/become-a-venue`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const venues = await loadIndexableVenues();
  const venueRoutes: MetadataRoute.Sitemap = venues.map((v) => ({
    url: `${BASE}/v/${v.slug}`,
    lastModified: v.updatedAt ?? now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Discovery library (per-name pages) intentionally omitted — those live as
  // YouTube/TikTok uploads until the on-site /n/[name] surface ships.

  return [...staticRoutes, ...venueRoutes];
}
