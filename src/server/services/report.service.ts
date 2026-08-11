/**
 * Reporting aggregations.
 *
 * Aggregated in the database rather than by pulling rows into Node — MySQL does
 * this far better, and the alternative would fetch a whole project's task table
 * on every dashboard render.
 *
 * Burndown is derived from `task.completed_at` rather than from a nightly
 * snapshot table. That keeps the schema smaller and is exact for the common
 * case; the tradeoff is that re-opening a completed task rewrites history rather
 * than showing the spike. If audit-exact history is ever needed, add a
 * `sprint_snapshot` row per day and read that instead.
 */

import { prisma } from "@/server/db/prisma";
import { notFound } from "@/server/http/errors";

/** Tasks completed per ISO week over the last N weeks. */
export async function getThroughput(projectId: string, weeks = 12) {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      completedAt: { gte: since },
    },
    select: { completedAt: true, estimateMin: true },
  });

  // Bucket by week start (Monday) in app code: the row count here is bounded by
  // "tasks completed in 12 weeks", which is small.
  const buckets = new Map<string, { count: number; minutes: number }>();

  for (let index = 0; index < weeks; index += 1) {
    const day = new Date(since);
    day.setDate(since.getDate() + index * 7);
    buckets.set(weekKey(day), { count: 0, minutes: 0 });
  }

  for (const row of rows) {
    if (!row.completedAt) continue;
    const key = weekKey(row.completedAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.minutes += row.estimateMin ?? 0;
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, value]) => ({
      week,
      completed: value.count,
      estimated_minutes: value.minutes,
    }));
}

/** Open task and estimate load per assignee. */
export async function getWorkload(projectId: string) {
  const [grouped, members] = await Promise.all([
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { projectId, deletedAt: null, completedAt: null },
      _count: { _all: true },
      _sum: { estimateMin: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
  ]);

  const byAssignee = new Map(grouped.map((row) => [row.assigneeId, row]));

  const rows = members.map((member) => {
    const stats = byAssignee.get(member.user.id);
    return {
      user: member.user,
      open_tasks: stats?._count._all ?? 0,
      estimated_minutes: stats?._sum.estimateMin ?? 0,
    };
  });

  // Unassigned work is real work — surface it rather than dropping it.
  const unassigned = byAssignee.get(null);
  if (unassigned && unassigned._count._all > 0) {
    rows.push({
      user: { id: "unassigned", name: "Unassigned", email: "", image: null },
      open_tasks: unassigned._count._all,
      estimated_minutes: unassigned._sum.estimateMin ?? 0,
    });
  }

  return rows.sort((a, b) => b.open_tasks - a.open_tasks);
}

/**
 * Sprint burndown: remaining estimated minutes at the end of each sprint day,
 * against an ideal straight line.
 */
export async function getBurndown(projectId: string, sprintId: string) {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId, deletedAt: null },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  if (!sprint) throw notFound("Sprint not found");

  const tasks = await prisma.task.findMany({
    where: { sprintId, deletedAt: null },
    select: { estimateMin: true, completedAt: true },
  });

  // Tasks with no estimate still count as work; give them a nominal weight so
  // they are visible on the chart rather than invisible zero-height bars.
  const NOMINAL_MINUTES = 60;
  const weighted = tasks.map((task) => ({
    minutes: task.estimateMin ?? NOMINAL_MINUTES,
    completedAt: task.completedAt,
  }));

  const totalMinutes = weighted.reduce((sum, task) => sum + task.minutes, 0);

  const days = eachDay(sprint.startDate, sprint.endDate);
  const lastIndex = Math.max(days.length - 1, 1);

  const now = new Date();

  const series = days.map((day, index) => {
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const isFuture = endOfDay > now;

    const burned = weighted
      .filter((task) => task.completedAt && task.completedAt <= endOfDay)
      .reduce((sum, task) => sum + task.minutes, 0);

    return {
      date: day.toISOString().slice(0, 10),
      /**
       * Null for days that have not happened yet, so the chart's
       * `connectNulls={false}` genuinely stops the actual line at today.
       * Emitting a number here would draw a flat tail to the sprint end and
       * read as "no work remaining changes", overstating progress.
       */
      remaining_minutes: isFuture ? null : totalMinutes - burned,
      // The ideal line spans the whole sprint by definition — it is a plan, not
      // an observation, so it is drawn for future days too.
      ideal_minutes: Math.round(
        totalMinutes - (totalMinutes * index) / lastIndex,
      ),
      is_future: isFuture,
    };
  });

  return {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      start_date: sprint.startDate.toISOString().slice(0, 10),
      end_date: sprint.endDate.toISOString().slice(0, 10),
    },
    total_minutes: totalMinutes,
    task_count: tasks.length,
    series,
  };
}

/** Headline counts for the project reports page. */
export async function getProjectSummary(projectId: string) {
  const [statuses, priorities, totals, timeSum] = await Promise.all([
    prisma.task.groupBy({
      by: ["statusId"],
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["priority"],
      where: { projectId, deletedAt: null, completedAt: null },
      _count: { _all: true },
    }),
    prisma.task.aggregate({
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.timeLog.aggregate({
      where: { deletedAt: null, task: { projectId, deletedAt: null } },
      _sum: { minutes: true },
    }),
  ]);

  const [openCount, overdueCount, columns] = await Promise.all([
    prisma.task.count({
      where: { projectId, deletedAt: null, completedAt: null },
    }),
    prisma.task.count({
      where: {
        projectId,
        deletedAt: null,
        completedAt: null,
        dueDate: { lt: new Date() },
      },
    }),
    prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, category: true, color: true },
    }),
  ]);

  const countByStatus = new Map(
    statuses.map((row) => [row.statusId, row._count._all]),
  );

  return {
    total_tasks: totals._count._all,
    open_tasks: openCount,
    completed_tasks: totals._count._all - openCount,
    overdue_tasks: overdueCount,
    logged_minutes: timeSum._sum.minutes ?? 0,
    by_status: columns.map((column) => ({
      id: column.id,
      name: column.name,
      category: column.category,
      color: column.color,
      count: countByStatus.get(column.id) ?? 0,
    })),
    by_priority: priorities.map((row) => ({
      priority: row.priority,
      count: row._count._all,
    })),
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** ISO-ish week key, "YYYY-MM-DD" of the Monday starting that week. */
function weekKey(date: Date): string {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  // getDay(): 0 = Sunday. Shift so Monday starts the week.
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday.toISOString().slice(0, 10);
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  // Guard against an inverted or absurd range producing an unbounded loop.
  let guard = 0;
  while (cursor <= end && guard < 400) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return days;
}
