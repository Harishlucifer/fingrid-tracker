import { requireProjectAccess } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  signOffDone,
  signOffDoneSchema,
} from "@/server/services/task.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string }> };
type Ctx = Awaited<ReturnType<typeof requireProjectAccess>>;

/**
 * Sign off everything in the project's Done columns at once.
 *
 * MANAGE here rather than in the service, unlike the per-task
 * `…/tasks/:id/stage`: there is no cheaper transition hiding in this endpoint,
 * so the requirement does not depend on the body and the guard can state it.
 */
export const POST = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, req) => signOffDone(ctx, await readJson(req, signOffDoneSchema)),
);
