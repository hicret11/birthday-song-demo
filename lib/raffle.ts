// Server-side raffle-entry persistence. Separate from lib/promotions.ts (which
// is pure, client-safe config) because this imports the Supabase admin client.
//
// Best-effort and dedupe-aware: a duplicate (same email + promotion) is treated
// as success, and any failure is logged, never thrown into the caller's flow.

import { getSupabaseAdmin } from "./supabase-admin";

export type RaffleEntryInput = {
  promotionId: string;
  email: string;
  eligibilityCountry?: string | null;
  eligibilityRegion?: string | null;
  prizeTermsVersion?: string | null;
  marketingConsent?: boolean;
  source?: string | null;
  anonymousId?: string | null;
  waitlistLeadId?: string | null;
  metadata?: Record<string, unknown>;
};

export type RaffleEntryResult = { ok: boolean; duplicate: boolean };

export async function recordRaffleEntry(input: RaffleEntryInput): Promise<RaffleEntryResult> {
  try {
    const row = {
      promotion_id: input.promotionId,
      email: input.email.toLowerCase(),
      eligibility_country: input.eligibilityCountry ?? null,
      eligibility_region: input.eligibilityRegion ?? null,
      prize_terms_version: input.prizeTermsVersion ?? null,
      // Raffle opt-in is independent of marketing consent — never default true.
      marketing_consent: input.marketingConsent === true,
      source: input.source ?? null,
      anonymous_id: input.anonymousId ?? null,
      waitlist_lead_id: input.waitlistLeadId ?? null,
      metadata: input.metadata ?? {},
    };

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("raffle_entries").insert([row]);
    if (error) {
      // Unique violation = already entered this promotion. Treat as success.
      if (error.code === "23505") return { ok: true, duplicate: true };
      console.error("[raffle] insert failed:", error.message);
      return { ok: false, duplicate: false };
    }
    return { ok: true, duplicate: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[raffle] insert threw:", message);
    return { ok: false, duplicate: false };
  }
}
