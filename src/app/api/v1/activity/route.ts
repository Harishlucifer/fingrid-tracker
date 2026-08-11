import { requireProjectAccess, requireSession } from "@/server/auth/guards";
import { badRequest } from "@/server/http/errors";
import { withApiHandler } from "@/server/http/handler";
import { parsePagination } from "@/server/http/pagination";
import { listActivity } from "@/server/services/comment.service";

export const runtime = "nodejs";

/**
 * Activity feed. A `project_id` is required and access-checked — without it the
 * endpoint would expose activity across projects the caller cannot see.
 */
export const GET = withApiHandler(
  async (req) => {
    const projectId = req.nextUrl.searchParams.get("project_id");
    if (!projectId) throw badRequest("project_id is required.");
    await requireProjectAccess(projectId, "VIEW");
    return requireSession();
  },
  async (_ctx, req) => {
    const params = req.nextUrl.searchParams;
    return listActivity(
      {
        projectId: params.get("project_id") ?? undefined,
        entityType: params.get("entity_type") ?? undefined,
        entityId: params.get("entity_id") ?? undefined,
      },
      parsePagination(params),
    );
  },
);
