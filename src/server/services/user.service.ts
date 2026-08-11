/**
 * Org member administration: role changes, deactivation, session revocation.
 */

import { z } from "zod";

import { orgRoleSchema } from "@/lib/constants";
import { prisma } from "@/server/db/prisma";
import { badRequest, notFound } from "@/server/http/errors";
import { buildMeta, type Pagination } from "@/server/http/pagination";

import { recordActivity } from "./activity.service";

export const updateUserSchema = z.object({
  role: orgRoleSchema.optional(),
  isActive: z.boolean().optional(),
  /** Delete this user's sessions, forcing an immediate re-authentication. */
  revokeSessions: z.boolean().optional(),
});

export type UserDto = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  is_active: boolean;
  active_sessions: number;
  last_login_at: string | null;
  created_at: string;
};

export async function listUsers(pagination: Pagination, search?: string) {
  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { email: { contains: search.toLowerCase() } },
            { name: { contains: search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { email: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: rows.map<UserDto>((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      image: row.image,
      role: row.role,
      is_active: row.isActive,
      active_sessions: row._count.sessions,
      last_login_at: row.lastLoginAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
    })),
    meta: buildMeta(total, pagination),
  };
}

export async function updateUser(
  actorId: string,
  userId: string,
  input: z.infer<typeof updateUserSchema>,
) {
  const target = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, email: true, role: true, isActive: true },
  });
  if (!target) throw notFound("User not found");

  // Guard against an admin locking the org out of its own settings. Both a
  // demotion and a deactivation can remove the last admin.
  const losesAdmin =
    target.role === "ADMIN" &&
    ((input.role !== undefined && input.role !== "ADMIN") ||
      input.isActive === false);

  if (losesAdmin) {
    const otherAdmins = await prisma.user.count({
      where: {
        role: "ADMIN",
        isActive: true,
        deletedAt: null,
        id: { not: userId },
      },
    });
    if (otherAdmins === 0) {
      throw badRequest(
        "This is the only active admin. Promote another admin first.",
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    },
    select: { id: true, email: true, role: true, isActive: true },
  });

  // Deactivation must cut access now, not at session expiry. An explicit
  // revokeSessions does the same thing without changing the role.
  let revokedSessions = 0;
  if (input.isActive === false || input.revokeSessions) {
    const result = await prisma.session.deleteMany({ where: { userId } });
    revokedSessions = result.count;
  }

  await recordActivity({
    entityType: "USER",
    entityId: userId,
    actorId,
    action:
      input.isActive === false
        ? "user.deactivated"
        : input.role !== undefined && input.role !== target.role
          ? "user.role_changed"
          : "user.updated",
    payload: {
      email: updated.email,
      from: { role: target.role, isActive: target.isActive },
      to: { role: updated.role, isActive: updated.isActive },
      revokedSessions,
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    role: updated.role,
    is_active: updated.isActive,
    revoked_sessions: revokedSessions,
  };
}

/** Members eligible to be added to a project / @mentioned. */
export async function listAssignableUsers() {
  const rows = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, image: true, role: true },
  });
  return rows;
}
