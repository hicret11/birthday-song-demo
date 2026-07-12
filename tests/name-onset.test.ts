import { describe, it, expect } from "vitest";
import { findNameOnsetMs } from "../lib/transcribe";

const captions = [
  { text: "Happy birthday to you", startMs: 1000, endMs: 3000 },
  { text: "our dear friend Siobhan", startMs: 3200, endMs: 5600 },
  { text: "make a wish tonight", startMs: 6000, endMs: 8000 },
];

describe("findNameOnsetMs", () => {
  it("returns the onset of the caption line that first sings the name", () => {
    expect(findNameOnsetMs(captions, "Siobhan")).toBe(3200);
  });

  it("is case-insensitive and tolerates minor spelling drift", () => {
    expect(findNameOnsetMs(captions, "siobhan")).toBe(3200);
    // A one-character variant still matches the line via the fuzzy fallback.
    expect(findNameOnsetMs(captions, "Siobhann")).toBe(3200);
  });

  it("returns null when the name never surfaces, or on empty input", () => {
    expect(findNameOnsetMs(captions, "Alexander")).toBeNull();
    expect(findNameOnsetMs(null, "Siobhan")).toBeNull();
    expect(findNameOnsetMs(captions, "")).toBeNull();
  });
});
