import { requireSession } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import {
  getResourceTimesheet,
  monthSchema,
} from "@/server/services/timesheet.service";

export const runtime = "nodejs";

/**
 * Monthly resource-wise timesheet. `?month=YYYY-MM`, defaulting to this month.
 *
 * Admins see every active user; everyone else sees only their own row. That is
 * enforced in the service off the session role, not from a query parameter, so
 * a hand-edited URL cannot widen the result.
 */
export const GET = withApiHandler(
  () => requireSession(),
  async (ctx, req) => {
    const params = req.nextUrl.searchParams;

    const month = monthSchema.parse(
      params.get("month") ?? new Date().toISOString().slice(0, 7),
    );

    return getResourceTimesheet(ctx, month, {
      projectId: params.get("project_id") ?? undefined,
    });
  },
);
