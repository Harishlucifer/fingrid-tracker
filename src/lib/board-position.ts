/**
 * Kanban ordering arithmetic.
 *
 * Tasks in a column carry an integer `position`, spaced by BOARD_POSITION_GAP.
 * A drop inserts at the midpoint between its new neighbours, which is O(1) — no
 * rewriting the whole column on every drag. Repeated insertions into the same
 * spot eventually exhaust the gap, at which point the caller rebalances that one
 * column.
 *
 * Integers rather than floats deliberately: a float midpoint chain degrades to
 * values that no longer compare correctly after ~50 inserts, and the failure is
 * silent. An integer gap that runs out is detectable, which is what
 * `needsRebalance` reports.
 */

import { BOARD_POSITION_GAP } from "./constants";

/**
 * Position for a task dropped between two neighbours.
 *
 * @param before position of the task above the drop point, or null at the top
 * @param after  position of the task below the drop point, or null at the bottom
 */
export function positionBetween(
  before: number | null,
  after: number | null,
): number {
  // Empty column.
  if (before === null && after === null) return BOARD_POSITION_GAP;

  // Dropped at the top: half-way between zero and the current first item.
  if (before === null && after !== null) return Math.floor(after / 2);

  // Dropped at the bottom: one full gap past the current last item.
  if (before !== null && after === null) return before + BOARD_POSITION_GAP;

  return Math.floor((before! + after!) / 2);
}

/**
 * True when a computed position collides with a neighbour, meaning the gap has
 * closed and the column must be rebalanced before the insert is durable.
 */
export function needsRebalance(
  position: number,
  before: number | null,
  after: number | null,
): boolean {
  if (before !== null && position <= before) return true;
  if (after !== null && position >= after) return true;
  // A top-insert that floors to 0 leaves no room for a further insert above it.
  if (before === null && position <= 0) return true;
  return false;
}

/**
 * Fresh, evenly-spaced positions for a whole column, preserving order.
 * Applied inside a transaction alongside the move that triggered it.
 */
export function rebalancedPositions(count: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => (index + 1) * BOARD_POSITION_GAP,
  );
}

/** Position appended after the current last task in a column. */
export function nextPosition(lastPosition: number | null): number {
  return lastPosition === null
    ? BOARD_POSITION_GAP
    : lastPosition + BOARD_POSITION_GAP;
}
