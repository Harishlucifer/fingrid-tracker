import { describe, expect, it } from "vitest";

import { TASK_STAGES, type TaskStage } from "@/lib/constants";
import { isOnBoard, stageTransition } from "@/lib/task-stage";

/** Every pair that is meant to be legal, and the level it needs. */
const LEGAL: Record<string, "EDIT" | "MANAGE"> = {
  "BACKLOG>ACTIVE": "EDIT",
  "ACTIVE>BACKLOG": "EDIT",
  "ACTIVE>COMPLETED": "MANAGE",
  "ACTIVE>BLOCKED": "MANAGE",
  "COMPLETED>ACTIVE": "MANAGE",
  "BLOCKED>ACTIVE": "MANAGE",
  "COMPLETED>BLOCKED": "MANAGE",
  "BLOCKED>COMPLETED": "MANAGE",
};

describe("stageTransition", () => {
  // Exhaustive over TASK_STAGES², so adding a stage later fails here until
  // somebody decides what it may do — rather than silently defaulting.
  it.each(
    TASK_STAGES.flatMap((from) => TASK_STAGES.map((to) => [from, to] as const)),
  )("decides %s -> %s", (from: TaskStage, to: TaskStage) => {
    const result = stageTransition(from, to);
    const expected = LEGAL[`${from}>${to}`];

    if (!expected) {
      expect(result.allowed).toBe(false);
      return;
    }

    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.requires).toBe(expected);
  });

  it("refuses a move to the stage the task is already at", () => {
    for (const stage of TASK_STAGES) {
      expect(stageTransition(stage, stage).allowed).toBe(false);
    }
  });

  // Marking work ready is planning, not sign-off. Requiring a lead for it would
  // just push people to file straight onto the board and skip the gate.
  it("lets an ordinary editor move work on and off the board", () => {
    const onto = stageTransition("BACKLOG", "ACTIVE");
    const back = stageTransition("ACTIVE", "BACKLOG");

    expect(onto.allowed && onto.requires).toBe("EDIT");
    expect(back.allowed && back.requires).toBe("EDIT");
  });

  it("requires MANAGE for every sign-off and every reopen", () => {
    const signOffs: [TaskStage, TaskStage][] = [
      ["ACTIVE", "COMPLETED"],
      ["ACTIVE", "BLOCKED"],
      ["COMPLETED", "ACTIVE"],
      ["BLOCKED", "ACTIVE"],
      ["COMPLETED", "BLOCKED"],
      ["BLOCKED", "COMPLETED"],
    ];

    for (const [from, to] of signOffs) {
      const result = stageTransition(from, to);
      expect(result.allowed && result.requires).toBe("MANAGE");
    }
  });

  // Accepting work that never reached a Done column would make Done mean
  // nothing, so only the two sign-off transitions carry the requirement.
  it("demands a Done column for sign-off and nothing else", () => {
    const completed = stageTransition("ACTIVE", "COMPLETED");
    const blocked = stageTransition("ACTIVE", "BLOCKED");
    expect(completed.allowed && completed.requiresDoneColumn).toBe(true);
    expect(blocked.allowed && blocked.requiresDoneColumn).toBe(true);

    const reopened = stageTransition("COMPLETED", "ACTIVE");
    const ready = stageTransition("BACKLOG", "ACTIVE");
    expect(reopened.allowed && reopened.requiresDoneColumn).toBe(false);
    expect(ready.allowed && ready.requiresDoneColumn).toBe(false);
  });

  // BLOCKED exists so somebody comes back to it. A decision with no way out
  // would leave re-filing the work as the only escape.
  it("never leaves a task stranded at a terminal stage", () => {
    expect(stageTransition("COMPLETED", "ACTIVE").allowed).toBe(true);
    expect(stageTransition("BLOCKED", "ACTIVE").allowed).toBe(true);
  });

  it("refuses to skip the board on the way in or out", () => {
    expect(stageTransition("BACKLOG", "COMPLETED").allowed).toBe(false);
    expect(stageTransition("BACKLOG", "BLOCKED").allowed).toBe(false);
    expect(stageTransition("COMPLETED", "BACKLOG").allowed).toBe(false);
    expect(stageTransition("BLOCKED", "BACKLOG").allowed).toBe(false);
  });

  it("explains a refusal in terms a person can act on", () => {
    const result = stageTransition("BACKLOG", "COMPLETED");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("the backlog");
      expect(result.reason).toContain("completed");
    }
  });
});

describe("isOnBoard", () => {
  it("is true for ACTIVE and false for every other stage", () => {
    for (const stage of TASK_STAGES) {
      expect(isOnBoard(stage)).toBe(stage === "ACTIVE");
    }
  });
});
