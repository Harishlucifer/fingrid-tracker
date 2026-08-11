import { requireProjectAccess, type ProjectAuthCtx } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import { removeProjectMember } from "@/server/services/project.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string; userId: string }> };

export const DELETE = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, _req, args) => {
    const { userId } = await args.params;
    return removeProjectMember(ctx, ctx.projectId, userId);
  },
);
