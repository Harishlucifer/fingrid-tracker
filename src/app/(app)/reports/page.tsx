import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Reports · Inforvio PM" };

/**
 * Reports are per-project (burndown needs one sprint, workload one team), so
 * this page is a chooser rather than an aggregate — an org-wide burndown across
 * unrelated projects would not mean anything.
 */
export default async function ReportsIndexPage() {
  const ctx = await requireSession();

  const projects = await prisma.project.findMany({
    where:
      ctx.role === "ADMIN"
        ? { deletedAt: null }
        : { deletedAt: null, members: { some: { userId: ctx.userId } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      _count: { select: { tasks: { where: { deletedAt: null } } } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose a project to see its burndown, throughput and workload.
        </p>
      </header>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-16 text-center text-sm">
            No projects to report on yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}/reports`}>
              <Card className="hover:border-accent/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="text-muted-foreground font-mono text-xs">
                      {project.key}
                    </p>
                    <p className="truncate text-sm font-medium">{project.name}</p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {project._count.tasks} tasks
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
