import { describe, expect, it } from "vitest";

import {
  describeTaskChanges,
  formatActivityValue,
} from "@/lib/task-activity";

const NAMES = new Map([
  ["status-todo", "Backlog"],
  ["status-doing", "In Progress"],
  ["sprint-1", "Sprint 4"],
]);

describe("describeTaskChanges", () => {
  it("reports an assignment with the names the audit row stored", () => {
    expect(
      describeTaskChanges("task.assigned", { from: null, to: "Ada" }, NAMES),
    ).toEqual([{ field: "assignee", from: null, to: "Ada" }]);
  });

  it("reports an unassignment as a change away from the previous holder", () => {
    expect(
      describeTaskChanges("task.unassigned", { from: "Ada", to: null }, NAMES),
    ).toEqual([{ field: "assignee", from: "Ada", to: null }]);
  });

  it("resolves a status id diff to column names", () => {
    expect(
      describeTaskChanges(
        "task.status_changed",
        { statusId: { from: "status-todo", to: "status-doing" } },
        NAMES,
      ),
    ).toEqual([{ field: "status", from: "Backlog", to: "In Progress" }]);
  });

  // A board drag and a category move name their destination and carry no
  // origin — the same event as above, recorded by a different write path.
  it("reads a board move, which names its destination and has no origin", () => {
    expect(
      describeTaskChanges(
        "task.status_changed",
        { toStatus: "In Progress", completed: false },
        NAMES,
      ),
    ).toEqual([{ field: "status", from: null, to: "In Progress" }]);
  });

  it("never echoes an id for a column deleted since the move", () => {
    const [change] = describeTaskChanges(
      "task.status_changed",
      { statusId: { from: "status-gone", to: "status-doing" } },
      NAMES,
    );
    expect(change).toEqual({
      field: "status",
      from: "(deleted)",
      to: "In Progress",
    });
  });

  it("reports several edited fields from one diff", () => {
    expect(
      describeTaskChanges(
        "task.updated",
        {
          priority: { from: "LOW", to: "URGENT" },
          dueDate: { from: null, to: "2026-09-01T00:00:00.000Z" },
        },
        NAMES,
      ),
    ).toEqual([
      { field: "priority", from: "LOW", to: "URGENT" },
      { field: "due_date", from: null, to: "2026-09-01" },
    ]);
  });

  // completedAt is stamped by the status change that caused it. Reporting it
  // as well would show every move into Done twice.
  it("does not report completed_at alongside the status change that set it", () => {
    expect(
      describeTaskChanges(
        "task.status_changed",
        {
          statusId: { from: "status-todo", to: "status-doing" },
          completedAt: { from: null, to: "2026-08-18T09:00:00.000Z" },
        },
        NAMES,
      ),
    ).toEqual([{ field: "status", from: "Backlog", to: "In Progress" }]);
  });

  it("yields nothing for events that carry context rather than a change", () => {
    expect(
      describeTaskChanges(
        "task.created",
        { ref: "PMT-42", title: "Ship it", type: "STORY", priority: "HIGH" },
        NAMES,
      ),
    ).toEqual([]);
  });

  it("survives a payload that is missing, empty or not an object", () => {
    expect(describeTaskChanges("task.updated", null, NAMES)).toEqual([]);
    expect(describeTaskChanges("task.updated", {}, NAMES)).toEqual([]);
    expect(describeTaskChanges("task.updated", ["nope"], NAMES)).toEqual([]);
    expect(describeTaskChanges("task.updated", "nope", NAMES)).toEqual([]);
  });

  it("ignores payload keys that are not a {from,to} diff", () => {
    expect(
      describeTaskChanges("task.updated", { title: "just a string" }, NAMES),
    ).toEqual([]);
  });
});

describe("formatActivityValue", () => {
  it("treats null, undefined and empty string as no value", () => {
    expect(formatActivityValue("title", null, NAMES)).toBeNull();
    expect(formatActivityValue("title", undefined, NAMES)).toBeNull();
    expect(formatActivityValue("title", "", NAMES)).toBeNull();
  });

  it("keeps only the day of a due date", () => {
    expect(
      formatActivityValue("due_date", "2026-09-01T00:00:00.000Z", NAMES),
    ).toBe("2026-09-01");
  });

  it("collapses whitespace in a description and truncates it", () => {
    expect(formatActivityValue("description", "a\n\n  b", NAMES)).toBe("a b");

    const long = "x".repeat(200);
    const formatted = formatActivityValue("description", long, NAMES);
    expect(formatted).toHaveLength(140);
    expect(formatted?.endsWith("…")).toBe(true);
  });

  it("reports a whitespace-only description as no value", () => {
    expect(formatActivityValue("description", "   \n ", NAMES)).toBeNull();
  });

  it("renders a numeric estimate as its own string", () => {
    expect(formatActivityValue("estimate_minutes", 90, NAMES)).toBe("90");
  });

  it("resolves sprint ids from the same name map", () => {
    expect(formatActivityValue("sprint", "sprint-1", NAMES)).toBe("Sprint 4");
  });
});
