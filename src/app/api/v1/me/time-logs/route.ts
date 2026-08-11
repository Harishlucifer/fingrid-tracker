import { requireSession } from "@/server/auth/guards";
import { badRequest } from "@/server/http/errors";
import { withApiHandler } from "@/server/http/handler";
import { getTimesheet } from "@/server/services/sprint.service";

export const runtime = "nodejs";

/**
 * Weekly timesheet. `from` and `to` are inclusive YYYY-MM-DD dates.
 *
 * `user_id` is honored for admins only — the service ignores it for everyone
 * else rather than erroring, so a tampered query string silently returns the
 * caller's own sheet instead of leaking someone else's.
 */
export const GET = withApiHandler(
  () => requireSession(),
  async (ctx, req) => {
    const params = req.nextUrl.searchParams;
    const fromRaw = params.get("from");
    const toRaw = params.get("to");

    if (!fromRaw || !toRaw) {
      throw badRequest("`from` and `to` dates are required (YYYY-MM-DD).");
    }

    const from = new Date(`${fromRaw}T00:00:00`);
    const to = new Date(`${toRaw}T23:59:59.999`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw badRequest("`from` and `to` must be valid YYYY-MM-DD dates.");
    }
    if (to < from) {
      throw badRequest("`to` cannot be before `from`.");
    }
    // Bound the range so a hand-edited URL cannot ask for a decade of rows.
    const days = (to.getTime() - from.getTime()) / 86_400_000;
    if (days > 92) {
      throw badRequest("Range cannot exceed 92 days.");
    }

    return getTimesheet(ctx, { from, to }, params.get("user_id") ?? undefined);
  },
);
