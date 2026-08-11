import { requireTaskAccess } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  createTimeLog,
  createTimeLogSchema,
  listTimeLogs,
} from "@/server/services/sprint.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ taskId: string }> };
type Ctx = Awaited<ReturnType<typeof requireTaskAccess>>;

export const GET = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "VIEW");
  },
  async (ctx) => listTimeLogs(ctx.taskId),
);

export const POST = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "EDIT");
  },
  async (ctx, req) => createTimeLog(ctx, await readJson(req, createTimeLogSchema)),
  { successStatus: 201 },
);
