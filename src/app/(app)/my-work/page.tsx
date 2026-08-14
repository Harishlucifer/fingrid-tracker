import { AtSign, Clock3, ListChecks } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DueDate, PriorityBadge, formatMinutes } from "@/components/task-meta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { requireSession } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "My work · Inforvio PM" };

export default async function MyWorkPage() {
  const ctx = await requireSession();

  const [tasks, mentions, recentTime] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null,
        completedAt: null,
        assigneeId: ctx.userId,
        project: { deletedAt: null },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      select: {
        id: true,
        number: true,
        title: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, key: true, name: true } },
        status: { select: { name: true } },
      },
    }),
    prisma.mention.findMany({
      where: { mentionedUserId: ctx.userId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        comment: {
          select: {
            body: true,
            author: { select: { name: true, email: true, image: true } },
            task: {
              select: {
                id: true,
                number: true,
                title: true,
                project: { select: { key: true } },
              },
            },
          },
        },
      },
    }),
    prisma.timeLog.aggregate({
      where: {
        userId: ctx.userId,
        deletedAt: null,
        spentOn: {
          gte: (() => {
            const date = new Date();
            date.setDate(date.getDate() - 7);
            date.setHours(0, 0, 0, 0);
            return date;
          })(),
        },
      },
      _sum: { minutes: true },
    }),
  ]);

  const loggedMinutes = recentTime._sum.minutes ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="My work"
        description="Your assignments, unread mentions and recent time at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open assignments"
          value={tasks.length}
          icon={ListChecks}
        />
        <StatCard
          label="Unread mentions"
          value={mentions.length}
          icon={AtSign}
          tone={mentions.length > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Logged in 7 days"
          value={formatMinutes(loggedMinutes)}
          icon={Clock3}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-5">
        <Card className="shadow-card rounded-2xl xl:col-span-3">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="bg-accent/10 text-accent flex size-9 items-center justify-center rounded-xl">
                  <ListChecks className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">Assigned to me</h2>
                  <p className="text-muted-foreground text-xs">
                    Ordered by nearest due date
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="tnum">
                {tasks.length}
              </Badge>
            </div>

            {tasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="Nothing assigned to you"
                hint="New assignments will appear here, with the nearest due date first."
                className="py-12"
              />
            ) : (
              <ul className="divide-y">
                {tasks.map((task) => {
                  return (
                    <li
                      key={task.id}
                      className="hover:bg-secondary/35 flex items-start gap-3 px-5 py-3.5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/projects/${task.project.id}/board`}
                            className="text-muted-foreground hover:text-foreground font-mono text-[11px]"
                          >
                            {task.project.key}-{task.number}
                          </Link>
                          <PriorityBadge priority={task.priority} />
                        </div>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="hover:text-accent mt-1 block truncate text-sm font-medium"
                        >
                          {task.title}
                        </Link>
                        <div className="mt-1.5 flex items-center gap-2 sm:hidden">
                          <Badge variant="secondary" className="text-[10px]">
                            {task.status.name}
                          </Badge>
                          <DueDate dueDate={task.dueDate} />
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="hidden shrink-0 text-[10px] sm:inline-flex"
                      >
                        {task.status.name}
                      </Badge>
                      <DueDate
                        dueDate={task.dueDate}
                        className="hidden shrink-0 sm:inline-flex"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card rounded-2xl xl:col-span-2">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="bg-accent/10 text-accent flex size-9 items-center justify-center rounded-xl">
                  <AtSign className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">Unread mentions</h2>
                  <p className="text-muted-foreground text-xs">
                    Conversations that need you
                  </p>
                </div>
              </div>
              {mentions.length > 0 && (
                <Badge variant="secondary" className="tnum">
                  {mentions.length}
                </Badge>
              )}
            </div>

            {mentions.length === 0 ? (
              <EmptyState
                icon={AtSign}
                title="You're all caught up"
                hint="New mentions from task conversations will appear here."
                className="py-12"
              />
            ) : (
              <ul className="divide-y">
                {mentions.map((mention) => (
                  <li
                    key={mention.id}
                    className="hover:bg-secondary/35 flex gap-3 px-5 py-4 transition-colors"
                  >
                    <UserAvatar user={mention.comment.author} size="sm" />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className="font-medium">
                          {mention.comment.author.name ??
                            mention.comment.author.email}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          mentioned you in
                        </span>
                        <Link
                          href={`/tasks/${mention.comment.task.id}`}
                          className="hover:text-accent font-mono text-xs"
                        >
                          {mention.comment.task.project.key}-
                          {mention.comment.task.number}
                        </Link>
                      </div>
                      <p className="text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {mention.comment.body}
                      </p>
                    </div>
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
