import { ReportsView } from "@/features/projects/reports/reports.view";
import { requireProjectPage } from "@/server/auth/page-guards";

export const metadata = { title: "Reports · Inforvio PM" };

export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectPage(projectId, "VIEW");
  return <ReportsView projectId={projectId} />;
}
