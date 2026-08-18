/**
 * Which stage changes a task is allowed to make, and who may make them.
 *
 * `stage` is the gate at each end of the board — see TASK_STAGES. The set of
 * legal moves is small and the consequences are asymmetric, so it is written
 * out as a table rather than inferred from the values:
 *
 *  * **Marking work ready is ordinary editing.** Anyone who can change a task
 *    can put it on the board or take it back off, because that is planning, and
 *    a gate that needed a lead's attention to pass would simply be routed around
 *    by filing straight onto the board instead.
 *  * **Signing work off is not.** COMPLETED and BLOCKED are the project's
 *    record of what it accepted, so they need MANAGE — the same level that
 *    already governs sprints and board columns.
 *  * **Sign-off happens from `Done` and nowhere else.** Accepting work that
 *    never reached a DONE column would make "Done" mean nothing, so the caller
 *    is told to move it there first. That is the one rule this module cannot
 *    check by itself: it needs the task's column category, so it reports the
 *    requirement and `task.service.ts` enforces it.
 *
 * Reopening is deliberately allowed from both terminal stages. BLOCKED exists
 * precisely so somebody comes back to it later, and a decision that could not be
 * revisited would leave the only escape as filing the work again from scratch.
 *
 * Pure and prisma-free so it is unit-testable — see the note in AGENTS.md.
 */

import type { TaskStage } from "./constants";
import type { AccessLevel } from "./permissions";

export type StageTransition =
  | { allowed: false; reason: string }
  | {
      allowed: true;
      /** Minimum project access the actor needs. */
      requires: AccessLevel;
      /**
       * True when the task must already sit in a DONE-category column. Checked
       * by the caller, which is the only side that knows the column.
       */
      requiresDoneColumn: boolean;
      /** What the transition is called, for the activity trail and the UI. */
      verb: string;
    };

const ALLOWED: Record<string, Omit<Extract<StageTransition, { allowed: true }>, "allowed">> = {
  // Planning. Ordinary editing, both directions.
  "BACKLOG>ACTIVE": { requires: "EDIT", requiresDoneColumn: false, verb: "marked ready" },
  "ACTIVE>BACKLOG": { requires: "EDIT", requiresDoneColumn: false, verb: "sent back to the backlog" },

  // Sign-off. Only from Done, and only by someone who can manage the project.
  "ACTIVE>COMPLETED": { requires: "MANAGE", requiresDoneColumn: true, verb: "completed" },
  "ACTIVE>BLOCKED": { requires: "MANAGE", requiresDoneColumn: true, verb: "blocked" },

  // Reopening, and changing a sign-off decision.
  "COMPLETED>ACTIVE": { requires: "MANAGE", requiresDoneColumn: false, verb: "reopened" },
  "BLOCKED>ACTIVE": { requires: "MANAGE", requiresDoneColumn: false, verb: "reopened" },
  "COMPLETED>BLOCKED": { requires: "MANAGE", requiresDoneColumn: false, verb: "blocked" },
  "BLOCKED>COMPLETED": { requires: "MANAGE", requiresDoneColumn: false, verb: "completed" },
};

/**
 * Resolve one stage change.
 *
 * Default-denies: an unlisted pair is refused rather than falling through to a
 * permissive branch, the same rule `permissions.ts` follows. Adding a stage
 * therefore makes every new pair illegal until someone writes it down here,
 * which is the intended failure direction.
 */
export function stageTransition(from: TaskStage, to: TaskStage): StageTransition {
  if (from === to) {
    return { allowed: false, reason: "The task is already at that stage." };
  }

  const rule = ALLOWED[`${from}>${to}`];
  if (!rule) {
    return {
      allowed: false,
      reason: `A task cannot go from ${describeStage(from)} to ${describeStage(to)}.`,
    };
  }

  return { allowed: true, ...rule };
}

/** Whether the board shows tasks at this stage. Exactly one stage qualifies. */
export function isOnBoard(stage: TaskStage): boolean {
  return stage === "ACTIVE";
}

/** How a stage is named to a person, as opposed to in the database. */
export function describeStage(stage: TaskStage): string {
  switch (stage) {
    case "BACKLOG":
      return "the backlog";
    case "ACTIVE":
      return "the board";
    case "COMPLETED":
      return "completed";
    case "BLOCKED":
      return "blocked";
    default:
      return stage;
  }
}

/** Refusal message when sign-off is attempted on work that is not in Done. */
export function notInDoneMessage(verb: string): string {
  return `Only work in a Done column can be ${verb}. Move the task to Done first.`;
}
