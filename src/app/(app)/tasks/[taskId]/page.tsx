import { TaskDetailView } from "@/features/tasks/detail/detail.view";
import { atLeast } from "@/lib/permissions";
import { requireTaskAccess } from "@/server/auth/guards";

export const metadata = { title: "Task · Inforvio PM" };

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  // Resolves the task's project and checks access to it; a task in a project the
  // caller cannot see 404s rather than 403s.
  const ctx = await requireTaskAccess(taskId, "VIEW");

  return (
    <TaskDetailView
      taskId={taskId}
      canEdit={atLeast(ctx.access, "EDIT")}
      // Signing work off is a project-shaping act, on the same footing as
      // managing sprints or board columns — see stageTransition.
      canManage={atLeast(ctx.access, "MANAGE")}
      currentUserId={ctx.userId}
    />
  );
}
