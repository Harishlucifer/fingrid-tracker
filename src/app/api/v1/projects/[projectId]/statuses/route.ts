/**
 * Board columns of one project: create, and re-order the whole list.
 *
 * MANAGE, not EDIT. Changing the columns changes the workflow every member
 * works inside — and a category change re-stamps completion on tasks that are
 * already there — so it sits with the project lead, alongside membership.
 */

import {
  requireProjectAccess,
  type ProjectAuthCtx,
} from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  createProjectStatus,
  createStatusSchema,
  reorderProjectStatuses,
  reorderStatusesSchema,
} from "@/server/services/project.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string }> };

export const POST = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, req) =>
    createProjectStatus(
      ctx,
      ctx.projectId,
      await readJson(req, createStatusSchema),
    ),
  { successStatus: 201 },
);

/**
 * Re-order. Takes the complete new order rather than one move, so two people
 * dragging at once cannot interleave into an order neither of them chose.
 */
export const PATCH = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "MANAGE");
  },
  async (ctx, req) =>
    reorderProjectStatuses(
      ctx,
      ctx.projectId,
      await readJson(req, reorderStatusesSchema),
    ),
);
