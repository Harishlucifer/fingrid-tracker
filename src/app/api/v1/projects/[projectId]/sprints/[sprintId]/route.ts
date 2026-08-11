import { requireProjectAccess, type ProjectAuthCtx } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  deleteSprint,
  updateSprint,
  updateSprintSchema,
} from "@/server/services/sprint.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string; sprintId: string }> };

export const PATCH = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, req, args) => {
    const { sprintId } = await args.params;
    return updateSprint(ctx, sprintId, await readJson(req, updateSprintSchema));
  },
);

export const DELETE = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, _req, args) => {
    const { sprintId } = await args.params;
    return deleteSprint(ctx, sprintId);
  },
);
