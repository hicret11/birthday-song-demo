// Google Places API (New) provider for UAE venue discovery. OFFICIAL API ONLY —
// no scraping. Text Search first (cheap field mask); Place Details only for
// leads missing website/phone, capped. Hard caps bound cost. Fails gracefully.
//
// Env: GOOGLE_PLACES_API_KEY (server-only). Optional caps:
//   OUTREACH_MAX_QUERIES (default 70), OUTREACH_MAX_DETAILS (default 60).

import { normalizeLead, scoreLead, type NormalizedLead } from "../provider";

export const UAE_CITIES = [
  "Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain",
];
export const QUERIES = [
  "birthday party venue", "kids party venue", "family restaurant birthday", "event venue birthday",
  "party planner", "kids entertainment", "indoor play area", "cake shop birthday", "gift shop",
  "hotel birthday party",
];

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_BASE = "https://places.googleapis.com/v1/places/";
const MAX_PLACES_PER_QUERY = 20; // single page only (no pagination) to bound cost

function capFromEnv(name: string, dflt: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : dflt;
}

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
};

/** Parse a Places (New) Text Search response → NormalizedLead[] (pure; testable). */
export function parsePlacesTextSearch(json: unknown, ctx: { query: string; city: string }): NormalizedLead[] {
  const places = (json as { places?: RawPlace[] })?.places ?? [];
  const out: NormalizedLead[] = [];
  for (const p of places.slice(0, MAX_PLACES_PER_QUERY)) {
    const name = p.displayName?.text;
    const placeId = p.id;
    if (!name || !placeId) continue;
    const lead = normalizeLead(
      {
        business_name: name,
        source_place_id: placeId,
        category: ctx.query, // the query label is the most useful category for outreach
        city: ctx.city,
        country: "AE",
        address: p.formattedAddress,
        rating: p.rating,
        review_count: p.userRatingCount,
      },
      { source: "google_places" },
    );
    if (lead) out.push(lead);
  }
  return out;
}

async function textSearch(apiKey: string, query: string, city: string): Promise<NormalizedLead[]> {
  const res = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // Essentials/Pro fields only — NOT contact fields (those are fetched per-place below).
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.primaryTypeDisplayName",
    },
    body: JSON.stringify({ textQuery: `${query} in ${city}, United Arab Emirates`, regionCode: "AE", maxResultCount: MAX_PLACES_PER_QUERY }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`text search ${res.status}`);
  return parsePlacesTextSearch(await res.json(), { query, city });
}

async function placeDetails(apiKey: string, placeId: string): Promise<{ website_url: string | null; phone: string | null; google_maps_url: string | null }> {
  const res = await fetch(`${PLACE_DETAILS_BASE}${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "websiteUri,nationalPhoneNumber,googleMapsUri" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`details ${res.status}`);
  const j = (await res.json()) as { websiteUri?: string; nationalPhoneNumber?: string; googleMapsUri?: string };
  return { website_url: j.websiteUri ?? null, phone: j.nationalPhoneNumber ?? null, google_maps_url: j.googleMapsUri ?? null };
}

export type GoogleStats = {
  text_searches: number; detail_calls: number; errors: number;
  raw_places: number; deduped: number; capped: boolean;
};

export async function fetchGooglePlacesLeads(opts: { apiKey: string }): Promise<{ leads: NormalizedLead[]; stats: GoogleStats }> {
  const MAX_QUERIES = capFromEnv("OUTREACH_MAX_QUERIES", UAE_CITIES.length * QUERIES.length); // 70
  const MAX_DETAILS = capFromEnv("OUTREACH_MAX_DETAILS", 60);
  const stats: GoogleStats = { text_searches: 0, detail_calls: 0, errors: 0, raw_places: 0, deduped: 0, capped: false };

  const byPlaceId = new Map<string, NormalizedLead>();
  outer: for (const city of UAE_CITIES) {
    for (const query of QUERIES) {
      if (stats.text_searches >= MAX_QUERIES) { stats.capped = true; break outer; }
      stats.text_searches++;
      try {
        const leads = await textSearch(opts.apiKey, query, city);
        stats.raw_places += leads.length;
        for (const lead of leads) {
          const key = lead.source_place_id;
          if (!key) continue;
          const existing = byPlaceId.get(key);
          if (!existing || lead.relevance_score > existing.relevance_score) byPlaceId.set(key, lead);
        }
      } catch {
        stats.errors++; // graceful: skip this query, keep going
      }
    }
  }

  // Enrich: Place Details ONLY for leads missing website AND phone, top-scored first, capped.
  const deduped = [...byPlaceId.values()].sort((a, b) => b.relevance_score - a.relevance_score);
  stats.deduped = deduped.length;
  for (const lead of deduped) {
    if (stats.detail_calls >= MAX_DETAILS) { stats.capped = true; break; }
    if (lead.website_url || lead.phone) continue;
    if (!lead.source_place_id) continue;
    stats.detail_calls++;
    try {
      const d = await placeDetails(opts.apiKey, lead.source_place_id);
      lead.website_url = d.website_url;
      lead.phone = d.phone;
      lead.google_maps_url = d.google_maps_url;
      lead.relevance_score = scoreLead(lead); // re-score now that contact info is known
    } catch {
      stats.errors++;
    }
  }

  return { leads: deduped, stats };
}
