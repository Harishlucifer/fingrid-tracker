/**
 * Tasks: CRUD, board moves, and the per-project numbering.
 */

import { z } from "zod";

import {
  needsRebalance,
  nextPosition,
  positionBetween,
  rebalancedPositions,
} from "@/lib/board-position";
import {
  STATUS_CATEGORIES,
  statusCategorySchema,
  taskPrioritySchema,
} from "@/lib/constants";
import type { AuthCtx, ProjectAuthCtx } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { enqueueTaskAssigned } from "@/server/notifications/dispatch";
import { badRequest, notFound } from "@/server/http/errors";
import { buildMeta, type Pagination } from "@/server/http/pagination";

import { diffPayload, recordActivity } from "./activity.service";

export const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().max(20000).optional(),
  statusId: z.string().min(1).optional(),
  priority: taskPrioritySchema.default("MEDIUM"),
  assigneeId: z.string().min(1).nullable().optional(),
  sprintId: z.string().min(1).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  estimateMin: z.number().int().min(0).max(60 * 24 * 365).nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).nullable().optional(),
  statusId: z.string().min(1).optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  sprintId: z.string().min(1).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  estimateMin: z.number().int().min(0).max(60 * 24 * 365).nullable().optional(),
});

/** A drag-and-drop drop: target column plus the neighbours it landed between. */
export const moveTaskSchema = z.object({
  statusId: z.string().min(1),
  beforeTaskId: z.string().min(1).nullable().optional(),
  afterTaskId: z.string().min(1).nullable().optional(),
});

export const listTasksQuerySchema = z.object({
  projectId: z.string().optional(),
  statusId: z.string().optional(),
  assigneeId: z.string().optional(),
  /**
   * A sprint id, or the literal "none" for the backlog — tasks belonging to no
   * sprint. "none" is needed because an absent `sprintId` means "don't filter",
   * which is a different question from "has no sprint".
   */
  sprintId: z.string().optional(),
  priority: taskPrioritySchema.optional(),
  q: z.string().optional(),
  open: z.coerce.boolean().optional(),
});

/** Sentinel used by the backlog view. */
export const NO_SPRINT = "none";

const taskSelect = {
  id: true,
  number: true,
  title: true,
  description: true,
  priority: true,
  position: true,
  dueDate: true,
  estimateMin: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, key: true, name: true } },
  status: { select: { id: true, name: true, category: true, position: true } },
  sprint: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, image: true } },
  reporter: { select: { id: true, name: true, email: true, image: true } },
  _count: {
    select: {
      comments: { where: { deletedAt: null } },
      attachments: { where: { deletedAt: null } },
    },
  },
} as const;

type TaskRow = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  priority: string;
  position: number;
  dueDate: Date | null;
  estimateMin: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: { id: string; key: string; name: string };
  status: { id: string; name: string; category: string; position: number };
  sprint: { id: string; name: string } | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  reporter: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  _count: { comments: number; attachments: number };
};

function toDto(row: TaskRow) {
  return {
    id: row.id,
    /** Human reference, e.g. PMT-42. */
    ref: `${row.project.key}-${row.number}`,
    number: row.number,
    title: row.title,
    description: row.description,
    priority: row.priority,
    position: row.position,
    due_date: row.dueDate?.toISOString() ?? null,
    estimate_minutes: row.estimateMin,
    completed_at: row.completedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    project: row.project,
    status: row.status,
    sprint: row.sprint,
    assignee: row.assignee,
    reporter: row.reporter,
    comment_count: row._count.comments,
    attachment_count: row._count.attachments,
  };
}

export type TaskDto = ReturnType<typeof toDto>;

/** Projects the caller may read — used to scope cross-project queries. */
export async function visibleProjectIds(
  ctx: AuthCtx,
): Promise<string[] | "ALL"> {
  if (ctx.role === "ADMIN") return "ALL";
  const memberships = await prisma.projectMember.findMany({
    where: { userId: ctx.userId },
    select: { projectId: true },
  });
  return memberships.map((row) => row.projectId);
}

