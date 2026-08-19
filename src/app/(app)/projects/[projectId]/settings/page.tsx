import { ProjectSettingsView } from "@/features/projects/settings/settings.view";
import { atLeast } from "@/lib/permissions";
import { requireProjectPage } from "@/server/auth/page-guards";

export const metadata = { title: "Project settings · Inforvio PM" };

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectPage(projectId, "VIEW");

  return (
    <ProjectSettingsView
      projectId={projectId}
      canManage={atLeast(ctx.access, "MANAGE")}
    />
  );
}
