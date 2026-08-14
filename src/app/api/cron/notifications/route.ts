/**
 * The notification outbox's clock.
 *
 * `flushNotificationsAfterResponse()` only runs as a side effect of a task write
 * or a comment write, so a row whose delivery failed waits for the next such
 * write to be retried. Over a quiet weekend — or when the failed send was the
 * last action of the day — that retry never happens and the mail is silently
 * late. A scheduled pass is what closes that.
 *
 * Two things it deliberately does not do:
 *
 *  * It does not reset FAILED rows. Those have exhausted the attempt ceiling,
 *    and requeueing them on a timer would make the ceiling meaningless — a
 *    permanently-bad address would retry forever. Resetting stays a deliberate
 *    admin action via `POST /api/v1/admin/notifications?reset_failed=true`,
 *    which is the thing to call after fixing SES configuration.
 *  * It returns no project data: delivery counts and the driver name only. No
 *    recipients, no subjects, no bodies. The caller is a scheduler, and a
 *    credential that leaks would leak nothing about anyone's work.
 *
 * Sits outside `/api/v1` on purpose. This is operational plumbing like
 * `healthz`/`readyz`, not part of the versioned client contract.
 */

import { requireCronSecret } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import { deliverPending } from "@/server/notifications/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Sends are sequential, so give the batch below room to finish. */
export const maxDuration = 60;

/**
 * Bounded per invocation so one run cannot outlast `maxDuration`. `deliverPending`
 * awaits each send in turn, so the ceiling is roughly batch × SES latency — 50
 * sits comfortably inside a minute with margin to spare.
 *
 * A larger backlog simply drains over the following runs: rows are claimed in
 * `createdAt` order, so nothing is skipped or starved by the bound.
 */
const CRON_BATCH_SIZE = 50;

export const GET = withApiHandler(
  (req) => requireCronSecret(req),
  async () => {
    const report = await deliverPending(CRON_BATCH_SIZE);

    // Always logged, unlike the after-response flush which stays quiet when it
    // finds nothing: a scheduled job that silently does nothing is
    // indistinguishable from one that stopped running.
    console.info("[cron] notification flush", report);

    return report;
  },
);
