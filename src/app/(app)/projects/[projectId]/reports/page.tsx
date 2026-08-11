import { ReportsView } from "@/features/projects/reports/reports.view";
import { requireProjectAccess } from "@/server/auth/guards";

export const metadata = { title: "Reports · Inforvio PM" };

export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectAccess(projectId, "VIEW");
  return <ReportsView projectId={projectId} />;
}
