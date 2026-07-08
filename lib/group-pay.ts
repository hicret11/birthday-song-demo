// Group split payment ("chip in") — server-side helpers.
//
// Several friends can each pay a partial amount toward one gift's unlock price.
// When the running total of paid chip-ins reaches the price, the gift unlocks
// via the SAME path a solo purchase uses (markSharedSongUnlocked). This ships
// behind the GROUP_PAY_ENABLED flag (off by default) so it never affects v1.
//
// Paid chip-ins live in Postgres (see the gift_contributions_pay migration);
// the gift/song itself lives in Vercel KV (lib/share.ts). All access here is via
// the Supabase service role. A row is written only from the Stripe webhook after
// a chip-in payment completes, keyed uniquely on the Stripe payment id so a
// redelivered webhook can never double-count.

import type { SharedSong } from "./api-types";
import { getSupabaseAdmin } from "./supabase-admin";
import { loadSharedSong, markSharedSongUnlocked } from "./share";
import {
  TIER_PRICE_DISPLAY,
  TIER_PRICE_DISPLAY_DELUXE,
  TIER_PRICE_DISPLAY_PRODUCTION,
  type Plan,
  type Tier,
} from "./pricing-tiers";

const TABLE = "gift_contributions_pay";

/** Smallest single chip-in we accept (USD cents). */
export const MIN_CHIP_IN_CENTS = 100;

/**
 * Is group split payment enabled? Off by default — set GROUP_PAY_ENABLED=1 (or
 * "true") to offer it. Read server-side only and passed into client components
 * as a boolean prop; never exposed as a NEXT_PUBLIC_ env.
 */
export function isGroupPayEnabled(): boolean {
  const raw = (process.env.GROUP_PAY_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true";
}

/**
 * Canonical unlock price (USD cents) the chip-in pool must reach for a gift.
 * Derived from the song's creation-time tier + plan, matching the solo unlock
 * price ladder (lib/pricing-tiers). Defaults to Tier C / "full" when unknown so
 * the target can never be higher than the buyer would otherwise be charged.
 */
export function giftPoolTargetCents(song: Pick<SharedSong, "tier" | "plan">): number {
  const tier: Tier = song.tier ?? "C";
  const plan: Plan =
    song.plan === "production" ? "production" : song.plan === "deluxe" ? "deluxe" : "full";
  const map =
    plan === "production"
      ? TIER_PRICE_DISPLAY_PRODUCTION
      : plan === "deluxe"
        ? TIER_PRICE_DISPLAY_DELUXE
        : TIER_PRICE_DISPLAY;
  return map[tier].amountCents;
}

export type ChipInProgress = {
  /** Sum of all paid chip-ins (USD cents). */
  paidCents: number;
  /** Number of distinct paid chip-ins (≈ friends who chipped in). */
  count: number;
};

/** Running total + count of PAID chip-ins for a gift. */
export async function getChipInProgress(giftId: string): Promise<ChipInProgress> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("amount_cents")
    .eq("gift_id", giftId)
    .eq("status", "paid");
  if (error || !data) {
    console.error("[group-pay] getChipInProgress failed:", error?.message);
    return { paidCents: 0, count: 0 };
  }
  const rows = data as { amount_cents: number }[];
  const paidCents = rows.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);
  return { paidCents, count: rows.length };
}

/**
 * Record a completed chip-in payment. Idempotent: keyed on stripe_payment_id
 * (unique), so a redelivered webhook is a harmless no-op. Returns true when a
 * NEW row was inserted, false if it already existed (duplicate delivery) or on
 * error — callers use this to avoid re-running side effects on replays.
 */
export async function recordChipIn(input: {
  giftId: string;
  contributorToken: string;
  amountCents: number;
  stripePaymentId: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        gift_id: input.giftId,
        contributor_token: input.contributorToken,
        amount_cents: input.amountCents,
        stripe_payment_id: input.stripePaymentId,
        status: "paid",
      },
      { onConflict: "stripe_payment_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    console.error("[group-pay] recordChipIn failed:", error.message);
    return false;
  }
  // With ignoreDuplicates, a conflicting (already-recorded) payment returns an
  // empty set — signal "not new" so the webhook skips the unlock re-check.
  return Array.isArray(data) && data.length > 0;
}

export type ChipInResult = {
  /** A NEW payment was recorded (false ⇒ duplicate webhook delivery). */
  recorded: boolean;
  /** Running total across all paid chip-ins after this one (USD cents). */
  paidCents: number;
  /** The gift's unlock price (USD cents). 0 if the gift is gone. */
  targetCents: number;
  /** This chip-in is what pushed the pool to/over the price and unlocked it. */
  justUnlocked: boolean;
};

/**
 * Record a completed chip-in and, if it completes the pool, unlock the gift via
 * the SAME path a solo purchase uses (markSharedSongUnlocked). Idempotent: a
 * duplicate Stripe delivery records nothing and never re-unlocks. This is the
 * single source of truth the webhook calls — kept here (not inline in the route)
 * so the two-contributor-reaches-price behavior is unit-testable.
 */
export async function applyChipIn(input: {
  giftId: string;
  contributorToken: string;
  amountCents: number;
  stripePaymentId: string;
}): Promise<ChipInResult> {
  const recorded = await recordChipIn(input);
  const song = await loadSharedSong(input.giftId);
  if (!song) {
    return { recorded, paidCents: 0, targetCents: 0, justUnlocked: false };
  }
  const targetCents = giftPoolTargetCents(song);
  const { paidCents } = await getChipInProgress(input.giftId);
  let justUnlocked = false;
  // Only a genuinely new payment can trigger the unlock (a redelivery must be a
  // no-op), and only while the gift is still locked.
  if (recorded && !song.unlocked && paidCents >= targetCents) {
    justUnlocked = await markSharedSongUnlocked(input.giftId, "full");
  }
  return { recorded, paidCents, targetCents, justUnlocked };
}
