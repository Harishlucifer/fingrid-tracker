import { requireProjectAccess, type ProjectAuthCtx } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import {
  getBurndown,
  getProjectSummary,
  getThroughput,
  getWorkload,
} from "@/server/services/report.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ projectId: string }> };

/**
 * One endpoint for the whole reports page, so it renders from a single round
 * trip rather than four. Burndown is only computed when a sprint is named.
 */
export const GET = withApiHandler<ProjectAuthCtx, unknown, RouteArgs>(
  async (_req, args) => {
    const { projectId } = await args.params;
    return requireProjectAccess(projectId, "VIEW");
  },
  async (ctx, req) => {
    const sprintId = req.nextUrl.searchParams.get("sprint_id");
    const weeks = Number.parseInt(
      req.nextUrl.searchParams.get("weeks") ?? "12",
      10,
    );

    const [summary, throughput, workload, burndown] = await Promise.all([
      getProjectSummary(ctx.projectId),
      getThroughput(ctx.projectId, Number.isNaN(weeks) ? 12 : Math.min(weeks, 52)),
      getWorkload(ctx.projectId),
      sprintId ? getBurndown(ctx.projectId, sprintId) : Promise.resolve(null),
    ]);

    return { summary, throughput, workload, burndown };
  },
);
