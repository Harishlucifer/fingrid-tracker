import { requireTaskAccess } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import { parsePagination } from "@/server/http/pagination";
import { listTaskActivity } from "@/server/services/comment.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ taskId: string }> };
type Ctx = Awaited<ReturnType<typeof requireTaskAccess>>;

/**
 * One task's history.
 *
 * Distinct from `/api/v1/activity`, which is the project-wide feed and takes a
 * `project_id`: this one is keyed by task, so the guard is the task's own, and
 * the caller does not have to know the project to ask what happened to a task
 * it can already see.
 */
export const GET = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "VIEW");
  },
  async (ctx, req) =>
    listTaskActivity(ctx, parsePagination(req.nextUrl.searchParams)),
);
