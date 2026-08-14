/**
 * Projects, their members, and their board columns.
 */

import { z } from "zod";

import {
  DEFAULT_TASK_STATUSES,
  projectRoleSchema,
  projectStatusSchema,
  statusCategorySchema,
  wipPolicySchema,
} from "@/lib/constants";
import { BOARD_POSITION_GAP } from "@/lib/constants";
import { nextPosition, rebalancedPositions } from "@/lib/board-position";
import { isCompleteReordering } from "@/lib/column-order";
import { effectiveProjectAccess } from "@/lib/permissions";
import type { AuthCtx } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { badRequest, conflict, notFound } from "@/server/http/errors";
import { buildMeta, type Pagination } from "@/server/http/pagination";

import { diffPayload, recordActivity } from "./activity.service";

/** Project keys are uppercase short codes used to build task numbers. */
const projectKeySchema = z
  .string()
  .min(2)
  .max(16)
  .transform((value) => value.trim().toUpperCase())
  .refine(
    (value) => /^[A-Z][A-Z0-9]*$/.test(value),
    "Use letters and digits only, starting with a letter (e.g. PMT).",
  );

export const createProjectSchema = z.object({
  key: projectKeySchema,
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  color: z.string().max(16).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: projectStatusSchema.optional(),
  color: z.string().max(16).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  /** Validated here because the column is a VarChar the database will not police. */
  wipPolicy: wipPolicySchema.optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: projectRoleSchema.default("MEMBER"),
});

/**
 * A WIP limit of zero would close the column outright — `breachesWipLimit` is
 * honest about that, but it is never what someone means to save, so the write
 * path refuses it. `null` clears the limit.
 */
const wipLimitSchema = z.number().int().min(1).max(999).nullable().optional();

export const createStatusSchema = z.object({
  name: z.string().min(1).max(64),
  category: statusCategorySchema,
  color: z.string().max(16).nullable().optional(),
  wipLimit: wipLimitSchema,
});

export const updateStatusSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  category: statusCategorySchema.optional(),
  color: z.string().max(16).nullable().optional(),
  wipLimit: wipLimitSchema,
});

/** A full re-ordering: every column of the project, exactly once, in new order. */
export const reorderStatusesSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export async function listProjects(ctx: AuthCtx, pagination: Pagination) {
  // Admins see everything; everyone else sees only projects they belong to.
  const where = {
    deletedAt: null,
    ...(ctx.role === "ADMIN"
      ? {}
      : { members: { some: { userId: ctx.userId } } }),
  };

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        status: true,
        color: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true, image: true } },
        members: { where: { userId: ctx.userId }, select: { role: true } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  // Open-task counts, in one grouped query rather than one per project.
  const openCounts = await prisma.task.groupBy({
    by: ["projectId"],
    where: {
      deletedAt: null,
      completedAt: null,
      projectId: { in: rows.map((row) => row.id) },
    },
    _count: { _all: true },
  });
  const openByProject = new Map(
    openCounts.map((row) => [row.projectId, row._count._all]),
  );

  return {
    data: rows.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      status: row.status,
      color: row.color,
      start_date: row.startDate?.toISOString() ?? null,
      end_date: row.endDate?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
      owner: row.owner,
      my_access: effectiveProjectAccess(ctx.role, row.members[0]?.role),
      task_count: row._count.tasks,
      open_task_count: openByProject.get(row.id) ?? 0,
    })),
    meta: buildMeta(total, pagination),
  };
}

export async function getProject(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      status: true,
      color: true,
      startDate: true,
      endDate: true,
      wipPolicy: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true, image: true } },
      statuses: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          position: true,
          color: true,
          wipLimit: true,
          // So the settings screen knows which columns cannot simply be
          // deleted, and can ask where their tasks should go.
          _count: { select: { tasks: { where: { deletedAt: null } } } },
        },
      },
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  if (!project) throw notFound("Project not found");

  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    status: project.status,
    color: project.color,
    start_date: project.startDate?.toISOString() ?? null,
    end_date: project.endDate?.toISOString() ?? null,
    wip_policy: project.wipPolicy,
    created_at: project.createdAt.toISOString(),
    owner: project.owner,
    statuses: project.statuses.map((status) => ({
      id: status.id,
      name: status.name,
      category: status.category,
      position: status.position,
      color: status.color,
      wip_limit: status.wipLimit,
      task_count: status._count.tasks,
    })),
    members: project.members.map((member) => ({
      id: member.id,
      role: member.role,
      user: member.user,
    })),
  };
}