export async function listTasks(
  ctx: AuthCtx,
  filters: z.infer<typeof listTasksQuerySchema>,
  pagination: Pagination,
) {
  const scope = await visibleProjectIds(ctx);

  // Never widen to every project when the caller has no memberships.
  if (scope !== "ALL" && scope.length === 0) {
    return { data: [], meta: buildMeta(0, pagination) };
  }

  if (filters.projectId && scope !== "ALL" && !scope.includes(filters.projectId)) {
    throw notFound("Project not found");
  }

  const where = {
    deletedAt: null,
    ...(filters.projectId
      ? { projectId: filters.projectId }
      : scope === "ALL"
        ? {}
        : { projectId: { in: scope } }),
    ...(filters.statusId ? { statusId: filters.statusId } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.sprintId
      ? filters.sprintId === NO_SPRINT
        ? { sprintId: null }
        : { sprintId: filters.sprintId }
      : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.open ? { completedAt: null } : {}),
    ...(filters.q ? { title: { contains: filters.q } } : {}),
    project: { deletedAt: null },
  };

  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ status: { position: "asc" } }, { position: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: taskSelect,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    data: rows.map(toDto),
    meta: buildMeta(total, pagination),
  };
}

/** Every live task in a project, grouped by column — the board query. */
export async function getBoard(projectId: string) {
  const [statuses, tasks] = await Promise.all([
    prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        position: true,
        color: true,
        wipLimit: true,
      },
    }),
    prisma.task.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { position: "asc" },
      select: taskSelect,
    }),
  ]);

  const byStatus = new Map<string, TaskDto[]>();
  for (const status of statuses) byStatus.set(status.id, []);
  for (const task of tasks) {
    byStatus.get(task.status.id)?.push(toDto(task));
  }

  return {
    columns: statuses.map((status) => ({
      id: status.id,
      name: status.name,
      category: status.category,
      position: status.position,
      color: status.color,
      wip_limit: status.wipLimit,
      tasks: byStatus.get(status.id) ?? [],
    })),
  };
}

export async function getTask(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: taskSelect,
  });
  if (!task) throw notFound("Task not found");
  return toDto(task);
}

export async function createTask(
  ctx: ProjectAuthCtx,
  input: z.infer<typeof createTaskSchema>,
) {
  const statuses = await prisma.taskStatus.findMany({
    where: { projectId: ctx.projectId },
    orderBy: { position: "asc" },
    select: { id: true, category: true },
  });
  if (statuses.length === 0) {
    throw badRequest("This project has no board columns.");
  }

  const status = input.statusId
    ? statuses.find((candidate) => candidate.id === input.statusId)
    : statuses[0];
  if (!status) throw badRequest("Unknown status for this project.");

  await assertAssignableMember(ctx.projectId, input.assigneeId);
  await assertSprintBelongs(ctx.projectId, input.sprintId);

  const last = await prisma.task.findFirst({
    where: { projectId: ctx.projectId, statusId: status.id, deletedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  // The number and the row must be allocated together, or two concurrent
  // creates collide on uq_task_project_number.
  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: ctx.projectId },
      data: { taskSeq: { increment: 1 } },
      select: { taskSeq: true, key: true },
    });

    const task = await tx.task.create({
      data: {
        projectId: ctx.projectId,
        statusId: status.id,
        number: project.taskSeq,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        assigneeId: input.assigneeId ?? null,
        reporterId: ctx.userId,
        sprintId: input.sprintId ?? null,
        dueDate: input.dueDate ?? null,
        estimateMin: input.estimateMin ?? null,
        position: nextPosition(last?.position ?? null),
        // A task created directly into a DONE column is complete on arrival.
        completedAt: status.category === "DONE" ? new Date() : null,
      },
      select: { id: true, number: true },
    });

    await recordActivity(
      {
        entityType: "TASK",
        entityId: task.id,
        projectId: ctx.projectId,
        actorId: ctx.userId,
        action: "task.created",
        payload: {
          ref: `${project.key}-${task.number}`,
          title: input.title,
          priority: input.priority,
        },
      },
      tx,
    );

    return task;
  });

  // A task can be assigned at creation, which is just as notifiable as a later
  // reassignment.
  if (input.assigneeId) {
    await notifyAssignee(
      { ...ctx, taskId: created.id },
      input.assigneeId,
    );
  }

  return getTask(created.id);
}

