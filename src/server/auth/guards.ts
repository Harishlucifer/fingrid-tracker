/**
 * Server-side authorization guards.
 *
 * Every route handler and every server component under `(app)/` calls one of
 * these. There is deliberately no "unguarded by default" path: `withApiHandler`
 * takes a guard as its first argument, so writing a handler without one is not
 * expressible.
 *
 * These re-read the session (and therefore the user's role and isActive) from
 * the database on every call. That is the point of the database session
 * strategy — see the note in `config.ts`.
 */

import { cache } from "react";

import type { NextRequest } from "next/server";

import { ErrorCodes } from "@/server/http/codes";
import {
  AppError,
  forbidden,
  notFound,
  unauthorized,
} from "@/server/http/errors";
import { prisma } from "@/server/db/prisma";
import {
  atLeast,
  canManageOrgSettings,
  effectiveProjectAccess,
  type AccessLevel,
} from "@/lib/permissions";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { env } from "@/lib/env";
import type { OrgRole } from "@/lib/constants";

import { auth } from "./config";

export type AuthCtx = {
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
};

export type ProjectAuthCtx = AuthCtx & {
  projectId: string;
  access: AccessLevel;
};

/**
 * The session read, deduplicated for the duration of ONE request.
 *
 * `auth()` is a database round-trip, and a single page render makes several
 * calls that all want the same answer — `(app)/layout.tsx` and the page below it
 * at minimum. React's `cache` collapses those into one query per request. It
 * does NOT cache across requests, so the revocation guarantee of the database
 * session strategy is untouched: the next request reads the row again, and a
 * deleted session is still refused immediately.
 */
export const getSession = cache(async () => auth());

/**
 * Require a valid session. Throws `AppError(401, AUTH_001)`.
 *
 * Also re-checks `isActive`: a user deactivated mid-session must not continue on
 * an existing session row.
 */
export async function requireSession(): Promise<AuthCtx> {
  const session = await getSession();

  if (!session?.user?.id) throw unauthorized();

  if (!session.user.isActive) {
    throw forbidden(
      "Your account has been deactivated.",
      ErrorCodes.AUTH_ACCOUNT_DISABLED,
    );
  }

  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    role: session.user.role as OrgRole,
  };
}

/** Require one of the given org roles. Throws `AppError(403, AUTH_003)`. */
export async function requireRole(...roles: OrgRole[]): Promise<AuthCtx> {
  const ctx = await requireSession();
  if (!roles.includes(ctx.role)) {
    throw forbidden(
      `This action requires the ${roles.join(" or ")} role.`,
    );
  }
  return ctx;
}

/** Require org ADMIN — the allowlist and member-management screens. */
export async function requireAdmin(): Promise<AuthCtx> {
  const ctx = await requireSession();
  if (!canManageOrgSettings(ctx.role)) {
    throw forbidden("This action requires the ADMIN role.");
  }
  return ctx;
}

/**
 * Require a level of access to one project, resolving org role ∩ project role.
 *
 * A project the caller cannot even VIEW is reported as 404, not 403 — a 403
 * would confirm the project exists to someone with no access to it.
 */
export async function requireProjectAccess(
  projectId: string,
  required: AccessLevel = "VIEW",
): Promise<ProjectAuthCtx> {
  const ctx = await requireSession();

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      members: {
        where: { userId: ctx.userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!project) throw notFound("Project not found");

  const access = effectiveProjectAccess(ctx.role, project.members[0]?.role);

  if (access === "NONE") throw notFound("Project not found");

  if (!atLeast(access, required)) {
    throw forbidden(
      "You do not have permission to do that in this project.",
      ErrorCodes.AUTH_NO_PROJECT_ACCESS,
    );
  }

  return { ...ctx, projectId: project.id, access };
}

/**
 * Resolve project access from a task id, for the many endpoints keyed by task.
 * Returns the task's project context plus the task's own id.
 */
export async function requireTaskAccess(
  taskId: string,
  required: AccessLevel = "VIEW",
): Promise<ProjectAuthCtx & { taskId: string }> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, projectId: true },
  });

  if (!task) throw notFound("Task not found");

  const ctx = await requireProjectAccess(task.projectId, required);
  return { ...ctx, taskId: task.id };
}

/**
 * Require the scheduled-job shared secret. Throws `AppError(401, AUTH_006)`.
 *
 * The one guard here that does not read a session, because a scheduler calls
 * from outside any browser and has no cookie to present. It deliberately
 * returns no `AuthCtx`: a scheduled job acts as nobody, so nothing it invokes
 * may attribute work to a user or widen its reach through one.
 *
 * It lives in this file anyway, so that "every route handler takes a guard from
 * guards.ts" stays literally true and this exception is visible next to the
 * rules it is an exception to.
 */
export async function requireCronSecret(req: NextRequest): Promise<void> {
  if (
    !isAuthorizedCronRequest(req.headers.get("authorization"), env.cronSecret)
  ) {
    throw new AppError(
      401,
      ErrorCodes.AUTH_INVALID_CRON_SECRET,
      "Invalid or missing scheduled-job credentials",
    );
  }
}
