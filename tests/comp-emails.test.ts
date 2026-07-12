import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isCompEmail, compEmailSet } from "../lib/comp-emails";

describe("isCompEmail", () => {
  const savedEnv = process.env.COMP_EMAILS;
  beforeEach(() => {
    delete process.env.COMP_EMAILS;
  });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.COMP_EMAILS;
    else process.env.COMP_EMAILS = savedEnv;
  });

  it("comps the built-in admin addresses, case-insensitively", () => {
    expect(isCompEmail("lemonigrootkerk@gmail.com")).toBe(true);
    expect(isCompEmail("Lemonigrootkerk@Gmail.com")).toBe(true);
    expect(isCompEmail("  nilyufarmobeius@gmail.com  ")).toBe(true);
  });

  it("does NOT comp unknown or empty addresses (fail closed)", () => {
    expect(isCompEmail("stranger@gmail.com")).toBe(false);
    expect(isCompEmail("")).toBe(false);
    expect(isCompEmail(null)).toBe(false);
    expect(isCompEmail(undefined)).toBe(false);
  });

  it("merges extra addresses from COMP_EMAILS (comma/space/semicolon separated)", () => {
    process.env.COMP_EMAILS = "extra@team.com, second@team.com;third@team.com";
    expect(isCompEmail("extra@team.com")).toBe(true);
    expect(isCompEmail("SECOND@team.com")).toBe(true);
    expect(isCompEmail("third@team.com")).toBe(true);
    // built-ins still present alongside env additions
    expect(isCompEmail("lemonigrootkerk@gmail.com")).toBe(true);
    expect(compEmailSet().size).toBeGreaterThanOrEqual(5);
  });
});
