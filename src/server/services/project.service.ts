/**
 * Projects, their members, and their board columns.
 */

import { z } from "zod";

import {
  DEFAULT_TASK_STATUSES,
  projectRoleSchema,
  projectStatusSchema,
} from "@/lib/constants";
import { BOARD_POSITION_GAP } from "@/lib/constants";
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
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: projectRoleSchema.default("MEMBER"),
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
    created_at: project.createdAt.toISOString(),
    owner: project.owner,
    statuses: project.statuses.map((status) => ({
      id: status.id,
      name: status.name,
      category: status.category,
      position: status.position,
      color: status.color,
      wip_limit: status.wipLimit,
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