export async function updateTask(
  ctx: ProjectAuthCtx & { taskId: string },
  input: z.infer<typeof updateTaskSchema>,
) {
  const before = await prisma.task.findFirst({
    where: { id: ctx.taskId, deletedAt: null },
    select: {
      title: true,
      description: true,
      priority: true,
      statusId: true,
      assigneeId: true,
      sprintId: true,
      dueDate: true,
      estimateMin: true,
      completedAt: true,
    },
  });
  if (!before) throw notFound("Task not found");

  await assertAssignableMember(ctx.projectId, input.assigneeId);
  await assertSprintBelongs(ctx.projectId, input.sprintId);

  // A status change may move the task across the DONE boundary, which is what
  // drives completedAt — and therefore every report.
  let completedAt = before.completedAt;
  if (input.statusId && input.statusId !== before.statusId) {
    const status = await prisma.taskStatus.findFirst({
      where: { id: input.statusId, projectId: ctx.projectId },
      select: { category: true },
    });
    if (!status) throw badRequest("Unknown status for this project.");
    completedAt = resolveCompletedAt(status.category, before.completedAt);
  }

  await prisma.task.update({
    where: { id: ctx.taskId },
    data: {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
      ...(input.statusId === undefined ? {} : { statusId: input.statusId }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.assigneeId === undefined
        ? {}
        : { assigneeId: input.assigneeId }),
      ...(input.sprintId === undefined ? {} : { sprintId: input.sprintId }),
      ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
      ...(input.estimateMin === undefined
        ? {}
        : { estimateMin: input.estimateMin }),
      completedAt,
    },
  });

  // A reassignment is its own event, not a generic field edit: it is the change
  // people ask about ("who moved this to me?"), so it gets a distinct action and
  // a payload with readable names rather than bare UUIDs.
  const reassigned =
    input.assigneeId !== undefined && input.assigneeId !== before.assigneeId;

  if (reassigned) {
    const [previous, next] = await Promise.all([
      before.assigneeId
        ? prisma.user.findUnique({
            where: { id: before.assigneeId },
            select: { name: true, email: true },
          })
        : null,
      input.assigneeId
        ? prisma.user.findUnique({
            where: { id: input.assigneeId },
            select: { name: true, email: true },
          })
        : null,
    ]);

    await recordActivity({
      entityType: "TASK",
      entityId: ctx.taskId,
      projectId: ctx.projectId,
      actorId: ctx.userId,
      action: input.assigneeId ? "task.assigned" : "task.unassigned",
      payload: {
        from: previous ? (previous.name ?? previous.email) : null,
        to: next ? (next.name ?? next.email) : null,
      },
    });

    await notifyAssignee(ctx, input.assigneeId ?? null);
  }

  await recordActivity({
    entityType: "TASK",
    entityId: ctx.taskId,
    projectId: ctx.projectId,
    actorId: ctx.userId,
    action:
      input.statusId && input.statusId !== before.statusId
        ? "task.status_changed"
        : "task.updated",
    // The assignee change is reported by its own event above, so it is excluded
    // here rather than duplicated as an opaque id diff.
    payload: diffPayload(before, {
      ...input,
      assigneeId: undefined,
      completedAt,
    }),
  });

  return getTask(ctx.taskId);
}

/**
 * Queue the "assigned to you" email.
 *
 * Deliberately outside the update transaction: the assignment must not fail
 * because notification bookkeeping did. The row lands in the outbox and is sent
 * after the response — see `src/server/notifications/dispatch.ts`.
 */
async function notifyAssignee(
  ctx: ProjectAuthCtx & { taskId: string },
  assigneeId: string | null,
) {
  if (!assigneeId) return;

  try {
    const [recipient, actor, task] = await Promise.all([
      prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true, email: true, isActive: true },
      }),
      prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true, name: true, email: true },
      }),
      prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: {
          id: true,
          number: true,
          title: true,
          priority: true,
          dueDate: true,
          project: { select: { id: true, key: true, name: true } },
        },
      }),
    ]);

    if (!recipient || !actor || !task) return;

    await enqueueTaskAssigned({
      recipient,
      actor,
      task: {
        id: task.id,
        ref: `${task.project.key}-${task.number}`,
        title: task.title,
        projectId: task.project.id,
        projectName: task.project.name,
        priority: task.priority,
        dueDate: task.dueDate,
      },
    });
  } catch (error) {
    // Never let notification bookkeeping break the assignment itself.
    console.error("[notifications] failed to queue assignment email", error);
  }
}

/**
 * Move a task within or between columns.
 *
 * Position is computed from the drop's neighbours; when the integer gap between
 * them has closed, the target column is rebalanced in the same transaction so
 * the move is still durable and correctly ordered.
 */
