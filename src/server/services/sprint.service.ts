/**
 * Sprints and time logging.
 */

import { z } from "zod";

import { sprintStatusSchema } from "@/lib/constants";
import type { AuthCtx, ProjectAuthCtx } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import { buildMeta, type Pagination } from "@/server/http/pagination";

import { diffPayload, recordActivity } from "./activity.service";

export const createSprintSchema = z
  .object({
    name: z.string().min(1).max(255),
    goal: z.string().max(5000).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: sprintStatusSchema.default("PLANNED"),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
  });

export const updateSprintSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  goal: z.string().max(5000).nullable().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: sprintStatusSchema.optional(),
});

export async function listSprints(projectId: string) {
  const rows = await prisma.sprint.findMany({
    where: { projectId, deletedAt: null },
    orderBy: [{ startDate: "desc" }],
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      startDate: true,
      endDate: true,
      _count: { select: { tasks: { where: { deletedAt: null } } } },
    },
  });

  // Completed-task counts per sprint, for the progress bars.
  const completed = await prisma.task.groupBy({
    by: ["sprintId"],
    where: {
      deletedAt: null,
      completedAt: { not: null },
      sprintId: { in: rows.map((row) => row.id) },
    },
    _count: { _all: true },
  });
  const completedBySprint = new Map(
    completed.map((row) => [row.sprintId, row._count._all]),
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    goal: row.goal,
    status: row.status,
    start_date: row.startDate.toISOString(),
    end_date: row.endDate.toISOString(),
    task_count: row._count.tasks,
    completed_task_count: completedBySprint.get(row.id) ?? 0,
  }));
}

export async function createSprint(
  ctx: ProjectAuthCtx,
  input: z.infer<typeof createSprintSchema>,
) {
  const existing = await prisma.sprint.findFirst({
    where: { projectId: ctx.projectId, name: input.name, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw conflict(`This project already has a sprint named "${input.name}".`);
  }

  // Only one sprint may be ACTIVE at a time, or "the current sprint" is
  // ambiguous and the burndown has no single subject.
  if (input.status === "ACTIVE") {
    await assertNoOtherActiveSprint(ctx.projectId, null);
  }

  const sprint = await prisma.sprint.create({
    data: {
      projectId: ctx.projectId,
      name: input.name,
      goal: input.goal ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
    },
    select: { id: true, name: true },
  });

  await recordActivity({
    entityType: "SPRINT",
    entityId: sprint.id,
    projectId: ctx.projectId,
    actorId: ctx.userId,
    action: "sprint.created",
    payload: { name: sprint.name },
  });

  return sprint;
}

export async function updateSprint(
  ctx: ProjectAuthCtx,
  sprintId: string,
  input: z.infer<typeof updateSprintSchema>,
) {
  const before = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId: ctx.projectId, deletedAt: null },
    select: {
      name: true,
      goal: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!before) throw notFound("Sprint not found");

  const startDate = input.startDate ?? before.startDate;
  const endDate = input.endDate ?? before.endDate;
  if (endDate < startDate) {
    throw badRequest("End date cannot be before the start date.");
  }

  if (input.status === "ACTIVE" && before.status !== "ACTIVE") {
    await assertNoOtherActiveSprint(ctx.projectId, sprintId);
  }

  await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.goal === undefined ? {} : { goal: input.goal }),
      ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
      ...(input.endDate === undefined ? {} : { endDate: input.endDate }),
      ...(input.status === undefined ? {} : { status: input.status }),
    },
  });

  await recordActivity({
    entityType: "SPRINT",
    entityId: sprintId,
    projectId: ctx.projectId,
    actorId: ctx.userId,
    action: "sprint.updated",
    payload: diffPayload(before, input),
  });

  return { id: sprintId, updated: true };
}

export async function deleteSprint(ctx: ProjectAuthCtx, sprintId: string) {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId: ctx.projectId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!sprint) throw notFound("Sprint not found");

  // Tasks outlive their sprint: detach rather than cascade, so nothing is lost
  // when a sprint is removed.
  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { sprintId },
      data: { sprintId: null },
    });
    await tx.sprint.update({
      where: { id: sprintId },
      data: { deletedAt: new Date() },
    });
    await recordActivity(
      {
        entityType: "SPRINT",
        entityId: sprintId,
        projectId: ctx.projectId,
        actorId: ctx.userId,
        action: "sprint.deleted",
        payload: { name: sprint.name },
      },
      tx,
    );
  });

  return { id: sprintId, deleted: true };
}

