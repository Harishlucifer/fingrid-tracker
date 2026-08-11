import { requireSession } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import { deleteAttachment } from "@/server/services/attachment.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ attachmentId: string }> };
type Ctx = Awaited<ReturnType<typeof requireSession>>;

/** Uploader, project lead, or org admin — enforced in the service. */
export const DELETE = withApiHandler<Ctx, unknown, RouteArgs>(
  () => requireSession(),
  async (ctx, _req, args) => {
    const { attachmentId } = await args.params;
    return deleteAttachment(ctx, attachmentId);
  },
);
