/**
 * Tests for the WIP rule.
 *
 * These encode the decisions rather than the arithmetic: only `ENFORCE` blocks,
 * a reorder inside a full column is never blocked, and an over-full column can
 * always be drained.
 */

import { describe, expect, it } from "vitest";

import {
  breachesWipLimit,
  showsWipWarning,
  wipLimitMessage,
} from "@/lib/wip-policy";

describe("breachesWipLimit", () => {
  it("blocks the task that would exceed the limit", () => {
    expect(
      breachesWipLimit({ policy: "ENFORCE", limit: 3, occupancy: 3 }),
    ).toBe(true);
  });

  it("admits the task that exactly fills the limit", () => {
    expect(
      breachesWipLimit({ policy: "ENFORCE", limit: 3, occupancy: 2 }),
    ).toBe(false);
  });

  it("only ENFORCE blocks — WARN and DISABLED never do", () => {
    // WARN is the pre-existing behaviour: the board flags it, the server allows
    // it. Anything else would change how every existing project works.
    expect(breachesWipLimit({ policy: "WARN", limit: 1, occupancy: 99 })).toBe(
      false,
    );
    expect(
      breachesWipLimit({ policy: "DISABLED", limit: 1, occupancy: 99 }),
    ).toBe(false);
  });

  it("treats a null limit as unlimited", () => {
    expect(
      breachesWipLimit({ policy: "ENFORCE", limit: null, occupancy: 1000 }),
    ).toBe(false);
  });

  it("lets a column that is already over its limit be drained", () => {
    // occupancy is the DESTINATION's, so a task leaving an over-full column is
    // never blocked by that column. Only where it lands matters.
    expect(
      breachesWipLimit({ policy: "ENFORCE", limit: 2, occupancy: 0 }),
    ).toBe(false);
  });

  it("still refuses to admit into an already over-full column", () => {
    expect(
      breachesWipLimit({ policy: "ENFORCE", limit: 2, occupancy: 5 }),
    ).toBe(true);
  });

  it("closes the column outright on a limit of zero", () => {
    expect(
      breachesWipLimit({ policy: "ENFORCE", limit: 0, occupancy: 0 }),
    ).toBe(true);
  });
});

describe("showsWipWarning", () => {
  it("warns only once the column is over — not when it is exactly full", () => {
    expect(showsWipWarning({ policy: "WARN", limit: 3, occupancy: 3 })).toBe(
      false,
    );
    expect(showsWipWarning({ policy: "WARN", limit: 3, occupancy: 4 })).toBe(
      true,
    );
  });

  it("warns under ENFORCE too, for limits lowered after the fact", () => {
    expect(showsWipWarning({ policy: "ENFORCE", limit: 2, occupancy: 5 })).toBe(
      true,
    );
  });

  it("says nothing when the policy is disabled or the limit is unset", () => {
    expect(
      showsWipWarning({ policy: "DISABLED", limit: 1, occupancy: 99 }),
    ).toBe(false);
    expect(
      showsWipWarning({ policy: "ENFORCE", limit: null, occupancy: 99 }),
    ).toBe(false);
  });
});

describe("wipLimitMessage", () => {
  it("names the column and the limit, and says what to do", () => {
    const message = wipLimitMessage("In Progress", 3);
    expect(message).toContain("In Progress");
    expect(message).toContain("3");
    expect(message).toMatch(/move something out|raise the limit/i);
  });
});
