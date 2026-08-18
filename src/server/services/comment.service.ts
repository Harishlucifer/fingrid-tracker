/**
 * Comments, @mentions and the activity feed.
 */

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { parseMentionEmails } from "@/lib/mentions";
import { describeTaskChanges } from "@/lib/task-activity";
import type { AuthCtx, ProjectAuthCtx } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { enqueueCommentNotifications } from "@/server/notifications/dispatch";
import { badRequest, forbidden, notFound } from "@/server/http/errors";
import { buildMeta, type Pagination } from "@/server/http/pagination";
import { getStorage } from "@/server/storage";

import { recordActivity } from "./activity.service";
import { attachmentSelect, toAttachmentDto } from "./attachment.service";

export const createCommentSchema = z
  .object({
    body: z.string().max(20000).default(""),
    parentId: z.string().min(1).nullable().optional(),
    /**
     * Files already uploaded against this task, claimed by this comment.
     *
     * Two steps rather than a multipart comment endpoint: the upload route
     * already owns size, MIME and storage handling, so a comment reuses it and
     * then adopts the rows. The claim is what makes an id here harmless — see
     * `claimAttachments`.
     */
    attachmentIds: z.array(z.string().min(1)).max(10).optional(),
  })
  // A comment has to say something. "Something" now includes a file, so an
  // empty body is fine when a file came with it — but a wholly empty post is
  // still refused, here rather than as a row nobody can see.
  .refine(
    (input) =>
      input.body.trim().length > 0 || (input.attachmentIds?.length ?? 0) > 0,
    { message: "Write a comment or attach a file.", path: ["body"] },
  );

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(20000),
});

/** One select, so a comment reads the same however it was fetched. */
const commentSelect = {
  id: true,
  body: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true, image: true } },
  mentions: {
    select: {
      mentionedUser: { select: { id: true, name: true, email: true } },
    },
  },
  attachments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: attachmentSelect,
  },
} as const;

type CommentRow = {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string | null; email: string; image: string | null };
  mentions: {
    mentionedUser: { id: string; name: string | null; email: string };
  }[];
  attachments: Parameters<typeof toAttachmentDto>[0][];
};

function toCommentDto(row: CommentRow) {
  return {
    id: row.id,
    body: row.body,
    parent_id: row.parentId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    author: row.author,
    mentions: row.mentions.map((mention) => mention.mentionedUser),
    attachments: row.attachments.map(toAttachmentDto),
  };
}

export async function listComments(taskId: string, pagination: Pagination) {
  const where = { taskId, deletedAt: null };

  const [rows, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: pagination.skip,
      take: pagination.take,
      select: commentSelect,
    }),
    prisma.comment.count({ where }),
  ]);

  return {
    data: rows.map(toCommentDto),
    meta: buildMeta(total, pagination),
  };
}

export async function createComment(
  ctx: ProjectAuthCtx & { taskId: string },
  input: z.infer<typeof createCommentSchema>,
) {
  // A reply must belong to the same task, or threads could be grafted across
  // tasks and leak content between projects.
  if (input.parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: input.parentId, taskId: ctx.taskId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!parent) throw badRequest("The comment being replied to was not found.");
    if (parent.parentId) {
      throw badRequest("Replies cannot be nested more than one level deep.");
    }
  }

  const mentionEmails = parseMentionEmails(input.body);

  // Only project members can be mentioned.
  const mentionable =
    mentionEmails.length > 0
      ? await prisma.user.findMany({
          where: {
            email: { in: mentionEmails },
            isActive: true,
            deletedAt: null,
            projectMemberships: { some: { projectId: ctx.projectId } },
          },
          select: { id: true, email: true },
        })
      : [];

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        taskId: ctx.taskId,
        authorId: ctx.userId,
        body: input.body,
        parentId: input.parentId ?? null,
        ...(mentionable.length > 0
          ? {
              mentions: {
                create: mentionable
                  // Never notify yourself.
                  .filter((user) => user.id !== ctx.userId)
                  .map((user) => ({ mentionedUserId: user.id })),
              },
            }
          : {}),
      },
      select: { id: true },
    });

    const attachmentCount = await claimAttachments(
      tx,
      ctx,
      created.id,
      input.attachmentIds ?? [],
    );

    await recordActivity(
      {
        entityType: "COMMENT",
        entityId: created.id,
        projectId: ctx.projectId,
        actorId: ctx.userId,
        action: input.parentId ? "comment.replied" : "comment.created",
        payload: {
          taskId: ctx.taskId,
          mentioned: mentionable.map((user) => user.email),
          attachments: attachmentCount,
        },
      },
      tx,
    );

    return created;
  });

  // Queue emails outside the transaction: a mail bookkeeping failure must not
  // roll back the comment the user just wrote.
  await queueCommentEmails({
    taskId: ctx.taskId,
    projectId: ctx.projectId,
    actorId: ctx.userId,
    body: input.body,
    mentionedIds: mentionable.map((user) => user.id),
  });

  const row = await prisma.comment.findUnique({
    where: { id: comment.id },
    select: commentSelect,
  });
  if (!row) throw notFound("Comment not found");

  return toCommentDto(row);
}

