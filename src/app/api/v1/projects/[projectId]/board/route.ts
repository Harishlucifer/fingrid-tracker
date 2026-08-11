import { requireProjectAccess, type ProjectAuthCtx } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import { getBoard } from "@/server/services/task.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string }> };

export const GET = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "VIEW");
  },
  async (ctx) => getBoard(ctx.projectId),
);