export async function moveTask(
  ctx: ProjectAuthCtx & { taskId: string },
  input: z.infer<typeof moveTaskSchema>,
) {
  const task = await prisma.task.findFirst({
    where: { id: ctx.taskId, deletedAt: null },
    select: { id: true, statusId: true, position: true, completedAt: true },
  });
  if (!task) throw notFound("Task not found");

  const status = await prisma.taskStatus.findFirst({
    where: { id: input.statusId, projectId: ctx.projectId },
    select: { id: true, category: true, name: true },
  });
  if (!status) throw badRequest("Unknown status for this project.");

  const [beforeTask, afterTask] = await Promise.all([
    input.beforeTaskId
      ? prisma.task.findFirst({
          where: {
            id: input.beforeTaskId,
            statusId: status.id,
            deletedAt: null,
          },
          select: { position: true },
        })
      : null,
    input.afterTaskId
      ? prisma.task.findFirst({
          where: {
            id: input.afterTaskId,
            statusId: status.id,
            deletedAt: null,
          },
          select: { position: true },
        })
      : null,
  ]);

  const before = beforeTask?.position ?? null;
  const after = afterTask?.position ?? null;
  const candidate = positionBetween(before, after);
  const completedAt = resolveCompletedAt(status.category, task.completedAt);

  await prisma.$transaction(async (tx) => {
    if (!needsRebalance(candidate, before, after)) {
      await tx.task.update({
        where: { id: ctx.taskId },
        data: { statusId: status.id, position: candidate, completedAt },
      });
      return;
    }

    // Gap exhausted: respace the whole column with the task in its new slot.
    const siblings = await tx.task.findMany({
      where: { statusId: status.id, deletedAt: null, id: { not: ctx.taskId } },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    const ordered: string[] = [];
    let inserted = false;
    for (const sibling of siblings) {
      if (!inserted && sibling.id === input.afterTaskId) {
        ordered.push(ctx.taskId);
        inserted = true;
      }
      ordered.push(sibling.id);
      if (!inserted && sibling.id === input.beforeTaskId) {
        ordered.push(ctx.taskId);
        inserted = true;
      }
    }
    if (!inserted) ordered.push(ctx.taskId);

    const positions = rebalancedPositions(ordered.length);

    await tx.task.update({
      where: { id: ctx.taskId },
      data: { statusId: status.id, completedAt },
    });

    for (const [index, id] of ordered.entries()) {
      await tx.task.update({
        where: { id },
        data: { position: positions[index]! },
      });
    }
  });

  await recordActivity({
    entityType: "TASK",
    entityId: ctx.taskId,
    projectId: ctx.projectId,
    actorId: ctx.userId,
    action: task.statusId === status.id ? "task.reordered" : "task.status_changed",
    payload: { toStatus: status.name, completed: completedAt !== null },
  });

  return getTask(ctx.taskId);
}

export const moveTaskCategorySchema = z.object({
  category: statusCategorySchema,
});

/**
 * Move a task to a different status *category* — the operation the overall
 * (cross-project) board needs.
 *
 * The per-project board moves a task to a specific `statusId`, but on a board
 * spanning many projects a column is a category (`TODO`/`IN_PROGRESS`/`DONE`),
 * because every project has its own differently-named columns. So the target
 * status is resolved here, inside the task's OWN project — a task never moves
 * across projects, which would orphan its number, comments and sprint.
 */
export async function moveTaskToCategory(
  ctx: ProjectAuthCtx & { taskId: string },
  input: z.infer<typeof moveTaskCategorySchema>,
) {
  const task = await prisma.task.findFirst({
    where: { id: ctx.taskId, deletedAt: null },
    select: {
      id: true,
      completedAt: true,
      status: { select: { id: true, category: true } },
    },
  });
  if (!task) throw notFound("Task not found");

  // Already in a column of that category — nothing to do, and re-stamping
  // completedAt would rewrite history the reports read.
  if (task.status.category === input.category) {
    return getTask(ctx.taskId);
  }

  const target = await prisma.taskStatus.findFirst({
    where: { projectId: ctx.projectId, category: input.category },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });
  if (!target) {
    throw badRequest(
      `This project has no ${input.category} column, so the task cannot be moved there.`,
    );
  }

  const last = await prisma.task.findFirst({
    where: {
      projectId: ctx.projectId,
      statusId: target.id,
      deletedAt: null,
    },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.task.update({
    where: { id: ctx.taskId },
    data: {
      statusId: target.id,
      // Appended to the end of the target column; the overall board is grouped,
      // not hand-ordered, so there is no drop position to honour.
      position: nextPosition(last?.position ?? null),
      completedAt: resolveCompletedAt(input.category, task.completedAt),
    },
  });

  await recordActivity({
    entityType: "TASK",
    entityId: ctx.taskId,
    projectId: ctx.projectId,
    actorId: ctx.userId,
    action: "task.status_changed",
    payload: { toStatus: target.name, category: input.category },
  });

  return getTask(ctx.taskId);
}

/**
 * Board across every project the caller can see, grouped by status category.
 *
 * Grouping by category rather than status id is what makes a cross-project board
 * possible at all: two projects' "In Review" columns are different rows in
 * `task_status`, but the same category.
 */
export async function getOverallBoard(
  ctx: AuthCtx,
  filters: { projectId?: string; assigneeId?: string; mineOnly?: boolean },
) {
  const scope = await visibleProjectIds(ctx);
  if (scope !== "ALL" && scope.length === 0) {
    return {
      columns: STATUS_CATEGORIES.map((category) => ({
        category,
        tasks: [],
        total: 0,
      })),
      projects: [],
      truncated: false,
    };
  }

  if (filters.projectId && scope !== "ALL" && !scope.includes(filters.projectId)) {
    throw notFound("Project not found");
  }

  const assigneeId =
    filters.assigneeId ?? (filters.mineOnly ? ctx.userId : undefined);

  const where = {
    deletedAt: null,
    project: { deletedAt: null },
    ...(filters.projectId
      ? { projectId: filters.projectId }
      : scope === "ALL"
        ? {}
        : { projectId: { in: scope } }),
    // `mine=true` is the older spelling of "assignee_id is me". An explicit
    // assignee wins, rather than the two spreads silently overwriting by order.
    ...(assigneeId ? { assigneeId } : {}),
  };

  // Bounded so a large org cannot pull its entire task table into one board.
  const CARD_LIMIT = 400;

  const [rows, total, projects] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: CARD_LIMIT,
      select: taskSelect,
    }),
    prisma.task.count({ where }),
    prisma.project.findMany({
      where:
        scope === "ALL"
          ? { deletedAt: null }
          : { deletedAt: null, id: { in: scope } },
      orderBy: { name: "asc" },
      select: { id: true, key: true, name: true },
    }),
  ]);

  const byCategory = new Map<string, TaskDto[]>(
    STATUS_CATEGORIES.map((category) => [category, []]),
  );
  for (const row of rows) {
    byCategory.get(row.status.category)?.push(toDto(row));
  }

  return {
    columns: STATUS_CATEGORIES.map((category) => ({
      category,
      tasks: byCategory.get(category) ?? [],
      total: byCategory.get(category)?.length ?? 0,
    })),
    projects,
    /** True when the card limit clipped the result — the UI says so explicitly. */
    truncated: total > CARD_LIMIT,
  };
}

