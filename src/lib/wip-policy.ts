/**
 * Whether a column will accept one more task.
 *
 * The board has always drawn an overflow warning from `wip_limit`, but the
 * server never read it — so the limit was advice the API let you ignore. This
 * module is the rule itself; `task.service.ts` calls it on every path that can
 * put a task into a column.
 *
 * Two things it deliberately gets right:
 *
 *  * **Reordering inside a full column is always allowed.** A task already in
 *    the column is being moved, not admitted, so it must not be counted against
 *    the limit — otherwise reaching the limit would freeze the column and the
 *    only way to tidy it would be to move work out first.
 *  * **A column already over its limit still lets work leave.** The rule is
 *    only ever applied to the destination, never the origin, so lowering a limit
 *    (or raising it after the fact) can never strand the tasks already there.
 *
 * Pure and prisma-free so it is unit-testable — see the note in AGENTS.md.
 */

import type { WipPolicy } from "./constants";

export type WipCheck = {
  policy: WipPolicy;
  /** The column's configured limit; `null` means unlimited. */
  limit: number | null;
  /**
   * Tasks currently in the destination column, EXCLUDING the task being placed.
   * The caller is responsible for that exclusion — see `breachesWipLimit`.
   */
  occupancy: number;
};

/**
 * Does admitting one more task breach the destination column's limit?
 *
 * A `limit` of `0` closes the column outright, which is what a limit of zero
 * literally means. Column management should refuse to save one, but the rule
 * here stays honest about whatever is actually stored.
 */
export function breachesWipLimit({
  policy,
  limit,
  occupancy,
}: WipCheck): boolean {
  if (policy !== "ENFORCE") return false;
  if (limit === null) return false;

  return occupancy + 1 > limit;
}

/** Whether the board should draw an over-capacity warning on a column. */
export function showsWipWarning({
  policy,
  limit,
  occupancy,
}: WipCheck): boolean {
  if (policy === "DISABLED") return false;
  if (limit === null) return false;

  return occupancy > limit;
}

/** Client-safe explanation for a refused move. Names the column, not the task. */
export function wipLimitMessage(columnName: string, limit: number): string {
  return `"${columnName}" is at its work-in-progress limit of ${limit}. Move something out of it first, or ask a project lead to raise the limit.`;
}
