import { requireTaskAccess } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import { moveTask, moveTaskSchema } from "@/server/services/task.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ taskId: string }> };
type Ctx = Awaited<ReturnType<typeof requireTaskAccess>>;

/** Drag-and-drop target. Called on every drop, so it stays a single query path. */
export const PATCH = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "EDIT");
  },
  async (ctx, req) => moveTask(ctx, await readJson(req, moveTaskSchema)),
);
