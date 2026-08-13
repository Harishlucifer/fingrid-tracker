/**
 * Authorized inline preview of an attachment.
 *
 * The sibling `download` route exists because serving user-uploaded bytes
 * inline from our own origin is the classic stored-XSS path. This route does
 * serve inline, so it buys that back with four rules, all of them enforced here
 * rather than trusted from the client:
 *
 *  1. **Allowlist.** Only the types in `PREVIEWABLE_MIME_TYPES` are served at
 *     all; anything else is refused with 415 and stays download-only. `image/svg+xml`
 *     is uploadable but absent from that list on purpose — an SVG can carry
 *     script, and inline it would run as same-origin code in the viewer's session.
 *  2. **The content type is ours, not theirs.** It comes from the allowlist,
 *     never from the stored row, so an uploader cannot pick how their bytes are
 *     interpreted. Text and JSON are flattened to `text/plain`.
 *  3. **`nosniff`**, so a browser cannot decide the bytes look like HTML.
 *  4. **A restrictive CSP with `sandbox`**, which puts the response in an opaque
 *     origin with no script execution — defence in depth for the one allowlisted
 *     format that has an embedded interpreter, PDF.
 *
 * Authorization is identical to download and happens before a byte is streamed:
 * the objects live in a private bucket and the app issues no presigned URLs, so
 * this and `download` remain the only paths to the bytes.
 */

import { NextResponse } from "next/server";

import { PREVIEWABLE_MIME_TYPES } from "@/lib/constants";
import { requireSession } from "@/server/auth/guards";
import { ErrorCodes } from "@/server/http/codes";
import { AppError } from "@/server/http/errors";
import { getAttachmentForDownload } from "@/server/services/attachment.service";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message, request_id: "preview" } },
    { status },
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  try {
    const ctx = await requireSession();
    const { attachmentId } = await params;

    const attachment = await getAttachmentForDownload(ctx, attachmentId);

    const contentType = PREVIEWABLE_MIME_TYPES[attachment.mimeType];
    if (!contentType) {
      return errorResponse(
        415,
        ErrorCodes.UPLOAD_NOT_PREVIEWABLE,
        "This file type cannot be previewed. Download it instead.",
      );
    }

    const stream = await getStorage().get(attachment.storageKey);

    return new NextResponse(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(attachment.sizeBytes),
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        // Private: this URL is per-user authorized, so no shared cache may keep it.
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.status, error.code, error.message);
    }

    console.error("[attachment] preview failed", error);
    return errorResponse(500, ErrorCodes.INTERNAL, "Internal server error");
  }
}
