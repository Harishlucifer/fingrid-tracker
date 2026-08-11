import {
  AlertTriangle,
  AtSign,
  Clock,
  FolderKanban,
  ListChecks,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DueDate, PriorityBadge, formatMinutes } from "@/components/task-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { requireSession } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Dashboard · Inforvio PM" };

/**
 * Rendered on the server: a read-only summary with no interactivity, so fetching
 * through client query hooks would add a round trip for nothing.
 */
export default async function DashboardPage() {
  const ctx = await requireSession();

  const projectScope =
    ctx.role === "ADMIN"
      ? { deletedAt: null }
      : { deletedAt: null, members: { some: { userId: ctx.userId } } };

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const [projects, myOpenTasks, overdue, unreadMentions, loggedThisWeek] =
    await Promise.all([
      prisma.project.count({ where: projectScope }),
      prisma.task.count({
        where: {
          deletedAt: null,
          completedAt: null,
          assigneeId: ctx.userId,
          project: { deletedAt: null },
        },
      }),
      prisma.task.count({
        where: {
          deletedAt: null,
          completedAt: null,
          assigneeId: ctx.userId,
          dueDate: { lt: new Date() },
          project: { deletedAt: null },
        },
      }),
      prisma.mention.count({
        where: { mentionedUserId: ctx.userId, readAt: null },
      }),
      prisma.timeLog.aggregate({
        where: { userId: ctx.userId, deletedAt: null, spentOn: { gte: weekAgo } },
        _sum: { minutes: true },
      }),
    ]);

  const [assigned, recentProjects] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null,
        completedAt: null,
        assigneeId: ctx.userId,
        project: { deletedAt: null },
      },
      // Overdue and soonest-due first; tasks with no due date fall to the end.
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        number: true,
        title: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        project: { select: { id: true, key: true } },
        status: { select: { name: true } },
      },
    }),
    prisma.project.findMany({
      where: projectScope,
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        key: true,
        name: true,
        members: {
          take: 5,
          select: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  const firstName = ctx.name?.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        description="Your open work, mentions and recent projects."
        actions={
          <Button asChild variant="outline">
            <Link href="/timesheet">
              <Clock className="size-4" />
              Timesheet
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My open tasks"
          value={myOpenTasks}
          icon={ListChecks}
          href="/my-work"
        />
        <StatCard
          label="Overdue"
          value={overdue}
          icon={AlertTriangle}
          href="/my-work"
          tone="danger"
        />
        <StatCard
          label="Unread mentions"
          value={unreadMentions}
          icon={AtSign}
          href="/my-work"
        />
        <StatCard
          label="Logged this week"
          value={formatMinutes(loggedThisWeek._sum.minutes ?? 0)}
          icon={Clock}
          href="/timesheet"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Assigned to you</h2>
              <Link
                href="/my-work"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                View all
              </Link>
            </div>

            {assigned.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="Nothing assigned to you"
                hint="Tasks assigned to you will appear here, soonest due first."
              />
            ) : (
              <ul className="divide-y">
                {assigned.map((task) => (
                  <li
                    key={task.id}
                    className="hover:bg-secondary/40 flex items-center gap-3 px-4 py-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {task.project.key}-{task.number}
                        </span>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="hover:text-accent mt-1 block truncate text-sm font-medium"
                      >
                        {task.title}
                      </Link>
                    </div>

                    <Badge
                      variant="secondary"
                      className="hidden shrink-0 text-[10px] sm:inline-flex"
                    >
                      {task.status.name}
                    </Badge>
                    <DueDate
                      dueDate={task.dueDate}
                      completedAt={task.completedAt}
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Projects</h2>
              <Link
                href="/projects"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                All {projects}
              </Link>
            </div>

            {recentProjects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                hint="Create a project to get a board, a backlog and reports."
              />
            ) : (
              <ul className="divide-y">
                {recentProjects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}/board`}
                      className="hover:bg-secondary/40 flex items-center gap-3 px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground font-mono text-[11px]">
                          {project.key}
                        </p>
                        <p className="truncate text-sm font-medium">
                          {project.name}
                        </p>
                        <p className="text-muted-foreground tnum mt-0.5 text-xs">
                          {project._count.tasks} task(s)
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        {project.members.slice(0, 3).map((member, index) => (
                          <UserAvatar
                            key={member.user.id}
                            user={member.user}
                            size="xs"
                            className={
                              index === 0 ? "ring-card ring-2" : "ring-card -ml-1.5 ring-2"
                            }
                          />
                        ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
