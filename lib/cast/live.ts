// Live (in-person) cast — concierge pilot config.
//
// The live experience (a real musician or costumed character showing up at a
// birthday) is human-fulfilled by us in a SINGLE pilot city. It is gated on the
// CAST_LIVE_CITIES env var: unset/empty ⇒ the feature is OFF everywhere and the
// UI never offers it. This is deliberately NOT a marketplace — no performer
// accounts, no matching; we take the request + a deposit and fulfil it by hand.

import type { CastKind } from "../cast";

export type LiveKind = "live_musician" | "character_visit";

export const LIVE_KINDS: LiveKind[] = ["live_musician", "character_visit"];

export function isLiveKind(kind: string): kind is LiveKind {
  return (LIVE_KINDS as string[]).includes(kind);
}

/** Not a call: the AI-call scheduler must ignore these. */
export function isLiveBookingKind(kind: CastKind): boolean {
  return kind !== "ai_call";
}

/**
 * Pilot cities where the live cast is offered, from CAST_LIVE_CITIES (a
 * comma-separated list, e.g. "Austin" or "Austin,Dallas"). Empty ⇒ off.
 */
export function getLiveCities(): string[] {
  return (process.env.CAST_LIVE_CITIES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Is the live cast offered anywhere right now? */
export function isLiveCastEnabled(): boolean {
  return getLiveCities().length > 0;
}

/** Case-insensitive check that a requested city is a configured pilot city. */
export function isLiveCityAllowed(city: string): boolean {
  const wanted = city.trim().toLowerCase();
  return getLiveCities().some((c) => c.toLowerCase() === wanted);
}

/**
 * Deposit charged to request a live booking (USD, whole dollars). A deposit
 * model is intentional for a concierge pilot — we confirm details by hand before
 * any full price. Override with CAST_LIVE_DEPOSIT_USD.
 */
export function liveDepositUsd(): number {
  const raw = Number(process.env.CAST_LIVE_DEPOSIT_USD);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 150;
}

/** Human-readable experience name for the Stripe line item + admin. */
export function liveKindLabel(kind: string): string {
  return kind === "live_musician"
    ? "Live musician visit"
    : kind === "character_visit"
      ? "Character visit"
      : "Live cast booking";
}
