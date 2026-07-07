import { kv } from "@vercel/kv";

// Daily spend caps per upstream service. The values here are the kill-switch
// budgets — exceeding them stops the relevant API route until UTC midnight.
//
// Note: Anthropic and Suno are the two paid services we actually invoke today.
// fal.ai is listed as a placeholder so the cap is ready when that integration
// lands (e.g., for a future avatar / image-gen feature).
export const DAILY_CAP_USD_CENTS: Record<string, number> = {
  openai: 5_000,      // $50.00 — lyrics + style-refine (+ moderation/Whisper)
  anthropic: 5_000,   // $50.00 — legacy; no longer used by the generation path
  suno: 5_000,        // $50.00 — defensive default; raise when revenue allows
  "fal.ai": 30_000,   // $300.00 (placeholder; service not wired yet)
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function counterKey(service: string): string {
  return `spend:${service}:${todayKey()}`;
}

function alertedKey(service: string): string {
  return `spend:${service}:${todayKey()}:alerted`;
}

const KEY_TTL_SECONDS = 48 * 60 * 60;

/** Read today's cumulative spend for a service, in cents. */
export async function getDailySpendCents(service: string): Promise<number> {
  try {
    const raw = await kv.get<number | string>(counterKey(service));
    if (raw == null) return 0;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    // KV unreachable → treat as zero so we never falsely 503 the route.
    return 0;
  }
}

/** Add a charge (in cents) to today's counter. Idempotent w.r.t. TTL. */
export async function recordSpendCents(service: string, amountCents: number): Promise<void> {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return;
  try {
    const total = await kv.incrby(counterKey(service), Math.round(amountCents));
    if (total === amountCents) {
      // First write of the day — set the 48h TTL.
      await kv.expire(counterKey(service), KEY_TTL_SECONDS);
    }
  } catch (err) {
    console.error(`[spend-cap] failed to record ${service}=${amountCents}c`, err);
  }
}

export type CapStatus = {
  overCap: boolean;
  spentCents: number;
  capCents: number;
  /**
   * True the first time we observe overCap today. Used to fire the alert
   * email exactly once per day per service. Subsequent overCap requests
   * see this as false (alert already dispatched, no spam).
   */
  shouldAlert: boolean;
};

/**
 * Check whether the service is within its daily cap. Does NOT increment;
 * call recordSpendCents() after a successful API call to account for spend.
 */
export async function checkCapStatus(service: string): Promise<CapStatus> {
  const capCents = DAILY_CAP_USD_CENTS[service] ?? Infinity;
  const spentCents = await getDailySpendCents(service);
  const overCap = spentCents >= capCents;
  let shouldAlert = false;
  if (overCap) {
    try {
      // SETNX-style: only the first write returns 1; subsequent attempts return 0.
      const set = await kv.set(alertedKey(service), "1", {
        nx: true,
        ex: KEY_TTL_SECONDS,
      });
      shouldAlert = set === "OK";
    } catch {
      shouldAlert = false;
    }
  }
  return { overCap, spentCents, capCents, shouldAlert };
}

/** Convenience: a known dollar amount → cents. */
export function dollarsToCents(usd: number): number {
  return Math.round(usd * 100);
}
