/**
 * Attachment storage. **Amazon S3 only** — there is no local-disk driver.
 *
 * The interface is kept (rather than calling the SDK from the service layer)
 * because it is what keeps the S3 specifics in one file: the service does
 * `getStorage().put(...)` and knows nothing about buckets, encryption or
 * credentials. It also leaves room for an S3-compatible endpoint via
 * `S3_ENDPOINT` without touching a call site.
 */

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

/**
 * The S3 driver, constructed once.
 *
 * Throws if `S3_BUCKET` is unset. That happens the first time attachment storage
 * is touched rather than at process start — env access is lazy, which is what
 * keeps `next build` working without secrets present. The error names the missing
 * variable, so a misconfigured deployment is obvious the first time anyone
 * uploads, instead of writing bytes somewhere they will be lost.
 */
export function getStorage(): Storage {
  if (cached) return cached;
  cached = createS3Storage();
  return cached;
}

/** Reset the memoized driver. Test-only; production constructs it once. */
export function resetStorageForTests(): void {
  cached = null;
}
