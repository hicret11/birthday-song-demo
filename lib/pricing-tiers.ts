// Country → pricing tier resolution.
//
// Three tiers per Ray's framework:
//   A — high-PPP, willingness-to-pay anchors at US baseline
//   B — mid-PPP, scaled down ~30-50%
//   C — low-PPP, scaled down further; also the safest default when geo is unknown
//
// This file is pure infrastructure: it maps an ISO 3166-1 alpha-2 country code
// to a tier letter. It does NOT decide prices or Stripe SKUs. When the consumer
// pricing strategy is finalized, plug the Stripe price_id mapping at the TODO
// below — the rest of the application already passes `tier` through.

import { getCountryCode } from "./geo";

export type Tier = "A" | "B" | "C";

const TIER_A: ReadonlySet<string> = new Set([
  // Big anchors
  "US", // United States
  "GB", // United Kingdom
  "AE", // United Arab Emirates
  "AU", // Australia
  // Northern Europe
  "DE", "FR", "NL", "SE", "NO", "DK", "FI",
  // Other high-PPP
  "SG", // Singapore
  "CA", // Canada
  "CH", // Switzerland
]);

const TIER_B: ReadonlySet<string> = new Set([
  // Eastern Europe
  "PL", "CZ", "HU", "RO",
  // Latin America
  "MX", "BR", "AR", "CL",
  // SE Asia
  "TH", "MY", "ID", "VN", "PH",
  // Türkiye
  "TR",
]);

/**
 * Resolve an ISO 3166-1 alpha-2 country code to a pricing tier.
 *
 * Unmapped countries → Tier C, intentionally the *lowest* price tier. Treating
 * "we don't know" as low-price is the safer default: a real Tier A user pays
 * slightly less than they would have, vs. a real Tier C user being priced out
 * by the strongest currency assumption.
 */
export function getTierForCountry(countryCode: string | null): Tier {
  if (!countryCode) return "C";
  const code = countryCode.toUpperCase();
  if (TIER_A.has(code)) return "A";
  if (TIER_B.has(code)) return "B";
  return "C";
}

/**
 * Test-only override: `?tier=A|B|C` on the request URL forces the resolved
 * tier. Honored ONLY in non-production environments so it cannot be abused
 * by an end user against the live price ladder.
 */
function readTierOverride(request: Request): Tier | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const url = new URL(request.url);
    const param = url.searchParams.get("tier");
    if (param === "A" || param === "B" || param === "C") return param;
  } catch {
    // Malformed request.url — ignore.
  }
  return null;
}

/**
 * Single source of truth for the request's pricing tier. Use this from any
 * route handler or server component that needs tier-aware behavior.
 *
 * Resolution order:
 *   1. `?tier=` override        (non-production only)
 *   2. Vercel edge country header → tier map
 *   3. Default → Tier C
 */
export function resolveTier(request: Request): Tier {
  const override = readTierOverride(request);
  if (override) return override;
  const country = getCountryCode(request);
  return getTierForCountry(country);
}

// TODO: wire tier → Stripe price_id when pricing strategy is finalized.
// Suggested shape, drop in here once decided:
//
//   export const STRIPE_PRICE_IDS: Record<Tier, string> = {
//     A: process.env.STRIPE_PRICE_ID_TIER_A!,
//     B: process.env.STRIPE_PRICE_ID_TIER_B!,
//     C: process.env.STRIPE_PRICE_ID_TIER_C!,
//   };
//
// The Stripe Checkout flow already receives a Tier letter from resolveTier();
// at that point it's a single lookup to pick the price. Until then, the venue
// founding-tier price stays the only Stripe Product on file.
