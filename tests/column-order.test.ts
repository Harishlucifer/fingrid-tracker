/**
 * Tests for whole-list column reordering.
 *
 * The interesting cases are the rejections: a partial list would leave columns
 * on stale positions, and an unknown id is how a column from another project
 * would get written into this one's board.
 */

import { describe, expect, it } from "vitest";

import { isCompleteReordering } from "@/lib/column-order";

const CURRENT = ["a", "b", "c"];

describe("isCompleteReordering", () => {
  it("accepts a genuine permutation", () => {
    expect(isCompleteReordering(CURRENT, ["c", "a", "b"])).toBe(true);
  });

  it("accepts the unchanged order", () => {
    expect(isCompleteReordering(CURRENT, ["a", "b", "c"])).toBe(true);
  });

  it("rejects a partial list", () => {
    expect(isCompleteReordering(CURRENT, ["a", "b"])).toBe(false);
  });

  it("rejects extra entries", () => {
    expect(isCompleteReordering(CURRENT, ["a", "b", "c", "d"])).toBe(false);
  });

  it("rejects a duplicate, which would give two columns one slot", () => {
    expect(isCompleteReordering(CURRENT, ["a", "a", "b"])).toBe(false);
  });

  it("rejects an id from another project", () => {
    // Same length, no duplicates — only the membership check catches this one.
    expect(isCompleteReordering(CURRENT, ["a", "b", "elsewhere"])).toBe(false);
  });

  it("handles the empty case without claiming success on a non-empty order", () => {
    expect(isCompleteReordering([], [])).toBe(true);
    expect(isCompleteReordering([], ["a"])).toBe(false);
  });
});
