/**
 * Amazon S3 storage driver — the only attachment store.
 *
 * Two deliberate choices:
 *
 *  * **Bytes stream through the app on download, not via a presigned URL.**
 *    `GET /api/v1/attachments/:id/download` authorizes the caller against the
 *    owning project before a single byte moves. A presigned URL would be a bearer
 *    credential anyone could forward for its lifetime, and the objects stay
 *    private either way. Attachments are capped at 25 MB, so proxying is cheap.
 *  * **Credentials are resolved once**, from `S3_ACCESS_KEY_ID` /
 *    `S3_SECRET_ACCESS_KEY` if set, else the shared `AWS_*` pair, else the SDK's
 *    default provider chain. A separate S3 key means the attachment credential
 *    cannot send mail. An instance role is still better in production — a static
 *    key in `.env` is a long-lived secret that has to be rotated by hand.
 *
 * The bucket itself must stay private: Block Public Access on, no public policy.
 * Nothing here grants public reads, and the download route is the only reader.
 */

import type {
  GetObjectCommandOutput,
  S3Client,
} from "@aws-sdk/client-s3";

import { resolveAwsCredentials } from "@/lib/aws-credentials";
import { env } from "@/lib/env";

import { assertSafeKey, type PutResult, type Storage } from "./index";

export function createS3Storage(): Storage {
  const bucket = env.s3Bucket;
  const region = env.s3Region;

  if (!bucket) {
    throw new Error(
      "S3_BUCKET is not set. Attachments are stored in S3 only — there is no local fallback, so this must be a real private bucket.",
    );
  }

  // Optional prefix so one bucket can host several environments without them
  // colliding, e.g. S3_PREFIX="staging".
  const prefix = env.s3Prefix?.replace(/^\/+|\/+$/g, "") ?? "";

  /** Apply the environment prefix to an already-validated key. */
  function objectKey(key: string): string {
    assertSafeKey(key);
    return prefix ? `${prefix}/${key}` : key;
  }

  // Imported lazily and cached, so the SDK is never loaded under the local driver.
  let clientPromise: Promise<S3Client> | null = null;

  // S3-specific key if provided, else the shared AWS one, else the instance role.
  // Resolved eagerly so a half-configured pair throws when the driver is built,
  // not on the first upload.
  const credentials = resolveAwsCredentials("S3");

  async function getClient(): Promise<S3Client> {
    if (!clientPromise) {
      clientPromise = import("@aws-sdk/client-s3").then(
        ({ S3Client: Client }) =>
          new Client({
            region,
            // Omitted entirely when unset, so the SDK's default provider chain
            // takes over rather than being handed an empty credentials object.
            ...(credentials ? { credentials } : {}),
            // Set only for S3-compatible endpoints (MinIO, LocalStack); unset for
            // real S3 so the SDK resolves the regional endpoint itself.
            ...(env.s3Endpoint
              ? { endpoint: env.s3Endpoint, forcePathStyle: true }
              : {}),
          }),
      );
    }
    return clientPromise;
  }

  return {
    async put(key, body, mimeType): Promise<PutResult> {
      const [client, { PutObjectCommand }] = await Promise.all([
        getClient(),
        import("@aws-sdk/client-s3"),
      ]);

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey(key),
          Body: body,
          ContentType: mimeType,
          // Content-Length is set explicitly: without it the SDK may fall back to
          // chunked encoding, which some S3-compatible endpoints reject.
          ContentLength: body.byteLength,
          // Encryption at rest. SSE-S3 by default; SSE-KMS when a key is given.
          ...(env.s3KmsKeyId
            ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: env.s3KmsKeyId }
            : { ServerSideEncryption: "AES256" }),
        }),
      );

      return { key, size: body.byteLength };
    },

    async get(key): Promise<ReadableStream<Uint8Array>> {
      const [client, { GetObjectCommand }] = await Promise.all([
        getClient(),
        import("@aws-sdk/client-s3"),
      ]);

      const response: GetObjectCommandOutput = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }),
      );

      if (!response.Body) {
        throw new Error(`S3 object has no body: ${key}`);
      }

      // The SDK's stream mixin converts the Node stream to a web stream, which is
      // what the route handler returns directly.
      return response.Body.transformToWebStream();
    },

    async delete(key): Promise<void> {
      const [client, { DeleteObjectCommand }] = await Promise.all([
        getClient(),
        import("@aws-sdk/client-s3"),
      ]);

      // S3 DeleteObject is idempotent — deleting a missing key succeeds, which is
      // what we want: a retried delete must not error.
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(key) }),
      );
    },
  };
}