export async function deleteTask(ctx: ProjectAuthCtx & { taskId: string }) {
  const task = await prisma.task.findFirst({
    where: { id: ctx.taskId, deletedAt: null },
    select: { id: true, number: true, project: { select: { key: true } } },
  });
  if (!task) throw notFound("Task not found");

  await prisma.task.update({
    where: { id: ctx.taskId },
    data: { deletedAt: new Date() },
  });

  await recordActivity({
    entityType: "TASK",
    entityId: ctx.taskId,
    projectId: ctx.projectId,
    actorId: ctx.userId,
    action: "task.deleted",
    payload: { ref: `${task.project.key}-${task.number}` },
  });

  return { id: ctx.taskId, deleted: true };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Stamp completion when entering a DONE column, clear it when leaving. Keeps the
 * existing timestamp if the task was already complete, so re-ordering inside a
 * DONE column does not rewrite history the reports depend on.
 */
function resolveCompletedAt(
  category: string,
  current: Date | null,
): Date | null {
  if (category === "DONE") return current ?? new Date();
  return null;
}

/** An assignee must be a member of the project. */
async function assertAssignableMember(
  projectId: string,
  assigneeId: string | null | undefined,
) {
  if (!assigneeId) return;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
    select: { id: true },
  });
  if (!member) {
    throw badRequest("That user is not a member of this project.");
  }
}

/** A sprint must belong to the same project — otherwise reports mix projects. */
async function assertSprintBelongs(
  projectId: string,
  sprintId: string | null | undefined,
) {
  if (!sprintId) return;
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId, deletedAt: null },
    select: { id: true },
  });
  if (!sprint) throw badRequest("That sprint does not belong to this project.");
}
