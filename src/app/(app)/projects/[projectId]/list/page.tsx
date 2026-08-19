import { TaskListView } from "@/features/projects/task-list/task-list.view";
import { requireProjectPage } from "@/server/auth/page-guards";

export const metadata = { title: "Tasks · Inforvio PM" };

export default async function ProjectListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectPage(projectId, "VIEW");
  return <TaskListView projectId={projectId} />;
}
