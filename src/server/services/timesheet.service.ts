/**
 * Monthly, resource-wise timesheet.
 *
 * "Resource-wise" means one row per person, one column per day of the month —
 * the utilisation view a lead uses to see who logged what. It is a different
 * question from the personal weekly sheet in `sprint.service.ts`, which answers
 * "what did *I* do".
 *
 * Aggregated with a `groupBy` rather than by pulling every row into Node: the
 * matrix is (people × days) which is small, but the underlying `time_log` rows
 * for a whole month are not.
 */

import { z } from "zod";

import { resolveMonth } from "@/lib/month";
import type { AuthCtx } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { forbidden } from "@/server/http/errors";

/** `YYYY-MM`. Date maths lives in `@/lib/month` so it is unit-testable. */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a YYYY-MM month, e.g. 2026-08");

export type ResourceTimesheet = {
  month: string;
  days: string[];
  rows: {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      role: string;
      is_active: boolean;
    };
    by_day: Record<string, number>;
    by_project: { id: string; key: string; name: string; minutes: number }[];
    total_minutes: number;
    days_logged: number;
  }[];
  day_totals: Record<string, number>;
  total_minutes: number;
  /** Set when the roster was capped — the UI must say so rather than imply completeness. */
  truncated_users: number;
};

const USER_CAP = 200;

/**
 * @param scopeToSelf when true the caller only ever sees their own row. Enforced
 *        here rather than trusted from the route, so a new caller cannot forget.
 */
export async function getResourceTimesheet(
  ctx: AuthCtx,
  month: string,
  options: { projectId?: string } = {},
): Promise<ResourceTimesheet> {
  const scopeToSelf = ctx.role !== "ADMIN";
  const range = resolveMonth(month);

  if (options.projectId && scopeToSelf) {
    // Non-admins have no cross-person view to filter, so a project filter here
    // would only be a way to probe other people's rows.
    throw forbidden("Only admins can filter the resource timesheet by project.");
  }

  const timeWhere = {
    deletedAt: null,
    spentOn: { gte: range.from, lte: range.to },
    ...(scopeToSelf ? { userId: ctx.userId } : {}),
    ...(options.projectId
      ? { task: { projectId: options.projectId, deletedAt: null } }
      : {}),
  };

  // Two grouped queries: one for the day matrix, one for the project split.
  const [byUserDay, byUserProject] = await Promise.all([
    prisma.timeLog.groupBy({
      by: ["userId", "spentOn"],
      where: timeWhere,
      _sum: { minutes: true },
    }),
    prisma.timeLog.findMany({
      where: timeWhere,
      select: {
        userId: true,
        minutes: true,
        task: {
          select: {
            project: { select: { id: true, key: true, name: true } },
          },
        },
      },
    }),
  ]);

  const userIdsWithTime = new Set(byUserDay.map((row) => row.userId));

  // The roster: for an admin, every active user — a zero row is the point of a
  // utilisation view. For everyone else, just themselves.
  const roster = await prisma.user.findMany({
    where: scopeToSelf
      ? { id: ctx.userId }
      : {
          deletedAt: null,
          OR: [{ isActive: true }, { id: { in: [...userIdsWithTime] } }],
        },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
    take: USER_CAP,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isActive: true,
    },
  });

  const totalCandidates = scopeToSelf
    ? 1
    : await prisma.user.count({
        where: {
          deletedAt: null,
          OR: [{ isActive: true }, { id: { in: [...userIdsWithTime] } }],
        },
      });

  const rowByUser = new Map<string, ResourceTimesheet["rows"][number]>();
  for (const user of roster) {
    rowByUser.set(user.id, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        is_active: user.isActive,
      },
      by_day: Object.fromEntries(range.days.map((day) => [day, 0])),
      by_project: [],
      total_minutes: 0,
      days_logged: 0,
    });
  }

  const dayTotals: Record<string, number> = Object.fromEntries(
    range.days.map((day) => [day, 0]),
  );

  for (const entry of byUserDay) {
    const row = rowByUser.get(entry.userId);
    if (!row) continue; // outside the capped roster

    const day = entry.spentOn.toISOString().slice(0, 10);
    const minutes = entry._sum.minutes ?? 0;
    if (!(day in row.by_day)) continue;

    row.by_day[day] = minutes;
    row.total_minutes += minutes;
    if (minutes > 0) row.days_logged += 1;
    dayTotals[day] = (dayTotals[day] ?? 0) + minutes;
  }

  // Project split per user, summed in app code — the rows here are already
  // filtered to one month.
  const projectAcc = new Map<string, Map<string, { key: string; name: string; minutes: number }>>();
  for (const entry of byUserProject) {
    if (!rowByUser.has(entry.userId)) continue;
    const project = entry.task.project;

    let perUser = projectAcc.get(entry.userId);
    if (!perUser) {
      perUser = new Map();
      projectAcc.set(entry.userId, perUser);
    }

    const existing = perUser.get(project.id);
    if (existing) {
      existing.minutes += entry.minutes;
    } else {
      perUser.set(project.id, {
        key: project.key,
        name: project.name,
        minutes: entry.minutes,
      });
    }
  }

  for (const [userId, projects] of projectAcc) {
    const row = rowByUser.get(userId);
    if (!row) continue;
    row.by_project = [...projects.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  const rows = [...rowByUser.values()].sort(
    (a, b) =>
      b.total_minutes - a.total_minutes ||
      (a.user.name ?? a.user.email).localeCompare(b.user.name ?? b.user.email),
  );

  return {
    month: range.month,
    days: range.days,
    rows,
    day_totals: dayTotals,
    total_minutes: Object.values(dayTotals).reduce((sum, n) => sum + n, 0),
    truncated_users: Math.max(0, totalCandidates - roster.length),
  };
}
