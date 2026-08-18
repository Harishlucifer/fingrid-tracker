import { requireTaskAccess } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  setTaskStage,
  setTaskStageSchema,
} from "@/server/services/task.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ taskId: string }> };
type Ctx = Awaited<ReturnType<typeof requireTaskAccess>>;

/**
 * Move a task through the board's gates: on from the backlog, or off it once a
 * lead has signed the work off.
 *
 * Guarded at EDIT, which is the floor — the sign-off transitions additionally
 * require MANAGE, and that check lives in the service because the level depends
 * on the target stage, which a guard cannot see before the body is parsed. Same
 * shape as the comment and time-log routes.
 */
export const PATCH = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "EDIT");
  },
  async (ctx, req) =>
    setTaskStage(ctx, await readJson(req, setTaskStageSchema)),
);
