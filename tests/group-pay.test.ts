import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SharedSong } from "../lib/api-types";

// Shared in-memory state for the mocked data layer (KV song store + the
// gift_contributions_pay table). Declared via vi.hoisted so the vi.mock
// factories below can close over it.
const h = vi.hoisted(() => ({
  songs: new Map<string, SharedSong>(),
  rows: [] as { stripe_payment_id: string; gift_id: string; amount_cents: number; status: string }[],
}));

// Mock the KV-backed song store (lib/share).
vi.mock("../lib/share", () => ({
  loadSharedSong: async (id: string) => h.songs.get(id) ?? null,
  markSharedSongUnlocked: async (id: string, plan?: "full" | "deluxe") => {
    const s = h.songs.get(id);
    if (!s) return false;
    s.unlocked = true;
    s.plan = plan ?? s.plan ?? "full";
    return true;
  },
}));

// Mock the Supabase service-role client with a tiny fake query builder that
// supports exactly the two chains group-pay uses:
//   from(t).upsert(row, {onConflict, ignoreDuplicates}).select("id")
//   from(t).select("amount_cents").eq(...).eq(...)
vi.mock("../lib/supabase-admin", () => {
  function makeQuery() {
    const filters: [string, unknown][] = [];
    let op: "upsert" | "select" = "select";
    let payload: Record<string, unknown> | null = null;
    let conflictKey: string | null = null;
    let ignoreDup = false;

    const run = () => {
      if (op === "upsert" && payload) {
        const key = conflictKey ?? "stripe_payment_id";
        const exists = h.rows.some((r) => (r as Record<string, unknown>)[key] === payload![key]);
        if (exists && ignoreDup) return { data: [], error: null }; // duplicate → no row
        const id = `row_${h.rows.length + 1}`;
        h.rows.push(payload as (typeof h.rows)[number]);
        return { data: [{ id }], error: null };
      }
      let rows = h.rows.slice();
      for (const [c, v] of filters) rows = rows.filter((r) => (r as Record<string, unknown>)[c] === v);
      return { data: rows.map((r) => ({ amount_cents: r.amount_cents })), error: null };
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (c: string, v: unknown) => {
        filters.push([c, v]);
        return builder;
      },
      upsert: (row: Record<string, unknown>, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
        op = "upsert";
        payload = row;
        conflictKey = opts?.onConflict ?? null;
        ignoreDup = !!opts?.ignoreDuplicates;
        return builder;
      },
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return builder;
  }
  return { getSupabaseAdmin: () => ({ from: () => makeQuery() }) };
});

import {
  giftPoolTargetCents,
  isGroupPayEnabled,
  applyChipIn,
  getChipInProgress,
} from "../lib/group-pay";

function seedSong(overrides: Partial<SharedSong> = {}): SharedSong {
  const song: SharedSong = {
    id: "gift1",
    name: "Sofia",
    language: "English",
    genre: "🎤 Pop",
    lyrics: { title: "For Sofia", sections: [], raw: "la la", style: "pop", language: "English" },
    audioUrl: "https://cdn.example.com/full.mp3",
    template: "classic",
    createdAt: 1_700_000_000_000,
    tier: "A",
    ...overrides,
  };
  h.songs.set(song.id, song);
  return song;
}

beforeEach(() => {
  h.songs.clear();
  h.rows.length = 0;
  delete process.env.GROUP_PAY_ENABLED;
});

describe("giftPoolTargetCents — pool target follows the solo price ladder", () => {
  it("uses the tier's full price", () => {
    expect(giftPoolTargetCents({ tier: "A", plan: "full" })).toBe(999);
    expect(giftPoolTargetCents({ tier: "B", plan: "full" })).toBe(599);
    expect(giftPoolTargetCents({ tier: "C", plan: "full" })).toBe(299);
  });
  it("uses the deluxe price when the plan is deluxe", () => {
    expect(giftPoolTargetCents({ tier: "A", plan: "deluxe" })).toBe(1499);
  });
  it("defaults to Tier C / full when unknown (never over-charges the pool)", () => {
    expect(giftPoolTargetCents({})).toBe(299);
  });
});

describe("isGroupPayEnabled — off by default", () => {
  it("is off when the env is unset", () => {
    expect(isGroupPayEnabled()).toBe(false);
  });
  it("is on for '1' or 'true' (case-insensitive)", () => {
    process.env.GROUP_PAY_ENABLED = "1";
    expect(isGroupPayEnabled()).toBe(true);
    process.env.GROUP_PAY_ENABLED = "TRUE";
    expect(isGroupPayEnabled()).toBe(true);
  });
  it("stays off for other values", () => {
    process.env.GROUP_PAY_ENABLED = "yes";
    expect(isGroupPayEnabled()).toBe(false);
  });
});

describe("applyChipIn — two contributors reaching the price unlock the gift", () => {
  it("does NOT unlock until the pool reaches the price, then unlocks", async () => {
    const song = seedSong({ tier: "A" }); // price = 999

    const first = await applyChipIn({
      giftId: "gift1",
      contributorToken: "friend-a",
      amountCents: 600,
      stripePaymentId: "pi_1",
    });
    expect(first.recorded).toBe(true);
    expect(first.paidCents).toBe(600);
    expect(first.targetCents).toBe(999);
    expect(first.justUnlocked).toBe(false);
    expect(song.unlocked).toBeFalsy();

    const second = await applyChipIn({
      giftId: "gift1",
      contributorToken: "friend-b",
      amountCents: 600, // pool now 1200 ≥ 999 (overshoot is fine)
      stripePaymentId: "pi_2",
    });
    expect(second.recorded).toBe(true);
    expect(second.paidCents).toBe(1200);
    expect(second.justUnlocked).toBe(true);
    expect(song.unlocked).toBe(true);
    expect(song.plan).toBe("full");
  });

  it("is idempotent — a redelivered webhook (same payment id) does not double-count or re-unlock", async () => {
    seedSong({ tier: "C" }); // price = 299

    const a = await applyChipIn({
      giftId: "gift1",
      contributorToken: "friend-a",
      amountCents: 299,
      stripePaymentId: "pi_dup",
    });
    expect(a.justUnlocked).toBe(true);
    expect(a.paidCents).toBe(299);

    // Same Stripe payment id delivered again.
    const replay = await applyChipIn({
      giftId: "gift1",
      contributorToken: "friend-a",
      amountCents: 299,
      stripePaymentId: "pi_dup",
    });
    expect(replay.recorded).toBe(false); // no new row
    expect(replay.justUnlocked).toBe(false); // not unlocked again
    const progress = await getChipInProgress("gift1");
    expect(progress.paidCents).toBe(299); // still counted once
    expect(progress.count).toBe(1);
  });

  it("records the chip-in even if the gift is already unlocked (no re-unlock)", async () => {
    seedSong({ tier: "C", unlocked: true });
    const r = await applyChipIn({
      giftId: "gift1",
      contributorToken: "late-friend",
      amountCents: 299,
      stripePaymentId: "pi_late",
    });
    expect(r.recorded).toBe(true);
    expect(r.justUnlocked).toBe(false); // already unlocked, not flipped again
  });
});
