/**
 * Attachment storage behind a three-method interface.
 *
 * Mirrors the factory pattern `alpha-api` uses for its external providers
 * (`app/factory/`): the driver is selected once from configuration, and callers
 * never know which one they got. Swapping to S3 is an env-var change plus one
 * new file — no call site moves.
 */

import { env } from "@/lib/env";

import { createLocalStorage } from "./local";
import { createS3Storage } from "./s3";

export type PutResult = { key: string; size: number };

export interface Storage {
  put(
    key: string,
    body: Buffer | Uint8Array,
    mimeType: string,
  ): Promise<PutResult>;
  get(key: string): Promise<ReadableStream<Uint8Array>>;
  delete(key: string): Promise<void>;
}

/**
 * Build the opaque storage key for an attachment.
 *
 * The basename is a server-generated UUID, never the client's filename — that is
 * what makes path traversal via a crafted name impossible. The original name is
 * kept in the database for display and in Content-Disposition on download.
 */
export function buildStorageKey(args: {
  projectId: string;
  taskId: string;
  attachmentId: string;
  fileName: string;
}): string {
  const extension = extractExtension(args.fileName);
  return `projects/${args.projectId}/tasks/${args.taskId}/${args.attachmentId}${extension}`;
}

/** Lowercased extension, at most 12 chars, or "" when there isn't a safe one. */
function extractExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 1 || dot === fileName.length - 1) return "";
  const raw = fileName.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,12}$/.test(raw)) return "";
  return `.${raw}`;
}

/**
 * Reject anything that could escape the storage root. Belt-and-braces: keys are
 * server-generated, so this should never fire — but a driver must not trust its
 * input either.
 */
export function assertSafeKey(key: string): void {
  if (
    !key ||
    key.startsWith("/") ||
    key.includes("..") ||
    key.includes("\\") ||
    key.includes("\0")
  ) {
    throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
  }
}

let cached: Storage | null = null;

export function getStorage(): Storage {
  if (cached) return cached;

  switch (env.storageDriver) {
    case "s3":
      // Throws at construction if S3_BUCKET is missing — a misconfigured server
      // should fail at boot, not silently write attachments to local disk.
      cached = createS3Storage();
      return cached;
    case "local":
    default:
      cached = createLocalStorage(env.storageLocalDir);
      return cached;
  }
}

/** Reset the memoized driver. Test-only; production selects a driver once. */
export function resetStorageForTests(): void {
  cached = null;
}
