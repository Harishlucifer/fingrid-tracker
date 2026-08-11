import Link from "next/link";

import { requireProjectAccess } from "@/server/auth/guards";
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
  const ctx = await requireProjectAccess(projectId, "VIEW");
  const project = await getProject(projectId);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Projects
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-muted-foreground font-mono text-sm">
            {project.key}
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                {project.description}
              </p>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Your access: <strong className="text-foreground">{ctx.access}</strong>
          </p>
        </div>

        <ProjectTabs projectId={projectId} />
      </header>

      {children}
    </div>
  );
}
