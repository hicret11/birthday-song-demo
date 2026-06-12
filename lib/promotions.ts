// Active promotion (raffle/voucher) configuration.
//
// Default: INACTIVE. No raffle/voucher behavior — no entries, no UI — unless an
// active promotion id is explicitly configured via env. This module is pure
// config (no DB / no server-only imports) so it is safe to import from client
// components for UI gating with NEXT_PUBLIC_ACTIVE_PROMOTION_ID.

const PROMO_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_VERSION_LEN = 40;

export type ActivePromotion = {
  id: string;
  prizeTermsVersion: string | null;
};

/**
 * The active promotion, or null when none is configured (the default).
 *
 * Resolution: prefer the server-only `ACTIVE_PROMOTION_ID`, then the public
 * `NEXT_PUBLIC_ACTIVE_PROMOTION_ID`. The id must match a strict slug pattern or
 * it is treated as unset (fail-closed → inactive).
 */
export function getActivePromotion(): ActivePromotion | null {
  const raw =
    (process.env.ACTIVE_PROMOTION_ID ?? process.env.NEXT_PUBLIC_ACTIVE_PROMOTION_ID ?? "").trim();
  if (!raw || !PROMO_ID_RE.test(raw)) return null;

  const prizeTermsVersion =
    (process.env.ACTIVE_PROMOTION_PRIZE_TERMS_VERSION ?? "").trim().slice(0, MAX_VERSION_LEN) ||
    null;

  return { id: raw, prizeTermsVersion };
}

/** True only when an active promotion is configured. */
export function isPromotionActive(): boolean {
  return getActivePromotion() !== null;
}

/**
 * Resolve a client-claimed promotion id against the active promotion. Returns
 * the active promotion only when there IS one AND the claim matches it (or no
 * claim was made — the active promotion is then assumed). Returns null when no
 * promotion is active.
 */
export function resolveActivePromotion(claimedId?: unknown): ActivePromotion | null {
  const active = getActivePromotion();
  if (!active) return null;
  if (claimedId === undefined || claimedId === null || claimedId === "") return active;
  if (typeof claimedId === "string" && claimedId.trim() === active.id) return active;
  return null;
}
