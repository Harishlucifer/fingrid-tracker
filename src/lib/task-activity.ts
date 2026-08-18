/**
 * Reading a task's audit trail.
 *
 * Prisma-free on purpose, like `wip-policy.ts` and `mentions.ts`: this is the
 * part of the activity feed that is worth testing — three write paths record a
 * status change in three different shapes, and every one of them has to come
 * out of here as the same sentence. Behind `@/server/db/prisma` none of that
 * could be exercised without a database.
 *
 * Name resolution stays with the caller. This module only knows which payload
 * keys hold an id.
 */

/**
 * Audit columns a history entry can report, mapped to the field name the API
 * exposes.
 *
 * `completedAt` is deliberately absent: it is stamped by the status change that
 * caused it, so reporting it as well would show every move into Done twice.
 */
export const TASK_ACTIVITY_FIELDS = {
  statusId: "status",
  sprintId: "sprint",
  title: "title",
  description: "description",
  type: "type",
  priority: "priority",
  dueDate: "due_date",
  estimateMin: "estimate_minutes",
} as const;

/** Fields whose recorded value is an id and needs a name looked up for it. */
const ID_FIELDS = new Set(["status", "sprint"]);

/** How much of an edited description is worth showing in a history line. */
const DESCRIPTION_LIMIT = 140;

export type TaskActivityChange = {
  field: string;
  from: string | null;
  to: string | null;
};

/**
 * Turn one audit payload into the changes it describes.
 *
 * Three payload shapes reach here, because three different write paths produce
 * them, and a reader should not have to know which one ran:
 *
 *   - assignment, which already stores readable names;
 *   - a board or category move, which names its destination column and has no
 *     origin to report;
 *   - a field edit, which is a `{column: {from, to}}` diff.
 *
 * Anything else — `task.created`, `task.deleted` — carries context rather than
 * a change, and yields nothing: the action alone already says what happened.
 */
export function describeTaskChanges(
  action: string,
  payload: unknown,
  names: ReadonlyMap<string, string>,
): TaskActivityChange[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const record = payload as Record<string, unknown>;

  if (action === "task.assigned" || action === "task.unassigned") {
    return [
      {
        field: "assignee",
        from: textOrNull(record.from),
        to: textOrNull(record.to),
      },
    ];
  }

  if (typeof record.toStatus === "string") {
    return [{ field: "status", from: null, to: record.toStatus }];
  }

  const changes: TaskActivityChange[] = [];

  for (const [column, field] of Object.entries(TASK_ACTIVITY_FIELDS)) {
    const change = record[column];
    if (!change || typeof change !== "object" || Array.isArray(change)) continue;

    const { from, to } = change as { from?: unknown; to?: unknown };
    changes.push({
      field,
      from: formatActivityValue(field, from, names),
      to: formatActivityValue(field, to, names),
    });
  }

  return changes;
}

export function formatActivityValue(
  field: string,
  value: unknown,
  names: ReadonlyMap<string, string>,
): string | null {
  if (value === null || value === undefined || value === "") return null;

  // A column or sprint deleted since the change was recorded has no name left
  // to show. Saying so is more honest than echoing the UUID.
  if (ID_FIELDS.has(field)) return names.get(String(value)) ?? "(deleted)";

  // Dates are recorded as full ISO timestamps; only the day is meaningful.
  if (field === "due_date") return String(value).slice(0, 10);

  // A description diff is for orientation, not for re-reading the whole edit.
  if (field === "description") {
    const text = String(value).replace(/\s+/g, " ").trim();
    if (text === "") return null;
    return text.length > DESCRIPTION_LIMIT
      ? `${text.slice(0, DESCRIPTION_LIMIT - 1)}…`
      : text;
  }

  return String(value);
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