/**
 * Adopt already-uploaded files into a comment, inside the comment's own
 * transaction so a rejected claim takes the comment with it.
 *
 * The `where` clause is the whole authorization argument, and every clause in
 * it is load-bearing:
 *
 *   - `taskId` — a file from another task, and therefore possibly another
 *     project, can never be pulled into view here.
 *   - `uploaderId` — you may only post files you uploaded yourself.
 *   - `commentId: null` — a file already claimed cannot be re-attached, so one
 *     upload cannot be sprayed across many comments.
 *
 * Anything not matching all three is simply not updated, which is why the count
 * is then compared: a partial match is refused outright rather than quietly
 * posting a comment with fewer files than the author attached.
 */
async function claimAttachments(
  tx: Prisma.TransactionClient,
  ctx: ProjectAuthCtx & { taskId: string },
  commentId: string,
  attachmentIds: string[],
): Promise<number> {
  if (attachmentIds.length === 0) return 0;

  const ids = [...new Set(attachmentIds)];

  const claimed = await tx.attachment.updateMany({
    where: {
      id: { in: ids },
      taskId: ctx.taskId,
      uploaderId: ctx.userId,
      commentId: null,
      deletedAt: null,
    },
    data: { commentId },
  });

  if (claimed.count !== ids.length) {
    throw badRequest(
      "One of the attached files is no longer available. Re-attach it and try again.",
    );
  }

  return claimed.count;
}

/**
 * Queue emails for a new comment: the people mentioned, plus the task's assignee
 * and reporter as implicit watchers.
 *
 * There is no watch/subscribe table yet, so "watcher" means assignee or
 * reporter — the two people who demonstrably care about the task. The dispatcher
 * de-duplicates and drops the actor, so nobody is emailed twice or told about
 * their own comment.
 */
async function queueCommentEmails(args: {
  taskId: string;
  projectId: string;
  actorId: string;
  body: string;
  mentionedIds: string[];
}) {
  try {
    const [task, actor] = await Promise.all([
      prisma.task.findUnique({
        where: { id: args.taskId },
        select: {
          id: true,
          number: true,
          title: true,
          assignee: { select: { id: true, email: true, isActive: true } },
          reporter: { select: { id: true, email: true, isActive: true } },
          project: { select: { id: true, key: true, name: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: args.actorId },
        select: { id: true, name: true, email: true },
      }),
    ]);

    if (!task || !actor) return;

    const mentioned =
      args.mentionedIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: args.mentionedIds } },
            select: { id: true, email: true, isActive: true },
          })
        : [];

    const watchers = [task.assignee, task.reporter].filter(
      (user): user is { id: string; email: string; isActive: boolean } =>
        Boolean(user),
    );

    await enqueueCommentNotifications({
      actor,
      task: {
        id: task.id,
        ref: `${task.project.key}-${task.number}`,
        title: task.title,
        projectId: task.project.id,
        projectName: task.project.name,
      },
      commentBody: args.body,
      mentioned,
      watchers,
    });
  } catch (error) {
    console.error("[notifications] failed to queue comment emails", error);
  }
}

export async function updateComment(
  ctx: AuthCtx,
  commentId: string,
  input: z.infer<typeof updateCommentSchema>,
) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
    select: { id: true, authorId: true, task: { select: { projectId: true } } },
  });
  if (!comment) throw notFound("Comment not found");

  // Only the author edits their own words. An admin can delete, but not rewrite.
  if (comment.authorId !== ctx.userId) {
    throw forbidden("You can only edit your own comments.");
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body: input.body },
    select: { id: true, body: true, updatedAt: true },
  });

  await recordActivity({
    entityType: "COMMENT",
    entityId: commentId,
    projectId: comment.task.projectId,
    actorId: ctx.userId,
    action: "comment.updated",
  });

  return {
    id: updated.id,
    body: updated.body,
    updated_at: updated.updatedAt.toISOString(),
  };
}

