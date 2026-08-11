import { OverallBoardView } from "@/features/board/overall-board.view";
import { canCreateProject } from "@/lib/permissions";
import { requireSession } from "@/server/auth/guards";

export const metadata = { title: "Board · Inforvio PM" };

/**
 * Cross-project board. Per-task authorization still happens on every move — the
 * `canEdit` flag here only decides whether cards are draggable at all, so an org
 * VIEWER gets a read-only board.
 */
export default async function OverallBoardPage() {
  const ctx = await requireSession();
  return (
    <OverallBoardView
      canEdit={canCreateProject(ctx.role)}
      currentUserId={ctx.userId}
    />
  );
}