export async function createProject(
  ctx: AuthCtx,
  input: z.infer<typeof createProjectSchema>,
) {
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw badRequest("End date cannot be before the start date.");
  }

  const existing = await prisma.project.findUnique({
    where: { key: input.key },
    select: { id: true, deletedAt: true },
  });
  if (existing) {
    throw conflict(
      `Project key ${input.key} is already in use. Keys stay reserved even after a project is archived, so task numbers never collide.`,
    );
  }

  // The project, its default board columns, and the creator's LEAD membership
  // are created together — a project with no columns cannot render a board.
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        ownerId: ctx.userId,
        statuses: {
          create: DEFAULT_TASK_STATUSES.map((status, index) => ({
            name: status.name,
            category: status.category,
            color: status.color,
            position: (index + 1) * BOARD_POSITION_GAP,
          })),
        },
        members: {
          create: { userId: ctx.userId, role: "LEAD" },
        },
      },
      select: { id: true, key: true, name: true },
    });

    await recordActivity(
      {
        entityType: "PROJECT",
        entityId: created.id,
        projectId: created.id,
        actorId: ctx.userId,
        action: "project.created",
        payload: { key: created.key, name: created.name },
      },
      tx,
    );

    return created;
  });

  return getProject(project.id);
}

export async function updateProject(
  ctx: AuthCtx,
  projectId: string,
  input: z.infer<typeof updateProjectSchema>,
) {
  const before = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      name: true,
      description: true,
      status: true,
      color: true,
      startDate: true,
      endDate: true,
      wipPolicy: true,
    },
  });
  if (!before) throw notFound("Project not found");

  const startDate = input.startDate ?? before.startDate;
  const endDate = input.endDate ?? before.endDate;
  if (startDate && endDate && endDate < startDate) {
    throw badRequest("End date cannot be before the start date.");
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.color === undefined ? {} : { color: input.color }),
      ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
      ...(input.endDate === undefined ? {} : { endDate: input.endDate }),
      ...(input.wipPolicy === undefined ? {} : { wipPolicy: input.wipPolicy }),
    },
  });

  await recordActivity({
    entityType: "PROJECT",
    entityId: projectId,
    projectId,
    actorId: ctx.userId,
    action: "project.updated",
    payload: diffPayload(before, input),
  });

  return getProject(projectId);
}

/** Archive by soft delete. The key stays reserved so task numbers never repeat. */
export async function deleteProject(ctx: AuthCtx, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, key: true },
  });
  if (!project) throw notFound("Project not found");

  await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });

  await recordActivity({
    entityType: "PROJECT",
    entityId: projectId,
    projectId,
    actorId: ctx.userId,
    action: "project.deleted",
    payload: { key: project.key },
  });

  return { id: projectId, deleted: true };
}

export async function addProjectMember(
  ctx: AuthCtx,
  projectId: string,
  input: z.infer<typeof addMemberSchema>,
) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, isActive: true, deletedAt: null },
    select: { id: true, email: true },
  });
  if (!user) throw notFound("User not found or inactive");

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: input.userId } },
    select: { id: true },
  });
  if (existing) throw conflict("That user is already a member of this project.");

  const member = await prisma.projectMember.create({
    data: { projectId, userId: input.userId, role: input.role },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  await recordActivity({
    entityType: "PROJECT",
    entityId: projectId,
    projectId,
    actorId: ctx.userId,
    action: "project.member_added",
    payload: { email: user.email, role: input.role },
  });

  return member;
}

export async function removeProjectMember(
  ctx: AuthCtx,
  projectId: string,
  userId: string,
) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true, role: true, user: { select: { email: true } } },
  });
  if (!member) throw notFound("Membership not found");

  // Never leave a project with no lead — there would be nobody able to manage it
  // except an org admin.
  if (member.role === "LEAD") {
    const otherLeads = await prisma.projectMember.count({
      where: { projectId, role: "LEAD", userId: { not: userId } },
    });
    if (otherLeads === 0) {
      throw badRequest(
        "This is the project's only lead. Promote another member first.",
      );
    }
  }

  await prisma.projectMember.delete({ where: { id: member.id } });

  await recordActivity({
    entityType: "PROJECT",
    entityId: projectId,
    projectId,
    actorId: ctx.userId,
    action: "project.member_removed",
    payload: { email: member.user.email },
  });

  return { removed: true };
}

