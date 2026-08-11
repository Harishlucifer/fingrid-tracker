import { requireProjectAccess, requireSession } from "@/server/auth/guards";
import { badRequest } from "@/server/http/errors";
import { readJson, withApiHandler } from "@/server/http/handler";
import { flushNotificationsAfterResponse } from "@/server/notifications/after-response";
import { parsePagination } from "@/server/http/pagination";
import {
  createTask,
  createTaskSchema,
  listTasks,
  listTasksQuerySchema,
} from "@/server/services/task.service";

export const runtime = "nodejs";

/**
 * Cross-project task list. The service scopes results to projects the caller can
 * see, so there is no project guard here — but a `projectId` filter the caller
 * has no access to is rejected inside `listTasks`.
 */
export const GET = withApiHandler(
  () => requireSession(),
  async (ctx, req) => {
    const filters = listTasksQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    return listTasks(ctx, filters, parsePagination(req.nextUrl.searchParams));
  },
);

/**
 * Create. The project is taken from the BODY, so the guard has to read the body
 * first — hence the clone: a request body can only be consumed once, and the
 * handler needs it again for full validation.
 */
export const POST = withApiHandler(
  async (req) => {
    const body = (await req.clone().json().catch(() => null)) as
      | { projectId?: unknown }
      | null;
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    if (!projectId) throw badRequest("projectId is required.");
    return requireProjectAccess(projectId, "EDIT");
  },
  async (ctx, req) => {
    const result = await createTask(ctx, await readJson(req, createTaskSchema));
    // Creating a task already assigned to someone notifies them.
    flushNotificationsAfterResponse();
    return result;
  },
  { successStatus: 201 },
);
