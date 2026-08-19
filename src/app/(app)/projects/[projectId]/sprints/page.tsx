import { SprintsView } from "@/features/projects/sprints/sprints.view";
import { atLeast } from "@/lib/permissions";
import { requireProjectPage } from "@/server/auth/page-guards";

export const metadata = { title: "Sprints · Inforvio PM" };

export default async function SprintsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectPage(projectId, "VIEW");

  // Creating and closing sprints is a lead/admin action.
  return (
    <SprintsView
      projectId={projectId}
      canManage={atLeast(ctx.access, "MANAGE")}
    />
  );
}
