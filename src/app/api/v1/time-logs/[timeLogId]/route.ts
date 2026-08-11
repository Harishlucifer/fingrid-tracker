import { requireSession } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import { deleteTimeLog } from "@/server/services/sprint.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ timeLogId: string }> };
type Ctx = Awaited<ReturnType<typeof requireSession>>;

export const DELETE = withApiHandler<Ctx, unknown, RouteArgs>(
  () => requireSession(),
  async (ctx, _req, args) => {
    const { timeLogId } = await args.params;
    return deleteTimeLog(ctx, timeLogId);
  },
);