// ---------------------------------------------------------------------------
// Board columns
// ---------------------------------------------------------------------------
//
// A column is an ordinary `task_status` row, so all of this is CRUD — with two
// pieces of care that are easy to miss and expensive to get wrong:
//
//  * **`category` drives `task.completed_at`**, which is what the burndown and
//    throughput reports read. Re-categorising a column that already holds tasks
//    must re-stamp them, or the reports silently disagree with the board.
//  * **A column cannot be removed while anything references it.** The FK from
//    `task.status_id` has no ON DELETE, so the database would refuse anyway —
//    but a raw FK error is not an explanation, so the caller is asked for a
//    destination and the tasks are moved first.

/** Every column of the project, ordered — the shape both edit paths need. */
async function projectStatuses(projectId: string) {
  return prisma.taskStatus.findMany({
    where: { projectId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      color: true,
      wipLimit: true,
      position: true,
    },
  });
}

export async function createProjectStatus(
  ctx: AuthCtx,
  projectId: string,
  input: z.infer<typeof createStatusSchema>,
) {
  const existing = await projectStatuses(projectId);

  // uq_task_status_name would raise this as a driver error; catching it here
  // means the client gets the contract's 409 and a sentence it can show.
  if (
    existing.some(
      (status) => status.name.toLowerCase() === input.name.trim().toLowerCase(),
    )
  ) {
    throw conflict(`This project already has a column called "${input.name}".`);
  }

  const last = existing.at(-1)?.position ?? null;

  const created = await prisma.taskStatus.create({
    data: {
      projectId,
      name: input.name.trim(),
      category: input.category,
      color: input.color ?? null,
      wipLimit: input.wipLimit ?? null,
      // Appended; reordering is a separate, explicit action.
      position: nextPosition(last),
    },
    select: { id: true, name: true, category: true },
  });

  await recordActivity({
    entityType: "PROJECT",
    entityId: projectId,
    projectId,
    actorId: ctx.userId,
    action: "project.column_created",
    payload: { name: created.name, category: created.category },
  });

  return getProject(projectId);
}

export async function updateProjectStatus(
  ctx: AuthCtx,
  projectId: string,
  statusId: string,
  input: z.infer<typeof updateStatusSchema>,
) {
  const before = await prisma.taskStatus.findFirst({
    where: { id: statusId, projectId },
    select: { id: true, name: true, category: true, color: true, wipLimit: true },
  });
  if (!before) throw notFound("Board column not found");

  if (input.name !== undefined) {
    const clash = await prisma.taskStatus.findFirst({
      where: {
        projectId,
        name: input.name.trim(),
        id: { not: statusId },
      },
      select: { id: true },
    });
    if (clash) {
      throw conflict(
        `This project already has a column called "${input.name}".`,
      );
    }
  }

  const movingIntoDone =
    input.category === "DONE" && before.category !== "DONE";
  const movingOutOfDone =
    input.category !== undefined &&
    input.category !== "DONE" &&
    before.category === "DONE";

  await prisma.$transaction(async (tx) => {
    await tx.taskStatus.update({
      where: { id: statusId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(input.color === undefined ? {} : { color: input.color }),
        ...(input.wipLimit === undefined ? {} : { wipLimit: input.wipLimit }),
      },
    });

    // Re-stamp the tasks sitting in the column, in the same transaction as the
    // category change: a task in a DONE column that is not marked complete (or
    // the reverse) would put the board and every report into disagreement.
    // Soft-deleted rows are left alone — no report reads them.
    if (movingIntoDone) {
      await tx.task.updateMany({
        where: { statusId, deletedAt: null, completedAt: null },
        data: { completedAt: new Date() },
      });
    } else if (movingOutOfDone) {
      await tx.task.updateMany({
        where: { statusId, deletedAt: null },
        data: { completedAt: null },
      });
    }
  });

  await recordActivity({
    entityType: "PROJECT",
    entityId: projectId,
    projectId,
    actorId: ctx.userId,
    action: "project.column_updated",
    payload: { name: before.name, changes: diffPayload(before, input) },
  });

  return getProject(projectId);
}

