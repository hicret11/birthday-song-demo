import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Re-generate on each request so newly onboarded venues appear within minutes,
// not on the next build.
export const revalidate = 0;

const BASE = "https://singmybirthday.com";

// Seed list of popular international first names for the programmatic
// "happy birthday [name] song" landing pages (app/happy-birthday/[name]).
// These capture long-tail organic search and funnel into /generate.
// Lowercased for clean, canonical URLs.
const SEED_NAMES = [
  // English / Western
  "emma", "olivia", "ava", "sophia", "isabella", "mia", "charlotte", "amelia",
  "harper", "evelyn", "liam", "noah", "oliver", "elijah", "william", "james",
  "benjamin", "lucas", "henry", "theodore", "jack", "leo", "ethan", "mason",
  // Spanish / Latin
  "mateo", "santiago", "sofia", "valentina", "diego", "lucia", "martina",
  "alejandro", "gabriel", "camila", "carlos", "maria", "jose", "ana",
  // French
  "louis", "gabrielle", "jules", "chloe", "manon", "hugo", "lea",
  // German / Nordic
  "lukas", "finn", "lena", "matteo", "elias", "astrid", "freya", "lars",
  // Italian / Portuguese
  "giulia", "francesco", "alessandro", "beatriz", "joao", "mariana",
  // Arabic
  "mohammed", "ahmed", "fatima", "aisha", "omar", "layla", "yusuf", "noor",
  // Indian / South Asian
  "aarav", "vivaan", "aditya", "ananya", "diya", "saanvi", "arjun", "ishaan",
  // East Asian
  "haruto", "yuki", "sakura", "wei", "mei", "minjun", "seoyeon",
  // African
  "kwame", "amara", "zola", "thabo", "chiamaka",
  // More common everyday names
  "michael", "sarah", "david", "jessica", "daniel", "emily", "john", "anna",
  "chris", "laura", "alex", "grace", "ryan", "hannah", "kevin", "rachel",
] as const;

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

  // Programmatic per-name "happy birthday [name] song" landing pages.
  const uniqueNames = Array.from(new Set(SEED_NAMES));
  const nameRoutes: MetadataRoute.Sitemap = uniqueNames.map((name) => ({
    url: `${BASE}/happy-birthday/${name}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...venueRoutes, ...nameRoutes];
}
