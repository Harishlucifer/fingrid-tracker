/**
 * Authorized attachment download.
 *
 * This route is the ONLY way to read an attachment: objects live in a private S3
 * bucket with no public policy, and the app hands out no presigned URLs — so
 * there is no path to the bytes that skips this check. Access is verified before
 * a single byte is streamed.
 */

import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/guards";
import { AppError } from "@/server/http/errors";
import { getAttachmentForDownload } from "@/server/services/attachment.service";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  try {
    const ctx = await requireSession();
    const { attachmentId } = await params;

    const attachment = await getAttachmentForDownload(ctx, attachmentId);
    const stream = await getStorage().get(attachment.storageKey);

    return new NextResponse(stream, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(attachment.sizeBytes),
        // `attachment` (not inline) so an uploaded SVG or HTML file cannot
        // execute as same-origin script in the viewer's session.
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        // Private: this URL is per-user authorized, so no shared cache may keep it.
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            request_id: "download",
          },
        },
        { status: error.status },
      );
    }

    console.error("[attachment] download failed", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_001",
          message: "Internal server error",
          request_id: "download",
        },
      },
      { status: 500 },
    );
  }
}
