import { requireSession } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  deleteComment,
  updateComment,
  updateCommentSchema,
} from "@/server/services/comment.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ commentId: string }> };
type Ctx = Awaited<ReturnType<typeof requireSession>>;

/**
 * Authorization for these lives in the service, because it depends on comment
 * ownership rather than only on project access: the author edits their own
 * comment; an admin may delete but not rewrite one.
 */
export const PATCH = withApiHandler<Ctx, unknown, RouteArgs>(
  () => requireSession(),
  async (ctx, req, args) => {
    const { commentId } = await args.params;
    return updateComment(ctx, commentId, await readJson(req, updateCommentSchema));
  },
);

export const DELETE = withApiHandler<Ctx, unknown, RouteArgs>(
  () => requireSession(),
  async (ctx, _req, args) => {
    const { commentId } = await args.params;
    return deleteComment(ctx, commentId);
  },
);
