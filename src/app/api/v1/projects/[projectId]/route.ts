import { requireProjectAccess, type ProjectAuthCtx } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  deleteProject,
  getProject,
  updateProject,
  updateProjectSchema,
} from "@/server/services/project.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string }> };

export const GET = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "VIEW");
  },
  async (ctx) => getProject(ctx.projectId),
);

export const PATCH = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, req) =>
    updateProject(ctx, ctx.projectId, await readJson(req, updateProjectSchema)),
);

export const DELETE = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx) => deleteProject(ctx, ctx.projectId),
);
