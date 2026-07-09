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
import {
  FULL_PRICE_LABEL,
  DELUXE_PRICE_LABEL,
  PRODUCTION_PRICE_LABEL,
} from "./pricing-display";

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

// ── Consumer song-unlock pricing ────────────────────────────────────────────
//
// One-time payment to unlock the full song + MP3 download + share video +
// photo slideshow. Price is geo-tiered (Ray's "price by IP"): high-PPP markets
// pay the anchor, mid/low markets pay less so the impulse buy stays frictionless.
//
// SETUP REQUIRED (do this in the Stripe Dashboard, then set the env vars):
//   1. Create ONE Product "Sing My Birthday — Full Song".
//   2. Add THREE one-time prices on it (amounts below are the defaults we chose;
//      adjust freely). Copy each price_id into the matching env var:
//        STRIPE_PRICE_ID_TIER_A  → $14.99  (US/UK/UAE/EU & other high-PPP)
//        STRIPE_PRICE_ID_TIER_B  → $9.99   (LatAm, SE-Asia, Eastern Europe, TR)
//        STRIPE_PRICE_ID_TIER_C  → $6.99   (everywhere else / unknown geo)
//   3. Add STRIPE_WEBHOOK_SECRET (already used by the venue flow) and make sure
//      the webhook endpoint subscribes to `checkout.session.completed`.
//
// The amounts in TIER_PRICE_DISPLAY are for UI copy ONLY — the actual charge is
// always whatever the Stripe price_id says, so the price the user sees and the
// price they pay can never drift apart in code.

export const STRIPE_PRICE_IDS: Record<Tier, string | undefined> = {
  A: process.env.STRIPE_PRICE_ID_TIER_A,
  B: process.env.STRIPE_PRICE_ID_TIER_B,
  C: process.env.STRIPE_PRICE_ID_TIER_C,
};

/** Display-only amounts. Keep in sync with the Stripe prices you create. */
export const TIER_PRICE_DISPLAY: Record<Tier, { label: string; amountCents: number; currency: string }> = {
  A: { label: FULL_PRICE_LABEL.A, amountCents: 1499, currency: "usd" },
  B: { label: FULL_PRICE_LABEL.B, amountCents: 999, currency: "usd" },
  C: { label: FULL_PRICE_LABEL.C, amountCents: 699, currency: "usd" },
};

/** Stripe price_id for a tier, or undefined if not configured yet. */
export function priceIdForTier(tier: Tier): string | undefined {
  return STRIPE_PRICE_IDS[tier];
}

// ── Deluxe upsell tier (good-better-best) ─────────────────────────────────────
//
// "Deluxe" is the higher of two consumer plans: everything in the Standard
// "Full Song" unlock PLUS a rendered photo-slideshow video set to the music.
// It raises average order value without changing the base flow.
//
// SETUP (optional — the feature degrades gracefully without it):
//   Create THREE more one-time prices (higher amounts) on the same product and
//   set the matching env vars:
//     STRIPE_PRICE_ID_DELUXE_A → $24.99  (high-PPP)
//     STRIPE_PRICE_ID_DELUXE_B → $16.99  (mid-PPP)
//     STRIPE_PRICE_ID_DELUXE_C → $11.99  (low-PPP / unknown geo)
//
// If a Deluxe price is unset, a Deluxe checkout transparently FALLS BACK to the
// corresponding Standard "full" price (priceIdForPlanTier below), so nothing
// breaks before the Deluxe SKUs are configured — the buyer simply pays the
// Standard price for the Deluxe selection until the prices are added.

export type Plan = "full" | "deluxe" | "production";

export const STRIPE_PRICE_IDS_DELUXE: Record<Tier, string | undefined> = {
  A: process.env.STRIPE_PRICE_ID_DELUXE_A,
  B: process.env.STRIPE_PRICE_ID_DELUXE_B,
  C: process.env.STRIPE_PRICE_ID_DELUXE_C,
};

/** Display-only Deluxe amounts. Keep in sync with the Stripe Deluxe prices. */
export const TIER_PRICE_DISPLAY_DELUXE: Record<Tier, { label: string; amountCents: number; currency: string }> = {
  A: { label: DELUXE_PRICE_LABEL.A, amountCents: 2499, currency: "usd" },
  B: { label: DELUXE_PRICE_LABEL.B, amountCents: 1699, currency: "usd" },
  C: { label: DELUXE_PRICE_LABEL.C, amountCents: 1199, currency: "usd" },
};

// ── Production tier (good-better-BEST) ────────────────────────────────────────
//
// "Full Production" is the top plan: everything in Deluxe PLUS an AI character
// birthday phone call (lib/cast/*). The call path stays a no-op until the
// ElevenLabs/Twilio env is configured, so shipping the tier is safe pre-go-live
// (the buyer still gets the full Deluxe deliverable; the booking waits).
//
// SETUP: create THREE more one-time prices on the same product with _v3 lookup
// keys and set the matching env vars:
//     STRIPE_PRICE_ID_PRODUCTION_A → $44.99  (high-PPP)
//     STRIPE_PRICE_ID_PRODUCTION_B → $29.99  (mid-PPP)
//     STRIPE_PRICE_ID_PRODUCTION_C → $21.99  (low-PPP / unknown geo)
//
// As with Deluxe, an unset Production price FALLS BACK to the Standard "full"
// price for that tier so checkout never breaks before the SKUs exist.

export const STRIPE_PRICE_IDS_PRODUCTION: Record<Tier, string | undefined> = {
  A: process.env.STRIPE_PRICE_ID_PRODUCTION_A,
  B: process.env.STRIPE_PRICE_ID_PRODUCTION_B,
  C: process.env.STRIPE_PRICE_ID_PRODUCTION_C,
};

/** Display-only Production amounts. Keep in sync with the Stripe Production prices. */
export const TIER_PRICE_DISPLAY_PRODUCTION: Record<Tier, { label: string; amountCents: number; currency: string }> = {
  A: { label: PRODUCTION_PRICE_LABEL.A, amountCents: 4499, currency: "usd" },
  B: { label: PRODUCTION_PRICE_LABEL.B, amountCents: 2999, currency: "usd" },
  C: { label: PRODUCTION_PRICE_LABEL.C, amountCents: 2199, currency: "usd" },
};

/**
 * Stripe price_id for a (plan, tier) pair.
 *
 * For plan="deluxe"/"production" returns that plan's price when configured;
 * otherwise falls back to the Standard "full" price for the tier (graceful
 * degradation). For plan="full" always returns the Standard price. May be
 * undefined only if even the Standard tier price is unconfigured.
 */
export function priceIdForPlanTier(plan: Plan, tier: Tier): string | undefined {
  if (plan === "production") {
    return STRIPE_PRICE_IDS_PRODUCTION[tier] ?? STRIPE_PRICE_IDS[tier];
  }
  if (plan === "deluxe") {
    return STRIPE_PRICE_IDS_DELUXE[tier] ?? STRIPE_PRICE_IDS[tier];
  }
  return STRIPE_PRICE_IDS[tier];
}
