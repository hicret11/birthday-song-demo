// Single source of truth for the DISPLAY price labels shown in paywall CTAs.
//
// Pure data, no imports — safe to pull into client components AND into the
// server-side pricing module. The actual charge is ALWAYS the Stripe price_id
// (see lib/pricing-tiers.ts); these strings only drive UI copy, so the number a
// buyer sees and the number they're charged can never drift within the code.
// If you change a Stripe price, change it here once and every surface updates.

export type Tier = "A" | "B" | "C";

/** Standard "Full Song" unlock — geo-tiered display labels. */
export const FULL_PRICE_LABEL: Record<Tier, string> = {
  A: "$14.99",
  B: "$9.99",
  C: "$6.99",
};

/** Deluxe (Full Song + photo slideshow) — geo-tiered display labels. */
export const DELUXE_PRICE_LABEL: Record<Tier, string> = {
  A: "$24.99",
  B: "$16.99",
  C: "$11.99",
};
