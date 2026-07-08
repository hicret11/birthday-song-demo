import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTierForCountry, resolveTier } from "../lib/pricing-tiers";

describe("getTierForCountry", () => {
  it("maps high-PPP anchors to Tier A", () => {
    expect(getTierForCountry("US")).toBe("A");
    expect(getTierForCountry("GB")).toBe("A");
    expect(getTierForCountry("DE")).toBe("A");
  });

  it("maps mid-PPP markets to Tier B", () => {
    expect(getTierForCountry("TR")).toBe("B");
    expect(getTierForCountry("BR")).toBe("B");
    expect(getTierForCountry("ID")).toBe("B");
  });

  it("defaults unknown / unmapped countries to Tier C (safest, lowest)", () => {
    expect(getTierForCountry("ZZ")).toBe("C");
    expect(getTierForCountry(null)).toBe("C");
    expect(getTierForCountry("")).toBe("C");
  });

  it("is case-insensitive", () => {
    expect(getTierForCountry("us")).toBe("A");
    expect(getTierForCountry("tr")).toBe("B");
  });
});

describe("resolveTier", () => {
  beforeEach(() => {
    // Ensure the ?tier= override is honored (only outside production).
    vi.stubEnv("NODE_ENV", "test");
  });

  it("honors the ?tier= override outside production", () => {
    expect(resolveTier(new Request("https://ex.com/?tier=A"))).toBe("A");
    expect(resolveTier(new Request("https://ex.com/?tier=B"))).toBe("B");
    expect(resolveTier(new Request("https://ex.com/?tier=C"))).toBe("C");
  });

  it("falls back to Tier C when no geo signal is present", () => {
    expect(resolveTier(new Request("https://ex.com/"))).toBe("C");
  });
});

describe("priceIdForPlanTier (env-dependent)", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const k of [
      "STRIPE_PRICE_ID_TIER_A",
      "STRIPE_PRICE_ID_DELUXE_A",
    ]) {
      delete process.env[k];
    }
  });

  it("returns the Standard price for plan=full", async () => {
    process.env.STRIPE_PRICE_ID_TIER_A = "price_full_A";
    const { priceIdForPlanTier } = await import("../lib/pricing-tiers");
    expect(priceIdForPlanTier("full", "A")).toBe("price_full_A");
  });

  it("falls back to the Standard price when the Deluxe SKU is unset", async () => {
    process.env.STRIPE_PRICE_ID_TIER_A = "price_full_A";
    const { priceIdForPlanTier } = await import("../lib/pricing-tiers");
    expect(priceIdForPlanTier("deluxe", "A")).toBe("price_full_A");
  });

  it("uses the Deluxe price when it is configured", async () => {
    process.env.STRIPE_PRICE_ID_TIER_A = "price_full_A";
    process.env.STRIPE_PRICE_ID_DELUXE_A = "price_deluxe_A";
    const { priceIdForPlanTier } = await import("../lib/pricing-tiers");
    expect(priceIdForPlanTier("deluxe", "A")).toBe("price_deluxe_A");
  });
});
