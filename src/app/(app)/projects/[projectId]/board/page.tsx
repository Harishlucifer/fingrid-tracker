import { BoardView } from "@/features/projects/board/board.view";
import { atLeast } from "@/lib/permissions";
import { requireProjectAccess } from "@/server/auth/guards";

export const metadata = { title: "Board · Inforvio PM" };

export default async function BoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectAccess(projectId, "VIEW");

  // Dragging and task creation are EDIT-level; a VIEWER gets a read-only board.
  // Signing work off is MANAGE, alongside sprints and column management.
  return (
    <BoardView
      projectId={projectId}
      canEdit={atLeast(ctx.access, "EDIT")}
      canManage={atLeast(ctx.access, "MANAGE")}
    />
  );
}