export async function deleteComment(ctx: AuthCtx, commentId: string) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
    select: {
      id: true,
      authorId: true,
      task: { select: { projectId: true } },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, storageKey: true },
      },
    },
  });
  if (!comment) throw notFound("Comment not found");

  // Author, or an org admin moderating.
  if (comment.authorId !== ctx.userId && ctx.role !== "ADMIN") {
    throw forbidden("You can only delete your own comments.");
  }

  const deletedAt = new Date();

  // A file posted in a comment goes with the comment. It is only reachable
  // through the comment that carries it, so leaving the row live would strand
  // bytes nobody can see and nobody can remove.
  await prisma.$transaction(async (tx) => {
    await tx.comment.update({ where: { id: commentId }, data: { deletedAt } });

    if (comment.attachments.length > 0) {
      await tx.attachment.updateMany({
        where: { commentId, deletedAt: null },
        data: { deletedAt },
      });
    }
  });

  // Bytes go after the rows commit, and best-effort: storage is not an archive,
  // but a failure to reach S3 must not resurrect a comment the user deleted. A
  // stranded object is reclaimable; a half-deleted comment is not.
  await Promise.all(
    comment.attachments.map((attachment) =>
      getStorage()
        .delete(attachment.storageKey)
        .catch((error) => {
          console.error("[comment] failed to delete attached file", {
            commentId,
            attachmentId: attachment.id,
            error,
          });
        }),
    ),
  );

  await recordActivity({
    entityType: "COMMENT",
    entityId: commentId,
    projectId: comment.task.projectId,
    actorId: ctx.userId,
    action: "comment.deleted",
    payload: { attachments: comment.attachments.length },
  });

  return { id: commentId, deleted: true };
}

/** Activity feed for one entity (task) or a whole project. */
export async function listActivity(
  filters: { projectId?: string; entityType?: string; entityId?: string },
  pagination: Pagination,
) {
  const where = {
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        payload: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      entity_type: row.entityType,
      entity_id: row.entityId,
      action: row.action,
      payload: row.payload,
      created_at: row.createdAt.toISOString(),
      actor: row.actor,
    })),
    meta: buildMeta(total, pagination),
  };
}

// ---------------------------------------------------------------------------
// Task history
// ---------------------------------------------------------------------------

/**
 * One task's own history: who moved it, who assigned it, and when.
 *
 * Scoped to `entityType: "TASK"` rather than everything that mentions the task,
 * because comments, files and time entries are each already visible in the tab
 * that owns them — repeating them here would make the one view that answers
 * "who changed this?" the hardest place to find the answer.
 *
 * Ids are resolved to names here rather than in the browser. The audit payload
 * stores a `statusId` because that is what the write actually changed, but a
 * UUID is not history anyone can read, and the client has no business knowing
 * which payload keys happen to be foreign keys.
 */
export async function listTaskActivity(
  ctx: ProjectAuthCtx & { taskId: string },
  pagination: Pagination,
) {
  const where = {
    entityType: "TASK",
    entityId: ctx.taskId,
    // A same-column drag is a board detail, not something that happened to the
    // task. It would otherwise bury the moves that matter.
    action: { not: "task.reordered" },
  };

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        action: true,
        payload: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  const names = rows.length > 0 ? await resolveNames(ctx.projectId) : new Map();

  return {
    data: rows.map((row) => ({
      id: row.id,
      action: row.action,
      created_at: row.createdAt.toISOString(),
      actor: row.actor,
      changes: describeTaskChanges(row.action, row.payload, names),
    })),
    meta: buildMeta(total, pagination),
  };
}

/** id -> display name for every board column and sprint in the project. */
async function resolveNames(projectId: string): Promise<Map<string, string>> {
  const [statuses, sprints] = await Promise.all([
    prisma.taskStatus.findMany({
      where: { projectId },
      select: { id: true, name: true },
    }),
    prisma.sprint.findMany({
      where: { projectId },
      select: { id: true, name: true },
    }),
  ]);

  return new Map(
    [...statuses, ...sprints].map((row) => [row.id, row.name] as const),
  );
}

/** Unread @mentions for the signed-in user — drives the My work page. */
export async function listMyMentions(ctx: AuthCtx, pagination: Pagination) {
  const where = { mentionedUserId: ctx.userId, readAt: null };

  const [rows, total] = await Promise.all([
    prisma.mention.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        createdAt: true,
        comment: {
          select: {
            id: true,
            body: true,
            author: { select: { id: true, name: true, email: true } },
            task: {
              select: {
                id: true,
                number: true,
                title: true,
                project: { select: { id: true, key: true } },
              },
            },
          },
        },
      },
    }),
    prisma.mention.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      created_at: row.createdAt.toISOString(),
      comment_id: row.comment.id,
      excerpt: row.comment.body.slice(0, 200),
      author: row.comment.author,
      task: {
        id: row.comment.task.id,
        ref: `${row.comment.task.project.key}-${row.comment.task.number}`,
        title: row.comment.task.title,
        project_id: row.comment.task.project.id,
      },
    })),
    meta: buildMeta(total, pagination),
  };
}

export async function markMentionsRead(ctx: AuthCtx, mentionIds?: string[]) {
  const result = await prisma.mention.updateMany({
    where: {
      mentionedUserId: ctx.userId,
      readAt: null,
      ...(mentionIds && mentionIds.length > 0 ? { id: { in: mentionIds } } : {}),
    },
    data: { readAt: new Date() },
  });
  return { marked: result.count };
}
