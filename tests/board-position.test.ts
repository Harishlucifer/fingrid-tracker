import { describe, expect, it } from "vitest";

import { BOARD_POSITION_GAP } from "@/lib/constants";
import {
  needsRebalance,
  nextPosition,
  positionBetween,
  positionForDrop,
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

describe("positionForDrop", () => {
  it("seeds an empty column, exactly as positionBetween does", () => {
    expect(positionForDrop(null, null, null)).toBe(BOARD_POSITION_GAP);
  });

  // The trap. positionBetween(null, null) is 1024 whatever the column holds,
  // and needsRebalance cannot see the collision because both neighbours are
  // null — so the write went through and two rows shared one position.
  it("appends past the end when neither neighbour resolved", () => {
    expect(positionForDrop(null, null, 5120)).toBe(5120 + BOARD_POSITION_GAP);
  });

  it("never lands on the seed position in a populated column", () => {
    expect(positionForDrop(null, null, BOARD_POSITION_GAP)).not.toBe(
      BOARD_POSITION_GAP,
    );
  });

  it("is strictly greater than the last position, for any column", () => {
    for (const last of [1, 2, 1024, 4096, 100_000]) {
      expect(positionForDrop(null, null, last)).toBeGreaterThan(last);
    }
  });

  it("defers to positionBetween whenever a neighbour is known", () => {
    expect(positionForDrop(1024, 2048, 99_999)).toBe(positionBetween(1024, 2048));
    expect(positionForDrop(null, 1024, 99_999)).toBe(positionBetween(null, 1024));
    expect(positionForDrop(1024, null, 99_999)).toBe(positionBetween(1024, null));
  });

  it("ignores the column end when a neighbour is known", () => {
    // The end is only consulted for the append case; a real drop between two
    // cards must not be dragged to the bottom by it.
    expect(positionForDrop(1024, 2048, 1)).toBe(1536);
  });
});
