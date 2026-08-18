import { requireSession } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  deleteTimeLog,
  updateTimeLog,
  updateTimeLogSchema,
} from "@/server/services/sprint.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ timeLogId: string }> };
type Ctx = Awaited<ReturnType<typeof requireSession>>;

/**
 * Authorization lives in the service for both verbs here, because it turns on
 * who logged the entry rather than on project access alone — the same reason
 * the comment routes are shaped this way.
 */
export const PATCH = withApiHandler<Ctx, unknown, RouteArgs>(
  () => requireSession(),
  async (ctx, req, args) => {
    const { timeLogId } = await args.params;
    return updateTimeLog(ctx, timeLogId, await readJson(req, updateTimeLogSchema));
  },
);

export const DELETE = withApiHandler<Ctx, unknown, RouteArgs>(
  () => requireSession(),
  async (ctx, _req, args) => {
    const { timeLogId } = await args.params;
    return deleteTimeLog(ctx, timeLogId);
  },
);
