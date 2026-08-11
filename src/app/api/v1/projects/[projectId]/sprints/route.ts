import { requireProjectAccess, type ProjectAuthCtx } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  createSprint,
  createSprintSchema,
  listSprints,
} from "@/server/services/sprint.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string }> };

export const GET = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "VIEW");
  },
  async (ctx) => listSprints(ctx.projectId),
);

export const POST = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, req) => createSprint(ctx, await readJson(req, createSprintSchema)),
  { successStatus: 201 },
);
