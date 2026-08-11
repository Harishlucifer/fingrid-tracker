import { requireTaskAccess } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  moveTaskCategorySchema,
  moveTaskToCategory,
} from "@/server/services/task.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ taskId: string }> };
type Ctx = Awaited<ReturnType<typeof requireTaskAccess>>;

/**
 * Move a task between status *categories* — what the overall board drags do.
 * The concrete target column is resolved inside the task's own project, so a
 * task never crosses projects.
 */
export const PATCH = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "EDIT");
  },
  async (ctx, req) =>
    moveTaskToCategory(ctx, await readJson(req, moveTaskCategorySchema)),
);
