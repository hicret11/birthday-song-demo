import { describe, it, expect } from "vitest";
import { computeDeliverAt, isDelivered, isValidTimezone } from "../lib/delivery";

/** Local hour of an ISO instant in a timezone (independent re-impl for asserts). */
function hourIn(tz: string, iso: string): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  return Number(h.find((p) => p.type === "hour")?.value);
}
function partsIn(tz: string, iso: string) {
  const map: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso)))
    if (p.type !== "literal") map[p.type] = p.value;
  return map;
}

describe("computeDeliverAt", () => {
  it("lands 9am local on the birthday in the given timezone", () => {
    const now = Date.parse("2026-03-01T00:00:00Z");
    const iso = computeDeliverAt("07-09", "America/New_York", now)!;
    expect(iso).toBeTruthy();
    expect(hourIn("America/New_York", iso)).toBe(9);
    const p = partsIn("America/New_York", iso);
    expect(`${p.month}-${p.day}`).toBe("07-09");
    expect(p.year).toBe("2026"); // still ahead this year
  });

  it("rolls to next year when the birthday already passed", () => {
    const now = Date.parse("2026-08-01T00:00:00Z"); // past Jul 9
    const iso = computeDeliverAt("07-09", "America/New_York", now)!;
    expect(partsIn("America/New_York", iso).year).toBe("2027");
    expect(hourIn("America/New_York", iso)).toBe(9);
  });

  it("delivers now (null, no gate) when the birthday is TODAY, even past 9am", () => {
    // Created on the birthday at ~14:20 local — the old code rolled this to next
    // year ("364 days" bug). Today's birthday must be available immediately.
    const now = Date.parse("2026-07-14T10:20:00Z"); // 14:20 in Asia/Dubai (UTC+4)
    expect(computeDeliverAt("07-14", "Asia/Dubai", now)).toBeNull();
  });

  it("still schedules a future birthday normally (not today)", () => {
    const now = Date.parse("2026-07-10T06:00:00Z"); // 10:00 Jul 10 in Dubai — 4 days out
    const iso = computeDeliverAt("07-14", "Asia/Dubai", now)!;
    expect(iso).toBeTruthy();
    expect(hourIn("Asia/Dubai", iso)).toBe(9);
    expect(partsIn("Asia/Dubai", iso).day).toBe("14");
  });

  it("respects the target timezone (Istanbul 9am ≠ NY 9am instant)", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const ny = computeDeliverAt("07-09", "America/New_York", now)!;
    const ist = computeDeliverAt("07-09", "Europe/Istanbul", now)!;
    expect(ny).not.toBe(ist);
    expect(hourIn("Europe/Istanbul", ist)).toBe(9);
  });

  it("falls back leap-day 02-29 to 02-28 in a non-leap year", () => {
    const now = Date.parse("2027-01-01T00:00:00Z"); // 2027 is not a leap year
    const iso = computeDeliverAt("02-29", "America/New_York", now)!;
    expect(partsIn("America/New_York", iso).day).toBe("28");
  });

  it("returns null for malformed month-day or bad timezone", () => {
    expect(computeDeliverAt("13-40", "America/New_York", Date.now())).toBeNull();
    expect(computeDeliverAt("07-09", "Not/AZone", Date.now())).toBeNull();
  });
});

describe("isDelivered", () => {
  const now = Date.parse("2026-06-15T12:00:00Z");
  it("true for instant/now mode + absent delivery", () => {
    expect(isDelivered(undefined, now)).toBe(true);
    expect(isDelivered({ mode: "now" }, now)).toBe(true);
  });
  it("false while a scheduled premiere is still in the future", () => {
    expect(isDelivered({ mode: "scheduled", deliverAt: "2026-07-09T13:00:00Z" }, now)).toBe(false);
  });
  it("true once the scheduled instant has passed", () => {
    expect(isDelivered({ mode: "scheduled", deliverAt: "2026-06-15T11:59:00Z" }, now)).toBe(true);
  });
});

describe("isValidTimezone", () => {
  it("accepts real IANA zones, rejects junk", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Europe/Istanbul")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
  });
});
