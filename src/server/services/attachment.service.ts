/**
 * Task attachments, stored in Amazon S3.
 *
 * Validation order matters: size and MIME are checked BEFORE the bytes are
 * uploaded, so an oversized or disallowed file never reaches the bucket — and is
 * never billed for.
 */

import { createHash, randomUUID } from "node:crypto";

import {
  ALLOWED_UPLOAD_MIME_TYPES,
  previewKindOf,
} from "@/lib/constants";
import { sanitizeFileName } from "@/lib/file-name";
import { env } from "@/lib/env";
import type { AuthCtx, ProjectAuthCtx } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import {
  badRequest,
  forbidden,
  notFound,
  payloadTooLarge,
  unsupportedMediaType,
} from "@/server/http/errors";
import { buildStorageKey, getStorage } from "@/server/storage";

import { recordActivity } from "./activity.service";

const ALLOWED_MIME = new Set<string>(ALLOWED_UPLOAD_MIME_TYPES);

/**
 * The columns every attachment payload is built from. Exported so comments can
 * embed their own files without re-deriving the shape — one select, one mapper,
 * so a preview added here appears everywhere the file is rendered.
 */
export const attachmentSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploader: { select: { id: true, name: true, email: true, image: true } },
} as const;

type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploader: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

export function toAttachmentDto(row: AttachmentRow) {
  return {
    id: row.id,
    file_name: row.fileName,
    mime_type: row.mimeType,
    size_bytes: row.sizeBytes,
    created_at: row.createdAt.toISOString(),
    uploader: row.uploader,
    download_url: `/api/v1/attachments/${row.id}/download`,
    /**
     * Null for anything that must not be rendered inline (an SVG, a .docx).
     * The client uses its presence to decide whether clicking opens a preview
     * or downloads; the route re-checks, so this is a hint, not the control.
     */
    preview_url: previewKindOf(row.mimeType)
      ? `/api/v1/attachments/${row.id}/preview`
      : null,
    preview_kind: previewKindOf(row.mimeType),
  };
}

/**
 * The task's own files.
 *
 * Deliberately excludes files posted with a comment (`commentId` set): those
 * render inside the comment that carries them, and listing them here as well
 * would show every discussion attachment twice with no way to tell which panel
 * owns it.
 */
export async function listAttachments(taskId: string) {
  const rows = await prisma.attachment.findMany({
    where: { taskId, commentId: null, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: attachmentSelect,
  });

  return rows.map(toAttachmentDto);
}

export async function createAttachment(
  ctx: ProjectAuthCtx & { taskId: string },
  file: File,
) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw badRequest("No file was provided.");
  }

  if (file.size <= 0) throw badRequest("The file is empty.");

  // Check the declared size first — cheap, and rejects most abuse before we
  // buffer anything.
  if (file.size > env.maxUploadBytes) {
    throw payloadTooLarge(
      `Files must be ${Math.floor(env.maxUploadBytes / 1024 / 1024)} MB or smaller.`,
    );
  }

  const mimeType = (file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    throw unsupportedMediaType(`${mimeType} files are not allowed.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Re-check against the real byte length: `file.size` is client-reported and
  // must never be the only size check.
  if (buffer.byteLength > env.maxUploadBytes) {
    throw payloadTooLarge("File exceeds the maximum upload size.");
  }

  const fileName = sanitizeFileName(file.name);
  const attachmentId = randomUUID();
  const storageKey = buildStorageKey({
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    attachmentId,
    fileName,
  });

  const checksum = createHash("sha256").update(buffer).digest("hex");

  // Write to storage first: a DB row pointing at a missing file is worse than an
  // orphaned file, which a later sweep can reclaim.
  const stored = await getStorage().put(storageKey, buffer, mimeType);

  try {
    const created = await prisma.attachment.create({
      data: {
        id: attachmentId,
        taskId: ctx.taskId,
        uploaderId: ctx.userId,
        storageKey: stored.key,
        fileName,
        mimeType,
        sizeBytes: stored.size,
        checksum,
      },
      select: attachmentSelect,
    });

    await recordActivity({
      entityType: "ATTACHMENT",
      entityId: created.id,
      projectId: ctx.projectId,
      actorId: ctx.userId,
      action: "attachment.created",
      payload: {
        taskId: ctx.taskId,
        fileName,
        sizeBytes: stored.size,
        mimeType,
      },
    });

    return toAttachmentDto(created);
  } catch (error) {
    // Don't leave the orphan behind if the row failed to insert.
    await getStorage()
      .delete(stored.key)
      .catch(() => undefined);
    throw error;
  }
}

/** Resolve an attachment the caller is allowed to read. Used by both the
 *  download and the preview route — same authorization, different framing. */
export async function getAttachmentForDownload(
  ctx: AuthCtx,
  attachmentId: string,
) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null },
    select: {
      id: true,
      storageKey: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      task: { select: { projectId: true } },
    },
  });
  if (!attachment) throw notFound("Attachment not found");

  // Authorize against the owning project before streaming a single byte.
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: attachment.task.projectId,
        userId: ctx.userId,
      },
    },
    select: { role: true },
  });

  if (!membership && ctx.role !== "ADMIN") {
    throw notFound("Attachment not found");
  }

  return attachment;
}

export async function deleteAttachment(ctx: AuthCtx, attachmentId: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null },
    select: {
      id: true,
      fileName: true,
      uploaderId: true,
      storageKey: true,
      task: { select: { projectId: true } },
    },
  });
  if (!attachment) throw notFound("Attachment not found");

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: attachment.task.projectId,
        userId: ctx.userId,
      },
    },
    select: { role: true },
  });

  const isUploader = attachment.uploaderId === ctx.userId;
  const isLead = membership?.role === "LEAD";
  if (!isUploader && !isLead && ctx.role !== "ADMIN") {
    throw forbidden("Only the uploader or a project lead can remove a file.");
  }

  // Soft-delete the row and remove the bytes. The row is kept for the audit
  // trail; the file is not, because storage is not an archive.
  await prisma.attachment.update({
    where: { id: attachmentId },
    data: { deletedAt: new Date() },
  });

  await getStorage()
    .delete(attachment.storageKey)
    .catch((error) => {
      console.error("[attachment] failed to delete stored file", {
        attachmentId,
        error,
      });
    });

  await recordActivity({
    entityType: "ATTACHMENT",
    entityId: attachmentId,
    projectId: attachment.task.projectId,
    actorId: ctx.userId,
    action: "attachment.deleted",
    payload: { fileName: attachment.fileName },
  });

  return { id: attachmentId, deleted: true };
}
