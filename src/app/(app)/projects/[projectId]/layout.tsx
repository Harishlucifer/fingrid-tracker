import Link from "next/link";

import { requireProjectPage } from "@/server/auth/page-guards";
import { getProject } from "@/server/services/project.service";

import { ProjectTabs } from "./project-tabs";

/**
 * Project shell. The guard here covers every nested route — board, list,
 * sprints, reports and settings all inherit the access check rather than each
 * repeating it.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectPage(projectId, "VIEW");
  const project = await getProject(projectId);

  return (
    <div className="space-y-5">
      <header className="bg-card shadow-card space-y-4 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-accent text-xs font-medium transition-colors"
          >
            Projects
          </Link>
          <span className="text-muted-foreground/60 text-xs">/</span>
          <span className="bg-secondary text-muted-foreground rounded-md px-2 py-0.5 font-mono text-[11px]">
            {project.key}
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
                {project.description}
              </p>
            )}
          </div>
          <p className="bg-secondary/70 text-muted-foreground rounded-full px-3 py-1.5 text-xs">
            Your access ·{" "}
            <strong className="text-foreground font-semibold">
              {ctx.access}
            </strong>
          </p>
        </div>

        <ProjectTabs projectId={projectId} />
      </header>

      {children}
    </div>
  );
}
