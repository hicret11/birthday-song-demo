import { describe, it, expect } from "vitest";
import {
  timezoneForPhone,
  localHourInTimezone,
  isWithinCallingWindow,
} from "../lib/cast/quiet-hours";

describe("timezoneForPhone", () => {
  it("maps US +1 to a North American zone (longest-prefix, 1-digit)", () => {
    expect(timezoneForPhone("+15551234567")).toBe("America/New_York");
  });

  it("prefers a 3-digit code over a colliding shorter prefix", () => {
    // +971 (UAE) must not be read as +97… or +9…
    expect(timezoneForPhone("+971501234567")).toBe("Asia/Dubai");
  });

  it("maps 2-digit codes (TR, GB)", () => {
    expect(timezoneForPhone("+905321234567")).toBe("Europe/Istanbul");
    expect(timezoneForPhone("+447700900123")).toBe("Europe/London");
  });

  it("returns null for empty / unmapped codes", () => {
    expect(timezoneForPhone("")).toBeNull();
    expect(timezoneForPhone(null)).toBeNull();
    expect(timezoneForPhone("+9999999999")).toBeNull(); // no such calling code
  });
});

describe("localHourInTimezone", () => {
  it("computes the local hour for a fixed instant", () => {
    // 2026-06-15T12:00:00Z → 08:00 in New York (EDT, UTC-4).
    expect(localHourInTimezone("America/New_York", "2026-06-15T12:00:00Z")).toBe(8);
    // Same instant → 15:00 in Istanbul (UTC+3).
    expect(localHourInTimezone("Europe/Istanbul", "2026-06-15T12:00:00Z")).toBe(15);
  });

  it("returns null for an invalid timezone", () => {
    expect(localHourInTimezone("Not/AZone", "2026-06-15T12:00:00Z")).toBeNull();
  });
});

describe("isWithinCallingWindow", () => {
  it("allows a call at a reasonable local hour", () => {
    // 12:00Z → 08:00 NY — exactly the window start (inclusive).
    expect(isWithinCallingWindow("2026-06-15T12:00:00Z", "America/New_York")).toBe(true);
  });

  it("blocks a call outside 8am–9pm local", () => {
    // 04:00Z → 00:00 NY (midnight) — well outside.
    expect(isWithinCallingWindow("2026-06-15T04:00:00Z", "America/New_York")).toBe(false);
    // 12:00Z → 21:00 Dubai (UTC+4) — 9pm is the exclusive end → blocked.
    expect(isWithinCallingWindow("2026-06-15T17:00:00Z", "Asia/Dubai")).toBe(false);
  });

  it("allows (never wedges) when the timezone is unknown", () => {
    expect(isWithinCallingWindow("2026-06-15T04:00:00Z", null)).toBe(true);
  });
});
