import { requireProjectAccess, type ProjectAuthCtx } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  addMemberSchema,
  addProjectMember,
} from "@/server/services/project.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string }> };

export const POST = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, req) =>
    addProjectMember(ctx, ctx.projectId, await readJson(req, addMemberSchema)),
  { successStatus: 201 },
);
