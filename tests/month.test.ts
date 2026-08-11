/**
 * Month arithmetic. Worth testing precisely: month lengths, leap years, year
 * boundaries and UTC handling are all places a timesheet silently loses or
 * duplicates a day.
 */

import { describe, expect, it } from "vitest";

import { isValidMonth, resolveMonth, shiftMonth } from "@/lib/month";

describe("isValidMonth", () => {
  it("accepts well-formed months", () => {
    for (const month of ["2026-01", "2026-08", "2026-12", "1999-10"]) {
      expect(isValidMonth(month), month).toBe(true);
    }
  });

  it("rejects malformed or out-of-range months", () => {
    for (const month of [
      "",
      "2026",
      "2026-00",
      "2026-13",
      "2026-8",
      "26-08",
      "2026-08-01",
      "August 2026",
    ]) {
      expect(isValidMonth(month), month).toBe(false);
    }
  });
});

describe("resolveMonth", () => {
  it("expands a 31-day month", () => {
    const range = resolveMonth("2026-08");
    expect(range.days).toHaveLength(31);
    expect(range.days[0]).toBe("2026-08-01");
    expect(range.days.at(-1)).toBe("2026-08-31");
  });

  it("expands a 30-day month", () => {
    expect(resolveMonth("2026-04").days).toHaveLength(30);
  });

  it("handles February in a non-leap year", () => {
    const range = resolveMonth("2026-02");
    expect(range.days).toHaveLength(28);
    expect(range.days.at(-1)).toBe("2026-02-28");
  });

  it("handles February in a leap year", () => {
    const range = resolveMonth("2028-02");
    expect(range.days).toHaveLength(29);
    expect(range.days.at(-1)).toBe("2028-02-29");
  });

  it("handles the century-rule leap years", () => {
    // 2000 is a leap year (divisible by 400); 1900 was not.
    expect(resolveMonth("2000-02").days).toHaveLength(29);
    expect(resolveMonth("1900-02").days).toHaveLength(28);
  });

  it("produces an inclusive UTC range covering the whole month", () => {
    const range = resolveMonth("2026-08");
    expect(range.from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-08-31T23:59:59.999Z");
  });

  it("zero-pads single-digit days and months", () => {
    const range = resolveMonth("2026-01");
    expect(range.days[0]).toBe("2026-01-01");
    expect(range.days[8]).toBe("2026-01-09");
  });

  it("every day is unique and ordered", () => {
    const days = resolveMonth("2026-12").days;
    expect(new Set(days).size).toBe(days.length);
    expect([...days].sort()).toEqual(days);
  });

  it("throws on a malformed month rather than guessing", () => {
    expect(() => resolveMonth("2026-13")).toThrow();
    expect(() => resolveMonth("nonsense")).toThrow();
  });
});

describe("shiftMonth", () => {
  it("moves forward and backward within a year", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
    expect(shiftMonth("2026-08", -1)).toBe("2026-07");
  });

  it("crosses the year boundary in both directions", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("handles multi-year shifts", () => {
    expect(shiftMonth("2026-08", 12)).toBe("2027-08");
    expect(shiftMonth("2026-08", -20)).toBe("2024-12");
  });

  it("is a no-op at zero and reversible", () => {
    expect(shiftMonth("2026-08", 0)).toBe("2026-08");
    expect(shiftMonth(shiftMonth("2026-03", -5), 5)).toBe("2026-03");
  });

  it("never lands on an invalid month, including from a 31-day month", () => {
    // Naive date maths from Jan 31 + 1 month yields March 3; building from day 1
    // cannot.
    expect(shiftMonth("2026-01", 1)).toBe("2026-02");
    for (let delta = -24; delta <= 24; delta += 1) {
      expect(isValidMonth(shiftMonth("2026-01", delta))).toBe(true);
    }
  });
});
