import { describe, it, expect, afterEach, vi } from "vitest";

// launch-pricing reads NEXT_PUBLIC_LAUNCH_DISCOUNT_PERCENT at module load, so we
// reset modules and re-import to exercise different percents.
async function load(percent: string | undefined) {
  vi.resetModules();
  if (percent === undefined) delete process.env.NEXT_PUBLIC_LAUNCH_DISCOUNT_PERCENT;
  else process.env.NEXT_PUBLIC_LAUNCH_DISCOUNT_PERCENT = percent;
  return import("../lib/launch-pricing");
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_LAUNCH_DISCOUNT_PERCENT;
});

describe("launch-pricing", () => {
  it("is off when the env var is unset or zero", async () => {
    const off = await load(undefined);
    expect(off.isLaunchActive()).toBe(false);
    const v = off.launchView("$14.99");
    expect(v.active).toBe(false);
    expect(v.discounted).toBe("$14.99");

    const zero = await load("0");
    expect(zero.isLaunchActive()).toBe(false);
  });

  it("applies a percent discount to a USD label", async () => {
    const m = await load("50");
    expect(m.launchDiscountPercent()).toBe(50);
    expect(m.launchView("$14.99").discounted).toBe("$7.50"); // 1499 → 750
    expect(m.launchView("$9.99").discounted).toBe("$5.00"); // 999 → 500 (round half up)
    expect(m.launchView("$6.99").discounted).toBe("$3.50"); // 699 → 350
    const v = m.launchView("$14.99");
    expect(v.active).toBe(true);
    expect(v.original).toBe("$14.99");
  });

  it("caps the discount at 90% (never free via launch)", async () => {
    const m = await load("200");
    expect(m.launchDiscountPercent()).toBe(90);
  });

  it("derives a deterministic coupon id from the percent", async () => {
    const m = await load("40");
    expect(m.launchCouponId()).toBe("launch-40pct");
    expect(m.launchCouponId(25)).toBe("launch-25pct");
  });

  it("leaves non-USD-shaped labels untouched", async () => {
    const m = await load("50");
    const v = m.launchView("Free");
    expect(v.active).toBe(false);
    expect(v.discounted).toBe("Free");
  });
});