/**
 * Re-order the whole column list in one call.
 *
 * The client sends the complete new order rather than a single move, so the
 * result cannot depend on which of several in-flight moves lands last. Anything
 * that is not a permutation of this project's columns is refused, which also
 * rejects an id belonging to a different project.
 */
export async function reorderProjectStatuses(
  ctx: AuthCtx,
  projectId: string,
  input: z.infer<typeof reorderStatusesSchema>,
) {
  const existing = await projectStatuses(projectId);

  if (
    !isCompleteReordering(
      existing.map((status) => status.id),
      input.order,
    )
  ) {
    throw badRequest(
      "The new order must list every column of this project exactly once.",
    );
  }

  const positions = rebalancedPositions(input.order.length);

  await prisma.$transaction(async (tx) => {
    for (const [index, id] of input.order.entries()) {
      await tx.taskStatus.update({
        where: { id },
        data: { position: positions[index]! },
      });
    }
  });

  await recordActivity({
    entityType: "PROJECT",
    entityId: projectId,
    projectId,
    actorId: ctx.userId,
    action: "project.columns_reordered",
    payload: {
      order: input.order.map(
        (id) => existing.find((status) => status.id === id)?.name ?? id,
      ),
    },
  });

  return getProject(projectId);
}

/**
 * Remove a column, relocating whatever still points at it.
 *
 * `moveToStatusId` is required whenever any task row references the column —
 * including soft-deleted ones, which still hold the foreign key and would
 * block the delete at the database level.
 */
export async function deleteProjectStatus(
  ctx: AuthCtx,
  projectId: string,
  statusId: string,
  moveToStatusId: string | null,
) {
  const existing = await projectStatuses(projectId);

  const status = existing.find((candidate) => candidate.id === statusId);
  if (!status) throw notFound("Board column not found");

  if (existing.length <= 1) {
    throw badRequest(
      "A project must keep at least one board column — a project with none cannot render a board or accept a task.",
    );
  }

  const [liveCount, totalCount] = await Promise.all([
    prisma.task.count({ where: { statusId, deletedAt: null } }),
    prisma.task.count({ where: { statusId } }),
  ]);

  let target: (typeof existing)[number] | undefined;

  if (totalCount > 0) {
    if (!moveToStatusId) {
      throw badRequest(
        liveCount > 0
          ? `"${status.name}" still holds ${liveCount} task(s). Choose a column to move them to first.`
          : `"${status.name}" is still referenced by deleted tasks. Choose a column to move them to first.`,
      );
    }

    target = existing.find((candidate) => candidate.id === moveToStatusId);
    if (!target || target.id === statusId) {
      throw badRequest(
        "Choose a different column of this project to move the tasks to.",
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    if (target) {
      // Live tasks are appended to the destination in their current order, so
      // the column they land in keeps a sensible sequence.
      const moving = await tx.task.findMany({
        where: { statusId, deletedAt: null },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      const last = await tx.task.findFirst({
        where: { statusId: target.id, deletedAt: null },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      let cursor = last?.position ?? null;
      for (const task of moving) {
        cursor = nextPosition(cursor);
        await tx.task.update({
          where: { id: task.id },
          data: { statusId: target.id, position: cursor },
        });
      }

      // Soft-deleted rows only need the foreign key repointed; their position
      // is meaningless and no report reads them.
      await tx.task.updateMany({
        where: { statusId },
        data: { statusId: target.id },
      });

      // The destination's category decides completion, exactly as a move would.
      // The WIP limit is deliberately NOT enforced here: this is an
      // administrative relocation, and refusing it would make a full column
      // impossible to delete.
      if (target.category === "DONE") {
        await tx.task.updateMany({
          where: {
            id: { in: moving.map((task) => task.id) },
            deletedAt: null,
            completedAt: null,
          },
          data: { completedAt: new Date() },
        });
      } else {
        await tx.task.updateMany({
          where: {
            id: { in: moving.map((task) => task.id) },
            deletedAt: null,
          },
          data: { completedAt: null },
        });
      }
    }

    await tx.taskStatus.delete({ where: { id: statusId } });
  });

  await recordActivity({
    entityType: "PROJECT",
    entityId: projectId,
    projectId,
    actorId: ctx.userId,
    action: "project.column_deleted",
    payload: {
      name: status.name,
      moved_to: target?.name ?? null,
      tasks_moved: liveCount,
    },
  });

  return getProject(projectId);
}
