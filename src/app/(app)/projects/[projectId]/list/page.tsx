import { TaskListView } from "@/features/projects/task-list/task-list.view";
import { requireProjectAccess } from "@/server/auth/guards";

export const metadata = { title: "Tasks · Inforvio PM" };

export default async function ProjectListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectAccess(projectId, "VIEW");
  return <TaskListView projectId={projectId} />;
}
