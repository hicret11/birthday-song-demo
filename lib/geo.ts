// Edge-IP geolocation. On Vercel, geo data is injected by the platform as
// request headers before the request reaches the handler. The country header
// is what the pricing tier map keys on.
//
// All headers are absent in local dev (`next dev`) and in any non-Vercel
// environment. Callers must treat null as the normal case.

const COUNTRY_HEADER = "x-vercel-ip-country";
const REGION_HEADER = "x-vercel-ip-country-region";
const CITY_HEADER = "x-vercel-ip-city";

const ISO_ALPHA_2_RE = /^[A-Z]{2}$/;

/**
 * ISO 3166-1 alpha-2 country code of the requesting IP, or null if not
 * available (local dev, unsupported edge regions, header stripped).
 */
export function getCountryCode(request: Request): string | null {
  const raw = request.headers.get(COUNTRY_HEADER);
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!ISO_ALPHA_2_RE.test(code)) return null;
  return code;
}

/**
 * Bundle of geo signals we may need later (city-level personalization,
 * region-level legal compliance hooks, etc.). All fields optional.
 */
export type GeoContext = {
  country: string | null;
  region: string | null;
  city: string | null;
};

export function getGeoContext(request: Request): GeoContext {
  const country = getCountryCode(request);
  const region = request.headers.get(REGION_HEADER)?.trim() || null;
  // Vercel URL-encodes the city header for non-ASCII characters.
  const cityRaw = request.headers.get(CITY_HEADER);
  const city = cityRaw ? safeDecode(cityRaw.trim()) || null : null;
  return { country, region, city };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
