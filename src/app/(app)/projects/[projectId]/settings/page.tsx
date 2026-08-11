import { ProjectSettingsView } from "@/features/projects/settings/settings.view";
import { atLeast } from "@/lib/permissions";
import { requireProjectAccess } from "@/server/auth/guards";

export const metadata = { title: "Project settings · Inforvio PM" };

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectAccess(projectId, "VIEW");

  return (
    <ProjectSettingsView
      projectId={projectId}
      canManage={atLeast(ctx.access, "MANAGE")}
    />
  );
}
