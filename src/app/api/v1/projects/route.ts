import { canCreateProject } from "@/lib/permissions";
import { requireSession } from "@/server/auth/guards";
import { forbidden } from "@/server/http/errors";
import { readJson, withApiHandler } from "@/server/http/handler";
import { parsePagination } from "@/server/http/pagination";
import {
  createProject,
  createProjectSchema,
  listProjects,
} from "@/server/services/project.service";

export const runtime = "nodejs";

export const GET = withApiHandler(
  () => requireSession(),
  async (ctx, req) => listProjects(ctx, parsePagination(req.nextUrl.searchParams)),
);

export const POST = withApiHandler(
  async () => {
    const ctx = await requireSession();
    // VIEWERs may read projects but not create them.
    if (!canCreateProject(ctx.role)) {
      throw forbidden("Your role cannot create projects.");
    }
    return ctx;
  },
  async (ctx, req) => createProject(ctx, await readJson(req, createProjectSchema)),
  { successStatus: 201 },
);
