import { requireTaskAccess } from "@/server/auth/guards";
import { badRequest } from "@/server/http/errors";
import { withApiHandler } from "@/server/http/handler";
import {
  createAttachment,
  listAttachments,
} from "@/server/services/attachment.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ taskId: string }> };
type Ctx = Awaited<ReturnType<typeof requireTaskAccess>>;

export const GET = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "VIEW");
  },
  async (ctx) => listAttachments(ctx.taskId),
);

/** multipart/form-data upload with a single `file` field. */
export const POST = withApiHandler<Ctx, unknown, RouteArgs>(
  async (_req, args) => {
    const { taskId } = await args.params;
    return requireTaskAccess(taskId, "EDIT");
  },
  async (ctx, req) => {
    const formData = await req.formData().catch(() => null);
    if (!formData) throw badRequest("Expected a multipart form upload.");

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw badRequest("Attach the file under the `file` field.");
    }

    return createAttachment(ctx, file);
  },
  { successStatus: 201 },
);
