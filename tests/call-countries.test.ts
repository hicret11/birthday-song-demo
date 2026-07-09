import { describe, it, expect } from "vitest";
import {
  ALLOWED_CALL_COUNTRIES,
  callCountryForPhone,
  isCallAllowedForPhone,
} from "../lib/cast/call-countries";

describe("callCountryForPhone", () => {
  it("maps each allowlisted country by its E.164 code", () => {
    expect(callCountryForPhone("+15551234567")).toBe("US");
    expect(callCountryForPhone("+447700900123")).toBe("GB");
    expect(callCountryForPhone("+905321234567")).toBe("TR");
    expect(callCountryForPhone("+971501234567")).toBe("AE");
  });

  it("prefers the 3-digit code over a colliding shorter prefix (AE, not a 9… country)", () => {
    expect(callCountryForPhone("+971501234567")).toBe("AE");
  });

  it("returns null for countries outside the allowlist (fail closed)", () => {
    expect(callCountryForPhone("+33612345678")).toBeNull(); // FR
    expect(callCountryForPhone("+4915112345678")).toBeNull(); // DE
    expect(callCountryForPhone("+919812345678")).toBeNull(); // IN
    expect(callCountryForPhone("+61412345678")).toBeNull(); // AU
  });

  it("returns null for empty / malformed input", () => {
    expect(callCountryForPhone("")).toBeNull();
    expect(callCountryForPhone(null)).toBeNull();
    expect(callCountryForPhone(undefined)).toBeNull();
    expect(callCountryForPhone("not-a-number")).toBeNull();
  });
});

describe("isCallAllowedForPhone", () => {
  it("allows allowlisted countries and denies everything else", () => {
    expect(isCallAllowedForPhone("+15551234567")).toBe(true);
    expect(isCallAllowedForPhone("+447700900123")).toBe(true);
    expect(isCallAllowedForPhone("+905321234567")).toBe(true);
    expect(isCallAllowedForPhone("+971501234567")).toBe(true);
    expect(isCallAllowedForPhone("+33612345678")).toBe(false);
    expect(isCallAllowedForPhone("")).toBe(false);
    expect(isCallAllowedForPhone(null)).toBe(false);
  });

  it("exposes exactly the four launch countries", () => {
    expect([...ALLOWED_CALL_COUNTRIES].sort()).toEqual(["AE", "GB", "TR", "US"]);
  });
});
