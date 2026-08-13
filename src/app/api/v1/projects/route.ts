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
    // Everyone may read the projects they can see; only an ADMIN creates one.
    if (!canCreateProject(ctx.role)) {
      throw forbidden("Only an admin can create a project.");
    }
    return ctx;
  },
  async (ctx, req) => createProject(ctx, await readJson(req, createProjectSchema)),
  { successStatus: 201 },
);
