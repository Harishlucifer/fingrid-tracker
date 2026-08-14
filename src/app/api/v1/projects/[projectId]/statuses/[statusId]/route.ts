/**
 * One board column: edit its name, category, colour or WIP limit, or remove it.
 *
 * Deleting takes `?move_to=<statusId>` when the column still holds tasks. It is
 * a query parameter rather than a body because a DELETE with a body is awkward
 * for clients and proxies; the service refuses the delete outright when tasks
 * exist and no destination was named, rather than guessing one.
 */

import {
  requireProjectAccess,
  type ProjectAuthCtx,
} from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  deleteProjectStatus,
  updateProjectStatus,
  updateStatusSchema,
} from "@/server/services/project.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string; statusId: string }> };

export const PATCH = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, req, args) => {
    const { statusId } = await args.params;
    return updateProjectStatus(
      ctx,
      ctx.projectId,
      statusId,
      await readJson(req, updateStatusSchema),
    );
  },
);

export const DELETE = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, req, args) => {
    const { statusId } = await args.params;
    return deleteProjectStatus(
      ctx,
      ctx.projectId,
      statusId,
      req.nextUrl.searchParams.get("move_to"),
    );
  },
);
