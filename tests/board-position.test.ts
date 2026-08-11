import { describe, expect, it } from "vitest";

import { BOARD_POSITION_GAP } from "@/lib/constants";
import {
  needsRebalance,
  nextPosition,
  positionBetween,
  rebalancedPositions,
} from "@/lib/board-position";

describe("positionBetween", () => {
  it("seeds an empty column", () => {
    expect(positionBetween(null, null)).toBe(BOARD_POSITION_GAP);
  });

  it("inserts above the first task", () => {
    expect(positionBetween(null, 1024)).toBe(512);
  });

  it("appends below the last task", () => {
    expect(positionBetween(1024, null)).toBe(1024 + BOARD_POSITION_GAP);
  });

  it("takes the midpoint between neighbours", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
    expect(positionBetween(1024, 1026)).toBe(1025);
  });

  it("keeps strict ordering across repeated midpoint inserts", () => {
    let before = 0;
    const after = 1024;
    // Each insert must stay strictly between its neighbours until the gap closes.
    for (let i = 0; i < 9; i += 1) {
      const position = positionBetween(before, after);
      if (needsRebalance(position, before, after)) break;
      expect(position).toBeGreaterThan(before);
      expect(position).toBeLessThan(after);
      before = position;
    }
  });
});

describe("needsRebalance", () => {
  it("is false for a healthy midpoint", () => {
    expect(needsRebalance(1536, 1024, 2048)).toBe(false);
  });

  it("detects a closed gap between adjacent integers", () => {
    // No integer exists strictly between 1024 and 1025.
    const position = positionBetween(1024, 1025);
    expect(needsRebalance(position, 1024, 1025)).toBe(true);
  });

  it("detects a top-insert that has run out of room", () => {
    expect(needsRebalance(positionBetween(null, 1), null, 1)).toBe(true);
  });

  it("detects an out-of-order position", () => {
    expect(needsRebalance(500, 1024, 2048)).toBe(true);
    expect(needsRebalance(3000, 1024, 2048)).toBe(true);
  });
});

describe("rebalancedPositions", () => {
  it("produces evenly spaced ascending positions", () => {
    expect(rebalancedPositions(3)).toEqual([1024, 2048, 3072]);
  });

  it("handles an empty column", () => {
    expect(rebalancedPositions(0)).toEqual([]);
  });

  it("always leaves room to insert between any two entries", () => {
    const positions = rebalancedPositions(10);
    for (let i = 1; i < positions.length; i += 1) {
      const gap = positions[i]! - positions[i - 1]!;
      expect(gap).toBeGreaterThan(1);
    }
  });
});

describe("nextPosition", () => {
  it("seeds and appends", () => {
    expect(nextPosition(null)).toBe(BOARD_POSITION_GAP);
    expect(nextPosition(5120)).toBe(5120 + BOARD_POSITION_GAP);
  });
});
