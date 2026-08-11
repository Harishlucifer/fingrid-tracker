/**
 * Enqueue and deliver notifications.
 *
 * The split matters:
 *
 *  * `enqueue*` writes `notification` rows — optionally inside the caller's
 *    transaction, so a notification is never sent for a change that rolled back,
 *    and never lost because SES was unavailable.
 *  * `deliverPending` sends them. Route handlers call it through Next's
 *    `after()`, so a slow SES call never delays the user's response.
 *
 * A failed send leaves the row PENDING (or FAILED past the attempt ceiling) with
 * its error recorded, so nothing disappears silently and a retry is possible.
 */

import { env } from "@/lib/env";
import { prisma } from "@/server/db/prisma";
import type { Db } from "@/server/services/activity.service";

import { getMailer } from "./mailer";
import {
  resolveCommentRecipients,
  shouldNotify,
  type NotifiableUser,
} from "./rules";
import {
  renderCommentMention,
  renderTaskAssigned,
  renderTaskComment,
  taskUrl,
  type NotificationType,
} from "./templates";

/** Give up after this many attempts so a permanently-bad address stops retrying. */
const MAX_ATTEMPTS = 5;
/** Delivered per invocation. Bounded so one request cannot fan out unboundedly. */
const BATCH_SIZE = 25;

type Recipient = NotifiableUser;
type Actor = { id: string; name: string | null; email: string };

type TaskContext = {
  id: string;
  ref: string;
  title: string;
  projectId: string;
  projectName: string;
  priority?: string;
  dueDate?: Date | null;
};

async function insert(
  db: Db,
  row: {
    userId: string;
    actorId: string;
    type: NotificationType;
    entityType: string;
    entityId: string;
    projectId: string | null;
    toEmail: string;
    subject: string;
    bodyText: string;
    bodyHtml: string;
  },
) {
  await db.notification.create({ data: row });
}

/** Queue "you were assigned a task". */
export async function enqueueTaskAssigned(
  args: {
    recipient: Recipient;
    actor: Actor;
    task: TaskContext;
  },
  db: Db = prisma,
): Promise<boolean> {
  if (!shouldNotify(args.recipient, args.actor.id)) return false;

  const rendered = renderTaskAssigned({
    actor: args.actor,
    taskRef: args.task.ref,
    taskTitle: args.task.title,
    projectName: args.task.projectName,
    taskUrl: taskUrl(env.appUrl, args.task.id),
    priority: args.task.priority,
    dueDate: args.task.dueDate
      ? args.task.dueDate.toISOString().slice(0, 10)
      : null,
  });

  await insert(db, {
    userId: args.recipient.id,
    actorId: args.actor.id,
    type: "TASK_ASSIGNED",
    entityType: "TASK",
    entityId: args.task.id,
    projectId: args.task.projectId,
    toEmail: args.recipient.email,
    subject: rendered.subject,
    bodyText: rendered.text,
    bodyHtml: rendered.html,
  });

  return true;
}

/**
 * Queue comment notifications: one per @mention, plus one for the assignee and
 * reporter who were not mentioned.
 *
 * De-duplicated by recipient, so being both mentioned and the assignee produces
 * one email rather than two — with the mention wording, which is more specific.
 */
export async function enqueueCommentNotifications(
  args: {
    actor: Actor;
    task: TaskContext;
    commentBody: string;
    mentioned: Recipient[];
    watchers: Recipient[];
  },
  db: Db = prisma,
): Promise<number> {
  const url = taskUrl(env.appUrl, args.task.id);
  const base = {
    actor: args.actor,
    taskRef: args.task.ref,
    taskTitle: args.task.title,
    projectName: args.task.projectName,
    taskUrl: url,
    commentBody: args.commentBody,
  };

  // De-duplication and precedence live in `rules.ts` so they are unit-tested.
  const recipients = resolveCommentRecipients({
    actorId: args.actor.id,
    mentioned: args.mentioned,
    watchers: args.watchers,
  });

  for (const { user, reason } of recipients) {
    const rendered =
      reason === "MENTION"
        ? renderCommentMention(base)
        : renderTaskComment(base);

    await insert(db, {
      userId: user.id,
      actorId: args.actor.id,
      type: reason === "MENTION" ? "COMMENT_MENTION" : "TASK_COMMENT",
      entityType: "TASK",
      entityId: args.task.id,
      projectId: args.task.projectId,
      toEmail: user.email,
      subject: rendered.subject,
      bodyText: rendered.text,
      bodyHtml: rendered.html,
    });
  }

  return recipients.length;
}

export type DeliveryReport = {
  attempted: number;
  sent: number;
  failed: number;
  driver: string;
};

/**
 * Send pending notifications. Safe to call concurrently: each row is claimed by
 * an `updateMany` guarded on its current status, so two callers cannot send the
 * same email twice.
 */
export async function deliverPending(
  limit = BATCH_SIZE,
): Promise<DeliveryReport> {
  const mailer = getMailer();
  const report: DeliveryReport = {
    attempted: 0,
    sent: 0,
    failed: 0,
    driver: mailer.name,
  };

  const pending = await prisma.notification.findMany({
    where: { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      attempts: true,
      toEmail: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
    },
  });

  for (const row of pending) {
    // Claim it: only one caller can move it out of PENDING.
    const claimed = await prisma.notification.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    report.attempted += 1;

    try {
      const result = await mailer.send({
        to: row.toEmail,
        subject: row.subject,
        text: row.bodyText,
        html: row.bodyHtml,
      });

      await prisma.notification.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.messageId,
          lastError: null,
        },
      });
      report.sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const message =
        error instanceof Error ? error.message : "Unknown mailer error";

      await prisma.notification.update({
        where: { id: row.id },
        data: {
          // Back to PENDING for another try, unless the ceiling is reached.
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          lastError: message.slice(0, 1000),
        },
      });

      console.error("[notifications] delivery failed", {
        notificationId: row.id,
        attempts,
        error: message,
      });
      report.failed += 1;
    }
  }

  return report;
}
