/**
 * Activity / audit log writes.
 *
 * Always called from the service layer, never from a route handler, so that
 * every mutation path records uniformly regardless of which endpoint triggered
 * it. Accepts an optional transaction client so the log entry commits or rolls
 * back with the change it describes.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { ActivityEntityType } from "@/lib/constants";
import { prisma } from "@/server/db/prisma";

/** Either the base client or a transaction client. */
export type Db = Prisma.TransactionClient | typeof prisma;

export type ActivityInput = {
  entityType: ActivityEntityType;
  entityId: string;
  /** Null for org-level events such as allowlist changes. */
  projectId?: string | null;
  actorId: string;
  /** Dotted verb, e.g. "task.status_changed". */
  action: string;
  payload?: Prisma.InputJsonValue;
};

export async function recordActivity(
  input: ActivityInput,
  db: Db = prisma,
): Promise<void> {
  await db.activityLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId ?? null,
      actorId: input.actorId,
      action: input.action,
      ...(input.payload === undefined ? {} : { payload: input.payload }),
    },
  });
}

/**
 * Diff two shallow objects into a `{field: {from, to}}` payload, skipping
 * unchanged keys. Keeps audit entries small and readable.
 */
export function diffPayload<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Prisma.InputJsonValue {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const [key, next] of Object.entries(after)) {
    if (next === undefined) continue;
    const previous = before[key];
    const sameDate =
      previous instanceof Date &&
      next instanceof Date &&
      previous.getTime() === next.getTime();
    if (previous === next || sameDate) continue;
    changes[key] = {
      from: previous instanceof Date ? previous.toISOString() : previous ?? null,
      to: next instanceof Date ? next.toISOString() : next ?? null,
    };
  }

  return changes as Prisma.InputJsonValue;
}
