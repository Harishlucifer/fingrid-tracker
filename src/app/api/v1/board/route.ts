import { requireSession } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import { getOverallBoard } from "@/server/services/task.service";

export const runtime = "nodejs";

/**
 * The overall (cross-project) board, grouped by status category.
 *
 * Scoped inside the service to projects the caller can see, so there is no
 * project guard here — but a `project_id` filter naming a project they cannot
 * reach 404s rather than silently widening.
 */
export const GET = withApiHandler(
  () => requireSession(),
  async (ctx, req) => {
    const params = req.nextUrl.searchParams;
    return getOverallBoard(ctx, {
      projectId: params.get("project_id") ?? undefined,
      assigneeId: params.get("assignee_id") ?? undefined,
      mineOnly: params.get("mine") === "true",
    });
  },
);
