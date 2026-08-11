/**
 * Comments, @mentions and the activity feed.
 */

import { z } from "zod";

import { parseMentionEmails } from "@/lib/mentions";
import type { AuthCtx, ProjectAuthCtx } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { enqueueCommentNotifications } from "@/server/notifications/dispatch";
import { badRequest, forbidden, notFound } from "@/server/http/errors";
import { buildMeta, type Pagination } from "@/server/http/pagination";

import { recordActivity } from "./activity.service";

export const createCommentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(20000),
  parentId: z.string().min(1).nullable().optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(20000),
});

export async function listComments(taskId: string, pagination: Pagination) {
  const where = { taskId, deletedAt: null };

  const [rows, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
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
      },
    }),
    prisma.comment.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      body: row.body,
      parent_id: row.parentId,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      author: row.author,
      mentions: row.mentions.map((mention) => mention.mentionedUser),
    })),
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

  const rows = await prisma.comment.findMany({
    where: { id: comment.id },
    select: {
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
    },
  });

  const row = rows[0];
  if (!row) throw notFound("Comment not found");

  return {
    id: row.id,
    body: row.body,
    parent_id: row.parentId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    author: row.author,
    mentions: row.mentions.map((mention) => mention.mentionedUser),
  };
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
    select: { id: true, authorId: true, task: { select: { projectId: true } } },
  });
  if (!comment) throw notFound("Comment not found");

  // Author, or an org admin moderating.
  if (comment.authorId !== ctx.userId && ctx.role !== "ADMIN") {
    throw forbidden("You can only delete your own comments.");
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  await recordActivity({
    entityType: "COMMENT",
    entityId: commentId,
    projectId: comment.task.projectId,
    actorId: ctx.userId,
    action: "comment.deleted",
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
