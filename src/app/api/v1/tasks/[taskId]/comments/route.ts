import { requireTaskAccess } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import { flushNotificationsAfterResponse } from "@/server/notifications/after-response";
import { parsePagination } from "@/server/http/pagination";
import {
  createComment,
  createCommentSchema,
  listComments,
} from "@/server/services/comment.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ taskId: string }> };
type Ctx = Awaited<ReturnType<typeof requireTaskAccess>>;

export const GET = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "VIEW");
  },
  async (ctx, req) =>
    listComments(ctx.taskId, parsePagination(req.nextUrl.searchParams)),
);

export const POST = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    // Commenting is an EDIT-level action: a VIEWER reads but does not post.
    return requireTaskAccess(taskId, "EDIT");
  },
  async (ctx, req) => {
    const result = await createComment(
      ctx,
      await readJson(req, createCommentSchema),
    );
    // Mention and watcher emails are queued by the service; flush them once the
    // response has been sent so the comment posts at full speed.
    flushNotificationsAfterResponse();
    return result;
  },
  { successStatus: 201 },
);
