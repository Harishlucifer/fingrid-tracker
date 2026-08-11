import { ProjectsListView } from "@/features/projects/list/list.view";
import { canCreateProject } from "@/lib/permissions";
import { requireSession } from "@/server/auth/guards";

export const metadata = { title: "Projects · Inforvio PM" };

export default async function ProjectsPage() {
  const ctx = await requireSession();
  return <ProjectsListView canCreate={canCreateProject(ctx.role)} />;
}