async function assertNoOtherActiveSprint(
  projectId: string,
  exceptSprintId: string | null,
) {
  const active = await prisma.sprint.findFirst({
    where: {
      projectId,
      status: "ACTIVE",
      deletedAt: null,
      ...(exceptSprintId ? { id: { not: exceptSprintId } } : {}),
    },
    select: { name: true },
  });
  if (active) {
    throw conflict(
      `"${active.name}" is already active. Complete it before starting another sprint.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Time logging
// ---------------------------------------------------------------------------

export const createTimeLogSchema = z.object({
  minutes: z
    .number()
    .int("Log whole minutes")
    .min(1, "Log at least one minute")
    .max(24 * 60, "A single entry cannot exceed 24 hours"),
  spentOn: z.coerce.date(),
  note: z.string().max(500).optional(),
});

export async function listTimeLogs(taskId: string) {
  const rows = await prisma.timeLog.findMany({
    where: { taskId, deletedAt: null },
    orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      minutes: true,
      spentOn: true,
      note: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);

  return {
    entries: rows.map((row) => ({
      id: row.id,
      minutes: row.minutes,
      spent_on: row.spentOn.toISOString().slice(0, 10),
      note: row.note,
      created_at: row.createdAt.toISOString(),
      user: row.user,
    })),
    total_minutes: totalMinutes,
  };
}

export async function createTimeLog(
  ctx: ProjectAuthCtx & { taskId: string },
  input: z.infer<typeof createTimeLogSchema>,
) {
  // Future-dated work has not happened yet.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (input.spentOn > endOfToday) {
    throw badRequest("You cannot log time against a future date.");
  }

  const created = await prisma.timeLog.create({
    data: {
      taskId: ctx.taskId,
      userId: ctx.userId,
      minutes: input.minutes,
      spentOn: input.spentOn,
      note: input.note ?? null,
    },
    select: { id: true, minutes: true, spentOn: true },
  });

  await recordActivity({
    entityType: "TIME_LOG",
    entityId: created.id,
    projectId: ctx.projectId,
    actorId: ctx.userId,
    action: "time_log.created",
    payload: {
      taskId: ctx.taskId,
      minutes: created.minutes,
      spentOn: created.spentOn.toISOString().slice(0, 10),
    },
  });

  return {
    id: created.id,
    minutes: created.minutes,
    spent_on: created.spentOn.toISOString().slice(0, 10),
  };
}

export const updateTimeLogSchema = z
  .object({
    minutes: z
      .number()
      .int("Log whole minutes")
      .min(1, "Log at least one minute")
      .max(24 * 60, "A single entry cannot exceed 24 hours")
      .optional(),
    spentOn: z.coerce.date().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .refine(
    (input) =>
      input.minutes !== undefined ||
      input.spentOn !== undefined ||
      input.note !== undefined,
    { message: "Nothing to change." },
  );

/**
 * Correct an existing entry.
 *
 * Same permission as removing one — your own time, or an admin fixing the
 * record — because an edit that could rewrite someone else's hours is a delete
 * and a create wearing a different name. `spentOn` matters as much as
 * `minutes`: moving a day is what pulls an entry into or out of a timesheet
 * week, so it is re-validated against today exactly as a new entry is.
 */
export async function updateTimeLog(
  ctx: AuthCtx,
  timeLogId: string,
  input: z.infer<typeof updateTimeLogSchema>,
) {
  const entry = await prisma.timeLog.findFirst({
    where: { id: timeLogId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      minutes: true,
      spentOn: true,
      note: true,
      task: { select: { projectId: true } },
    },
  });
  if (!entry) throw notFound("Time entry not found");

  if (entry.userId !== ctx.userId && ctx.role !== "ADMIN") {
    throw forbidden("You can only edit your own time entries.");
  }

  if (input.spentOn) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (input.spentOn > endOfToday) {
      throw badRequest("You cannot log time against a future date.");
    }
  }

  const updated = await prisma.timeLog.update({
    where: { id: timeLogId },
    data: {
      ...(input.minutes === undefined ? {} : { minutes: input.minutes }),
      ...(input.spentOn === undefined ? {} : { spentOn: input.spentOn }),
      ...(input.note === undefined ? {} : { note: input.note }),
    },
    select: { id: true, minutes: true, spentOn: true, note: true },
  });

  await recordActivity({
    entityType: "TIME_LOG",
    entityId: timeLogId,
    projectId: entry.task.projectId,
    actorId: ctx.userId,
    action: "time_log.updated",
    payload: diffPayload(
      {
        minutes: entry.minutes,
        spentOn: entry.spentOn.toISOString().slice(0, 10),
        note: entry.note,
      },
      {
        minutes: updated.minutes,
        spentOn: updated.spentOn.toISOString().slice(0, 10),
        note: updated.note,
      },
    ),
  });

  return {
    id: updated.id,
    minutes: updated.minutes,
    spent_on: updated.spentOn.toISOString().slice(0, 10),
    note: updated.note,
  };
}

export async function deleteTimeLog(ctx: AuthCtx, timeLogId: string) {
  const entry = await prisma.timeLog.findFirst({
    where: { id: timeLogId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      minutes: true,
      task: { select: { projectId: true } },
    },
  });
  if (!entry) throw notFound("Time entry not found");

  // Your own time, or an admin correcting the record.
  if (entry.userId !== ctx.userId && ctx.role !== "ADMIN") {
    throw forbidden("You can only remove your own time entries.");
  }

  await prisma.timeLog.update({
    where: { id: timeLogId },
    data: { deletedAt: new Date() },
  });

  await recordActivity({
    entityType: "TIME_LOG",
    entityId: timeLogId,
    projectId: entry.task.projectId,
    actorId: ctx.userId,
    action: "time_log.deleted",
    payload: { minutes: entry.minutes },
  });

  return { id: timeLogId, deleted: true };
}

/**
 * Weekly timesheet for one user: every entry in the range, pivoted into a
 * task × day grid with row, column and grand totals.
 *
 * The pivot happens here rather than in the browser so the client renders a
 * ready-made grid, and so the totals are computed once from the same rows.
 * Row count is bounded by "one person's entries in one week", so this is small.
 */
export async function getTimesheet(
  ctx: AuthCtx,
  range: { from: Date; to: Date },
  targetUserId?: string,
) {
  // Admins may inspect someone else's timesheet; everyone else sees only their
  // own, regardless of what the query string asks for.
  const userId =
    targetUserId && ctx.role === "ADMIN" ? targetUserId : ctx.userId;

  const entries = await prisma.timeLog.findMany({
    where: {
      userId,
      deletedAt: null,
      spentOn: { gte: range.from, lte: range.to },
    },
    orderBy: [{ spentOn: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      minutes: true,
      spentOn: true,
      note: true,
      task: {
        select: {
          id: true,
          number: true,
          title: true,
          project: { select: { id: true, key: true, name: true } },
        },
      },
    },
  });

  const days: string[] = [];
  for (
    const cursor = new Date(range.from);
    cursor <= range.to;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    days.push(cursor.toISOString().slice(0, 10));
  }

  type Row = {
    task_id: string;
    ref: string;
    title: string;
    project: { id: string; key: string };
    /** day (YYYY-MM-DD) -> minutes */
    by_day: Record<string, number>;
    total_minutes: number;
  };

  const rows = new Map<string, Row>();
  const dayTotals: Record<string, number> = Object.fromEntries(
    days.map((day) => [day, 0]),
  );

  for (const entry of entries) {
    const day = entry.spentOn.toISOString().slice(0, 10);
    const key = entry.task.id;

    let row = rows.get(key);
    if (!row) {
      row = {
        task_id: entry.task.id,
        ref: `${entry.task.project.key}-${entry.task.number}`,
        title: entry.task.title,
        project: { id: entry.task.project.id, key: entry.task.project.key },
        by_day: Object.fromEntries(days.map((d) => [d, 0])),
        total_minutes: 0,
      };
      rows.set(key, row);
    }

    row.by_day[day] = (row.by_day[day] ?? 0) + entry.minutes;
    row.total_minutes += entry.minutes;
    dayTotals[day] = (dayTotals[day] ?? 0) + entry.minutes;
  }

  return {
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
    days,
    rows: [...rows.values()].sort((a, b) => b.total_minutes - a.total_minutes),
    day_totals: dayTotals,
    total_minutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
    entries: entries.map((entry) => ({
      id: entry.id,
      minutes: entry.minutes,
      spent_on: entry.spentOn.toISOString().slice(0, 10),
      note: entry.note,
      task_id: entry.task.id,
      ref: `${entry.task.project.key}-${entry.task.number}`,
    })),
  };
}

/** Time logged by the signed-in user over a date range — the My work summary. */
export async function listMyTimeLogs(
  ctx: AuthCtx,
  range: { from: Date; to: Date },
  pagination: Pagination,
) {
  const where = {
    userId: ctx.userId,
    deletedAt: null,
    spentOn: { gte: range.from, lte: range.to },
  };

  const [rows, total, sum] = await Promise.all([
    prisma.timeLog.findMany({
      where,
      orderBy: { spentOn: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        minutes: true,
        spentOn: true,
        note: true,
        task: {
          select: {
            id: true,
            number: true,
            title: true,
            project: { select: { id: true, key: true } },
          },
        },
      },
    }),
    prisma.timeLog.count({ where }),
    prisma.timeLog.aggregate({ where, _sum: { minutes: true } }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      minutes: row.minutes,
      spent_on: row.spentOn.toISOString().slice(0, 10),
      note: row.note,
      task: {
        id: row.task.id,
        ref: `${row.task.project.key}-${row.task.number}`,
        title: row.task.title,
      },
    })),
    meta: {
      ...buildMeta(total, pagination),
      total_minutes: sum._sum.minutes ?? 0,
    },
  };
}
