/**
 * Validation for a whole-list column reordering.
 *
 * The client sends the complete new order rather than one move, so the result
 * cannot depend on which of several in-flight drags lands last. That makes the
 * check "is this a permutation of exactly this project's columns?" — which is
 * also what stops an id belonging to a *different* project from being written
 * into this one's board.
 *
 * Pure and prisma-free so it is unit-testable; see the note in AGENTS.md.
 */

/**
 * Whether `order` lists every one of `currentIds` exactly once.
 *
 * Rejects a short list (columns would keep stale positions), a long one, a
 * duplicate (two columns would claim one slot), and any unknown id.
 */
export function isCompleteReordering(
  currentIds: readonly string[],
  order: readonly string[],
): boolean {
  if (order.length !== currentIds.length) return false;

  const unique = new Set(order);
  if (unique.size !== order.length) return false;

  const known = new Set(currentIds);
  return order.every((id) => known.has(id));
}
