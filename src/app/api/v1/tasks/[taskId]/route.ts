import { requireTaskAccess } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import { flushNotificationsAfterResponse } from "@/server/notifications/after-response";
import {
  deleteTask,
  getTask,
  updateTask,
  updateTaskSchema,
} from "@/server/services/task.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ taskId: string }> };
type Ctx = Awaited<ReturnType<typeof requireTaskAccess>>;

export const GET = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "VIEW");
  },
  async (ctx) => getTask(ctx.taskId),
);

export const PATCH = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "EDIT");
  },
  async (ctx, req) => {
    const result = await updateTask(ctx, await readJson(req, updateTaskSchema));
    // A reassignment may have queued an email; send it once the response is out.
    flushNotificationsAfterResponse();
    return result;
  },
);

export const DELETE = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "EDIT");
  },
  async (ctx) => deleteTask(ctx),
);
