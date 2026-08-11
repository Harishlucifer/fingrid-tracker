import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            author: { select: { name: true, email: true } },
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
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My work</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {tasks.length} open task(s) · {formatMinutes(loggedMinutes)} logged in
          the last 7 days
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned to me</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing assigned to you.
            </p>
          ) : (
            <ul className="divide-y">
              {tasks.map((task) => {
                const overdue = task.dueDate !== null && task.dueDate < new Date();
                return (
                  <li key={task.id} className="flex items-center gap-3 py-2.5">
                    <Link
                      href={`/projects/${task.project.id}/board`}
                      className="text-muted-foreground hover:text-foreground w-20 shrink-0 font-mono text-xs"
                    >
                      {task.project.key}-{task.number}
                    </Link>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="hover:text-accent min-w-0 flex-1 truncate text-sm"
                    >
                      {task.title}
                    </Link>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {task.status.name}
                    </Badge>
                    {task.dueDate && (
                      <span
                        className={
                          overdue
                            ? "text-danger shrink-0 text-xs font-medium"
                            : "text-muted-foreground shrink-0 text-xs"
                        }
                      >
                        {task.dueDate.toLocaleDateString()}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Unread mentions {mentions.length > 0 && `(${mentions.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mentions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No unread mentions.</p>
          ) : (
            <ul className="space-y-3">
              {mentions.map((mention) => (
                <li key={mention.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {mention.comment.author.name ?? mention.comment.author.email}
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
                  <p className="text-muted-foreground mt-1 line-clamp-2">
                    {mention.comment.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (!minutes) return "0h";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
