// Outreach provider abstraction — swap Google Places / SerpAPI / DataForSEO later
// behind one interface. Pure: no DB, no network, no secrets here. The default
// provider is "none" (returns not-configured). NO scraping of any website.

export const OUTREACH_STATUSES = [
  "new", "shortlisted", "contacted", "replied", "not_relevant", "partnered",
] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export type NormalizedLead = {
  source: string;
  source_place_id: string | null;
  business_name: string;
  category: string | null;
  country: string;
  city: string | null;
  area: string | null;
  address: string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  google_maps_url: string | null;
  rating: number | null;
  review_count: number | null;
  relevance_score: number;
};

const RELEVANT_HINTS = [
  "birthday", "party", "kids", "child", "family restaurant", "event", "planner",
  "entertain", "cake", "bakery", "dessert", "gift", "play", "hotel", "banquet",
  "celebration", "balloon", "venue",
];

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** Heuristic 0–100 relevance for B2B birthday/event outreach. */
export function scoreLead(l: Partial<NormalizedLead>): number {
  let s = 40;
  const hay = `${l.category ?? ""} ${l.business_name ?? ""}`.toLowerCase();
  if (RELEVANT_HINTS.some((h) => hay.includes(h))) s += 25;
  const r = l.rating ?? 0;
  s += r >= 4.5 ? 15 : r >= 4 ? 10 : r >= 3 ? 5 : 0;
  const rc = l.review_count ?? 0;
  s += rc >= 500 ? 10 : rc >= 100 ? 7 : rc >= 20 ? 4 : 0;
  if (l.website_url) s += 5;
  if (l.phone) s += 5;
  return Math.max(0, Math.min(100, s));
}

/** Normalize a raw record (from import or a provider) → NormalizedLead, or null if unusable. */
export function normalizeLead(raw: Record<string, unknown>, defaults?: { source?: string }): NormalizedLead | null {
  const business_name = str(raw.business_name ?? raw.name);
  if (!business_name) return null;
  const base: Omit<NormalizedLead, "relevance_score"> = {
    source: str(raw.source) ?? defaults?.source ?? "manual_import",
    source_place_id: str(raw.source_place_id ?? raw.place_id),
    business_name,
    category: str(raw.category ?? raw.type),
    country: (str(raw.country) ?? "AE").toUpperCase().slice(0, 2),
    city: str(raw.city),
    area: str(raw.area ?? raw.neighborhood),
    address: str(raw.address ?? raw.formatted_address),
    website_url: str(raw.website_url ?? raw.website),
    phone: str(raw.phone ?? raw.formatted_phone_number),
    email: str(raw.email),
    instagram_url: str(raw.instagram_url ?? raw.instagram),
    google_maps_url: str(raw.google_maps_url ?? raw.maps_url ?? raw.url),
    rating: num(raw.rating),
    review_count: num(raw.review_count ?? raw.user_ratings_total),
  };
  return { ...base, relevance_score: scoreLead(base) };
}

export type ProviderResult =
  | { configured: true; leads: NormalizedLead[]; stats?: Record<string, number | boolean> }
  | { configured: false; reason: string };

export function getProviderName(): string {
  const v = (process.env.OUTREACH_PROVIDER ?? "none").trim();
  return v || "none";
}

/**
 * Fetch UAE venue leads from the configured provider. Phase C1: always
 * not-configured (no real provider implemented; no scraping, no paid API).
 * Phase C2 will implement "google_places" here behind GOOGLE_PLACES_API_KEY.
 */
export async function fetchUaeVenueLeads(): Promise<ProviderResult> {
  const name = getProviderName();
  if (name === "none") return { configured: false, reason: "source not configured" };
  if (name === "google_places") {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return { configured: false, reason: "GOOGLE_PLACES_API_KEY missing" };
    // Dynamic import keeps the network/provider code out of modules that only
    // need the pure helpers above.
    const { fetchGooglePlacesLeads } = await import("./providers/google-places");
    const { leads, stats } = await fetchGooglePlacesLeads({ apiKey });
    return { configured: true, leads, stats: { ...stats } };
  }
  return { configured: false, reason: `provider "${name}" not implemented yet` };
}
