import { requireAdmin } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { withApiHandler } from "@/server/http/handler";
import { parsePagination, buildMeta } from "@/server/http/pagination";
import { deliverPending } from "@/server/notifications/dispatch";
import { getMailer } from "@/server/notifications/mailer";

export const runtime = "nodejs";

/**
 * Notification outbox, for diagnosing "why didn't I get an email".
 *
 * Bodies are excluded — an admin needs delivery state, not the contents of other
 * people's messages.
 */
export const GET = withApiHandler(
  () => requireAdmin(),
  async (_ctx, req) => {
    const pagination = parsePagination(req.nextUrl.searchParams);
    const status = req.nextUrl.searchParams.get("status") ?? undefined;

    const where = status ? { status } : {};

    const [rows, total, counts] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          type: true,
          toEmail: true,
          subject: true,
          status: true,
          attempts: true,
          lastError: true,
          providerMessageId: true,
          sentAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    return {
      data: {
        driver: getMailer().name,
        counts: Object.fromEntries(
          counts.map((row) => [row.status, row._count._all]),
        ),
        notifications: rows.map((row) => ({
          id: row.id,
          type: row.type,
          to_email: row.toEmail,
          subject: row.subject,
          status: row.status,
          attempts: row.attempts,
          last_error: row.lastError,
          provider_message_id: row.providerMessageId,
          sent_at: row.sentAt?.toISOString() ?? null,
          created_at: row.createdAt.toISOString(),
        })),
      },
      meta: buildMeta(total, pagination),
    };
  },
);

/**
 * Force a delivery pass. Useful after fixing SES configuration: rows that failed
 * while it was misconfigured are still PENDING and will go out on this call.
 *
 * Rows that hit the attempt ceiling are FAILED and are reset to PENDING first,
 * so an admin can retry them explicitly after fixing the cause.
 */
export const POST = withApiHandler(
  () => requireAdmin(),
  async (_ctx, req) => {
    if (req.nextUrl.searchParams.get("reset_failed") === "true") {
      await prisma.notification.updateMany({
        where: { status: "FAILED" },
        data: { status: "PENDING", attempts: 0 },
      });
    }

    return deliverPending(100);
  },
);
