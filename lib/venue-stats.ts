// Per-venue daily counters in Vercel KV. Cheap to write (single INCR), cheap to
// read (one MGET for the 30-day window), trivial to retire later if Vercel
// Analytics' API grows up.
//
// Keys: venue-stat:{kind}:{slug}:{YYYY-MM-DD}
// TTL : 35 days — guarantees the 30-day window read is always populated.

import { kv } from "@vercel/kv";

const TTL_SECONDS = 35 * 24 * 60 * 60;
const WINDOW_DAYS = 30;

export type StatKind = "page-view" | "capture";

function statKey(kind: StatKind, slug: string, isoDate: string): string {
  return `venue-stat:${kind}:${slug}:${isoDate}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Best-effort daily counter bump. Fire-and-forget — KV blip must never
 * propagate up and break the request that triggered it.
 */
export async function recordVenueStat(kind: StatKind, slug: string): Promise<void> {
  if (!slug) return;
  try {
    const key = statKey(kind, slug, todayIso());
    const total = await kv.incr(key);
    if (total === 1) {
      await kv.expire(key, TTL_SECONDS);
    }
  } catch {
    // KV unreachable; skip silently.
  }
}

/** Sum of the last 30 daily buckets for one stat / slug combination. */
export async function readWindowedStat(
  kind: StatKind,
  slug: string,
): Promise<number> {
  if (!slug) return 0;
  const today = Date.now();
  const keys: string[] = [];
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const d = new Date(today - i * 86_400_000).toISOString().slice(0, 10);
    keys.push(statKey(kind, slug, d));
  }
  try {
    const values = await kv.mget<(number | string | null)[]>(...keys);
    return values.reduce<number>((sum, v) => {
      if (v == null) return sum;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
  } catch {
    return 0;
  }
}
